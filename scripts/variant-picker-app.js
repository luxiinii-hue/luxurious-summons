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

  /**
   * Single source of truth for "which actor is this picker acting on behalf of."
   * v0.4.6 FIX 9: every call site in this file used to read game.user.character
   * directly, ignoring ctx.sourceActor (which spell-trigger.js passes correctly
   * — the actual casting actor, not whatever character happens to be assigned
   * to the current user). That broke eligibility, maxSpellSlotLevel, and the
   * Place-button source actor for GMs, who typically have no assigned character
   * at all — the friend's primary test path.
   */
  #sourceActor() {
    return this.ctx?.sourceActor ?? game.user.character;
  }

  constructor(template, ctx = {}) {
    super();
    this.template = template;
    this.ctx = ctx;
    const variants = template.variants ?? [{ id: "__default__", name: template.name, thumbnail: template.thumbnail }];
    // Annotate with eligibility for the active caster. Resolved from ctx.sourceActor
    // first (the actor that actually cast the spell / triggered the picker — set
    // correctly by spell-trigger.js), falling back to game.user.character only when
    // no source actor was passed (e.g. legacy call sites). v0.4.6 FIX 9: reading
    // game.user.character unconditionally broke eligibility + info-card resolution
    // for GMs, who typically have no assigned character.
    const caster = ctx.caster ?? readActiveCaster(this.#sourceActor());
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
    // v0.5.0: "fixed multi-spawn" templates (Mirror Image — always exactly
    // maxActive copies of the SAME single stat block, no per-variant choice)
    // are signaled by carrying no explicit `variants` array while maxActive > 1.
    // Every OTHER multi-spawn template (Animate Dead, and any future one)
    // ships a real `variants` array (Skeleton/Zombie) where the player picks
    // WHICH thing to spawn how many of — that's the only case the manual
    // per-card stepper makes sense for. For fixed multi-spawn we pre-fill the
    // counter to the cap and hide the stepper entirely; the picker just shows
    // "places N <template.name>" and Place runs the full sequence immediately.
    this.fixedMultiSpawn = this.multiSpawn && !template.variants;
    if (this.fixedMultiSpawn) {
      for (let i = 0; i < template.maxActive; i++) this.counter = increment(this.counter, this.selectedVariantId);
    }
    // Cast-level state (used by compendium-scaled templates — wired in task 25)
    this.selectedCastSlotLevel = ctx.castSlotLevel ?? null;
  }

  async _prepareContext() {
    const selected = this._eligibleVariants.find(v => v.id === this.selectedVariantId);
    const variantsForRender = this._eligibleVariants.map(v => ({
      ...v,
      _count: this.counter?.counts?.[v.id] ?? 0
    }));
    const sourceMode = this.template.source?.mode;
    const showCastLevelSelector = sourceMode === "compendium-scaled";
    const castLevelOptions = showCastLevelSelector
      ? (this.template.source.scalingTable ?? []).map(row => ({
          level: row.slotLevel,
          label: this.#formatOrdinal(row.slotLevel) + " level"
        }))
      : [];
    // Default cast level to the cast's own slot level (set via spell-trigger ctx)
    // or the spell's base level (first row of scaling table).
    if (showCastLevelSelector && this.selectedCastSlotLevel == null) {
      this.selectedCastSlotLevel = castLevelOptions[0]?.level ?? null;
    }
    return {
      template: this.template,
      variants: variantsForRender,
      selectedVariantId: this.selectedVariantId,
      selectedDetails: await this.#buildDetailsCard(selected),
      canPlace: this.multiSpawn
        ? (this.counter ? totalCount(this.counter) > 0 : false)
        : (!!selected && !selected._ineligible),
      multiSpawn: this.multiSpawn,
      // v0.5.0: fixed multi-spawn (Mirror Image) pre-fills to the cap and
      // hides the per-card stepper — showStepper is what the partial actually
      // renders on, distinct from multiSpawn (which still drives the
      // "N / max" total chip and the "Place N" button label for both cases).
      showStepper: this.multiSpawn && !this.fixedMultiSpawn,
      fixedMultiSpawn: this.fixedMultiSpawn,
      multispawnTotal: this.multiSpawn ? totalCount(this.counter) : 0,
      multispawnMax: this.template.maxActive,
      showCastLevelSelector,
      castLevelOptions,
      selectedCastSlotLevel: this.selectedCastSlotLevel
    };
  }

  #formatOrdinal(n) {
    const v = n % 100;
    if (v >= 11 && v <= 13) return n + "th";
    switch (n % 10) {
      case 1:  return n + "st";
      case 2:  return n + "nd";
      case 3:  return n + "rd";
      default: return n + "th";
    }
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    this.#wireVariantCardClicks();
    this.#wireStepperClicks();
    this.#wireCastLevelSelector();
  }

  #wireCastLevelSelector() {
    const select = this.element.querySelector(".luxsum-cast-level-select");
    if (!select) return;
    select.addEventListener("change", async (e) => {
      this.selectedCastSlotLevel = parseInt(e.target.value, 10);
      // Cast level affects info-card stats (Summon Dragon's HP scales per tier).
      // Refresh the info card surgically — don't full-render or the grid scroll resets.
      await this.#refreshInfoCard();
    });
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
    // v0.5.0: fixedMultiSpawn templates (Mirror Image) have no stepper DOM to
    // wire — the counter is pre-filled to the cap in the constructor and
    // never changes for the lifetime of the dialog.
    if (!this.multiSpawn || this.fixedMultiSpawn) return;
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
   *
   * V13/V14 fallback: V14 namespaces `renderTemplate` under
   * `foundry.applications.handlebars`; V13 still exposes it as a global.
   * Reading the global on V13+ emits a deprecation warning, so probe the
   * namespaced API first.
   */
  async #refreshInfoCard() {
    const selected = this._eligibleVariants.find(v => v.id === this.selectedVariantId);
    const details = await this.#buildDetailsCard(selected);
    const mount = this.element.querySelector("[data-info-card]");
    if (!mount) return;
    const renderTpl = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
    const html = await renderTpl("modules/luxurious-summons/templates/partials/summon-details.hbs", { details });
    mount.innerHTML = html;
  }

  /**
   * Build the data shape consumed by summon-details.hbs. Resolves actor data
   * per the template's source mode so the info card shows real stats.
   *
   * Failure modes (e.g., compendium UUID placeholder) are handled gracefully
   * — the card falls back to template description + dashes for stats.
   */
  async #buildDetailsCard(variant) {
    const emptyDetails = (name, flavor) => ({
      name: name ?? "—",
      type: "",
      flavor: flavor ?? "",
      hp: "—", ac: "—", speed: "—",
      abilities: [],
      saves: [],
      actorId: null
    });

    if (!variant) return emptyDetails("—", "(select a variant)");

    const sourceMode = this.template.source?.mode;
    let actorData = null;
    try {
      if (sourceMode === "compendium" || sourceMode === "compendium-scaled") {
        const { resolveCompendiumData, resolveCompendiumScaledData } = await import("./source-modes.js");
        actorData = sourceMode === "compendium-scaled"
          ? await resolveCompendiumScaledData(this.template, variant, {
              name: variant.name,
              castSlotLevel: this.selectedCastSlotLevel
            })
          : await resolveCompendiumData(this.template, variant, { name: variant.name });
      } else if (sourceMode === "inline-synthesized") {
        const { resolveInlineData } = await import("./source-modes.js");
        actorData = resolveInlineData(this.template, { name: variant.name ?? this.template.name });
      } else if (sourceMode === "clone") {
        const source = this.#sourceActor();
        if (source) {
          const { resolveCloneData } = await import("./source-modes.js");
          actorData = resolveCloneData(source, {
            prefix: this.template.defaults?.namePrefix ?? "",
            suffix: this.template.defaults?.nameSuffix ?? ""
          });
        }
      }
    } catch (e) {
      console.warn(`[${MODULE_ID}] info-card resolution failed for variant "${variant.id}":`, e.message);
    }

    if (!actorData) return emptyDetails(variant.name, this.template.description);

    const sys = actorData.system ?? {};
    const mv = sys.attributes?.movement ?? {};
    const speedParts = [];
    if (mv.walk)  speedParts.push(`Walk ${mv.walk}`);
    if (mv.fly)   speedParts.push(`Fly ${mv.fly}`);
    if (mv.swim)  speedParts.push(`Swim ${mv.swim}`);
    if (mv.climb) speedParts.push(`Climb ${mv.climb}`);

    // dnd5e ability score → modifier helper
    const abilityMod = (score) => {
      const m = Math.floor(((score ?? 10) - 10) / 2);
      return (m >= 0 ? "+" : "") + m;
    };
    const abilityNames = ["str", "dex", "con", "int", "wis", "cha"];
    const abilities = abilityNames.map(key => {
      const ab = sys.abilities?.[key] ?? {};
      return {
        name:  key.toUpperCase(),
        score: ab.value ?? "—",
        mod:   ab.value !== undefined ? abilityMod(ab.value) : "—",
        save:  ab.save?.proficient === 1 || ab.proficient === 1
      };
    });

    return {
      name:    variant.name ?? this.template.name,
      type:    sys.details?.type?.value ?? "",
      flavor:  this.template.description,
      ac:      sys.attributes?.ac?.flat ?? sys.attributes?.ac?.value ?? "—",
      hp:      sys.attributes?.hp ? `${sys.attributes.hp.value ?? "—"} / ${sys.attributes.hp.max ?? "—"}` : "—",
      speed:   speedParts.length ? speedParts.join(" • ") : "—",
      abilities,
      saves:   [],         // detailed save breakdown is left to the actor sheet for v0.4.0
      actorId: null        // no live actor yet — info card is preview-only
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
      // v0.4.6 FIX 10: runSpawnFlow now returns an explicit outcome. Before this
      // fix, ESC on placement N of M resolved the SAME shape as "0 placements
      // collected" (an empty array), which runSpawnFlow already treated as
      // cancel-and-return — but this loop had no way to tell that apart from
      // "this iteration's spawn just didn't happen, keep going" and re-armed
      // the placement overlay for every remaining token in the sequence. Now we
      // break on "cancelled" specifically, so ESC during e.g. an Animate Dead
      // 4-token sequence stops the whole batch instead of re-prompting 3 more times.
      let placedCount = 0;
      for (const variantId of sequence) {
        const result = await runSpawnFlow({
          template: this.template,
          variantId,
          castSlotLevel: this.selectedCastSlotLevel,
          sourcePlayerId: game.user.id,
          sourceActor: this.#sourceActor()
        });
        if (result?.outcome === "cancelled") {
          console.log(`[${MODULE_ID}] multi-spawn sequence cancelled by user after ${placedCount} of ${sequence.length} placement(s)`);
          ui.notifications?.info(game.i18n.format("LUXSUM.VariantPicker.MultiSpawnCancelled", { placed: placedCount, total: sequence.length })
            || `Placement cancelled — ${placedCount} of ${sequence.length} placed.`);
          return;
        }
        if (result?.outcome === "spawned") placedCount++;
        // "blocked" outcomes (restriction cap hit mid-sequence, etc.) fall
        // through and the loop continues — a per-iteration restriction
        // rejection doesn't necessarily invalidate the rest of the batch.
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
      sourceActor: this.#sourceActor()
    });
  }
}

function readActiveCaster(char) {
  if (!char) return { classes: [], maxSpellSlotLevel: 0, featureNames: [] };
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
  // v0.4.6 FIX 2: lowercased names of every owned feat-type item — Pact of the
  // Chain is a feature, not a subclass, and variant.requires.feature matches
  // against this list.
  const featureNames = (char.items ?? [])
    .filter(i => i.type === "feat")
    .map(i => (i.name ?? "").toLowerCase());
  return { classes, maxSpellSlotLevel, featureNames };
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
