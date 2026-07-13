// scripts/effect-textures.js — module-scoped registry of PIXI textures for
// spawn / death animation effects.
//
// v0.4.7 FIX 2: the original design preloaded all 4 textures once, in the
// `ready` hook. But `Game.setupGame -> initializeCanvas` runs the INITIAL
// canvas draw (and therefore drawToken -> maybeRunSpawnAnimation, for any
// companion actor with a stale spawnState left over from a prior session)
// BEFORE `Hooks.once("ready")` fires. On that boot path, getEffectTexture()
// returned undefined every time and crystalForm/particleBloom silently
// skipped their particle layer ("hexShard texture not loaded" warning).
//
// Fix: textures are now loaded lazily on first use via ensureEffectTexture(),
// with the ready-hook preload in main.js kept as a warm-up (same effect,
// just no longer load-bearing for correctness — it only shaves the latency
// of the FIRST animation that needs a given texture post-ready).
//
// We use a module-scoped Map instead of a window global to avoid cross-module
// pollution. Foundry plugins coexist in one global scope; named module imports
// give us isolation.

const MODULE_ID = "luxurious-summons";

const EFFECT_PATHS = {
  hexShard: "modules/luxurious-summons/assets/effects/hex-shard.svg",
  goldMote: "modules/luxurious-summons/assets/effects/gold-mote.svg",
  ember:    "modules/luxurious-summons/assets/effects/ember.svg",
  boneMote: "modules/luxurious-summons/assets/effects/bone-mote.svg"
};

const _textures = new Map();
// In-flight load promises, so concurrent ensureEffectTexture() calls for the
// same name (e.g. two spawn animations racing during a multi-spawn) share one
// load instead of firing duplicate network/texture-cache requests.
const _loading = new Map();

export function setEffectTextures(map) {
  for (const [k, v] of Object.entries(map)) _textures.set(k, v);
}

/**
 * Sync lookup — returns the cached texture or undefined if not yet loaded.
 * Kept for any caller that's genuinely synchronous; no animation should
 * depend on this alone anymore (see ensureEffectTexture below).
 */
export function getEffectTexture(name) {
  return _textures.get(name);
}

export function hasEffectTextures() {
  return _textures.size > 0;
}

/**
 * Async — returns the cached texture, or loads it on demand and caches it.
 * Uses the same V13/V14 texture-loader fallback chain as the ready-hook
 * preload. If the on-demand load fails (404 / offline / boot-time asset
 * race), warns once per name and resolves to undefined so callers can skip
 * the particle layer gracefully — matches the existing "texture not loaded"
 * skip behavior, just without needing the ready-hook to have already run.
 */
export async function ensureEffectTexture(name) {
  const cached = _textures.get(name);
  if (cached) return cached;

  if (_loading.has(name)) return _loading.get(name);

  const path = EFFECT_PATHS[name];
  if (!path) {
    console.warn(`[${MODULE_ID}] ensureEffectTexture: no known path for effect texture "${name}"`);
    return undefined;
  }

  const loadPromise = (async () => {
    try {
      const loader = foundry.canvas?.loadTexture ?? globalThis.loadTexture;
      const texture = loader ? await loader(path) : await PIXI.Assets.load(path);
      if (texture) {
        _textures.set(name, texture);
        console.log(`[${MODULE_ID}] ensureEffectTexture: lazily loaded "${name}" from ${path}`);
      }
      return texture;
    } catch (e) {
      console.warn(`[${MODULE_ID}] ensureEffectTexture: failed to load "${name}" from ${path}:`, e);
      return undefined;
    } finally {
      _loading.delete(name);
    }
  })();
  _loading.set(name, loadPromise);
  return loadPromise;
}

/**
 * Warm-up preload for all known effect textures — called from main.js's
 * ready hook. Failure of any single texture is non-fatal; each animation
 * call site independently retries via ensureEffectTexture on demand.
 */
export async function preloadAllEffectTextures() {
  const names = Object.keys(EFFECT_PATHS);
  const results = await Promise.all(names.map(name => ensureEffectTexture(name)));
  const loaded = results.filter(Boolean).length;
  console.log(`[${MODULE_ID}] preloadAllEffectTextures: warm-up loaded ${loaded}/${names.length} effect textures`);
  return loaded;
}
