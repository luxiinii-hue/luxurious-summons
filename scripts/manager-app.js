// scripts/manager-app.js — Companion Manager dialog (5 tabs, role-gated)
import { templates as builtinTemplates } from "./templates-builtin.js";
import { openSpawnDialog } from "./spawn-app.js";
import { activatePlacement } from "./placement-overlay.js";
import { postBrokerRequest } from "./chat-broker.js";
import { checkRestrictions } from "./spawn-engine.js";
import { runDeathAndCleanup } from "./lifecycle.js";
import { callHandler } from "./handlers/index.js";
import { s } from "./settings.js";

const MODULE_ID = "luxurious-summons";

export class ManagerApp extends foundry.applications.api.ApplicationV2 {
  #activeTab = "my-companions";

  static DEFAULT_OPTIONS = {
    id: "luxsum-manager",
    classes: ["luxsum", "luxsum-manager"],
    tag: "div",
    window: {
      title: "LUXSUM.Manager.Title",
      icon: "fa-solid fa-ghost",
      resizable: true
    },
    position: { width: 720, height: 560 }
  };

  static PARTS = {
    body: { template: "modules/luxurious-summons/templates/manager.hbs" }
  };

  async _prepareContext(_options) {
    const myCompanions = (game.user.flags?.[MODULE_ID]?.activeCompanions ?? []).map(entry => {
      const actor = game.actors.get(entry.actorId);
      if (!actor) return null;
      const flag = actor.flags?.[MODULE_ID];
      const tpl = builtinTemplates.find(t => t.id === flag?.templateId);
      const scene = entry.sceneId ? game.scenes.get(entry.sceneId) : null;
      return {
        actorId: actor.id,
        name: actor.name,
        templateId: flag?.templateId,
        hpValue: actor.system?.attributes?.hp?.value ?? 0,
        hpMax: actor.system?.attributes?.hp?.max ?? 0,
        sceneName: scene?.name ?? "",
        tokenImg: actor.prototypeToken?.texture?.src ?? "icons/svg/mystery-man.svg",
        templateThumb: tpl?.thumbnail ?? "",
        templateName: tpl?.name ?? "",
        borderColor: flag?.visualOverrides?.borderColor ?? "#c9a14b",
        extraActions: tpl?.extraActions ?? []
      };
    }).filter(Boolean);

    const templates = builtinTemplates.map(t => ({
      ...t,
      activeCount: myCompanions.filter(c => c.templateId === t.id).length
    }));

    return {
      activeTab: this.#activeTab,
      isGM: game.user.isGM,
      myCompanions,
      templates
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);

    // Tab clicks
    this.element.querySelectorAll(".luxsum-tabs .item").forEach(el => {
      el.addEventListener("click", (e) => {
        const tab = e.currentTarget.dataset.tab;
        if (tab) {
          this.#activeTab = tab;
          this.render({ force: true });
        }
      });
    });

    // Template card click → open Spawn dialog → placement → broker → spawn
    this.element.querySelectorAll(".luxsum-template-card").forEach(card => {
      card.addEventListener("click", () => this.#onTemplateCardClick(card.dataset.templateId));
    });

    // Companion-card body click (anywhere except inside [data-stop-propagation]) → open sheet
    this.element.querySelectorAll('.luxsum-card[data-action="open-sheet"]').forEach(card => {
      card.addEventListener("click", (e) => {
        // Ignore clicks inside the action rows (their own listeners handle them)
        if (e.target.closest("[data-stop-propagation]")) return;
        this.#onOpenSheet(card.dataset.actorId);
      });
    });

    // Quick-access buttons
    this.element.querySelectorAll('[data-action="open-sheet"]:not(.luxsum-card)').forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        this.#onOpenSheet(e.currentTarget.dataset.actorId);
      });
    });
    this.element.querySelectorAll('[data-action="select-pan"]').forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        this.#onSelectAndPan(e.currentTarget.dataset.actorId);
      });
    });
    this.element.querySelectorAll('[data-action="toggle-combat"]').forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        this.#onToggleCombat(e.currentTarget.dataset.actorId);
      });
    });

    // Dismiss button
    this.element.querySelectorAll('[data-action="dismiss"]').forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        this.#onDismiss(e.currentTarget.dataset.actorId);
      });
    });

    // Extra actions (Repair, Refresh, etc.)
    this.element.querySelectorAll('[data-action="extra"]').forEach(el => {
      el.addEventListener("click", async (e) => {
        e.stopPropagation();
        const handlerId = e.currentTarget.dataset.handler;
        const actorId = e.currentTarget.dataset.actorId;
        const actor = game.actors.get(actorId);
        if (!actor || !handlerId) return;
        await callHandler(handlerId, { actor, app: this });
      });
    });
  }

  #onOpenSheet(actorId) {
    const actor = game.actors.get(actorId);
    if (!actor) return;
    actor.sheet.render({ force: true });
  }

  async #onSelectAndPan(actorId) {
    const actor = game.actors.get(actorId);
    if (!actor) return;
    const tokens = actor.getActiveTokens();
    const token = tokens[0];
    if (!token) {
      ui.notifications?.warn(`[${MODULE_ID}] no active token for ${actor.name} on the current scene`);
      return;
    }
    // If the token is on a different scene, view that scene first
    if (token.scene && token.scene.id !== canvas.scene?.id) {
      await token.scene.view();
    }
    token.control({ releaseOthers: true });
    await canvas.animatePan({ x: token.center.x, y: token.center.y, duration: 250 });
  }

  async #onToggleCombat(actorId) {
    const actor = game.actors.get(actorId);
    if (!actor) return;
    let combat = game.combat;
    if (!combat) {
      ui.notifications?.warn(`[${MODULE_ID}] no active combat. Start one first (left toolbar).`);
      return;
    }
    const existing = combat.combatants.find(c => c.actorId === actor.id);
    if (existing) {
      await existing.delete();
      ui.notifications?.info(`[${MODULE_ID}] ${actor.name} removed from combat`);
    } else {
      // dnd5e: rollInitiative auto-creates combatants when createCombatants:true
      await actor.rollInitiative({ createCombatants: true });
      ui.notifications?.info(`[${MODULE_ID}] ${actor.name} added to combat (initiative rolled)`);
    }
  }

  async #onTemplateCardClick(templateId) {
    const tpl = builtinTemplates.find(t => t.id === templateId);
    if (!tpl) return;

    openSpawnDialog(tpl, async ({ template, sourceActorId }) => {
      // Restrictions pre-check (broker re-checks on GM client)
      const activeCompanions = game.user.flags?.[MODULE_ID]?.activeCompanions ?? [];
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

      // Placement overlay
      const placements = await activatePlacement({
        tokenWidth: canvas.grid.size,
        tokenHeight: canvas.grid.size,
        thumbnailSrc: template.thumbnail,
        count: template.maxActive,
        label: game.i18n.format("LUXSUM.Spawn.PlacementLabel", { templateName: template.name })
      });
      if (placements.length === 0) return;     // user cancelled

      // Post to broker — primary GM auto-spawns
      await postBrokerRequest("spawn", {
        templateId: template.id,
        sourceActorId,
        sourcePlayerId: game.user.id,
        placements,
        visualOverrides: undefined            // template defaults; per-spawn override comes Plan 2
      });

      // Update local recent-spawn window for client-side restriction pre-check
      const ts = Date.now();
      const windowMs = config.antispamWindowSeconds * 1000;
      const updatedRecent = [...recentSpawnTimestamps, ts].filter(t => ts - t <= windowMs);
      await game.user.update({ [`flags.${MODULE_ID}.recentSpawnTimestamps`]: updatedRecent });
    });
  }

  async #onDismiss(actorId) {
    const actor = game.actors.get(actorId);
    if (!actor) return;
    const proceed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Luxurious Summons" },
      content: `<p>${game.i18n.format("LUXSUM.Companion.DismissConfirm", { name: actor.name })}</p>`,
      yes: { label: "Dismiss",  callback: () => true },
      no:  { label: "Keep",     callback: () => false },
      defaultYes: true,
      rejectClose: false
    });
    if (!proceed) return;
    // Manual dismiss → softFade animation (NOT the per-template death animation;
    // those fire only on HP=0 to keep the visual language distinct: "killed in
    // combat" vs "user dismissed").
    const { deathAnimations } = await import("./death-animations.js");
    const tokens = actor.getActiveTokens();
    await Promise.all(tokens.map(t => deathAnimations.softFade?.(t) ?? Promise.resolve()));
    await actor.delete();
  }
}

let _managerInstance = null;
export function openManager() {
  if (!_managerInstance) _managerInstance = new ManagerApp();
  _managerInstance.render({ force: true });
}

// Re-render the manager when our user-flag activeCompanions changes
// (signaled by broker confirm running refreshUserIndexes on the GM client)
Hooks.on("updateUser", (user, changes) => {
  if (user.id !== game.user.id) return;
  if (!changes.flags?.[MODULE_ID]?.activeCompanions) return;
  if (_managerInstance?.rendered) _managerInstance.render({ force: true });
});
