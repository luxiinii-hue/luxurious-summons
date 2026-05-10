// scripts/spawn-app.js — Spawn Dialog (ApplicationV2 modal)
const MODULE_ID = "luxurious-summons";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class SpawnApp extends HandlebarsApplicationMixin(ApplicationV2) {
  #template = null;
  #sourceActorId = null;
  #onPlaceCallback = null;

  static DEFAULT_OPTIONS = {
    id: "luxsum-spawn",
    classes: ["luxsum", "luxsum-spawn"],
    tag: "div",
    window: {
      icon: "fa-solid fa-ghost",
      resizable: false
    },
    position: { width: 480, height: "auto" }
  };

  static PARTS = {
    body: { template: "modules/luxurious-summons/templates/spawn.hbs" }
  };

  constructor({ template, defaultSourceActorId = null, onPlace }) {
    super();
    this.#template = template;
    this.#onPlaceCallback = onPlace;
    // Priority: explicit defaultSourceActorId (from spell-cast trigger) >
    // player's assigned character. Falls back to null if neither.
    this.#sourceActorId = defaultSourceActorId ?? game.user.character?.id ?? null;
    this.options.window.title = game.i18n.format("LUXSUM.Spawn.Title", { templateName: template.name });
  }

  async _prepareContext(_options) {
    // For clone-mode templates, the source is the master actor — locked when
    // the player has a default character (most common case).
    const sourceLocked = this.#template.source.mode === "clone" && this.#sourceActorId !== null;
    const candidateActors = sourceLocked
      ? [{ id: this.#sourceActorId,
           name: game.actors.get(this.#sourceActorId)?.name ?? "(unknown)",
           isSelected: true }]
      : game.actors
          .filter(a => a.isOwner && a.type !== "vehicle")
          .map(a => ({ id: a.id, name: a.name, isSelected: a.id === this.#sourceActorId }));
    return {
      template: this.#template,
      candidateActors,
      sourceLocked
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    this.element.querySelector('[data-action="cancel"]')?.addEventListener("click", () => this.close());
    this.element.querySelector('[data-action="place"]')?.addEventListener("click", async () => {
      const select = this.element.querySelector('select[name="sourceActorId"]');
      if (select) this.#sourceActorId = select.value;
      if (!this.#sourceActorId) {
        ui.notifications?.error(`[${MODULE_ID}] no source actor selected`);
        return;
      }
      await this.close();
      if (this.#onPlaceCallback) {
        await this.#onPlaceCallback({ template: this.#template, sourceActorId: this.#sourceActorId });
      }
    });
  }
}

export function openSpawnDialog({ template, defaultSourceActorId = null, onPlace }) {
  const app = new SpawnApp({ template, defaultSourceActorId, onPlace });
  app.render({ force: true });
  return app;
}
