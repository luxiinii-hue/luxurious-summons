// scripts/visual-filters.js — PIXI filter chain build/apply
//
// describeFilters is pure-logic (Task 13, unit-tested).
// buildFilters constructs PIXI instances from descriptors (Foundry-side).
// applyFiltersToToken attaches them to a token mesh (Task 14, manual smoke).

import { isCompanion, getCompanionFlag } from "./data-model.js";
import { getMotionProfile } from "./motion-profiles.js";
import { s } from "./settings.js";

const MODULE_ID = "luxurious-summons";

// WeakMap of token → ticker callback ref so we can clean up old motion when overrides change.
const _activeMotion = new WeakMap();

/**
 * Pure-logic. Returns an ordered list of filter descriptors for the given
 * visualOverrides. The actual PIXI filters are built from descriptors in
 * buildFilters() — this lets us unit-test the compositing decision without
 * running PIXI in node.
 *
 * Order matters: PIXI filter pipelines apply in array order.
 */
export function describeFilters(v) {
  const list = [];
  if (v.hueIntensity > 0) {
    list.push({ kind: "colorMatrix", hueColor: v.hueColor, hueIntensity: v.hueIntensity });
  }
  if (v.saturation !== 1) {
    list.push({ kind: "saturation", value: v.saturation });
  }
  if (v.brightness !== 1) {
    list.push({ kind: "brightness", value: v.brightness });
  }
  if (v.alpha < 1) {
    list.push({ kind: "alpha", value: v.alpha });
  }
  if (v.outlineThickness > 0) {
    list.push({ kind: "outline", color: v.outlineColor, thickness: v.outlineThickness });
  }
  if (v.shimmer) {
    list.push({ kind: "shimmer", intensity: v.shimmerIntensity });
  }
  return list;
}

/**
 * Build actual PIXI filter instances from descriptors. Foundry-side; uses
 * PIXI.ColorMatrixFilter + PIXI.AlphaFilter + outline filter.
 */
export function buildFilters(descriptors) {
  const filters = [];
  for (const d of descriptors) {
    switch (d.kind) {
      case "colorMatrix": {
        const f = new PIXI.ColorMatrixFilter();
        f.tint(parseInt(d.hueColor.replace("#", "0x"), 16), false);
        f.alpha = d.hueIntensity;
        filters.push(f);
        break;
      }
      case "saturation": {
        const f = new PIXI.ColorMatrixFilter();
        f.saturate(d.value - 1, true);
        filters.push(f);
        break;
      }
      case "brightness": {
        const f = new PIXI.ColorMatrixFilter();
        f.brightness(d.value, true);
        filters.push(f);
        break;
      }
      case "alpha": {
        const f = new PIXI.AlphaFilter(d.value);
        filters.push(f);
        break;
      }
      case "outline": {
        const Outline = PIXI.filters?.OutlineFilter ?? PIXI.OutlineFilter;
        if (Outline) {
          const f = new Outline(d.thickness, parseInt(d.color.replace("#", "0x"), 16));
          filters.push(f);
        } else {
          console.warn(`[${MODULE_ID}] OutlineFilter unavailable in this PIXI build`);
        }
        break;
      }
      case "shimmer": {
        // Skipped in Plan 1 — implemented as displacement filter in Plan 2
        console.log(`[${MODULE_ID}] shimmer filter deferred to Plan 2`);
        break;
      }
    }
  }
  return filters;
}

/**
 * Apply the visual filter chain to a companion token, plus border tint.
 * Reads `visualOverrides` and `motionOverrides` from the actor's flag.
 * Called from drawToken hook + updateActor (override change).
 */
export function applyFiltersToToken(token) {
  if (!isCompanion(token.actor)) return;
  const flag = getCompanionFlag(token.actor);
  if (!flag?.visualOverrides) return;
  applyOverridesToToken(token, flag.visualOverrides, flag.motionOverrides);
}

/**
 * Core apply path that takes overrides directly (not from the actor flag).
 *
 * Used by the Restyle dialog to apply DRAFT overrides live as the user drags
 * sliders, without persisting to the flag until Save. Same logic as
 * applyFiltersToToken but parameterized.
 */
