// scripts/variant-picker-app.js — Plan 3 variant-picker modal (ApplicationV2).
//
// Opens via SpawnGalleryApp click OR via spell-cast trigger. Two-column layout:
// left = variant grid, right = summon-details info card. Single-variant
// templates open with N=1 pre-selected; the user still clicks Place —
// consistency over special-casing.
//
// Surgical-update pattern (paid for in the preview): variant selection toggles
// the `.selected` class + replaces the info card's innerHTML imperatively.
// We only call `this.render()` when something structural changes (cast level,
// multi-spawn counts) — never on plain variant click. Avoids the scroll-jump
// the preview review surfaced.

import { filterVariants, isVariantEligible } from "./variant-eligibility.js";
import {
  createCounter, increment, decrement, totalCount, canIncrement, toPlacementSequence
} from "./multi-spawn-counter.js";

const MODULE_ID = "luxurious-summons";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class VariantPickerApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "luxsum-variant-picker",
    tag: "div",
    window: { title: "LUXSUM.VariantPicker.Title", resizable: false },
    position: { width: 760, height: "auto" },
    actions: {
      cancel: VariantPickerApp.#onCancel,
      place:  VariantPickerApp.#onPlace
    }
  };

  static PARTS = {
    body: { template: "modules/luxurious-summons/templates/variant-picker.hbs", root: true }
  };

  constructor(template, ctx = {}) {
    super();
    this.template = template;
    this.ctx = ctx;
    const variants = template.variants ?? [{ id: "__default__", name: template.name, thumbnail: template.thumbnail }];
    // Annotate with eligibility for the active caster
    const caster = ctx.caster ?? readActiveCaster();
    this._caster = caster;
    this._eligibleVariants = variants.map(v => {
      const eligible = isVariantEligible(v, caster);
      return {
        ...v,
        _ineligible: !eligible,
        _reason: eligible ? null : "Not eligible — check class/subclass/level requirements."
      };
    });
    this.selectedVariantId = this._eligibleVariants.find(v => !v._ineligible)?.id
                          ?? this._eligibleVariants[0]?.id;
    // Multi-spawn state
    this.multiSpawn = (template.maxActive ?? 1) > 1;
    this.counter = this.multiSpawn ? createCounter({ maxActive: template.maxActive }) : null;
    // Cast-level state (used by compendium-scaled templates — wired in task 25)
    this.selectedCastSlotLevel = ctx.castSlotLevel ?? null;
  }

  async _prepareContext() {
    const selected = this._eligibleVariants.find(v => v.id === this.selectedVariantId);
    const variantsForRender = this._eligibleVariants.map(v => ({
      ...v,
      _count: this.counter?.counts?.[v.id] ?? 0
    }));
    return {
      template: this.template,
      variants: variantsForRender,
      selectedVariantId: this.selectedVariantId,
      selectedDetails: await this.#buildDetailsCard(selected),
      canPlace: this.multiSpawn
        ? (this.counter ? totalCount(this.counter) > 0 : false)
        : (!!selected && !selected._ineligible),
      multiSpawn: this.multiSpawn,
      multispawnTotal: this.multiSpawn ? totalCount(this.counter) : 0,
      multispawnMax: this.template.maxActive,
      showCastLevelSelector: false,    // task 25 will flip this on for compendium-scaled
      castLevelOptions: [],
      selectedCastSlotLevel: this.selectedCastSlotLevel
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    this.#wireVariantCardClicks();
    this.#wireStepperClicks();
  }

  /**
   * Surgical click handler — no `this.render()`. Toggles the `.selected`
   * class + updates the info card via DOM replacement. Preserves scroll
   * position in the variant grid (a wholesale re-render would reset it).
   */
  #wireVariantCardClicks() {
    this.element.querySelectorAll(".luxsum-variant-card").forEach(el => {
      if (el.classList.contains("ineligible")) return;
      el.addEventListener("click", async (e) => {
        if (e.target.closest(".luxsum-variant-stepper")) return;  // stepper handled separately
        const variantId = el.dataset.variantId;
        if (this.selectedVariantId === variantId) return;
        this.selectedVariantId = variantId;
        // Surgical selection toggle
        this.element.querySelectorAll(".luxsum-variant-card.selected").forEach(c => c.classList.remove("selected"));
        el.classList.add("selected");
        // Update info card
        await this.#refreshInfoCard();
        // Update Place button disabled state (multi-spawn doesn't care; single does)
        if (!this.multiSpawn) {
          const placeBtn = this.element.querySelector('button[data-action="place"]');
          if (placeBtn) placeBtn.disabled = false;
        }
      });
      el.addEventListener("dblclick", (e) => {
        if (e.target.closest(".luxsum-variant-stepper")) return;
        const variantId = el.dataset.variantId;
        this.selectedVariantId = variantId;
        VariantPickerApp.#onPlace.call(this);
      });
    });
  }

  #wireStepperClicks() {
    if (!this.multiSpawn) return;
    this.element.querySelectorAll('.luxsum-variant-stepper button[data-action="inc"]').forEach(b => {
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = b.dataset.variantId;
        if (!canIncrement(this.counter)) return;
        this.counter = increment(this.counter, id);
        this.#refreshMultispawnDisplay();
      });
    });
    this.element.querySelectorAll('.luxsum-variant-stepper button[data-action="dec"]').forEach(b => {
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        this.counter = decrement(this.counter, b.dataset.variantId);
        this.#refreshMultispawnDisplay();
      });
    });
  }

  /**
   * Surgically refresh the per-card count + the total chip + the Place button.
   * Avoids `this.render()` which would scroll-reset the grid.
   */
  #refreshMultispawnDisplay() {
    if (!this.multiSpawn) return;
    for (const v of this._eligibleVariants) {
      const card = this.element.querySelector(`.luxsum-variant-card[data-variant-id="${v.id}"]`);
      if (!card) continue;
      const countEl = card.querySelector(".luxsum-variant-count");
      if (countEl) countEl.textContent = String(this.counter.counts[v.id] ?? 0);
    }
    const total = totalCount(this.counter);
    const totalEl = this.element.querySelector("[data-multispawn-total]");
    if (totalEl) totalEl.textContent = String(total);
    const placeBtn = this.element.querySelector('button[data-action="place"]');
    if (placeBtn) {
      placeBtn.disabled = total === 0;
      const label = game.i18n.format("LUXSUM.VariantPicker.PlaceN", { count: total });
      placeBtn.textContent = label;
    }
  }

  /**
   * Surgically replace the info-card DOM with fresh content for the current selection.
   */
  async #refreshInfoCard() {
    const selected = this._eligibleVariants.find(v => v.id === this.selectedVariantId);
    const details = await this.#buildDetailsCard(selected);
    const mount = this.element.querySelector("[data-info-card]");
    if (!mount) return;
    const html = await renderTemplate("modules/luxurious-summons/templates/partials/summon-details.hbs", { details });
    mount.innerHTML = html;
  }

  /**
   * Build the data shape consumed by summon-details.hbs. For Plan 3 task 24
   * this is a placeholder — task 26 plugs in real actor-data resolution.
   */
  async #buildDetailsCard(variant) {
    if (!variant) {
      return { name: "—", type: "", flavor: "(select a variant)", hp: "—", ac: "—", speed: "—", abilities: [], saves: [], actorId: null };
    }
    return {
      name:    variant.name,
      type:    "",
      flavor:  this.template.description,
      hp:      "—",
      ac:      "—",
      speed:   "—",
      abilities: [],
      saves:   [],
      actorId: null
    };
  }

  _updatePosition(position) {
    if (!this.element) return position ?? this.position;
    try { return super._updatePosition(position); }
    catch (e) {
      console.log(`[${MODULE_ID}] VariantPickerApp._updatePosition suppressed: ${e.message}`);
      return position ?? this.position;
    }
  }

  static async #onCancel(event, target) {
    this.close();
  }

  static async #onPlace(event, target) {
    const { runSpawnFlow } = await import("./spawn-flow.js");
    if (this.multiSpawn) {
      const sequence = toPlacementSequence(this.counter);
      if (sequence.length === 0) return;
      this.close();
      for (const variantId of sequence) {
        await runSpawnFlow({
          template: this.template,
          variantId,
          castSlotLevel: this.selectedCastSlotLevel,
          sourcePlayerId: game.user.id,
          sourceActor: this.ctx.sourceActor ?? game.user.character
        });
      }
      return;
    }
    const variant = this._eligibleVariants.find(v => v.id === this.selectedVariantId);
    if (!variant || variant._ineligible) return;
    this.close();
    await runSpawnFlow({
      template: this.template,
      variantId: variant.id !== "__default__" ? variant.id : null,
      castSlotLevel: this.selectedCastSlotLevel,
      sourcePlayerId: game.user.id,
      sourceActor: this.ctx.sourceActor ?? game.user.character
    });
  }
}

