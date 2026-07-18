// scripts/spawn-flow.js — shared client-side spawn-flow runner.
//
// Plan 3: signature changed from `runSpawnFlow(template, defaultSourceActorId?)`
// to `runSpawnFlow(ctx)` where ctx = { template, variantId, castSlotLevel,
// sourcePlayerId, sourceActor }. The variant picker is the universal entry
// point; manager-app + spell-trigger now open the picker which in turn calls
// this. The legacy spawn-app.js + spawn.hbs are removed.
//
// The runner: runs restriction pre-check → activates the placement overlay →
// posts a chat-broker request → updates the caller's recent-spawn-timestamps
// for the anti-spam window.

import { activatePlacement } from "./placement-overlay.js";
import { postBrokerRequest } from "./chat-broker.js";
import { checkRestrictions } from "./spawn-engine.js";
import { getActiveManager } from "./manager-app.js";
import { s } from "./settings.js";

const MODULE_ID = "luxurious-summons";

/**
 * Runs one placement + spawn request.
 *
 * Returns an outcome object so multi-placement callers (variant-picker-app.js's
 * multi-spawn loop) can distinguish "the user cancelled — stop the whole
 * sequence" from "this one spawn didn't happen for an unrelated reason (no
 * template, no source actor, restriction check failed) — but a subsequent one
 * in the same batch might still be fine." v0.4.6 FIX 10.
 *
 *   { outcome: "spawned" }    — broker request posted successfully
 *   { outcome: "cancelled" }  — user pressed ESC / a competing overlay preempted
 *   { outcome: "blocked", reason } — template missing, no source actor, or a
 *                                     restriction (cap/antispam) rejected the spawn
 */
