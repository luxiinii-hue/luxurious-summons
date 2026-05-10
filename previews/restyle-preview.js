// previews/restyle-preview.js — Standalone preview wiring (no Foundry, no PIXI).
//
// Validates the Restyle dialog's visual + interaction model without touching the live module.
// Reads control values, updates CSS variables on the mock token, and lets you switch between
// three template flavors (Simulacrum / Mage Hand / Familiar) so the gold-and-wine chrome can
// be evaluated against both hextech and Belle Époque templates.
//
// In real Foundry, restyle-app.js does the analogous wiring against actual PIXI filters +
// the motion ticker. This file is intentionally not used in production.

// ── Template flavor defaults ──────────────────────────────────────────────

const TEMPLATES = {
  simulacrum: {
    name: "Daisy",
    titleNoun: "Restyle",
    family: "hextech",
    silhouette: "silh-simulacrum",
    fallbackBg: "#88ccff",
    summonDetails: {
      name: "Snowflake",
      type: "Construct (illusion), neutral",
      flavor: "An icy duplicate of the caster. Half HP, no natural recovery, snapshot spell slots.",
      hp: "31 / 31",
      ac: 12,
      speed: "30 ft",
      abilities: [
        { name: "STR", score: 10, save: false },
        { name: "DEX", score: 14, save: false },
        { name: "CON", score: 12, save: false },
        { name: "INT", score: 18, save: true },
        { name: "WIS", score: 13, save: true },
        { name: "CHA", score: 14, save: false }
      ],
      saves: [
        { ability: "INT", modifier: "+6" },
        { ability: "WIS", modifier: "+3" }
      ],
      descriptionOnly: false
    },
    defaults: {
      tintColor: "#88ccff", tintStrength: 18,
      brightness: 105, vibrance: 130,
      alpha: 88,
      outlineEnabled: true, outlineColor: "#aaffff", outlineThickness: 3,
      shimmerEnabled: true, shimmerStrength: 35,
      motionPreset: "default", motionProfile: "flame-flicker",
      motionFloat: 0, motionSway: 0, motionPulse: 0,
      namePrefix: "Simulacrum of ", nameSuffix: "",
      cardBorder: "#88ccff",
      titleAccent: "#9eecf5"
    }
  },
  "mage-hand": {
    name: "Spectral Hand",
    titleNoun: "Restyle",
    family: "hextech",
    silhouette: "silh-magehand",
    fallbackBg: "#c9a14b",
    summonDetails: {
      name: "Spectral Hand",
      type: "Magical effect (force)",
      flavor: "A ghostly disembodied hand of arcane force. Lifts up to 10 lb, manipulates objects, reaches 30 ft from the caster. Lasts 1 minute per cast.",
      descriptionOnly: true
    },
    defaults: {
      tintColor: "#c9a14b", tintStrength: 28,
      brightness: 110, vibrance: 95,
      alpha: 92,
      outlineEnabled: true, outlineColor: "#7ea9ff", outlineThickness: 4,
      shimmerEnabled: false, shimmerStrength: 0,
      motionPreset: "default", motionProfile: "floating-hand",
      motionFloat: 0, motionSway: 0, motionPulse: 0,
      namePrefix: "", nameSuffix: "",
      cardBorder: "#c9a14b",
      titleAccent: "#7ea9ff"
    }
  },
  familiar: {
    name: "Snowy",
    titleNoun: "Restyle",
    family: "belle-epoque",
    silhouette: "silh-owl",
    fallbackBg: "#e8dcc4",
    summonDetails: {
      name: "Snowy",
      type: "Beast (familiar), unaligned",
      flavor: "A wise companion. Sharp senses, telepathic bond to the caster, fully obedient.",
      hp: "1 / 1",
      ac: 11,
      speed: "5 ft · fly 60 ft",
      abilities: [
        { name: "STR", score: 3, save: false },
        { name: "DEX", score: 13, save: false },
        { name: "CON", score: 8, save: false },
        { name: "INT", score: 2, save: false },
        { name: "WIS", score: 12, save: false },
        { name: "CHA", score: 7, save: false }
      ],
      saves: [],
      descriptionOnly: false
    },
    defaults: {
      tintColor: "#e8dcc4", tintStrength: 12,
      brightness: 100, vibrance: 100,
      alpha: 100,
      outlineEnabled: false, outlineColor: "#c9a14b", outlineThickness: 2,
      shimmerEnabled: false, shimmerStrength: 0,
      motionPreset: "subtle", motionProfile: "idle-breathing",
      motionFloat: 0, motionSway: 0, motionPulse: 0,
      namePrefix: "", nameSuffix: ", Familiar",
      cardBorder: "#c9a14b",
      titleAccent: "#f0c97a"
    }
  }
};

