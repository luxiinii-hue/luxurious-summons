// scripts/restyle-app.js — Restyle dialog (Plan 2).
//
// Opens from a companion card. Shows the summon details info card on the left
// (HP/AC/Speed/abilities/saves + Open Foundry Sheet button) and the customization
// control panel on the right. Live PIXI filter + motion updates as the user drags
// sliders. Save commits to actor flags; Cancel reverts; Reset copies template
// defaults into the draft.
//
// Draft state machine: the dialog mutates an in-memory `_draft` object, applies it
// imperatively to the canvas token via applyOverridesToToken, and only writes the
// flag on Save. Sticky-slider gotcha (V13/V14): never call this.render() on slider
// input — only update the value readout via direct DOM manipulation.

import { applyOverridesToToken } from "./visual-filters.js";
import { getCompanionFlag } from "./data-model.js";
import { templates as builtinTemplates } from "./templates-builtin.js";

const MODULE_ID = "luxurious-summons";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// Preset → intensity multiplier (matches design spec §6).
const PRESET_INTENSITY = { off: 0, subtle: 0.5, default: 1.0, lively: 1.5 };

function intensityToPreset(intensity) {
  if (intensity === 0) return "off";
  if (intensity <= 0.5) return "subtle";
  if (intensity <= 1.0) return "default";
  return "lively";
}

