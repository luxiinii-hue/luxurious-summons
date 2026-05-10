// scripts/spawn-flow.js — shared client-side spawn-flow runner.
//
// Used by:
//   - ManagerApp's template-card click (defaultSourceActorId omitted → player's character)
//   - spell-trigger.js's dnd5e.useItem hook (defaultSourceActorId = casting actor)
//
// The runner: opens the Spawn Dialog → on Place runs restriction pre-check →
// activates the placement overlay → posts a chat-broker request → updates the
// caller's recent-spawn-timestamps for the anti-spam window.

import { openSpawnDialog } from "./spawn-app.js";
import { activatePlacement } from "./placement-overlay.js";
import { postBrokerRequest } from "./chat-broker.js";
import { checkRestrictions } from "./spawn-engine.js";
import { s } from "./settings.js";

const MODULE_ID = "luxurious-summons";

export function runSpawnFlow(template, defaultSourceActorId = null) {
  openSpawnDialog({
    template,
    defaultSourceActorId,
    onPlace: async ({ template: tpl, sourceActorId }) => {
      // Restrictions pre-check (broker re-checks authoritatively on the GM client)
      const activeCompanions = game.user.flags?.[MODULE_ID]?.activeCompanions ?? [];
      const recentSpawnTimestamps = game.user.flags?.[MODULE_ID]?.recentSpawnTimestamps ?? [];
      const config = {
        globalCap: s("globalActiveCapPerPlayer"),
        antispamMax: s("antispamMaxSpawnsPerWindow"),
        antispamWindowSeconds: s("antispamWindowSeconds")
      };
      const verdict = checkRestrictions({
        template: tpl, activeCompanions, recentSpawnTimestamps, now: Date.now(), config
      });
      if (!verdict.allowed) {
        ui.notifications?.warn(verdict.message);
        return;
      }

      // Click-to-place overlay
      const placements = await activatePlacement({
        tokenWidth: canvas.grid.size,
        tokenHeight: canvas.grid.size,
        thumbnailSrc: tpl.thumbnail,
        count: tpl.maxActive,
        label: game.i18n.format("LUXSUM.Spawn.PlacementLabel", { templateName: tpl.name })
      });
      if (placements.length === 0) return;     // user cancelled (ESC)

      // Hand off to the primary GM client via chat-broker
      await postBrokerRequest("spawn", {
        templateId: tpl.id,
        sourceActorId,
        sourcePlayerId: game.user.id,
        placements,
        visualOverrides: undefined            // template defaults; per-spawn override comes Plan 2
      });

      // Track local timestamp for the anti-spam rolling window
      const ts = Date.now();
      const windowMs = config.antispamWindowSeconds * 1000;
      const updatedRecent = [...recentSpawnTimestamps, ts].filter(t => ts - t <= windowMs);
      await game.user.update({ [`flags.${MODULE_ID}.recentSpawnTimestamps`]: updatedRecent });
    }
  });
}
