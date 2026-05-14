// scripts/spawn-trigger-anim.js — drawToken hook handler that plays a spawn
// animation once when a freshly-spawned companion token appears on canvas.
//
// The actor flag `spawnState: "pending-spawn"` is set by performSpawn after
// token creation. This handler reads it, plays the right effect via the
// template + variant override resolution chain, and clears the flag so
// subsequent drawToken events (scene reload, token reveal) don't re-play.

import { readEffects } from "./data-model.js";

const MODULE_ID = "luxurious-summons";

export async function maybeRunSpawnAnimation(token) {
  const flag = token.actor?.flags?.[MODULE_ID];
  if (flag?.spawnState !== "pending-spawn") return;
  if (!game.settings.get(MODULE_ID, "enableDeathAnimations")) {
    // Shared "fancy effects" gate. If disabled, just clear the flag silently.
    await token.actor.unsetFlag(MODULE_ID, "spawnState");
    return;
  }
  const { templates } = await import("./templates-builtin.js");
  const template = templates.find(t => t.id === flag.templateId);
  if (!template) {
    console.warn(`[${MODULE_ID}] maybeRunSpawnAnimation: template "${flag.templateId}" not found`);
    await token.actor.unsetFlag(MODULE_ID, "spawnState");
    return;
  }
  const effects = readEffects(template);
  const variant = flag.variantId ? (template.variants ?? []).find(v => v.id === flag.variantId) : null;
  const spawnId = variant?.spawnEffectOverride ?? effects.spawn;
  if (!spawnId) {
    // No spawn animation configured (e.g., legacy template) — just clear the flag.
    await token.actor.unsetFlag(MODULE_ID, "spawnState");
    return;
  }
  const { spawnAnimations } = await import("./spawn-animations.js");
  const handler = spawnAnimations[spawnId];
  if (!handler) {
    console.warn(`[${MODULE_ID}] maybeRunSpawnAnimation: no animation registered for "${spawnId}"`);
    await token.actor.unsetFlag(MODULE_ID, "spawnState");
    return;
  }
  console.log(`[${MODULE_ID}] playing spawn animation "${spawnId}" for ${token.actor.name}`);
  try {
    await handler(token);
  } catch (e) {
    console.warn(`[${MODULE_ID}] spawn animation "${spawnId}" threw:`, e);
  }
  await token.actor.unsetFlag(MODULE_ID, "spawnState");
}
