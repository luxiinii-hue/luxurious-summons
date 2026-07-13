// scripts/visual-filters.js — PIXI filter chain build/apply
//
// describeFilters is pure-logic (Task 13, unit-tested).
// buildFilters constructs PIXI instances from descriptors (Foundry-side).
// applyFiltersToToken attaches them to a token mesh (Task 14, manual smoke).

import { isCompanion, getCompanionFlag, resolveEffectiveMotion } from "./data-model.js";
import { getMotionProfile, motionProfileBounds } from "./motion-profiles.js";
import { s } from "./settings.js";
import { isAnimating } from "./anim-state.js";
import { getLuxOutlineFilterClass } from "./outline-filter.js";

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
        // v0.4.7 FIX 3: the friend's V13 build 351 ships a PIXI build with
        // NEITHER PIXI.filters.OutlineFilter NOR PIXI.OutlineFilter — every
        // outline control silently did nothing on the production runtime.
        // LuxOutlineFilter is our vendored 8-direction alpha-sampling shader,
        // last resort in the lookup chain. Whichever implementation is picked,
        // construction is wrapped in try/catch — a shader-compile failure on
        // some exotic renderer must skip only the outline entry, never break
        // the rest of the filter chain.
        const implName = PIXI.filters?.OutlineFilter ? "PIXI.filters.OutlineFilter"
                        : PIXI.OutlineFilter ? "PIXI.OutlineFilter"
                        : "LuxOutlineFilter (vendored fallback)";
        try {
          // getLuxOutlineFilterClass() itself can throw (e.g. if PIXI.Filter
          // is somehow unavailable too) — deliberately resolved INSIDE the
          // try so that failure is caught by the same handler as a
          // shader-compile failure, never escaping to break the rest of the
          // filter chain.
          const Outline = PIXI.filters?.OutlineFilter ?? PIXI.OutlineFilter ?? getLuxOutlineFilterClass();
          const f = new Outline(d.thickness, parseInt(d.color.replace("#", "0x"), 16));
          filters.push(f);
          if (s("verboseLogging")) {
            console.log(`[${MODULE_ID}] outline filter using ${implName}`);
          }
        } catch (e) {
          console.warn(`[${MODULE_ID}] outline filter construction failed (${implName}); skipping outline entry:`, e);
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
  // Diagnostic: log mesh + override state on each hook-driven apply (NOT slider-driven —
  // see applyOverridesToToken which gets called rapidly during drag). Helps diagnose
  // invisible-token / texture-not-ready races. Gated on verboseLogging to keep noise down.
  if (s("verboseLogging")) {
    const v = flag.visualOverrides;
    console.log(`[${MODULE_ID}] applyFiltersToToken on ${token.id} (${token.name}): mesh=${!!token.mesh}, textureValid=${!!token.mesh?.texture?.valid}, alpha=${v.alpha}, outline=${v.outlineThickness}, hueIntensity=${v.hueIntensity}`);
  }
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

  if (!s("enablePIXIFilters") || s("gmForceDisableFilters")) {
    // Performance escape hatch (client) OR GM world-wide kill switch (v0.6.0).
    // Either way: basic tint only, no filters, no motion. The GM switch beats
    // every client's preference — it exists for "the table is lagging, kill
    // everything NOW" moments.
    const tintHex = parseInt((visualOverrides.hueColor ?? "#ffffff").replace("#", "0x"), 16);
    if (token.mesh) token.mesh.tint = tintHex;
    removeMotionFromToken(token);
    return;
  }

  const descriptors = describeFilters(visualOverrides);
  const filters = buildFilters(descriptors);
  if (token.mesh) {
    token.mesh.filters = filters.length > 0 ? filters : null;
  } else {
    console.warn(`[${MODULE_ID}] applyOverridesToToken on ${token.id}: token.mesh not ready — skipping filter apply (will re-apply on next refresh hook)`);
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

  if (!s("enablePIXIFilters") || s("gmForceDisableFilters")) return; // escape hatches cover motion too
  // NOTE: intensity 0 deliberately does NOT early-return here — a per-template
  // or per-companion GM dial may raise a player's "Off" (GM wins both ways).
  // The effective-intensity resolver below is the single authority on 0.
  if (!motion || motion.profile === "none") return;

  const profile = getMotionProfile(motion.profile);
  if (!profile) return;

  // v0.6.0 GM Console: layer the three GM controls (global switch+dial /
  // per-template / per-companion) over the player's intensity. `motion` may be
  // a Restyle DRAFT rather than the persisted flag, so we merge it over the
  // actor's flag (which carries templateId + gmOverrides) before resolving —
  // GM freezes hold even during a player's live Restyle preview.
  const companionFlag = { ...(getCompanionFlag(token.actor) ?? {}), motionOverrides: motion };
  const gmGlobals = {
    gmMotionEnabled: s("gmMotionEnabled"),
    gmMotionIntensity: s("gmMotionIntensity"),
    gmForceDisableFilters: s("gmForceDisableFilters")
  };
  const intensity = resolveEffectiveMotion(companionFlag, s("templateOverrides"), gmGlobals);
  if (intensity === 0) {
    if (s("verboseLogging")) console.log(`[${MODULE_ID}] motion suppressed on ${token.id} (effective intensity 0 — GM layer)`);
    return;
  }

  const mesh = token.mesh;
  if (!mesh) return;

  // Inspect the profile's bounds: if a dimension's max delta is 0, the profile
  // never animates it, so the ticker must NOT write that dimension at all —
  // writing even a stable "base + 0" would fight Foundry's continuous refresh
  // and on V13 can pin the mesh at a half-initialised transform (mesh becomes
  // invisible while the border keeps drawing at the correct world position).
  const bounds = motionProfileBounds[motion.profile] ?? motionProfileBounds.none;
  const animatesPosition = bounds.dx > 0 || bounds.dy > 0;
  const animatesRotation = bounds.dRotation > 0;
  const animatesScale = bounds.dScale > 0;
  const animatesAlpha = bounds.dAlpha > 0;

  // Lazy base snapshot — captured on the first tick once Foundry's refresh has
  // populated canonical position / scale / alpha. Snapshotting at attach time
  // races the draw chain on V13 and could capture zeros.
  //
  // The base must be RE-CAPTURED whenever Foundry moves the token; otherwise
  // the ticker keeps writing `oldBase + delta` and the mesh visually snaps
  // back to the spawn position. Triggers for re-capture:
  //   (a) `token._animation` was set last frame and is now clear — Foundry's
  //       drag/ruler tween just finished, mesh.position is canonical at the
  //       new spot. Paid for in v0.4.4: floating-hand Mage Hand wouldn't
  //       follow when dragged.
  //   (b) The mesh has drifted significantly from our last write — instant
  //       snap via token-config dialog or programmatic update without a tween.
  let base = null;
  let wasAnimating = false;
  let lastWrite = null;
  const startedAt = performance.now() / 1000;

  const tickerCallback = () => {
    // Treat a module-owned spawn/death animation exactly like Foundry's own
    // token._animation tween: skip the frame entirely and set wasAnimating so
    // the base is re-captured from the canonical (post-animation) mesh once it
    // clears. Critically, this check runs BEFORE the lazy base snapshot below,
    // so the snapshot can never capture an animation-mutated mesh (e.g. alpha
    // pinned to ~0 mid-fade-in). v0.4.6 FIX 1 — paid for by Simulacrum/Unseen
    // Servant/Summon Dragon shipping permanently invisible after their spawn
    // animation completed.
    if (token._animation || isAnimating(token.id)) {
      wasAnimating = true;
      return;
    }
    if (!base) {
      base = {
        x: mesh.position.x,
        y: mesh.position.y,
        rotation: mesh.rotation ?? 0,
        scaleX: mesh.scale?.x ?? 1,
        scaleY: mesh.scale?.y ?? 1,
        alpha: mesh.alpha ?? 1
      };
      wasAnimating = false;
    } else if (wasAnimating) {
      // Foundry just finished a tween — mesh.position is canonical at the new
      // location. Re-capture only the position dimensions (drag/ruler don't
      // touch scale/rotation/alpha; re-capturing those would compound our own
      // last-applied delta into the base).
      base.x = mesh.position.x;
      base.y = mesh.position.y;
      wasAnimating = false;
    } else if (lastWrite && animatesPosition) {
      // Catch non-tweened snaps (token-config x/y edit, scripted moves).
      // Threshold of 2 px allows for float-precision noise.
      const dx = Math.abs(mesh.position.x - lastWrite.x);
      const dy = Math.abs(mesh.position.y - lastWrite.y);
      if (dx > 2 || dy > 2) {
        base.x = mesh.position.x;
        base.y = mesh.position.y;
      }
    }
    const t = (performance.now() / 1000) - startedAt;
    const delta = profile(t, intensity);
    if (animatesPosition) {
      const nx = base.x + delta.dx;
      const ny = base.y + delta.dy;
      mesh.position.set(nx, ny);
      lastWrite = { x: nx, y: ny };
    }
    if (animatesRotation) mesh.rotation = base.rotation + delta.dRotation;
    if (animatesScale) mesh.scale.set(base.scaleX + delta.dScale, base.scaleY + delta.dScale);
    if (animatesAlpha) mesh.alpha = Math.max(0, Math.min(1, base.alpha + delta.dAlpha));
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

/**
 * v0.6.0 GM Console. Re-apply filters + motion to every companion token on the
 * current canvas. Wired as the onChange of the GM world settings (and
 * templateOverrides) — world-setting onChange fires on every connected client,
 * so one GM change takes effect table-wide within a frame. Per-token try/catch:
 * one broken token must not abort the sweep.
 */
export function reapplyAllCompanionTokens() {
  if (!canvas?.tokens) return;
  let refreshed = 0;
  for (const token of canvas.tokens.placeables) {
    if (!isCompanion(token.actor)) continue;
    try {
      applyFiltersToToken(token);
      refreshed++;
    } catch (e) {
      console.warn(`[${MODULE_ID}] reapplyAllCompanionTokens: failed on ${token.id} (${token.name}):`, e);
    }
  }
  console.log(`[${MODULE_ID}] reapplyAllCompanionTokens: refreshed ${refreshed} companion token(s)`);
}