function formatModifier(score) {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function formatSpeed(movement) {
  if (!movement) return "—";
  const units = movement.units ?? "ft";
  const parts = [];
  if (movement.walk) parts.push(`${movement.walk} ${units}`);
  if (movement.fly) parts.push(`fly ${movement.fly}`);
  if (movement.swim) parts.push(`swim ${movement.swim}`);
  if (movement.climb) parts.push(`climb ${movement.climb}`);
  if (movement.burrow) parts.push(`burrow ${movement.burrow}`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

/**
 * Build the summon-details context object from the companion actor and its template.
 * Reads dnd5e v3/v4/v5-compatible paths under `actor.system.*`.
 */
function buildSummonDetails(actor, template) {
  const sys = actor.system ?? {};
  const hp = sys.attributes?.hp;
  const ac = sys.attributes?.ac;
  const abilitiesKeys = ["str", "dex", "con", "int", "wis", "cha"];
  const abilities = abilitiesKeys.map(key => {
    const abil = sys.abilities?.[key];
    const score = abil?.value ?? 10;
    return {
      name: key.toUpperCase(),
      score,
      mod: formatModifier(score),
      save: (abil?.proficient ?? 0) > 0
    };
  });
  const saves = abilities
    .filter(a => a.save)
    .map(a => {
      const key = a.name.toLowerCase();
      const saveValue = sys.abilities?.[key]?.save;
      const modifier = saveValue !== undefined
        ? (saveValue >= 0 ? `+${saveValue}` : `${saveValue}`)
        : a.mod;
      return { ability: a.name, modifier };
    });
  return {
    actorId: actor.id,
    name: actor.name,
    type: template?.name ?? "Companion",
    flavor: template?.description ?? "",
    hp: hp ? `${hp.value ?? 0} / ${hp.max ?? 0}` : "—",
    ac: ac?.value ?? ac?.flat ?? "—",
    speed: formatSpeed(sys.attributes?.movement),
    abilities,
    saves,
    descriptionOnly: false
  };
}

// Debounce window between the user's last change and the flag write that persists it.
// Long enough to bundle a slider drag into a single update; short enough that closing the
// dialog mid-drag still commits naturally.
const AUTO_APPLY_DEBOUNCE_MS = 350;

export class RestyleApp extends HandlebarsApplicationMixin(ApplicationV2) {
  #actor = null;
  #originalFlag = null;
  #draft = null;
  #template = null;
  #writeTimer = null;
  #dirty = false;          // true if any change happened since open (skip the no-op flush)

  static DEFAULT_OPTIONS = {
    id: "luxsum-restyle",
    classes: ["luxsum", "luxsum-restyle"],
    tag: "div",
    window: {
      title: "LUXSUM.Restyle.Title",
      icon: "fa-solid fa-palette",
      resizable: false
    },
    position: { width: 720, height: "auto" }
  };

  static PARTS = {
    body: { template: "modules/luxurious-summons/templates/restyle.hbs" }
  };

  constructor({ actor }) {
    super();
    this.#actor = actor;
    this.#template = builtinTemplates.find(t => t.id === actor.flags?.[MODULE_ID]?.templateId) ?? null;
    const flag = getCompanionFlag(actor) ?? {};
    this.#originalFlag = {
      visualOverrides: foundry.utils.deepClone(flag.visualOverrides ?? {}),
      motionOverrides: foundry.utils.deepClone(flag.motionOverrides ?? { profile: "none", intensity: 0 })
    };
    this.#draft = foundry.utils.deepClone(this.#originalFlag);
    this.options.window.title = `${game.i18n.localize("LUXSUM.Restyle.Title")}: ${actor.name}`;
  }

  async _prepareContext(_options) {
    const details = buildSummonDetails(this.#actor, this.#template);
    const v = this.#draft.visualOverrides;
    const m = this.#draft.motionOverrides;
    return {
      draft: {
        ...v,
        outlineEnabled: (v.outlineThickness ?? 0) > 0,
        motionPreset: intensityToPreset(m.intensity ?? 0)
      },
      display: {
        hueIntensityPct: Math.round((v.hueIntensity ?? 0) * 100),
        brightnessPct: Math.round((v.brightness ?? 1) * 100),
        brightnessFmt: `${(v.brightness ?? 1).toFixed(2)}×`,
        saturationPct: Math.round((v.saturation ?? 1) * 100),
        saturationFmt: `${(v.saturation ?? 1).toFixed(2)}×`,
        alphaPct: Math.round((v.alpha ?? 1) * 100),
        shimmerIntensityPct: Math.round((v.shimmerIntensity ?? 0) * 100)
      },
      details
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);

    // Sliders — input event = imperative live update (never this.render() per the
    // sticky-thumb gotcha in CLAUDE.md).
    this.element.querySelectorAll(".luxsum-slider").forEach(el => {
      el.addEventListener("input", (e) => {
        this.#onSliderChange(e.target.dataset.bind, parseFloat(e.target.value));
      });
    });

    // Color pickers — input event fires continuously while color wheel is open.
    this.element.querySelectorAll(".luxsum-color-input").forEach(el => {
      el.addEventListener("input", (e) => {
        this.#onColorChange(e.target.dataset.bind, e.target.value);
      });
    });

    // Toggle switches (outline, shimmer).
    this.element.querySelectorAll(".luxsum-toggle-input").forEach(el => {
      el.addEventListener("change", (e) => {
        this.#onToggleChange(e.target.dataset.bind, e.target.checked);
      });
    });

    // Motion preset radios.
    this.element.querySelectorAll('input[name="motion-preset"]').forEach(el => {
      el.addEventListener("change", (e) => {
        if (e.target.checked) this.#onMotionPresetChange(e.target.value);
      });
    });

    // Text inputs (naming prefix/suffix).
    this.element.querySelectorAll('input[type="text"][data-bind]').forEach(el => {
      el.addEventListener("input", (e) => {
        this.#draft.visualOverrides[e.target.dataset.bind] = e.target.value;
      });
    });

    // Footer buttons.
    this.element.querySelector('[data-action="revert"]')?.addEventListener("click", () => this.#onRevert());
    this.element.querySelector('[data-action="reset-defaults"]')?.addEventListener("click", () => this.#onReset());

    // Open Foundry Sheet button (in the summon-details card).
    this.element.querySelector('[data-action="open-foundry-sheet"]')?.addEventListener("click", () => {
      this.#actor.sheet.render({ force: true });
    });
  }

  #onSliderChange(key, rawValue) {
    // Slider domain → flag value mapping:
    //   hueIntensity, alpha, shimmerIntensity: 0-100 → 0.0-1.0
    //   brightness, saturation:                 0-200 → 0.0-2.0
    //   outlineThickness:                       0-8 integer px
    let value = rawValue;
    if (["hueIntensity", "alpha", "shimmerIntensity"].includes(key)) value = rawValue / 100;
    else if (["brightness", "saturation"].includes(key)) value = rawValue / 100;
    else if (key === "outlineThickness") value = Math.round(rawValue);
    this.#draft.visualOverrides[key] = value;
    this.#updateValueReadout(key, rawValue);
    this.#applyDraft();
  }

  #onColorChange(key, hex) {
    this.#draft.visualOverrides[key] = hex;
    const swatch = this.element.querySelector(`.luxsum-color-swatch[data-swatch="${key}"]`);
    if (swatch) swatch.style.setProperty("--swatch-color", hex);
    this.#applyDraft();
  }

  #onToggleChange(key, checked) {
    if (key === "outlineEnabled") {
      // Virtual toggle: persist as outlineThickness 0 (off) or >0 (on)
      if (!checked) {
        this.#draft.visualOverrides.outlineThickness = 0;
      } else if ((this.#draft.visualOverrides.outlineThickness ?? 0) === 0) {
        this.#draft.visualOverrides.outlineThickness = 3;
        // Update the slider DOM to reflect the new value
        const slider = this.element.querySelector('[data-bind="outlineThickness"]');
        if (slider) slider.value = "3";
        this.#updateValueReadout("outlineThickness", 3);
      }
      const body = this.element.querySelector(".luxsum-restyle-outline-body");
      if (body) body.style.display = checked ? "" : "none";
    } else if (key === "shimmer") {
      this.#draft.visualOverrides.shimmer = checked;
      const body = this.element.querySelector(".luxsum-restyle-shimmer-body");
      if (body) body.style.display = checked ? "" : "none";
    }
    this.#applyDraft();
  }

  #onMotionPresetChange(preset) {
    const intensity = PRESET_INTENSITY[preset] ?? 1.0;
    this.#draft.motionOverrides.intensity = intensity;
    // If switching from off to non-off and profile is "none", fall back to the template default.
    if (intensity > 0 && this.#draft.motionOverrides.profile === "none") {
      this.#draft.motionOverrides.profile = this.#template?.defaults?.motionProfile ?? "idle-breathing";
    }
    this.#applyDraft();
  }

  #updateValueReadout(key, rawValue) {
    const el = this.element.querySelector(`[data-value-for="${key}"]`);
    if (!el) return;
    if (["hueIntensity", "alpha", "shimmerIntensity"].includes(key)) {
      el.textContent = `${rawValue}%`;
    } else if (["brightness", "saturation"].includes(key)) {
      el.textContent = `${(rawValue / 100).toFixed(2)}×`;
    } else if (key === "outlineThickness") {
      el.textContent = `${Math.round(rawValue)} px`;
    }
  }

  #applyDraft() {
    // Live canvas update — imperative, no flag write yet.
    const tokens = this.#actor.getActiveTokens();
    for (const t of tokens) {
      applyOverridesToToken(t, this.#draft.visualOverrides, this.#draft.motionOverrides);
    }
    // Schedule debounced flag write so the change persists across reload + multi-client sync.
    this.#scheduleFlagWrite();
  }

  #scheduleFlagWrite() {
    this.#dirty = true;
    if (this.#writeTimer) clearTimeout(this.#writeTimer);
    this.#writeTimer = setTimeout(() => this.#flushFlagWrite(), AUTO_APPLY_DEBOUNCE_MS);
  }

  async #flushFlagWrite() {
    if (this.#writeTimer) {
      clearTimeout(this.#writeTimer);
      this.#writeTimer = null;
    }
    if (!this.#dirty) return;
    this.#dirty = false;
    await this.#actor.update({
      [`flags.${MODULE_ID}.visualOverrides`]: this.#draft.visualOverrides,
      [`flags.${MODULE_ID}.motionOverrides`]: this.#draft.motionOverrides
    });
    console.log(`[${MODULE_ID}] Restyle auto-applied for ${this.#actor.name}`);
  }

  async #onRevert() {
    // Discard any pending write and roll the flag back to its state when the dialog opened.
    if (this.#writeTimer) {
      clearTimeout(this.#writeTimer);
      this.#writeTimer = null;
    }
    this.#dirty = false;
    await this.#actor.update({
      [`flags.${MODULE_ID}.visualOverrides`]: this.#originalFlag.visualOverrides,
      [`flags.${MODULE_ID}.motionOverrides`]: this.#originalFlag.motionOverrides
    });
    console.log(`[${MODULE_ID}] Restyle reverted for ${this.#actor.name}`);
    await this.close();
  }

  #onReset() {
    if (!this.#template) return;
    // Copy template defaults into draft. The template's `defaults` lump visual + motion together;
    // split them back into the two override blocks.
    const d = this.#template.defaults ?? {};
    this.#draft.visualOverrides = { ...d };
    delete this.#draft.visualOverrides.motionProfile;
    delete this.#draft.visualOverrides.motionIntensity;
    this.#draft.motionOverrides = {
      profile: d.motionProfile ?? "none",
      intensity: d.motionIntensity ?? 0
    };
    this.#applyDraft();
    this.render({ force: true });
  }

  async _onClose(options) {
    // Flush any pending debounced write so closing via the X always commits current state
    // (mid-drag close shouldn't lose the last change).
    await this.#flushFlagWrite();
    await super._onClose?.(options);
    _activeRestyle = null;
  }
}

let _activeRestyle = null;

export function openRestyleApp(actor) {
  if (_activeRestyle?.rendered) _activeRestyle.close();
  _activeRestyle = new RestyleApp({ actor });
  _activeRestyle.render({ force: true });
}

export function getActiveRestyleApp() {
  return _activeRestyle?.rendered ? _activeRestyle : null;
}
