// scripts/main.js — Luxurious Summons module entry
import { registerSettings, s } from "./settings.js";
import { refreshUserIndexes } from "./data-model.js";
import { openManager } from "./manager-app.js";
import { installBrokerHook } from "./chat-broker.js";
import { installSpawnBrokerHandler } from "./spawn-engine.js";
import { applyFiltersToToken } from "./visual-filters.js";
import { installLifecycleHooks, installDeleteHandling } from "./lifecycle.js";

const MODULE_ID = "luxurious-summons";

Hooks.once("init", () => {
  console.log(`[${MODULE_ID}] init — module loading`);
  registerSettings();
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
  const buttonConfig = {
    name: MODULE_ID,
    title: "LUXSUM.SceneControl.Title",
    icon: "fa-solid fa-ghost",
    button: true,
    visible: true,
    onClick: () => openManager(),
    onChange: () => openManager()       // V13 vs V14 differ in which fires
  };
  if (Array.isArray(controls)) {
    controls.push(buttonConfig);                        // V13
  } else {
    controls[MODULE_ID] = buttonConfig;                 // V14
  }
});
