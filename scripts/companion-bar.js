// scripts/companion-bar.js — the Companion Bar (v0.8.0)
//
// The user's ask, verbatim: "making the character who summoned it have a simple
// way of changing between which of the summons they control in a simple,
// intuitive, and smooth way."
//
// Foundry's native answer is "click the token on canvas", which falls apart the
// moment your summons are off-screen, stacked, tiny (Mage Hand), or four
// identical Skeletons. This is a persistent strip of portraits docked above the
// hotbar: your own character first, then every companion you own. One click
// selects and pans. It is deliberately NOT an ApplicationV2 — a window frame
// around a six-portrait strip would be noise, and ApplicationV2's positioning
// chain has a V13 race we'd have to defend against for no benefit.
//
// Interactions:
//   click            select + pan to that token (releases other selections)
//   shift-click      ADD to the current selection — move a pack of skeletons together
//   double-click     open the sheet
//   Alt+C            cycle to the next token in the bar
//   Alt+Shift+C      select every companion at once
//
// Refresh is debounced because a 4-token Animate Dead spawn fires createActor,
// createToken and updateActor in rapid succession.

import { getCompanionFlag } from "./data-model.js";
import { s } from "./settings.js";

const MODULE_ID = "luxurious-summons";
const BAR_ID = "luxsum-companion-bar";

let _refreshHandle = null;

// ── Data ──────────────────────────────────────────────────────────────

/**
 * Locate a companion's token. Returns the live canvas token when it's on the
 * current scene, otherwise just the scene it lives on so the bar can show it
 * dimmed with a "where is it" tooltip instead of silently omitting it.
 */
function locateToken(actor) {
  const live = actor.getActiveTokens?.()[0] ?? null;
  if (live) return { token: live, onScene: true, sceneName: canvas.scene?.name ?? "" };
  for (const scene of game.scenes ?? []) {
    if (scene.tokens.some(t => t.actorId === actor.id)) {
      return { token: null, onScene: false, sceneName: scene.name };
    }
  }
  return { token: null, onScene: false, sceneName: "" };
}

/**
 * The chip label has ~60px to work with, and every companion name ends in
 * " of <master>" — so raw names truncate to "SKELETON …" for all four
 * skeletons, which is precisely the ambiguity the bar exists to remove.
 * Dropping the master's name leaves the part that actually distinguishes
 * them ("Skeleton (2)"). Full name still shows in the tooltip.
 */
export function shortLabel(name, kind, masterName) {
  if (typeof name !== "string") return "";
  if (kind === "self") return name.split(/\s+/)[0];
  if (masterName) {
    const stripped = name.replace(` of ${masterName}`, "");
    if (stripped !== name) return stripped.trim();
  }
  return name;
}

function entryFor(actor, kind) {
  const { token, onScene, sceneName } = locateToken(actor);
  const flag = getCompanionFlag(actor);
  const masterName = flag?.sourceActorId ? game.actors.get(flag.sourceActorId)?.name : null;
  const hp = actor.system?.attributes?.hp ?? {};
  const max = Number(hp.max) || 0;
  const value = Number(hp.value) || 0;
  return {
    kind,
    actor,
    actorId: actor.id,
    name: actor.name,
    label: shortLabel(actor.name, kind, masterName),
    img: actor.prototypeToken?.texture?.src || actor.img || "icons/svg/mystery-man.svg",
    onScene,
    sceneName,
    controlled: token?.controlled === true,
    hpValue: value,
    hpMax: max,
    hpPct: max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : null
  };
}

/**
 * The bar shows only what THIS user owns: their assigned character plus the
 * companions they summoned. A GM's view of everyone else's summons is the GM
 * Console's job — mirroring it here would make the bar unusable at a full table.
 */
export function collectBarEntries() {
  const entries = [];
  const self = game.user?.character;
  if (self) entries.push(entryFor(self, "self"));

  const companions = (game.actors ?? []).filter(a => {
    const flag = getCompanionFlag(a);
    return flag?.isCompanion === true && flag.sourcePlayerId === game.user.id;
  });
  // Oldest first, so a companion's position in the bar doesn't shuffle when a
  // sibling is dismissed — muscle memory matters for a control surface.
  companions.sort((a, b) => (getCompanionFlag(a)?.spawnedAt ?? 0) - (getCompanionFlag(b)?.spawnedAt ?? 0));
  for (const actor of companions) entries.push(entryFor(actor, "companion"));

  return entries;
}

// ── Actions ───────────────────────────────────────────────────────────

async function selectEntry(actorId, { additive = false } = {}) {
  const actor = game.actors.get(actorId);
  if (!actor) return;
  const token = actor.getActiveTokens?.()[0];
  if (!token) {
    const { sceneName } = locateToken(actor);
    ui.notifications?.info(
      sceneName
        ? game.i18n.format("LUXSUM.Bar.OnOtherScene", { name: actor.name, scene: sceneName })
        : game.i18n.format("LUXSUM.Bar.NoToken", { name: actor.name })
    );
    return;
  }
  token.control({ releaseOthers: !additive });
  if (!additive) await canvas.animatePan({ x: token.center.x, y: token.center.y, duration: 250 });
}

