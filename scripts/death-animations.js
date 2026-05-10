// scripts/death-animations.js — per-template PIXI death animations
//
// Plan 1 ships icyShatter (Simulacrum) + softFade (manual dismiss + fallback).
// The other 4 (glassShatter, smokeDissipation, boneCollapse, pop) land in Plan 3.
//
// Each animation receives a Token instance and returns a Promise that resolves
// when the animation completes. Cleanup contract: do NOT delete the token —
// that's the lifecycle hook's job. Just animate.

const MODULE_ID = "luxurious-summons";

function tweenWithTicker(durationMs, onTick) {
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(1, elapsed / durationMs);
      onTick(t);
      if (t >= 1) {
        PIXI.Ticker.shared.remove(tick);
        resolve();
      }
    };
    PIXI.Ticker.shared.add(tick);
  });
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

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
   * softFade — alpha 1→0 + slight scale-down. 400ms. Used for manual dismiss
   * and as the Plan 1 placeholder for templates whose fancy animations land in Plan 3.
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
  }

  // Plan 3: glassShatter, smokeDissipation, boneCollapse, pop
};
