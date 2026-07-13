// previews/gm-console-preview.js — vanilla-JS wiring for the GM Console preview.
// No Foundry, no PIXI. Mock data inline. The precedence function below is the
// SAME logic that ships as resolveEffectiveMotion() in scripts/data-model.js —
// the preview doubles as a design validation of the model.

"use strict";

/* ------------------------------------------------------------------ mock data */

const PLAYERS = {
  astrid: { name: "Astrid", color: "#a78bfa" },
  brann:  { name: "Brann",  color: "#4fd1c5" }
};

const TEMPLATES = {
  "simulacrum":     { name: "Simulacrum",     thumb: "../assets/templates-thumbs/simulacrum.webp", anim: "anim-flicker" },
  "unseen-servant": { name: "Unseen Servant", thumb: "../assets/tokens/unseen-servant.webp",       anim: "anim-breathe" },
  "mage-hand":      { name: "Mage Hand",      thumb: "../assets/tokens/mage-hand.webp",            anim: "anim-bob" },
  "summon-dragon":  { name: "Summon Dragon",  thumb: "../assets/variants/dragon-cold.webp",        anim: "anim-breathe" }
};

const COMPANIONS = [
  { id: "c1", name: "Simulacrum of Elara", templateId: "simulacrum",     ownerId: "astrid",
    tokenImg: "../assets/templates-thumbs/simulacrum.webp", borderColor: "#88ccff",
    hp: [22, 44], scene: null, motionIntensity: 0.6 },
  { id: "c2", name: "Unseen Servant",      templateId: "unseen-servant", ownerId: "astrid",
    tokenImg: "../assets/tokens/unseen-servant.webp", borderColor: "#c9a14b",
    hp: [1, 1],  scene: null, motionIntensity: 1.0 },
  { id: "c3", name: "Mage Hand",           templateId: "mage-hand",      ownerId: "brann",
    tokenImg: "../assets/tokens/mage-hand.webp", borderColor: "#5cd3e8",
    hp: [1, 1],  scene: null, motionIntensity: 1.0 },
  { id: "c4", name: "Frostwing",           templateId: "summon-dragon",  ownerId: "brann",
    tokenImg: "../assets/variants/dragon-cold.webp", borderColor: "#c8e8f0",
    hp: [50, 50], scene: "The Crypt", motionIntensity: 1.0 }
];

/* --------------------------------------------------------------------- state */

const state = {
  gmMotionEnabled: true,
  gmMotionIntensity: 1.0,                 // 0–1.5
  gmForceDisableFilters: false,
  templateOverrides: {},                  // { [tid]: { motionEnabled?, motionIntensity? } }
  gmOverrides: {},                        // { [companionId]: { motionEnabled? } }
  playerFilter: null                      // null = all
};

/* ---------------------------------------------------- the precedence function */
// Mirrors scripts/data-model.js resolveEffectiveMotion(companionFlag, templateOverrides, gmGlobals)

function resolveEffectiveMotion(companion, templateOverrides, gmGlobals) {
  if (gmGlobals.gmMotionEnabled === false) return 0;
  if (gmGlobals.gmForceDisableFilters === true) return 0;
  const perCompanion = state.gmOverrides[companion.id] ?? {};
  if (perCompanion.motionEnabled === false) return 0;
  const perTemplate = templateOverrides[companion.templateId] ?? {};
  if (perTemplate.motionEnabled === false) return 0;
  const base = perCompanion.motionIntensity
            ?? perTemplate.motionIntensity
            ?? companion.motionIntensity
            ?? 1.0;
  return base * (gmGlobals.gmMotionIntensity ?? 1.0);
}

/* ---------------------------------------------------------------- rendering */

const PRESETS = { off: 0, subtle: 0.5, default: 1.0, lively: 1.5 };

function intensityToPreset(i) {
  if (i === 0) return "off";
  if (i <= 0.5) return "subtle";
  if (i <= 1.0) return "default";
  return "lively";
}

function activeTemplateIds() {
  return [...new Set(COMPANIONS.map(c => c.templateId))];
}