function openSheetFor(actorId) {
  game.actors.get(actorId)?.sheet?.render({ force: true });
}

/** Alt+C — step to the next token in the bar, wrapping around. */
export function cycleCompanions() {
  const entries = collectBarEntries().filter(e => e.onScene);
  if (!entries.length) return;
  const current = canvas.tokens?.controlled?.[0]?.actor?.id;
  const idx = entries.findIndex(e => e.actorId === current);
  const next = entries[(idx + 1) % entries.length];
  selectEntry(next.actorId);
}

/** Alt+Shift+C — grab the whole pack (four skeletons move as one drag). */
export function selectAllCompanions() {
  const entries = collectBarEntries().filter(e => e.onScene && e.kind === "companion");
  if (!entries.length) return;
  canvas.tokens?.releaseAll();
  for (const e of entries) game.actors.get(e.actorId)?.getActiveTokens()[0]?.control({ releaseOthers: false });
  ui.notifications?.info(game.i18n.format("LUXSUM.Bar.SelectedAll", { count: entries.length }));
}

async function toggleCollapsed() {
  await game.settings.set(MODULE_ID, "companionBarCollapsed", !s("companionBarCollapsed"));
  refreshCompanionBar();
}

// ── Rendering ─────────────────────────────────────────────────────────

// Local rather than foundry.utils.escapeHTML: actor names are user-authored and
// go straight into innerHTML here, so this must not depend on a namespaced API
// that could move between versions.
function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function hpClass(pct) {
  if (pct === null) return "";
  if (pct <= 25) return "is-critical";
  if (pct <= 50) return "is-hurt";
  return "";
}

function chipHtml(entry) {
  const classes = [
    "luxsum-bar-chip",
    entry.kind === "self" ? "is-self" : "",
    entry.controlled ? "is-controlled" : "",
    entry.onScene ? "" : "is-offscene"
  ].filter(Boolean).join(" ");

  const tooltip = entry.onScene
    ? (entry.hpPct === null ? entry.name : `${entry.name} — ${entry.hpValue}/${entry.hpMax}`)
    : game.i18n.format("LUXSUM.Bar.OnOtherScene", { name: entry.name, scene: entry.sceneName });

  // The track is always rendered, even for HP-less summons (Mage Hand), so
  // every chip keeps the same height and the row's baseline stays flat.
  const hpBar = entry.hpPct === null
    ? `<div class="luxsum-bar-hp is-empty"></div>`
    : `<div class="luxsum-bar-hp"><div class="luxsum-bar-hp-fill ${hpClass(entry.hpPct)}" style="width:${entry.hpPct}%"></div></div>`;

  return `
    <div class="${classes}" role="button" tabindex="0"
         data-actor-id="${entry.actorId}" data-tooltip="${esc(tooltip)}">
      <div class="luxsum-bar-frame">
        <img class="luxsum-bar-portrait" src="${entry.img}" alt="" draggable="false"/>
      </div>
      ${hpBar}
      <div class="luxsum-bar-name">${esc(entry.label)}</div>
    </div>`;
}

function barHtml(entries, collapsed) {
  if (collapsed) {
    return `<div class="luxsum-bar-inner is-collapsed">
      <div class="luxsum-bar-handle" role="button" tabindex="0" data-action="toggle"
           data-tooltip="${game.i18n.localize("LUXSUM.Bar.Expand")}">
        <i class="fa-solid fa-ghost"></i>
        <span class="luxsum-bar-count">${entries.filter(e => e.kind === "companion").length}</span>
      </div>
    </div>`;
  }

  const self = entries.filter(e => e.kind === "self").map(chipHtml).join("");
  const companions = entries.filter(e => e.kind === "companion").map(chipHtml).join("");
  // The fleur divider does real work here: it separates "you" from "things you
  // summoned", so the click-back-to-my-character target is never ambiguous.
  const divider = self && companions
    ? `<div class="luxsum-bar-divider" aria-hidden="true"></div>`
    : "";

  return `<div class="luxsum-bar-inner">
    ${self}${divider}${companions}
    <div class="luxsum-bar-handle" role="button" tabindex="0" data-action="toggle"
         data-tooltip="${game.i18n.localize("LUXSUM.Bar.Collapse")}">
      <i class="fa-solid fa-chevron-down"></i>
    </div>
  </div>`;
}

/**
 * Park the bar just above the macro hotbar.
 *
 * Injecting into `#ui-bottom` would be tidier, but that container's flex
 * direction and children have shifted between Foundry versions — prepending
 * into a ROW would land us beside the players list rather than above the
 * hotbar, and a wrong guess also risks shoving Foundry's own chrome around.
 * Measuring the hotbar and positioning fixed makes no layout assumptions at
 * all, and it cannot perturb anything else on screen.
 */