function readActiveCaster() {
  const char = game.user.character;
  if (!char) return { classes: [], maxSpellSlotLevel: 0 };
  // dnd5e v5: actor.classes is a record keyed by class id; values have .identifier + .subclass + .system.levels
  const classes = Object.values(char.classes ?? {}).map(cls => ({
    name:     (cls.identifier ?? cls.name ?? "").toLowerCase(),
    subclass: (cls.subclass?.identifier ?? cls.subclass?.name ?? "").toLowerCase() || null,
    level:    cls.system?.levels ?? cls.system?.level ?? 0
  }));
  // Highest available spell slot level (used by variant.requires.spellSlotLevel)
  const spells = char.system?.spells ?? {};
  let maxSpellSlotLevel = 0;
  for (let i = 1; i <= 9; i++) {
    if ((spells[`spell${i}`]?.max ?? 0) > 0) maxSpellSlotLevel = i;
  }
  return { classes, maxSpellSlotLevel };
}

let _instance = null;

export function openVariantPicker(template, ctx = {}) {
  if (_instance?.rendered) _instance.close();
  _instance = new VariantPickerApp(template, ctx);
  _instance.render({ force: true });
  return _instance;
}

export function getActiveVariantPicker() {
  return _instance?.rendered ? _instance : null;
}
