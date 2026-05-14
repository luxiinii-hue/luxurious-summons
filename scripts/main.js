// scripts/main.js — Luxurious Summons module entry
import { registerSettings, s } from "./settings.js";
import { refreshUserIndexes } from "./data-model.js";
import { openManager } from "./manager-app.js";
import { installBrokerHook } from "./chat-broker.js";
import { installSpawnBrokerHandler } from "./spawn-engine.js";
import { applyFiltersToToken, removeMotionFromToken } from "./visual-filters.js";
import { installLifecycleHooks, installDeleteHandling, installDismissBrokerHandler, cleanupOrphanedCompanionTokens } from "./lifecycle.js";
import { installDnd5eHooks } from "./dnd5e-mods.js";
import "./handlers/simulacrum.js";   // self-registers Repair via registerHandler
import { installSheetDecorator } from "./sheet-decorator.js";
import { installSpellCastTrigger } from "./spell-trigger.js";

const MODULE_ID = "luxurious-summons";

Hooks.once("init", async () => {
  console.log(`[${MODULE_ID}] init — module loading`);
  registerSettings();

  // V14 ships fewer Handlebars helpers than V13. We need `gt` for variant-count
  // comparisons in template-gallery-card.hbs ("show variant badge if > 1").
  Handlebars.registerHelper("gt", (a, b) => Number(a) > Number(b));

  // V14: pre-register Handlebars partials. Without this, `{{> "modules/..."}}` references
  // in templates throw at render time with "The partial <path> could not be found." V13
  // may have auto-loaded partials by path; V14's HandlebarsApplicationMixin is strict and
  // expects each partial path to be registered via loadTemplates() first. See module-local
  // CLAUDE.md V14 gotchas — paid for in v0.1.6.
  const loader =
    foundry.applications?.handlebars?.loadTemplates ?? globalThis.loadTemplates;
  if (loader) {
    await loader([
      "modules/luxurious-summons/templates/partials/companion-card.hbs",
      "modules/luxurious-summons/templates/partials/template-card.hbs",
      "modules/luxurious-summons/templates/partials/summon-details.hbs",
      "modules/luxurious-summons/templates/partials/template-gallery-card.hbs"
    ]);
    console.log(`[${MODULE_ID}] partials registered`);
  } else {
    console.warn(`[${MODULE_ID}] no loadTemplates API available — partials may not render`);
  }
});

// Inject the fleur-de-lis SVG sprite once at ready. The Restyle dialog references it
// via `<use href="#luxsum-fleur"/>` for every group divider — single source of truth,
// no template duplication.
function injectFleurSprite() {
  if (document.getElementById("luxsum-fleur-sprite")) return;
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.id = "luxsum-fleur-sprite";
  svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = `<defs><symbol id="luxsum-fleur" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 C 10.5 5.5 10.5 9 12 12.5 C 13.5 9 13.5 5.5 12 2 Z"/><path d="M11.5 5 C 8 6.5 4.5 9 4 12 C 5.5 13.5 9 13.5 11 12 C 11.5 9.5 11.5 7 11.5 5 Z"/><path d="M12.5 5 C 16 6.5 19.5 9 20 12 C 18.5 13.5 15 13.5 13 12 C 12.5 9.5 12.5 7 12.5 5 Z"/><path d="M3.5 12.5 L 20.5 12.5 L 20.5 14.5 L 3.5 14.5 Z"/><path d="M12 14.5 C 10.8 17 10.8 20.5 12 22 C 13.2 20.5 13.2 17 12 14.5 Z"/></symbol></defs>`;
  document.body.appendChild(svg);
}

Hooks.once("ready", async () => {
  console.log(`[${MODULE_ID}] ready — module loaded`);
  injectFleurSprite();
  if (game.system.id !== "dnd5e") {
    ui.notifications?.warn(`[${MODULE_ID}] requires the dnd5e system; spawn features disabled on system "${game.system.id}".`);
    return;
  }
  await refreshUserIndexes();
  installBrokerHook();
  installSpawnBrokerHandler();
  installLifecycleHooks();
  installDeleteHandling();
  installDismissBrokerHandler();
  installDnd5eHooks();
  installSheetDecorator();
  installSpellCastTrigger();
  // Sweep up ghost tokens from prior sessions (companion tokens whose actor was deleted
  // without the token also being deleted — paid for in v0.3.3). GM-only by gate inside.
  await cleanupOrphanedCompanionTokens();
  if (s("verboseLogging")) {
    console.log(`[${MODULE_ID}] verbose logging enabled — full diagnostic trail will print`);
  }
});

// Apply visual filters when a companion token is drawn / its overrides change
Hooks.on("drawToken", (token) => {
  applyFiltersToToken(token);
});
Hooks.on("updateActor", (actor, changes) => {
  const moduleChanges = changes.flags?.[MODULE_ID];
  if (moduleChanges?.visualOverrides || moduleChanges?.motionOverrides) {
    for (const t of actor.getActiveTokens()) applyFiltersToToken(t);
  }
});
// Tear down motion ticker callbacks when a token is removed from the canvas
// (token deletion, scene change, etc.) so we don't leak per-frame work.
Hooks.on("destroyToken", (token) => {
  removeMotionFromToken(token);
});

Hooks.on("getSceneControlButtons", (controls) => {
  // V14 scene controls require a hierarchical structure: each top-level
  // control must have a `tools` collection. The launcher button itself goes
  // INSIDE tools as a tool with `button: true`. Without that nesting,
  // Foundry's #prepareControls does Object.entries(undefined) on the missing
  // tools field and crashes the canvas + cascades into NotesLayer.
  const tool = {
    name: MODULE_ID,
    title: "LUXSUM.SceneControl.Title",
    icon: "fa-solid fa-ghost",
    button: true,
    visible: true,
    onClick: () => openManager(),
    onChange: () => openManager()       // V13 vs V14 differ in which fires
  };
  const control = {
    name: MODULE_ID,
    title: "LUXSUM.SceneControl.Title",
    icon: "fa-solid fa-ghost",
    visible: true,
    activeTool: MODULE_ID,
    tools: { [MODULE_ID]: tool }        // V14: dict
  };
  if (Array.isArray(controls)) {
    control.tools = [tool];             // V13: array
    controls.push(control);
  } else {
    controls[MODULE_ID] = control;
  }
});
