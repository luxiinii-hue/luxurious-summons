// scripts/chat-broker.js — player↔GM coordination via chat-message flags
//
// Why chat messages and not game.socket.emit? Per parent-workspace CLAUDE.md
// gotcha: "game.socket.emit can drop messages silently cross-client in V14
// with no error trace. For replicated state, prefer ChatMessage.create + flag
// pattern."
const MODULE_ID = "luxurious-summons";

// Pure-logic primary-GM election. Lowest sorted id among active GMs wins.
// Used by every GM client to determine if THEY are the one acting on a request.
export function electPrimaryGM(users) {
  const activeGMs = users.filter(u => u.isGM && u.active);
  if (activeGMs.length === 0) return null;
  activeGMs.sort((a, b) => a.id.localeCompare(b.id));
  return activeGMs[0].id;
}

export function isPrimaryGM() {
  if (!game.user.isGM) return false;
  const primaryId = electPrimaryGM(game.users.contents);
  return primaryId === game.user.id;
}

// Player calls this to ask the GM to perform a privileged action.
// `kind` distinguishes spawn vs other future broker actions.
// `payload` carries everything the GM needs to perform the action.
export async function postBrokerRequest(kind, payload) {
  const requestedAt = Date.now();
  const flagPayload = { kind, payload, requestedAt, requesterId: game.user.id };
  const msg = await ChatMessage.create({
    content: `<em>[luxurious-summons] ${game.user.name} requests: ${kind}</em>`,
    flags: { [MODULE_ID]: { brokerRequest: flagPayload } },
    whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id),  // GM-only
    style: CONST.CHAT_MESSAGE_STYLES?.OTHER ?? 0
  });
  console.log(`[${MODULE_ID}] broker request posted: kind=${kind}, msg.id=${msg.id}`);
  return msg;
}

// Per-kind handlers register here at module load (handler files self-register on import).
const _handlers = new Map();

export function registerBrokerHandler(kind, handler) {
  _handlers.set(kind, handler);
}

// Wired in main.js — fires on every client when a chat message arrives.
// Each GM client checks: am I the primary? Then routes the request.
export function installBrokerHook() {
  Hooks.on("createChatMessage", async (msg) => {
    const req = msg.flags?.[MODULE_ID]?.brokerRequest;
    if (!req) return;
    if (!isPrimaryGM()) return;     // only the primary acts
    const handler = _handlers.get(req.kind);
    if (!handler) {
      console.warn(`[${MODULE_ID}] broker request for unknown kind: ${req.kind}`);
      return;
    }
    console.log(`[${MODULE_ID}] primary GM handling broker request kind=${req.kind}`);
    try {
      const result = await handler(req.payload, req);
      // Confirmation message — tells the requester it succeeded
      await ChatMessage.create({
        content: `<em>[luxurious-summons] ${req.kind} handled.</em>`,
        flags: { [MODULE_ID]: { brokerConfirm: { requesterId: req.requesterId, kind: req.kind, result } } },
        whisper: [req.requesterId, game.user.id],
        style: CONST.CHAT_MESSAGE_STYLES?.OTHER ?? 0
      });
      // Clean up the request message
      await msg.delete();
    } catch (err) {
      console.error(`[${MODULE_ID}] broker handler threw for kind=${req.kind}:`, err);
      ui.notifications?.error(`[${MODULE_ID}] broker request failed: ${err.message}`);
      // v0.7.3: tell the REQUESTER too. The handler runs on the GM's client, so
      // before this the player who asked for the spawn saw an empty canvas and
      // no error anywhere — the failure was invisible to the only person
      // watching for a result.
      if (req.requesterId && req.requesterId !== game.user.id) {
        await ChatMessage.create({
          content: `<em>[Luxurious Summons] Your ${req.kind} request failed on the GM's client: ${err.message}</em>`,
          whisper: [req.requesterId, game.user.id],
          style: CONST.CHAT_MESSAGE_STYLES?.OTHER ?? 0
        }).catch(e => console.warn(`[${MODULE_ID}] could not whisper failure to requester: ${e.message}`));
      }
    }
  });
}
