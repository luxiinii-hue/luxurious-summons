// scripts/main.js — Luxurious Summons module entry
import { registerSettings, s } from "./settings.js";
import { refreshUserIndexes } from "./data-model.js";
import { openManager } from "./manager-app.js";
import { installBrokerHook } from "./chat-broker.js";
import { installSpawnBrokerHandler } from "./spawn-engine.js";
import { applyFiltersToToken } from "./visual-filters.js";
import { installLifecycleHooks, installDeleteHandling } from "./lifecycle.js";
import { installDnd5eHooks } from "./dnd5e-mods.js";
import "./handlers/simulacrum.js";   // self-registers Repair via registerHandler
import { installSheetDecorator } from "./sheet-decorator.js";
import { installSpellCastTrigger } from "./spell-trigger.js";

const MODULE_ID = "luxurious-summons";

Hooks.once("init", async () => {
  console.log(`[${MODULE_ID}] init — module loading`);
  registerSettings();

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
      "modules/luxurious-summons/templates/partials/template-card.hbs"
    ]);
    console.log(`[${MODULE_ID}] partials registered`);
  } else {
    console.warn(`[${MODULE_ID}] no loadTemplates API available — partials may not render`);
  }
});

Hooks.once("ready", async () => {
  console.log(`[${MODULE_ID}] ready — module loaded`);
  if (game.system.id !== "dnd5e") {
    ui.notifications?.warn(`[${MODULE_ID}] requires the dnd5e system; spawn features disabled on system "${game.system.id}".`);
    return;
  }
  await refreshUserIndexes();
  installBrokerHook();
  installSpawnBrokerHandler();
  installLifecycleHooks();
  installDeleteHandling();
  installDnd5eHooks();
  installSheetDecorator();
  installSpellCastTrigger();
  if (s("verboseLogging")) {
    console.log(`[${MODULE_ID}] verbose logging enabled — full diagnostic trail will print`);
  }
});

// Apply visual filters when a companion token is drawn / its overrides change
Hooks.on("drawToken", (token) => {
  applyFiltersToToken(token);
});
Hooks.on("updateActor", (actor, changes) => {
  if (changes.flags?.[MODULE_ID]?.visualOverrides) {
    for (const t of actor.getActiveTokens()) applyFiltersToToken(t);
  }
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
