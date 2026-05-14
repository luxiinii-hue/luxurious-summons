// scripts/manager-app.js — Companion Manager dialog (5 tabs, role-gated)
import { templates as builtinTemplates } from "./templates-builtin.js";
import { runSpawnFlow } from "./spawn-flow.js";
import { runDeathAndCleanup } from "./lifecycle.js";
import { callHandler } from "./handlers/index.js";

const MODULE_ID = "luxurious-summons";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ManagerApp extends HandlebarsApplicationMixin(ApplicationV2) {
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

    // Restyle button
    this.element.querySelectorAll('[data-action="restyle"]').forEach(el => {
      el.addEventListener("click", async (e) => {
        e.stopPropagation();
        const actor = game.actors.get(e.currentTarget.dataset.actorId);
        if (!actor) return;
        const { openRestyleApp } = await import("./restyle-app.js");
        openRestyleApp(actor);
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

  #onTemplateCardClick(templateId) {
    const tpl = builtinTemplates.find(t => t.id === templateId);
    if (!tpl) return;
    runSpawnFlow(tpl);     // shared with the dnd5e spell-cast trigger
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
    // Manual dismiss flow:
    //   - GM path: runDeathAndCleanup runs softFade + token delete + actor delete in
    //     the right order (animation first so the GM sees the fade, then tokens, then
    //     actor). Paid for in v0.3.3 — previous code deleted the actor without
    //     touching the token documents, leaving ghost tokens that couldn't be selected
    //     but stayed visible.
    //   - Player path: softFade runs locally so the requester sees the fade, then
    //     broker the privileged cleanup to the GM. Player can't delete world actors
    //     or scene tokens even with OWNER on the actor.
    if (game.user.isGM) {
      const { runDeathAndCleanup } = await import("./lifecycle.js");
      await runDeathAndCleanup(actor);
      console.log(`[${MODULE_ID}] dismissed companion ${actor.id} (GM direct)`);
    } else {
      const { deathAnimations } = await import("./death-animations.js");
      const tokens = actor.getActiveTokens();
      await Promise.all(tokens.map(t => deathAnimations.softFade?.(t) ?? Promise.resolve()));
      const { postBrokerRequest } = await import("./chat-broker.js");
      await postBrokerRequest("dismiss", { actorId });
      console.log(`[${MODULE_ID}] dismiss broker request posted for ${actor.id}`);
    }
  }
}

let _managerInstance = null;
export function openManager() {
  if (!_managerInstance) _managerInstance = new ManagerApp();
  _managerInstance.render({ force: true });
}

/**
 * Get the currently-open Manager instance if it's rendered, else null.
 * Used by spawn-flow to minimize the manager during placement so it doesn't
 * occlude the canvas. Returns null if the manager isn't open.
 */
export function getActiveManager() {
  return _managerInstance?.rendered ? _managerInstance : null;
}

// Re-render the manager when our user-flag activeCompanions changes
// (signaled by the GM client running refreshUserIndexes after spawn/dismiss/delete).
Hooks.on("updateUser", (user, changes) => {
  if (user.id !== game.user.id) return;
  const hasFlagChange = changes.flags?.[MODULE_ID]?.activeCompanions !== undefined;
  if (!hasFlagChange) return;
  const newCount = changes.flags[MODULE_ID].activeCompanions.length;
  console.log(`[${MODULE_ID}] manager: own activeCompanions flag changed (now ${newCount} entr${newCount === 1 ? "y" : "ies"}); rendered=${_managerInstance?.rendered}`);
  if (_managerInstance?.rendered) _managerInstance.render({ force: true });
});
