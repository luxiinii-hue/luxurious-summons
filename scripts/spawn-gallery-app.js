// scripts/spawn-gallery-app.js — Plan 3 Spawn-dialog gallery (ApplicationV2)
//
// Entry point: Manager → Spawn New tab → opens this. Click a card → opens
// VariantPickerApp for that template (always, even for N=1 variants —
// consistency over special-casing).
//
// V13/V14 strictness:
//   - HandlebarsApplicationMixin (else "not renderable" throw)
//   - Single-root template (else "must render a single HTML element" throw)
//   - height: "auto" + defensive _updatePosition (else null offsetWidth)
//   - render({ force: true }), not render(true)

import { templates as allTemplates } from "./templates-builtin.js";

const MODULE_ID = "luxurious-summons";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class SpawnGalleryApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "luxsum-spawn-gallery",
    tag: "div",
    window: {
      title: "LUXSUM.SpawnGallery.Title",
      resizable: false
    },
    position: {
      width: 680,
      height: "auto"
    },
    actions: {
      cancel: SpawnGalleryApp.#onCancel
    }
  };

  static PARTS = {
    body: {
      template: "modules/luxurious-summons/templates/spawn-gallery.hbs",
      root: true
    }
  };

  async _prepareContext() {
    return { templates: allTemplates };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    // Wire card click → open variant picker for that template
    this.element.querySelectorAll(".luxsum-template-card").forEach(el => {
      el.addEventListener("click", async () => {
        const id = el.dataset.templateId;
        const template = allTemplates.find(t => t.id === id);
        if (!template) return;
        const { openVariantPicker } = await import("./variant-picker-app.js");
        openVariantPicker(template, { source: "gallery", sourceActor: game.user.character });
        this.close();
      });
    });
  }

  _updatePosition(position) {
    if (!this.element) return position ?? this.position;
    try {
      return super._updatePosition(position);
    } catch (e) {
      console.log(`[${MODULE_ID}] SpawnGalleryApp._updatePosition suppressed: ${e.message}`);
      return position ?? this.position;
    }
  }

  static #onCancel(event, target) {
    this.close();
  }
}

let _instance = null;

export function openSpawnGallery() {
  if (!_instance || !_instance.rendered) {
    _instance = new SpawnGalleryApp();
  }
  _instance.render({ force: true });
  return _instance;
}

export function getActiveSpawnGallery() {
  return _instance?.rendered ? _instance : null;
}
