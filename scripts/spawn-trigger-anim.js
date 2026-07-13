// scripts/spawn-trigger-anim.js — drawToken hook handler that plays a spawn
// animation once when a freshly-spawned companion token appears on canvas.
//
// The actor flag `spawnState: "pending-spawn"` is set by performSpawn after
// token creation. This handler reads it, plays the right effect via the
// template + variant override resolution chain, and (on the primary-GM client
// only) clears the flag so subsequent drawToken events (scene reload, token
// reveal) don't re-play.
//
// v0.4.6 FIX 5 — two bugs in the original implementation:
//
// 1. `drawToken` fires on EVERY connected client, including clients that don't
//    own the actor. `token.actor.unsetFlag(...)` on a non-owner client throws
//    "User lacks permission to update Actor" — an unhandled rejection on every
//    single spawn, on every non-owner client (which is most clients most of
//    the time: any GM watching a player's summon, or vice versa).
// 2. The client-scope "enableDeathAnimations" setting is per-client by design
//    (a performance escape hatch), but the old code cleared the flag as soon
//    as ANY client with the setting disabled saw the token — including the
//    primary GM. That raced the flag-clear against every other client's
//    drawToken handler and could suppress the spawn animation for everyone,
//    not just the client that opted out.
//
// Fix: the client-scope setting gates LOCAL PLAYBACK ONLY, never flag writes.
// A per-client one-shot Set (keyed by token id) guards against replaying the
// animation on redundant drawToken fires within the same client session
// (panning off/onscreen, scene reload). Flag clearing is restricted to the
// primary-GM client (electPrimaryGM — same election already used by
// chat-broker.js) and always wrapped so a permission failure just warns
// instead of leaving an unhandled rejection.

import { readEffects } from "./data-model.js";
import { markAnimating, clearAnimating } from "./anim-state.js";
import { electPrimaryGM } from "./chat-broker.js";

const MODULE_ID = "luxurious-summons";

// Per-client, not per-actor — a fresh session (reload) gets a fresh Set, which
// is correct: a token reappearing after reload with spawnState still set
// (e.g. the primary-GM clear failed) should still get one more play attempt
// on this client rather than being silently skipped forever.
const _alreadyAnimatedTokenIds = new Set();

function isPrimaryGmClient() {
  if (!game.user.isGM) return false;
  return electPrimaryGM(game.users.contents) === game.user.id;
}

/**
 * Clear the spawnState flag. Primary-GM-only (world-actor writes are
 * GM-gated regardless of OWNER permission — same rule as the dismiss broker).
 * Swallows permission errors into a warn-log instead of an unhandled rejection.
 */
async function clearSpawnStateFlag(actor) {
  if (!isPrimaryGmClient()) return;
  try {
    await actor.unsetFlag(MODULE_ID, "spawnState");
  } catch (e) {
    console.warn(`[${MODULE_ID}] clearSpawnStateFlag: unsetFlag failed for ${actor.id} (${actor.name}): ${e.message}`);
  }
}

export async function maybeRunSpawnAnimation(token) {
  const flag = token.actor?.flags?.[MODULE_ID];
  if (flag?.spawnState !== "pending-spawn") return;

  if (_alreadyAnimatedTokenIds.has(token.id)) {
    // Already played (or attempted) locally this session — don't replay, but
    // still let the primary GM clear the flag below in case an earlier
    // attempt's clear failed.
    await clearSpawnStateFlag(token.actor);
    return;
  }
  _alreadyAnimatedTokenIds.add(token.id);

  if (!game.settings.get(MODULE_ID, "enableDeathAnimations")
      || game.settings.get(MODULE_ID, "gmForceDisableSpawnDeathAnims")) {
    // Client-scope "fancy effects" gate + the GM's world-wide kill switch
    // (v0.6.0) — both gate LOCAL PLAYBACK ONLY. Must never short-circuit the
    // flag clear in a way that races other clients; the primary-GM clear below
    // runs regardless of either setting. (The world switch is symmetric across
    // clients, so unlike a client-scope early-clear it cannot suppress the
    // animation for clients that wanted it — everyone skips together.)
    console.log(`[${MODULE_ID}] maybeRunSpawnAnimation: animations disabled (client or GM world switch) — skipping local playback for ${token.actor?.name}`);
    await clearSpawnStateFlag(token.actor);
    return;
  }

  const { templates } = await import("./templates-builtin.js");
  const template = templates.find(t => t.id === flag.templateId);
  if (!template) {
    console.warn(`[${MODULE_ID}] maybeRunSpawnAnimation: template "${flag.templateId}" not found`);
    await clearSpawnStateFlag(token.actor);
    return;
  }
  const effects = readEffects(template);
  const variant = flag.variantId ? (template.variants ?? []).find(v => v.id === flag.variantId) : null;
  const spawnId = variant?.spawnEffectOverride ?? effects.spawn;
  if (!spawnId) {
    // No spawn animation configured (e.g., legacy template) — just clear the flag.
    await clearSpawnStateFlag(token.actor);
    return;
  }
  const { spawnAnimations } = await import("./spawn-animations.js");
  const handler = spawnAnimations[spawnId];
  if (!handler) {
    console.warn(`[${MODULE_ID}] maybeRunSpawnAnimation: no animation registered for "${spawnId}"`);
    await clearSpawnStateFlag(token.actor);
    return;
  }
  console.log(`[${MODULE_ID}] playing spawn animation "${spawnId}" for ${token.actor.name}`);
  // Mark SYNCHRONOUSLY (before any await) so the motion ticker's very next
  // frame already sees isAnimating(token.id) === true and skips its lazy base
  // snapshot. try/finally guarantees the mark clears even if the animation
  // throws — otherwise the token would be permanently excluded from motion.
  // v0.4.6 FIX 1.
  markAnimating(token.id);
  try {
    await handler(token);
  } catch (e) {
    console.warn(`[${MODULE_ID}] spawn animation "${spawnId}" threw:`, e);
  } finally {
    clearAnimating(token.id);
  }
  await clearSpawnStateFlag(token.actor);
}
