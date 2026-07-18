// scripts/approval.js — D-mode GM approval flow (v0.7.0, Plan 4 slice 3).
//
// Flow (player pre-places — locked user decision):
//   1. Player runs the normal spawn flow: picker → placement ghost → click.
//   2. If approval is required (world setting `requireApprovalForAllSpawns` OR
//      the template's `requiresApproval`, and the requester is not a GM),
//      spawn-flow posts an APPROVAL CARD instead of the "spawn" broker request.
//      The card carries the complete, already-placed spawn payload (including
//      coordinates) in its message flags — the same payload shape the broker's
//      "spawn" handler (performSpawn) consumes.
//   3. The card is whispered to all GMs + the requester. Approve/Deny buttons
//      render for GMs only (renderChatMessage + renderChatMessageHTML — both
//      registered for V13/V14 cross-compat; jQuery vs HTMLElement handled).
//   4. Approve → the CLICKING GM's client runs performSpawn(payload) directly
//      (GM has document authority; no broker hop, no primary-GM election —
//      the click IS the election). Deny → no spawn. Either way the card is
//      updated to its decided state and the requester gets a whispered result.
//
// RAW note: the spell slot was consumed at cast time (postUseActivity fires
// after consumption — the standing trade-off from v0.1.x). A denied request
// does NOT auto-refund the slot; the GM adjudicates manually if they care.
//
// Two-GM race: both clicking within the same instant could double-spawn. The
// click handler disables the buttons immediately and re-reads the message's
// live status before executing, which closes everything but a sub-millisecond
// tie between two GM clients — accepted.

import { s } from "./settings.js";

const MODULE_ID = "luxurious-summons";

/**
 * Pure-logic. Does this spawn need GM approval? GMs never need approval of
 * their own spawns.
 */
export function needsGmApproval({ isGM, requireAll, templateRequires }) {
  if (isGM === true) return false;
  return requireAll === true || templateRequires === true;
}

function esc(str) {
  return String(str ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function buildCardHtml(display, status, deciderName = null) {
  const title = game.i18n.localize("LUXSUM.Approval.CardTitle");
  const lines = [
    `<div class="luxsum-approval-card" data-status="${status}">`,
    `<div class="luxsum-approval-title">✦ ${esc(title)}</div>`,
    `<div class="luxsum-approval-body">`,
    `<strong>${esc(display.requesterName)}</strong> → ${esc(display.templateName)}${display.variantName ? ` (${esc(display.variantName)})` : ""}`,
    display.sceneName ? `<div class="luxsum-approval-meta">Scene: ${esc(display.sceneName)} · spot already chosen</div>` : "",
    `</div>`
  ];
  if (status === "pending") {
    lines.push(
      `<div class="luxsum-approval-actions">`,
      `<button type="button" data-luxsum-approval="approve">${game.i18n.localize("LUXSUM.Approval.Approve")}</button>`,
      `<button type="button" data-luxsum-approval="deny">${game.i18n.localize("LUXSUM.Approval.Deny")}</button>`,
      `</div>`
    );
  } else {
    const verdict = status === "approved" ? "✓ Approved" : "✗ Denied";
    lines.push(`<div class="luxsum-approval-verdict luxsum-approval-${status}">${verdict}${deciderName ? ` — ${esc(deciderName)}` : ""}</div>`);
  }
  lines.push(`</div>`);
  return lines.join("");
}

/**
 * Requester-side. Post the approval card (players can create chat messages).
 * `payload` must be the exact shape performSpawn consumes.
 */
export async function postApprovalRequest(payload, display) {
  const gmIds = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
  const fullDisplay = { ...display, requesterName: game.user.name };
  await ChatMessage.create({
    content: buildCardHtml(fullDisplay, "pending"),
    whisper: [...new Set([...gmIds, game.user.id])],
    flags: {
      [MODULE_ID]: {
        approvalRequest: {
          status: "pending",
          payload,
          display: fullDisplay,
          requesterId: game.user.id,
          requestedAt: Date.now()
        }
      }
    },
    style: CONST.CHAT_MESSAGE_STYLES?.OTHER ?? 0
  });
  console.log(`[${MODULE_ID}] approval request posted for template "${payload.templateId}" by ${game.user.name}`);
}

async function handleDecision(message, approve) {
  if (!game.user.isGM) return;
  // Re-read live state — another GM may have decided while this card sat open.
  const live = game.messages.get(message.id);
  const req = live?.flags?.[MODULE_ID]?.approvalRequest;
  if (!req || req.status !== "pending") {
    console.log(`[${MODULE_ID}] approval decision ignored — request already ${req?.status ?? "gone"}`);
    return;
  }
  const status = approve ? "approved" : "denied";
  console.log(`[${MODULE_ID}] approval: ${game.user.name} ${status} request from ${req.display?.requesterName} (${req.payload?.templateId})`);

  if (approve) {
    try {
      const { performSpawn } = await import("./spawn-engine.js");
      await performSpawn(req.payload);
    } catch (e) {
      console.error(`[${MODULE_ID}] approved spawn failed:`, e);
      ui.notifications?.error(`Approved spawn failed: ${e.message}`);
      return; // leave the card pending so the GM can retry after fixing the cause
    }
  }

  await live.update({
    content: buildCardHtml(req.display, status, game.user.name),
    [`flags.${MODULE_ID}.approvalRequest.status`]: status
  });

  const key = approve ? "LUXSUM.Approval.Approved" : "LUXSUM.Approval.Denied";
  await ChatMessage.create({
    content: `<em>[Luxurious Summons] ${game.i18n.format(key, { name: req.display?.templateName ?? req.payload?.templateId })}</em>`,
    whisper: [req.requesterId],
    style: CONST.CHAT_MESSAGE_STYLES?.OTHER ?? 0
  });
}

/**
 * Wire the card buttons. Registered for BOTH the V13 and V14 render hooks;
 * handler signature differs (jQuery vs raw HTMLElement) — feature-detected.
 */
export function installApprovalHooks() {
  const onRender = (message, html) => {
    const el = html instanceof HTMLElement ? html : html?.[0];
    if (!el) return;
    const req = message.flags?.[MODULE_ID]?.approvalRequest;
    if (!req) return;
    const buttons = el.querySelectorAll("[data-luxsum-approval]");
    if (req.status !== "pending" || !game.user.isGM) {
      buttons.forEach(b => { b.style.display = "none"; });
      return;
    }
    buttons.forEach(b => {
      b.addEventListener("click", () => {
        buttons.forEach(x => { x.disabled = true; });
        handleDecision(message, b.dataset.luxsumApproval === "approve");
      });
    });
  };
  Hooks.on("renderChatMessage", onRender);       // V13
  Hooks.on("renderChatMessageHTML", onRender);   // V14
  console.log(`[${MODULE_ID}] approval-card hooks registered (renderChatMessage + renderChatMessageHTML)`);
}