function renderTemplateRows() {
  const host = document.getElementById("gm-template-rows");
  host.innerHTML = "";
  for (const tid of activeTemplateIds()) {
    const t = TEMPLATES[tid];
    const ov = state.templateOverrides[tid] ?? {};
    const enabled = ov.motionEnabled !== false;
    const preset = intensityToPreset(ov.motionIntensity ?? 1.0);
    const row = document.createElement("div");
    row.className = "luxsum-gm-template-row" + (enabled ? "" : " luxsum-gm-template-row-off");
    row.innerHTML = `
      <img class="luxsum-gm-template-thumb" src="${t.thumb}" alt="">
      <span class="luxsum-gm-template-name">${t.name}</span>
      <label class="luxsum-toggle" title="Idle motion for every ${t.name} token">
        <input type="checkbox" class="luxsum-toggle-input" data-tid="${tid}" ${enabled ? "checked" : ""}>
        <span class="luxsum-toggle-track"><span class="luxsum-toggle-lever"></span></span>
      </label>
      <div class="luxsum-motion-presets" role="radiogroup">
        ${Object.keys(PRESETS).map(p => `
          <input type="radio" name="tpl-preset-${tid}" id="tpl-${tid}-${p}" value="${p}" ${p === preset ? "checked" : ""} ${enabled ? "" : "disabled"}>
          <label for="tpl-${tid}-${p}" class="luxsum-motion-preset-label">${p[0].toUpperCase() + p.slice(1)}</label>
        `).join("")}
      </div>`;
    row.querySelector(".luxsum-toggle-input").addEventListener("change", e => {
      state.templateOverrides[tid] = { ...(state.templateOverrides[tid] ?? {}), motionEnabled: e.target.checked };
      renderTemplateRows(); applyMotion();
      toast(`${t.name}: idle motion ${e.target.checked ? "on" : "off"} (all tokens)`);
    });
    row.querySelectorAll(`input[type="radio"]`).forEach(r => r.addEventListener("change", e => {
      state.templateOverrides[tid] = { ...(state.templateOverrides[tid] ?? {}), motionIntensity: PRESETS[e.target.value] };
      applyMotion();
    }));
    host.appendChild(row);
  }
}

function renderFilters() {
  const host = document.getElementById("gm-filters");
  host.innerHTML = "";
  const mkChip = (label, color, key) => {
    const chip = document.createElement("span");
    chip.className = "luxsum-gm-chip" + ((state.playerFilter ?? null) === key ? " active" : "");
    chip.innerHTML = (color ? `<span class="luxsum-gm-chip-dot" style="--chip-color:${color}"></span>` : "") + label;
    chip.addEventListener("click", () => { state.playerFilter = key; renderFilters(); renderGrid(); });
    return chip;
  };
  host.appendChild(mkChip("All players", null, null));
  for (const [pid, p] of Object.entries(PLAYERS)) host.appendChild(mkChip(p.name, p.color, pid));
}