// Preset → intensity multiplier (matches design spec §6).
const PRESET_INTENSITY = { off: 0, subtle: 0.5, default: 1.0, lively: 1.5 };

// ── DOM refs ──────────────────────────────────────────────────────────────

const dom = {
  // Stage / preview token
  stage: document.getElementById("stage"),
  previewToken: document.getElementById("preview-token"),
  previewTokenSvg: document.getElementById("preview-token-svg"),
  previewNameplate: document.getElementById("preview-nameplate"),

  // Summon details card
  sdCard: document.getElementById("summon-details"),
  sdName: document.getElementById("sd-name"),
  sdType: document.getElementById("sd-type"),
  sdFlavor: document.getElementById("sd-flavor"),
  sdHp: document.getElementById("sd-hp"),
  sdAc: document.getElementById("sd-ac"),
  sdSpeed: document.getElementById("sd-speed"),
  sdAbilities: document.getElementById("sd-abilities"),
  sdSaves: document.getElementById("sd-saves"),
  sdOpenSheet: document.getElementById("sd-open-sheet"),

  // Dialog title
  dialogTitle: document.getElementById("dialog-title"),
  dialog: document.getElementById("restyle-dialog"),

  // Controls
  tintColor: document.getElementById("ctrl-tint-color"),
  tintStrength: document.getElementById("ctrl-tint-strength"),
  brightness: document.getElementById("ctrl-brightness"),
  vibrance: document.getElementById("ctrl-vibrance"),
  alpha: document.getElementById("ctrl-alpha"),
  outlineEnabled: document.getElementById("ctrl-outline-enabled"),
  outlineColor: document.getElementById("ctrl-outline-color"),
  outlineThickness: document.getElementById("ctrl-outline-thickness"),
  shimmerEnabled: document.getElementById("ctrl-shimmer-enabled"),
  shimmerStrength: document.getElementById("ctrl-shimmer-strength"),
  motionProfile: document.getElementById("ctrl-motion-profile"),
  motionFloat: document.getElementById("ctrl-motion-float"),
  motionSway: document.getElementById("ctrl-motion-sway"),
  motionPulse: document.getElementById("ctrl-motion-pulse"),
  namePrefix: document.getElementById("ctrl-name-prefix"),
  nameSuffix: document.getElementById("ctrl-name-suffix"),
  cardBorder: document.getElementById("ctrl-card-border"),

  // Swatches
  swatchTint: document.getElementById("swatch-tint"),
  swatchOutline: document.getElementById("swatch-outline"),
  swatchCard: document.getElementById("swatch-card"),

  // Value readouts
  valTintStrength: document.getElementById("val-tint-strength"),
  valBrightness: document.getElementById("val-brightness"),
  valVibrance: document.getElementById("val-vibrance"),
  valAlpha: document.getElementById("val-alpha"),
  valOutlineThickness: document.getElementById("val-outline-thickness"),
  valShimmerStrength: document.getElementById("val-shimmer-strength"),
  valMotionFloat: document.getElementById("val-motion-float"),
  valMotionSway: document.getElementById("val-motion-sway"),
  valMotionPulse: document.getElementById("val-motion-pulse"),

  // Outline / shimmer sub-bodies (for collapse when toggle off)
  outlineBody: document.getElementById("outline-body"),
  shimmerBody: document.getElementById("shimmer-body"),

  // Preview switchers
  flavorButtons: document.querySelectorAll(".luxsum-preview-flavor-btn"),
  thumbToggle: document.getElementById("thumb-toggle"),
};

// ── Helpers ───────────────────────────────────────────────────────────────

