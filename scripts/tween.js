// scripts/tween.js — shared PIXI ticker-based tween helper
// Used by spawn-animations.js + death-animations.js.
//
// Defensive guard against mid-animation mesh destruction (v0.3.3): when the
// onTick callback throws because the target was destroyed (e.g., a synced
// token delete arrived from the GM), bail cleanly rather than spamming the
// console per frame.

const MODULE_ID = "luxurious-summons";

export function tweenWithTicker(durationMs, onTick) {
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(1, elapsed / durationMs);
      try {
        onTick(t);
      } catch (err) {
        console.log(`[${MODULE_ID}] tween aborted: ${err.message ?? err}`);
        PIXI.Ticker.shared.remove(tick);
        resolve();
        return;
      }
      if (t >= 1) {
        PIXI.Ticker.shared.remove(tick);
        resolve();
      }
    };
    PIXI.Ticker.shared.add(tick);
  });
}

export function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
export function easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
