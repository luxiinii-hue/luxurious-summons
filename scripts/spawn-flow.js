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

  // The Manager (if open) sits over the canvas and occludes the placement preview.
  // Minimize it for the duration of the placement step and restore in finally so we
  // always recover even if placement throws.
  const manager = getActiveManager();
  if (manager) {
    await manager.minimize();
    console.log(`[${MODULE_ID}] minimized manager during placement`);
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
    if (manager) {
      await manager.maximize();
      console.log(`[${MODULE_ID}] maximized manager after placement`);
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