function positionBar(bar) {
  const hotbar = document.querySelector("#hotbar");
  // 90px ≈ hotbar height; used only if the element can't be found, where
  // sitting slightly too high beats overlapping the macro slots.
  const offset = hotbar
    ? Math.max(0, window.innerHeight - hotbar.getBoundingClientRect().top) + 6
    : 90;
  bar.style.bottom = `${offset}px`;
}

export function refreshCompanionBar() {
  const existing = document.getElementById(BAR_ID);

  if (!game.ready || !s("showCompanionBar")) {
    existing?.remove();
    return;
  }

  const entries = collectBarEntries();
  // Nothing to switch between — one lone character chip is pure clutter.
  const hasCompanions = entries.some(e => e.kind === "companion");
  if (!hasCompanions) {
    existing?.remove();
    return;
  }

  const collapsed = s("companionBarCollapsed");
  let bar = existing;
  if (!bar) {
    bar = document.createElement("div");
    bar.id = BAR_ID;
    bar.className = "luxsum luxsum-bar";
    document.body.appendChild(bar);
  }

  bar.innerHTML = barHtml(entries, collapsed);
  positionBar(bar);
}

/** Debounced — a multi-token spawn fires a burst of document hooks. */
function scheduleRefresh() {
  if (_refreshHandle) return;
  _refreshHandle = setTimeout(() => {
    _refreshHandle = null;
    try {
      refreshCompanionBar();
    } catch (e) {
      console.warn(`[${MODULE_ID}] companion bar refresh failed:`, e);
    }
  }, 60);
}

// ── Wiring ────────────────────────────────────────────────────────────

export function installCompanionBar() {
  // One delegated listener on the document, installed exactly once at ready —
  // the bar's innerHTML is replaced on every refresh, so per-element listeners
  // would have to be re-bound each time (and would leak if we forgot).
  document.addEventListener("click", (event) => {
    const bar = event.target.closest?.(`#${BAR_ID}`);
    if (!bar) return;

    const handle = event.target.closest("[data-action='toggle']");
    if (handle) { toggleCollapsed(); return; }

    const chip = event.target.closest(".luxsum-bar-chip");
    if (!chip) return;
    // Foundry's own double-click detection isn't available on plain DOM, so
    // `detail` (the browser's click counter) distinguishes the two.
    if (event.detail >= 2) openSheetFor(chip.dataset.actorId);
    else selectEntry(chip.dataset.actorId, { additive: event.shiftKey });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const chip = event.target.closest?.(`#${BAR_ID} .luxsum-bar-chip`);
    if (chip) { event.preventDefault(); selectEntry(chip.dataset.actorId); return; }
    const handle = event.target.closest?.(`#${BAR_ID} [data-action='toggle']`);
    if (handle) { event.preventDefault(); toggleCollapsed(); }
  });

  // The hotbar moves when the window resizes or the sidebar collapses, so the
  // measured offset has to be recomputed rather than captured once.
  window.addEventListener("resize", () => {
    const bar = document.getElementById(BAR_ID);
    if (bar) positionBar(bar);
  });
  Hooks.on("collapseSidebar", scheduleRefresh);

  Hooks.on("controlToken", scheduleRefresh);
  Hooks.on("canvasReady", scheduleRefresh);
  Hooks.on("createActor", scheduleRefresh);
  Hooks.on("deleteActor", scheduleRefresh);
  Hooks.on("createToken", scheduleRefresh);
  Hooks.on("deleteToken", scheduleRefresh);
  Hooks.on("updateUser", (user) => { if (user.id === game.user.id) scheduleRefresh(); });
  Hooks.on("updateActor", (actor, changes) => {
    // HP and name are the only actor fields the bar draws.
    if (changes.name !== undefined || changes.system?.attributes?.hp !== undefined) scheduleRefresh();
  });

  refreshCompanionBar();
  console.log(`[${MODULE_ID}] companion bar installed`);
}

/** Registered during `init` — Foundry rejects keybinding registration later. */
export function registerCompanionKeybindings() {
  game.keybindings.register(MODULE_ID, "cycleCompanions", {
    name: "LUXSUM.Keybind.Cycle.Name",
    hint: "LUXSUM.Keybind.Cycle.Hint",
    editable: [{ key: "KeyC", modifiers: ["Alt"] }],
    onDown: () => { cycleCompanions(); return true; }
  });
  game.keybindings.register(MODULE_ID, "selectAllCompanions", {
    name: "LUXSUM.Keybind.SelectAll.Name",
    hint: "LUXSUM.Keybind.SelectAll.Hint",
    editable: [{ key: "KeyC", modifiers: ["Alt", "Shift"] }],
    onDown: () => { selectAllCompanions(); return true; }
  });
}
