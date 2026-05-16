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
    return;
  }
  if (!sourceActor) {
    ui.notifications?.warn(game.i18n.localize("LUXSUM.Spawn.NoSourceActor") || `[${MODULE_ID}] no source actor — assign a character to your user first.`);
    return;
  }

  // Restrictions pre-check (broker re-checks authoritatively on the GM client).
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
    return;
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
  if (!placements || placements.length === 0) return;     // user cancelled (ESC)

  // Hand off to the primary GM client via chat-broker
  await postBrokerRequest("spawn", {
    templateId: template.id,
    variantId,
    castSlotLevel,
    sourceActorId: sourceActor.id,
    sourcePlayerId,
    placements,
    visualOverrides: undefined
  });

  // Track local timestamp for the anti-spam rolling window
  const ts = Date.now();
  const windowMs = config.antispamWindowSeconds * 1000;
  const updatedRecent = [...recentSpawnTimestamps, ts].filter(t => ts - t <= windowMs);
  await game.user.update({ [`flags.${MODULE_ID}.recentSpawnTimestamps`]: updatedRecent });
}
