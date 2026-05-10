// scripts/manager-app.js — Companion Manager dialog (5 tabs, role-gated)
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
    const myCompanions = (game.user.flags?.[MODULE_ID]?.activeCompanions ?? []).map(e => ({
      ...e,
      name: game.actors.get(e.actorId)?.name ?? "(missing)"
    }));
    // templates list populated by Task 19 (templates-builtin.js)
    const templates = [];
    return {
      activeTab: this.#activeTab,
      isGM: game.user.isGM,
      myCompanions,
      templates
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    // Wire tab clicks (imperative — `actions` would also work but a single uniform handler is simpler).
    this.element.querySelectorAll(".luxsum-tabs .item").forEach(el => {
      el.addEventListener("click", (e) => {
        const tab = e.currentTarget.dataset.tab;
        if (tab) {
          this.#activeTab = tab;
          this.render({ force: true });   // V14: render({force:true}), NOT render(true)
        }
      });
    });
  }
}

let _managerInstance = null;
export function openManager() {
  if (!_managerInstance) _managerInstance = new ManagerApp();
  _managerInstance.render({ force: true });
}