function renderGrid() {
  const host = document.getElementById("gm-grid");
  host.innerHTML = "";
  const visible = COMPANIONS.filter(c => !state.playerFilter || c.ownerId === state.playerFilter);
  document.getElementById("gm-roster-count").textContent = `— ${visible.length} of ${COMPANIONS.length}`;
  if (!visible.length) {
    host.innerHTML = `<div class="luxsum-gm-empty" style="grid-column: 1/-1">No active companions match this filter.</div>`;
    return;
  }
  for (const c of visible) {
    const owner = PLAYERS[c.ownerId];
    const t = TEMPLATES[c.templateId];
    const motionOn = (state.gmOverrides[c.id]?.motionEnabled) !== false;
    const hpPct = Math.round((c.hp[0] / c.hp[1]) * 100);
    const offScene = !!c.scene;
    const card = document.createElement("div");
    card.className = "luxsum-gm-card";
    card.style.borderLeftColor = c.borderColor;
    card.innerHTML = `
      <div class="luxsum-gm-card-head">
        <img class="luxsum-gm-card-token ${t.anim}" data-cid="${c.id}" src="${c.tokenImg}" alt="">
        <div class="luxsum-gm-card-title">
          <h3 class="luxsum-gm-card-name">${c.name}</h3>
          <span class="luxsum-gm-card-template">${t.name}</span>
        </div>
      </div>
      <span class="luxsum-gm-owner" style="--owner-color:${owner.color}"><span class="luxsum-gm-chip-dot"></span>${owner.name}</span>
      <div class="luxsum-gm-hp"><span>HP ${c.hp[0]}/${c.hp[1]}</span><div class="luxsum-gm-hp-bar"><div class="luxsum-gm-hp-fill" style="--hp-pct:${hpPct}%"></div></div></div>
      ${offScene ? `<span class="luxsum-gm-card-scene">On scene: ${c.scene}</span>` : ""}
      <div class="luxsum-gm-card-actions">
        <span role="button" tabindex="0" title="Open character sheet"><i class="fa-solid fa-id-card"></i> Sheet</span>
        <span role="button" tabindex="0" class="${offScene ? "disabled" : ""}" title="${offScene ? "Token is on another scene" : "Select token and pan to it"}"><i class="fa-solid fa-crosshairs"></i> Pan</span>
        <span role="button" tabindex="0" title="Open the full Restyle dialog for this companion"><i class="fa-solid fa-palette"></i> Restyle</span>
        <span role="button" tabindex="0" class="luxsum-gm-motion-btn ${motionOn ? "" : "motion-off"}" data-cid="${c.id}"
              title="${motionOn ? "Idle motion ON — click to freeze this companion" : "Idle motion OFF (GM) — click to restore"}">
          <i class="fa-solid ${motionOn ? "fa-wind" : "fa-snowflake"}"></i> Motion
        </span>
        <span role="button" tabindex="0" class="luxsum-gm-dismiss-btn" data-cid="${c.id}" title="Force-dismiss (death animation + full cleanup)"><i class="fa-solid fa-skull"></i> Dismiss</span>
      </div>`;
    card.querySelector(".luxsum-gm-motion-btn").addEventListener("click", () => {
      const cur = (state.gmOverrides[c.id]?.motionEnabled) !== false;
      state.gmOverrides[c.id] = { motionEnabled: !cur };
      renderGrid(); applyMotion();
      toast(`${c.name}: idle motion ${cur ? "frozen" : "restored"} (GM override)`);
    });
    card.querySelector(".luxsum-gm-dismiss-btn").addEventListener("click", () => {
      toast(`(preview) Would force-dismiss ${c.name} — death animation, token + actor cleanup`);
    });
    card.querySelector('[title*="Restyle"]').addEventListener("click", () => {
      toast(`(preview) Would open the Restyle dialog for ${c.name}`);
    });
    host.appendChild(card);
  }
  applyMotion();
}

/* --------------------------------------------------- motion demo application */

function applyMotion() {
  const gmGlobals = {
    gmMotionEnabled: state.gmMotionEnabled,
    gmMotionIntensity: state.gmMotionIntensity,
    gmForceDisableFilters: state.gmForceDisableFilters
  };
  for (const c of COMPANIONS) {
    const img = document.querySelector(`.luxsum-gm-card-token[data-cid="${c.id}"]`);
    if (!img) continue;
    const amp = resolveEffectiveMotion(c, state.templateOverrides, gmGlobals);
    img.style.setProperty("--amp", String(amp));
    img.style.animationPlayState = amp === 0 ? "paused" : "running";
    if (amp === 0) { // reset to rest pose
      img.style.animation = "none";
      void img.offsetWidth; // reflow to restart cleanly when re-enabled
      img.style.animation = "";
      img.style.animationPlayState = "paused";
    }
  }
}

/* ------------------------------------------------------------- global wiring */

document.getElementById("gm-motion-enabled").addEventListener("change", e => {
  state.gmMotionEnabled = e.target.checked;
  document.getElementById("gm-intensity-row").classList.toggle("luxsum-gm-row-disabled", !e.target.checked);
  applyMotion();
  toast(`Idle animations ${e.target.checked ? "enabled" : "disabled"} world-wide`);
});

document.getElementById("gm-motion-intensity").addEventListener("input", e => {
  state.gmMotionIntensity = Number(e.target.value) / 100;
  document.getElementById("gm-motion-intensity-value").textContent = `${e.target.value}%`;
  applyMotion();
});

document.getElementById("gm-force-no-filters").addEventListener("change", e => {
  state.gmForceDisableFilters = e.target.checked;
  applyMotion();
  toast(`All token effects ${e.target.checked ? "DISABLED" : "restored"} world-wide${e.target.checked ? " (tint only)" : ""}`);
});

document.getElementById("gm-force-no-spawn-death").addEventListener("change", e => {
  toast(`Spawn & death animations ${e.target.checked ? "disabled" : "enabled"} world-wide`);
});

document.getElementById("gm-show-all-templates").addEventListener("click", e => {
  e.preventDefault();
  toast("(preview) Would expand to all 14 templates — rows identical to the ones above");
});

/* ------------------------------------------------------------------- toast */

let _toastTimer = null;
function toast(msg) {
  const el = document.getElementById("gmprev-toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

/* --------------------------------------------------------------------- init */

renderTemplateRows();
renderFilters();
renderGrid();
