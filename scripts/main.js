// scripts/main.js — Luxurious Summons module entry
import { registerSettings, s } from "./settings.js";
import { refreshUserIndexes } from "./data-model.js";

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
  if (s("verboseLogging")) {
    console.log(`[${MODULE_ID}] verbose logging enabled — full diagnostic trail will print`);
  }
});
