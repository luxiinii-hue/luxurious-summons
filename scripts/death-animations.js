// scripts/death-animations.js — per-template PIXI death animations
//
// Plan 1 ships icyShatter (Simulacrum) + softFade (manual dismiss + fallback).
// The other 4 (glassShatter, smokeDissipation, boneCollapse, pop) land in Plan 3.
//
// Each animation receives a Token instance and returns a Promise that resolves
// when the animation completes. Cleanup contract: do NOT delete the token —
// that's the lifecycle hook's job. Just animate.

import { tweenWithTicker, easeOutCubic } from "./tween.js";
import { ensureEffectTexture } from "./effect-textures.js";

const MODULE_ID = "luxurious-summons";

export const deathAnimations = {
  /**
   * icyShatter — desaturate, scale 1.1×, alpha fade with a frost-particle burst.
   * 600ms total. Used for Simulacrum.
   */
  icyShatter: async (token) => {
    if (!token?.mesh) return;
    const mesh = token.mesh;
    const startScale = mesh.scale.x;
    const startAlpha = mesh.alpha;

    const desat = new PIXI.ColorMatrixFilter();
    desat.saturate(-1, false);
    const prevFilters = mesh.filters ?? [];
    mesh.filters = [...prevFilters, desat];

    const layer = canvas.interface;
    const particles = [];
    const cx = token.center.x;
    const cy = token.center.y;
    for (let i = 0; i < 12; i++) {
      const p = new PIXI.Graphics();
      p.beginFill(0xddffff, 0.9);
      p.drawCircle(0, 0, 4);
      p.endFill();
      const angle = (i / 12) * Math.PI * 2;
      p._vx = Math.cos(angle) * 80;
      p._vy = Math.sin(angle) * 80;
      p.x = cx; p.y = cy;
      layer.addChild(p);
      particles.push(p);
    }

    await tweenWithTicker(600, (t) => {
      const eased = easeOutCubic(t);
      mesh.scale.set(startScale * (1 + 0.1 * eased));
      mesh.alpha = startAlpha * (1 - eased);
      for (const p of particles) {
        p.x = cx + p._vx * eased;
        p.y = cy + p._vy * eased;
        p.alpha = 1 - eased;
      }
    });

    for (const p of particles) {
      layer.removeChild(p);
      p.destroy();
    }
    mesh.filters = prevFilters;
  },

  /**
   * softFade — alpha 1→0 + slight scale-down. 400ms. Used as the no-family
   * fallback for any template whose `effects.death` doesn't match a known entry.
   */
  softFade: async (token) => {
    if (!token?.mesh) return;
    const mesh = token.mesh;
    const startScale = mesh.scale.x;
    const startAlpha = mesh.alpha;
    await tweenWithTicker(400, (t) => {
      mesh.alpha = startAlpha * (1 - t);
      mesh.scale.set(startScale * (1 - 0.1 * t));
    });
  },

  /**
   * belleFade — saturation 1→0.4 + brightness 1→0.6 + alpha 1→0 over 1.0 s.
   * Wine-tinted darkening. Belle Époque family default.
   */
  belleFade: async (token) => {
    if (!token?.mesh) return;
    const mesh = token.mesh;
    const startAlpha = mesh.alpha;
    const cm = new PIXI.ColorMatrixFilter();
    const prevFilters = mesh.filters ?? [];
    mesh.filters = [...prevFilters, cm];
    await tweenWithTicker(1000, (t) => {
      const eased = easeOutCubic(t);
      cm.reset();
      cm.saturate(-(1 - 0.4) * eased, true);
      cm.brightness(1 - 0.4 * eased, true);
      mesh.alpha = startAlpha * (1 - eased);
    });
    mesh.filters = prevFilters;
  },

  /**
   * hexShatter — 6 cyan SVG shards spawn at token center, drift outward, fade.
   * Token alpha 1 → 0 in sync. Hextech family default; mirror of hexCrystalForm.
   */
  hexShatter: async (token) => {
    if (!token?.mesh) return;
    const mesh = token.mesh;
    const startAlpha = mesh.alpha;
    // v0.4.7 FIX 2: load on demand — see spawn-animations.js particleBloom comment.
    const texture = await ensureEffectTexture("hexShard");
    if (!texture) {
      console.warn(`[${MODULE_ID}] hexShatter: hexShard texture not loaded`);
      mesh.alpha = 0;
      return;
    }
    const layer = canvas.interface;
    const cx = token.center.x;
    const cy = token.center.y;
    const shards = [];
    for (let i = 0; i < 6; i++) {
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5, 0.5);
      sprite.x = cx;
      sprite.y = cy;
      const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
      sprite._vx = Math.cos(angle) * 64;
      sprite._vy = Math.sin(angle) * 64;
      sprite.scale.set(1.2);
      layer.addChild(sprite);
      shards.push(sprite);
    }
    await tweenWithTicker(1000, (t) => {
      const eased = easeOutCubic(t);
      mesh.alpha = startAlpha * (1 - eased);
      for (const sprite of shards) {
        sprite.x = cx + sprite._vx * eased;
        sprite.y = cy + sprite._vy * eased;
        sprite.alpha = 1 - eased;
        sprite.scale.set(1.2 - 0.6 * eased);
      }
    });
    for (const sprite of shards) {
      layer.removeChild(sprite);
      sprite.destroy();
    }
  },

  /**
   * mageHandDissolve — belleFade core + gold-mote puff at the end. Used by Mage Hand.
   */
  mageHandDissolve: async (token) => {
    await deathAnimations.belleFade(token);
    const texture = await ensureEffectTexture("goldMote");
    if (!texture || !token?.center) return;
    const layer = canvas.interface;
    const cx = token.center.x;
    const cy = token.center.y;
    const motes = [];
    for (let i = 0; i < 8; i++) {
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5, 0.5);
      sprite.x = cx;
      sprite.y = cy;
      const angle = (i / 8) * Math.PI * 2;
      sprite._vx = Math.cos(angle) * 40;
      sprite._vy = Math.sin(angle) * 40;
      layer.addChild(sprite);
      motes.push(sprite);
    }
    await tweenWithTicker(400, (t) => {
      const eased = easeOutCubic(t);
      for (const sprite of motes) {
        sprite.x = cx + sprite._vx * eased;
        sprite.y = cy + sprite._vy * eased;
        sprite.alpha = 1 - eased;
      }
    });
    for (const sprite of motes) {
      layer.removeChild(sprite);
      sprite.destroy();
    }
  },

  /**
   * echoCollapse — vertical line of motes rises up and fades. Token alpha 1→0.
   * Used by Echo Knight Echo.
   */
  echoCollapse: async (token) => {
    if (!token?.mesh) return;
    const mesh = token.mesh;
    const startAlpha = mesh.alpha;
    const texture = await ensureEffectTexture("goldMote");
    if (!texture) {
      mesh.alpha = 0;
      return;
    }
    const layer = canvas.interface;
    const cx = token.center.x;
    const cy = token.center.y;
    const motes = [];
    for (let i = 0; i < 12; i++) {
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5, 0.5);
      sprite.x = cx + (Math.random() - 0.5) * 8;
      sprite.y = cy;
      sprite._delay = i * 0.04;
      sprite._driftY = -64 - Math.random() * 16;
      layer.addChild(sprite);
      motes.push(sprite);
    }
    await tweenWithTicker(800, (t) => {
      mesh.alpha = startAlpha * (1 - t);
      for (const sprite of motes) {
        const localT = Math.max(0, Math.min(1, (t - sprite._delay) / (1 - sprite._delay)));
        sprite.y = cy + sprite._driftY * localT;
        sprite.alpha = localT < 0.2 ? localT * 5 : (1 - (localT - 0.2) / 0.8);
      }
    });
    for (const sprite of motes) {
      layer.removeChild(sprite);
      sprite.destroy();
    }
  },

  /**
   * infernalFade — belleFade core + ember-puff at the end. Used by Pact-of-the-Chain
   * fiendish variants (Imp, Quasit).
   */
  infernalFade: async (token) => {
    await deathAnimations.belleFade(token);
    const texture = await ensureEffectTexture("ember");
    if (!texture || !token?.center) return;
    const layer = canvas.interface;
    const cx = token.center.x;
    const cy = token.center.y;
    const motes = [];
    for (let i = 0; i < 10; i++) {
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5, 0.5);
      sprite.x = cx;
      sprite.y = cy;
      const angle = (i / 10) * Math.PI * 2;
      sprite._vx = Math.cos(angle) * 32;
      sprite._vy = Math.sin(angle) * 32 - 24;
      layer.addChild(sprite);
      motes.push(sprite);
    }
    await tweenWithTicker(500, (t) => {
      const eased = easeOutCubic(t);
      for (const sprite of motes) {
        sprite.x = cx + sprite._vx * eased;
        sprite.y = cy + sprite._vy * eased;
        sprite.alpha = 1 - eased;
        sprite.scale.set(1 + 0.5 * eased);
      }
    });
    for (const sprite of motes) {
      layer.removeChild(sprite);
      sprite.destroy();
    }
  },

  /**
   * boneCollapse — desaturate to bone-white + scale 1.0 → 0.7 + alpha 1 → 0.
   * Used by Animate Dead variants — "collapse back into corpse".
   */
  boneCollapse: async (token) => {
    if (!token?.mesh) return;
    const mesh = token.mesh;
    const startAlpha = mesh.alpha;
    const startScale = mesh.scale.x;
    const cm = new PIXI.ColorMatrixFilter();
    const prevFilters = mesh.filters ?? [];
    mesh.filters = [...prevFilters, cm];
    await tweenWithTicker(1000, (t) => {
      const eased = easeOutCubic(t);
      cm.reset();
      cm.saturate(-eased, true);
      mesh.alpha = startAlpha * (1 - eased);
      mesh.scale.set(startScale * (1 - 0.3 * eased));
    });
    mesh.filters = prevFilters;
    mesh.scale.set(startScale);
  }
};
