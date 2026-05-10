// scripts/visual-filters.js — PIXI filter chain build/apply
//
// describeFilters is pure-logic (Task 13, unit-tested).
// buildFilters constructs PIXI instances from descriptors (Foundry-side).
// applyFiltersToToken attaches them to a token mesh (Task 14, manual smoke).

import { isCompanion, getCompanionFlag } from "./data-model.js";
import { s } from "./settings.js";

const MODULE_ID = "luxurious-summons";

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
 * Called from drawToken hook + updateActor (visualOverrides change).
 */
export function applyFiltersToToken(token) {
  if (!isCompanion(token.actor)) return;
  const flag = getCompanionFlag(token.actor);
  if (!flag?.visualOverrides) return;

  if (!s("enablePIXIFilters")) {
    // Performance escape hatch — apply only basic tint
    const tintHex = parseInt((flag.visualOverrides.hueColor ?? "#ffffff").replace("#", "0x"), 16);
    if (token.mesh) token.mesh.tint = tintHex;
    return;
  }

  const descriptors = describeFilters(flag.visualOverrides);
  const filters = buildFilters(descriptors);
  if (token.mesh) {
    token.mesh.filters = filters.length > 0 ? filters : null;
    console.log(`[${MODULE_ID}] applied ${filters.length} filter(s) to token ${token.id}`);
  }

  // Border color (Foundry's own border, separate from PIXI filters)
  if (flag.visualOverrides.borderColor && token.border) {
    const borderHex = parseInt(flag.visualOverrides.borderColor.replace("#", "0x"), 16);
    token.border.tint = borderHex;
  }
}