// Convert "#rrggbb" to {r,g,b} 0-255 ints.
function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return { r: 200, g: 200, b: 200 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

// Approximate hue rotation in degrees from a target color, relative to a neutral white starting
// point. Used to convert the user's tint color into a CSS hue-rotate value for the preview.
// This is intentionally rough — PIXI's tint blends multiplicatively, CSS hue-rotate can't
// match it exactly, and that mismatch is documented in the spec (§5.2).
function hexToHueDeg(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  if (max === min) return 0;
  const d = max - min;
  let h;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return Math.round(h * 60);
}

// Set CSS var on the token element.
function setVar(name, value) {
  dom.previewToken.style.setProperty(name, value);
}

// Format a D&D 5e ability modifier from a raw score: floor((score - 10) / 2), signed.
function formatModifier(score) {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

// Render the summon details card for a given template's summonDetails block.
function renderSummonDetails(details) {
  if (!details) return;

  // Toggle the "description-only" variant (hides vitals/abilities/saves) for non-creature
  // summons like Mage Hand. The DOM stays the same; CSS hides the irrelevant sections.
  dom.sdCard.classList.toggle("description-only", !!details.descriptionOnly);

  dom.sdName.textContent = details.name ?? "";
  dom.sdType.textContent = details.type ?? "";
  dom.sdFlavor.textContent = details.flavor ?? "";

  if (!details.descriptionOnly) {
    dom.sdHp.textContent = details.hp ?? "—";
    dom.sdAc.textContent = (details.ac ?? "—").toString();
    dom.sdSpeed.textContent = details.speed ?? "—";

    // Ability score cells — 6 in a 2 × 3 grid.
    dom.sdAbilities.innerHTML = "";
    for (const abil of (details.abilities ?? [])) {
      const cell = document.createElement("div");
      cell.className = "luxsum-ability";
      if (abil.save) cell.classList.add("has-save-prof");
      const name = document.createElement("span");
      name.className = "luxsum-ability-name";
      name.textContent = abil.name;
      const score = document.createElement("span");
      score.className = "luxsum-ability-score";
      score.textContent = abil.score.toString();
      const mod = document.createElement("span");
      mod.className = "luxsum-ability-mod";
      mod.textContent = formatModifier(abil.score);
      cell.append(name, score, mod);
      dom.sdAbilities.appendChild(cell);
    }

    // Save-prof chips — rebuild after the label span so the label stays first.
    while (dom.sdSaves.lastChild && !dom.sdSaves.lastChild.classList?.contains("luxsum-summon-details-saves-label")) {
      dom.sdSaves.removeChild(dom.sdSaves.lastChild);
    }
    if (details.saves && details.saves.length > 0) {
      for (const s of details.saves) {
        const chip = document.createElement("span");
        chip.className = "luxsum-save-prof";
        chip.textContent = `${s.ability} ${s.modifier}`;
        dom.sdSaves.appendChild(chip);
      }
      dom.sdSaves.style.display = "";
    } else {
      // Hide the whole row when nothing to show (Familiar example has no save profs).
      dom.sdSaves.style.display = "none";
    }
  }
}

// ── Apply current control state to the token preview ─────────────────────

function applyAllToToken() {
  const tintColor = dom.tintColor.value;
  const tintStrength = parseInt(dom.tintStrength.value, 10);
  const brightness = parseInt(dom.brightness.value, 10);
  const vibrance = parseInt(dom.vibrance.value, 10);
  const alpha = parseInt(dom.alpha.value, 10);
  const outlineEnabled = dom.outlineEnabled.checked;
  const outlineColor = dom.outlineColor.value;
  const outlineThickness = parseInt(dom.outlineThickness.value, 10);
  const shimmerEnabled = dom.shimmerEnabled.checked;
  const shimmerStrength = parseInt(dom.shimmerStrength.value, 10);

  // ── Filters ───
  // Token background color = the tint (since we're applying the tint as the actual background
  // beneath the silhouette). In real PIXI this would be a multiplicative blend.
  setVar("--swatch-color", tintColor);

  // CSS filter pipeline. Hue-rotate is approximate; in PIXI we'd use a ColorMatrixFilter.
  // Strength blends between "no rotate" and "full rotate to target color." This is intentionally
  // a UI hint, not pixel-accurate.
  setVar("--filter-hue", `${(hexToHueDeg(tintColor) - 200) * (tintStrength / 100)}deg`);
  setVar("--filter-brightness", brightness / 100);
  setVar("--filter-saturate", vibrance / 100);
  setVar("--filter-alpha", alpha / 100);
  setVar("--filter-outline-thickness", outlineEnabled ? `${outlineThickness * 2}px` : "0px");
  setVar("--filter-outline-color", outlineEnabled ? outlineColor : "transparent");

  // ── Shimmer (preview-only approximation; real PIXI uses DisplacementFilter) ───
  // Toggle on the stage (not the token) so the shimmer composites cleanly over the token's
  // background. Sets --shimmer-strength so the radial-gradient + rotating-sheen layers can
  // scale their alpha by the slider value.
  const shimmerOn = shimmerEnabled && shimmerStrength > 0;
  dom.stage.classList.toggle("shimmering", shimmerOn);
  dom.stage.style.setProperty("--shimmer-strength", (shimmerStrength / 100).toFixed(2));

  // ── Motion ───
  const presetEl = document.querySelector('input[name="motion-preset"]:checked');
  const preset = presetEl ? presetEl.value : "default";
  let intensity = PRESET_INTENSITY[preset] ?? 1.0;

  // Advanced axes override the preset when any are non-zero — they let the user dial in a
  // custom motion shape rather than a uniform intensity multiplier.
  const float = parseInt(dom.motionFloat.value, 10);
  const sway = parseInt(dom.motionSway.value, 10);
  const pulse = parseInt(dom.motionPulse.value, 10);
  const advancedTouched = float > 0 || sway > 0 || pulse > 0;
  if (advancedTouched) {
    // Average the three axes (rough but communicates the idea).
    intensity = (float + sway + pulse) / 300;
  }

  setVar("--motion-intensity", intensity);

  // Apply motion class.
  const profile = dom.motionProfile.value;
  const classList = dom.previewToken.classList;
  ["motion-none", "motion-floating-hand", "motion-ethereal-drift",
   "motion-mirror-wobble", "motion-idle-breathing", "motion-flame-flicker"].forEach(c => classList.remove(c));
  if (intensity > 0 && profile !== "none") {
    classList.add(`motion-${profile}`);
  } else {
    classList.add("motion-none");
  }

  // ── Swatches ───
  dom.swatchTint.style.setProperty("--swatch-color", tintColor);
  dom.swatchOutline.style.setProperty("--swatch-color", outlineColor);
  dom.swatchCard.style.setProperty("--swatch-color", dom.cardBorder.value);

  // ── Value readouts ───
  dom.valTintStrength.textContent = `${tintStrength}%`;
  dom.valBrightness.textContent = `${(brightness / 100).toFixed(2)}×`;
  dom.valVibrance.textContent = `${(vibrance / 100).toFixed(2)}×`;
  dom.valAlpha.textContent = `${alpha}%`;
  dom.valOutlineThickness.textContent = `${outlineThickness} px`;
  dom.valShimmerStrength.textContent = `${shimmerStrength}%`;
  dom.valMotionFloat.textContent = `${float}%`;
  dom.valMotionSway.textContent = `${sway}%`;
  dom.valMotionPulse.textContent = `${pulse}%`;

  // ── Conditional control bodies (hide sub-controls when toggle off) ───
  dom.outlineBody.style.display = outlineEnabled ? "" : "none";
  dom.shimmerBody.style.display = shimmerEnabled ? "" : "none";

  // ── Nameplate ───
  const baseName = dom.dialogTitle.dataset.baseName || "Daisy";
  dom.previewNameplate.textContent = `${dom.namePrefix.value}${baseName}${dom.nameSuffix.value}`;
}

// ── Load template defaults into the dialog ────────────────────────────────

function loadTemplate(key) {
  const tpl = TEMPLATES[key];
  if (!tpl) return;
  const d = tpl.defaults;

  // Dialog title — uses template name + template-themed title-accent CSS variable.
  dom.dialogTitle.textContent = `${tpl.titleNoun}: ${tpl.name}`;
  dom.dialogTitle.dataset.baseName = tpl.name;
  dom.dialog.style.setProperty("--luxsum-title-accent", d.titleAccent);

  // Preview token silhouette
  dom.previewTokenSvg.innerHTML = `<use href="#${tpl.silhouette}"/>`;

  // Push every control value
  dom.tintColor.value = d.tintColor;
  dom.tintStrength.value = d.tintStrength;
  dom.brightness.value = d.brightness;
  dom.vibrance.value = d.vibrance;
  dom.alpha.value = d.alpha;
  dom.outlineEnabled.checked = d.outlineEnabled;
  dom.outlineColor.value = d.outlineColor;
  dom.outlineThickness.value = d.outlineThickness;
  dom.shimmerEnabled.checked = d.shimmerEnabled;
  dom.shimmerStrength.value = d.shimmerStrength;
  dom.motionProfile.value = d.motionProfile;
  dom.motionFloat.value = d.motionFloat;
  dom.motionSway.value = d.motionSway;
  dom.motionPulse.value = d.motionPulse;
  dom.namePrefix.value = d.namePrefix;
  dom.nameSuffix.value = d.nameSuffix;
  dom.cardBorder.value = d.cardBorder;

  // Motion preset radio
  const presetInput = document.getElementById(`motion-${d.motionPreset}`);
  if (presetInput) presetInput.checked = true;

  // Render the summon details info card
  renderSummonDetails(tpl.summonDetails);

  // Re-apply everything
  applyAllToToken();

  // Mark active flavor button
  dom.flavorButtons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.template === key);
  });
}