export function applyOverridesToToken(token, visualOverrides, motionOverrides) {
  if (!visualOverrides) return;

  if (!s("enablePIXIFilters")) {
    // Performance escape hatch — apply only basic tint
    const tintHex = parseInt((visualOverrides.hueColor ?? "#ffffff").replace("#", "0x"), 16);
    if (token.mesh) token.mesh.tint = tintHex;
    return;
  }

  const descriptors = describeFilters(visualOverrides);
  const filters = buildFilters(descriptors);
  if (token.mesh) {
    token.mesh.filters = filters.length > 0 ? filters : null;
  }

  // Border color (Foundry's own border, separate from PIXI filters)
  if (visualOverrides.borderColor && token.border) {
    const borderHex = parseInt(visualOverrides.borderColor.replace("#", "0x"), 16);
    token.border.tint = borderHex;
  }

  // Apply procedural motion if motionOverrides are configured.
  applyMotionToTokenWith(token, motionOverrides);
}

/**
 * Procedural motion via PIXI ticker. Registers a per-frame callback that adds
 * transform deltas (computed by the named motion profile) on top of the
 * token's base position / rotation / scale / alpha.
 *
 * Cleanup: any previously-registered callback is removed first, so this is
 * safe to call repeatedly (e.g., from updateActor when motionOverrides change).
 *
 * Performance: respects `enablePIXIFilters` setting (filter-off implies
 * motion-off — the user wants minimum overhead in both cases).
 */
export function applyMotionToToken(token) {
  // Reads from the actor flag — the canonical entry point.
  if (!isCompanion(token.actor)) return;
  const motion = getCompanionFlag(token.actor)?.motionOverrides;
  applyMotionToTokenWith(token, motion);
}

/**
 * Core motion application path. Takes the motionOverrides object directly so
 * the Restyle dialog can drive live motion changes from its draft state.
 */
function applyMotionToTokenWith(token, motion) {
  // Always clear existing motion first — safe to call when overrides change.
  removeMotionFromToken(token);

  if (!s("enablePIXIFilters")) return;     // escape hatch covers motion too
  if (!motion || motion.profile === "none" || !motion.intensity) return;

  const profile = getMotionProfile(motion.profile);
  if (!profile) return;
  const intensity = motion.intensity ?? 1;

  // Snapshot the token's base transform — motion is anchored to these values.
  const mesh = token.mesh;
  if (!mesh) return;
  const base = {
    x: mesh.position.x,
    y: mesh.position.y,
    rotation: mesh.rotation ?? 0,
    scaleX: mesh.scale?.x ?? 1,
    scaleY: mesh.scale?.y ?? 1,
    alpha: mesh.alpha ?? 1
  };
  const startedAt = performance.now() / 1000;

  const tickerCallback = () => {
    // Skip applying while Foundry is animating the token (e.g., ruler-driven move
    // or token-drag tween). Avoids fighting Foundry's render loop for control
    // of mesh.position. The animation finishes in <1 s and motion resumes cleanly.
    if (token._animation) return;
    const t = (performance.now() / 1000) - startedAt;
    const delta = profile(t, intensity);
    mesh.position.set(base.x + delta.dx, base.y + delta.dy);
    mesh.rotation = base.rotation + delta.dRotation;
    mesh.scale.set(base.scaleX + delta.dScale, base.scaleY + delta.dScale);
    mesh.alpha = Math.max(0, Math.min(1, base.alpha + delta.dAlpha));
  };

  const ticker = canvas?.app?.ticker;
  if (!ticker) {
    console.warn(`[${MODULE_ID}] no canvas ticker available; motion skipped on ${token.id}`);
    return;
  }
  ticker.add(tickerCallback);
  _activeMotion.set(token, tickerCallback);
  console.log(`[${MODULE_ID}] motion attached to ${token.id}: ${motion.profile} @ ${intensity}`);
}

/**
 * Tear down the motion ticker callback for a token. Called by applyMotionToToken
 * (to clear before re-attaching) and from the deleteToken hook in main.js.
 */
export function removeMotionFromToken(token) {
  const callback = _activeMotion.get(token);
  if (!callback) return;
  canvas?.app?.ticker?.remove(callback);
  _activeMotion.delete(token);

  // Restore the mesh to its base orientation so the token doesn't stay frozen
  // mid-wobble when motion is disabled. The next render will set canonical values.
  // (We trust Foundry's own refresh to overwrite our last-frame deltas.)
}