export async function runSpawnFlow(ctx) {
  const {
    template,
    variantId = null,
    castSlotLevel = null,
    sourcePlayerId = game.user.id,
    sourceActor = game.user.character
  } = ctx;

  if (!template) {
    console.warn(`[${MODULE_ID}] runSpawnFlow called without template`);
    return { outcome: "blocked", reason: "no-template" };
  }
  if (!sourceActor) {
    ui.notifications?.warn(game.i18n.localize("LUXSUM.Spawn.NoSourceActor") || `[${MODULE_ID}] no source actor — assign a character to your user first.`);
    return { outcome: "blocked", reason: "no-source-actor" };
  }

  // Restrictions pre-check, enforced HERE ONLY, on the requester's own client,
  // against the defensively-filtered index below.
  //
  // v0.4.6 FIX 11: this comment previously claimed "the broker re-checks
  // authoritatively on the GM client" — that's false. spawn-engine.js's
  // performSpawn() (the function registered as the broker's "spawn" handler,
  // run on the primary-GM client) never calls checkRestrictions at all. A
  // player who bypasses this client-side check (mods, a stale index, a race
  // between two rapid casts before recentSpawnTimestamps updates) can still
  // get a broker-side spawn through uncontested. A GM-side authoritative
  // re-check inside performSpawn is a known TODO, not yet implemented — this
  // pass only corrects the misleading comment; see FIX 11 in the v0.4.6 spec.
  // Defensive: filter out stale entries (actor no longer exists in game.actors).
  const rawActiveCompanions = game.user.flags?.[MODULE_ID]?.activeCompanions ?? [];
  const activeCompanions = rawActiveCompanions.filter(entry => game.actors.get(entry.actorId));
  if (activeCompanions.length !== rawActiveCompanions.length) {
    console.warn(`[${MODULE_ID}] activeCompanions index had ${rawActiveCompanions.length - activeCompanions.length} stale entr${rawActiveCompanions.length - activeCompanions.length === 1 ? "y" : "ies"}; filtered for restriction check`);
  }
  const recentSpawnTimestamps = game.user.flags?.[MODULE_ID]?.recentSpawnTimestamps ?? [];
  const config = {
    globalCap: s("globalActiveCapPerPlayer"),
    antispamMax: s("antispamMaxSpawnsPerWindow"),
    antispamWindowSeconds: s("antispamWindowSeconds")
  };
  const verdict = checkRestrictions({
    template, activeCompanions, recentSpawnTimestamps, now: Date.now(), config
  });
  if (!verdict.allowed) {
    ui.notifications?.warn(verdict.message);
    return { outcome: "blocked", reason: verdict.reason };
  }

  // Minimize any windows that sit over the canvas and occlude the placement preview:
  //   - the Manager (existing pattern from v0.1.7)
  //   - the caster's character sheet (paid for in v0.4.2 — cast-driven flow
  //     leaves the spellbook open in front of the canvas)
  //   - any item sheets owned by the caster (the spell item itself, if open)
  // We collect them up front, minimize all, and restore in finally so we
  // always recover even if placement throws.
  const toMinimize = [];
  const manager = getActiveManager();
  if (manager) toMinimize.push(manager);
  if (sourceActor?.sheet?.rendered) toMinimize.push(sourceActor.sheet);
  if (sourceActor?.items) {
    for (const item of sourceActor.items) {
      if (item.sheet?.rendered && !toMinimize.includes(item.sheet)) toMinimize.push(item.sheet);
    }
  }
  for (const app of toMinimize) {
    try { await app.minimize(); } catch (e) {
      console.log(`[${MODULE_ID}] minimize ${app.constructor?.name} during placement failed: ${e.message}`);
    }
  }
  if (toMinimize.length > 0) {
    console.log(`[${MODULE_ID}] minimized ${toMinimize.length} window(s) during placement: ${toMinimize.map(a => a.constructor?.name).join(", ")}`);
  }

  let placements;
  try {
    placements = await activatePlacement({
      tokenWidth: canvas.grid.size,
      tokenHeight: canvas.grid.size,
      thumbnailSrc: template.thumbnail,
      count: 1,                                  // multi-spawn loops one cast at a time
      label: game.i18n.format("LUXSUM.Spawn.PlacementLabel", { templateName: template.name })
    });
  } finally {
    for (const app of toMinimize) {
      try { await app.maximize(); } catch (e) {
        console.log(`[${MODULE_ID}] maximize ${app.constructor?.name} after placement failed: ${e.message}`);
      }
    }
  }
  // v0.4.6 FIX 10: activatePlacement now resolves `null` (not `[]`) on ESC /
  // preemption, so this check unambiguously means "the user cancelled" — no
  // longer conflated with "count was somehow already satisfied with zero
  // clicks," which never happens with count:1 but was a latent ambiguity.
  if (!placements) {
    console.log(`[${MODULE_ID}] runSpawnFlow: placement cancelled by user`);
    return { outcome: "cancelled" };
  }

  const payload = {
    templateId: template.id,
    variantId,
    castSlotLevel,
    sourceActorId: sourceActor.id,
    sourcePlayerId,
    placements,
    visualOverrides: undefined
  };

  // Track local timestamp for the anti-spam rolling window — counted for
  // approval REQUESTS too, so a spam-clicker can't flood the GM with cards.
  const ts = Date.now();
  const windowMs = config.antispamWindowSeconds * 1000;
  const updatedRecent = [...recentSpawnTimestamps, ts].filter(t => ts - t <= windowMs);
  await game.user.update({ [`flags.${MODULE_ID}.recentSpawnTimestamps`]: updatedRecent });

  // v0.7.0 D-mode: if this spawn needs GM approval, post the approval card
  // (payload carries the already-chosen placement) instead of the spawn request.
  const { needsGmApproval, postApprovalRequest } = await import("./approval.js");
  if (needsGmApproval({
    isGM: game.user.isGM,
    requireAll: s("requireApprovalForAllSpawns") === true,
    templateRequires: template.requiresApproval === true
  })) {
    const variantName = variantId ? (template.variants ?? []).find(v => v.id === variantId)?.name : null;
    await postApprovalRequest(payload, {
      templateName: template.name,
      variantName,
      sceneName: canvas.scene?.name ?? ""
    });
    ui.notifications?.info(game.i18n.localize("LUXSUM.Approval.Pending"));
    return { outcome: "pending-approval" };
  }

  // Hand off to the primary GM client via chat-broker
  await postBrokerRequest("spawn", payload);

  return { outcome: "spawned" };
}