// ── Event wiring ──────────────────────────────────────────────────────────

// All controls — apply on every input event for live preview feel.
const liveControls = [
  dom.tintColor, dom.tintStrength,
  dom.brightness, dom.vibrance,
  dom.alpha,
  dom.outlineEnabled, dom.outlineColor, dom.outlineThickness,
  dom.shimmerEnabled, dom.shimmerStrength,
  dom.motionProfile, dom.motionFloat, dom.motionSway, dom.motionPulse,
  dom.namePrefix, dom.nameSuffix,
  dom.cardBorder
];
liveControls.forEach(el => {
  el.addEventListener("input", applyAllToToken);
  el.addEventListener("change", applyAllToToken);
});

// Motion preset radios
document.querySelectorAll('input[name="motion-preset"]').forEach(radio => {
  radio.addEventListener("change", applyAllToToken);
});

// Template flavor switcher
dom.flavorButtons.forEach(btn => {
  btn.addEventListener("click", () => loadTemplate(btn.dataset.template));
});

// Thumb-shape toggle (round ↔ hex)
dom.thumbToggle.addEventListener("click", () => {
  const isHex = dom.dialog.classList.toggle("thumbs-hex");
  dom.thumbToggle.classList.toggle("hex", isHex);
  dom.thumbToggle.textContent = isHex ? "⬡ Hex thumbs" : "○ Round thumbs";
});

// Reset / Cancel / Save — preview no-ops with a visual confirmation.
document.getElementById("btn-reset").addEventListener("click", () => {
  const activeFlavor = document.querySelector(".luxsum-preview-flavor-btn.active");
  if (activeFlavor) loadTemplate(activeFlavor.dataset.template);
});

document.getElementById("btn-cancel").addEventListener("click", () => {
  flashButton("btn-cancel");
});

document.getElementById("btn-save").addEventListener("click", () => {
  flashButton("btn-save");
});

document.querySelector(".header-button.close").addEventListener("click", () => {
  flashButton("btn-cancel"); // X behaves as Cancel per spec §4.6
});

function flashButton(id) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.style.boxShadow = "0 0 0 4px var(--luxsum-accent-hi)";
  setTimeout(() => { btn.style.boxShadow = ""; }, 200);
}

// Open Foundry Sheet — preview no-op with visible feedback.
dom.sdOpenSheet.addEventListener("click", () => {
  flashButton("sd-open-sheet");
  // In real Foundry: actor.sheet.render({ force: true });
});

// ── Initial load ──────────────────────────────────────────────────────────

loadTemplate("simulacrum");
