// scripts/effect-textures.js — module-scoped registry of preloaded PIXI textures
// for spawn / death animation effects. Populated once at module ready in main.js.
//
// We use a module-scoped Map instead of a window global to avoid cross-module
// pollution. Foundry plugins coexist in one global scope; named module imports
// give us isolation.

const _textures = new Map();

export function setEffectTextures(map) {
  for (const [k, v] of Object.entries(map)) _textures.set(k, v);
}

export function getEffectTexture(name) {
  return _textures.get(name);
}

export function hasEffectTextures() {
  return _textures.size > 0;
}
