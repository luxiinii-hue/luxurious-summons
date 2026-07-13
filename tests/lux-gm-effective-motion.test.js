// tests/lux-gm-effective-motion.test.js — resolveEffectiveMotion precedence matrix.
// The three-layer GM-wins model (v0.6.0 GM Console): global switch+dial /
// per-template / per-companion, layered over the player's Restyle intensity.

import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveEffectiveMotion } from "../scripts/data-model.js";

const flag = (over = {}) => ({
  templateId: "simulacrum",
  motionOverrides: { profile: "flame-flicker", intensity: 0.6 },
  ...over
});

const GM_DEFAULTS = { gmMotionEnabled: true, gmMotionIntensity: 1.0, gmForceDisableFilters: false };

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `expected ~${b}, got ${a}`);

test("defaults: player Restyle intensity passes through unchanged", () => {
  near(resolveEffectiveMotion(flag(), {}, GM_DEFAULTS), 0.6);
});

test("global switch off zeroes everything, even explicit per-companion intensity", () => {
  const f = flag({ gmOverrides: { motionIntensity: 1.5 } });
  assert.equal(resolveEffectiveMotion(f, {}, { ...GM_DEFAULTS, gmMotionEnabled: false }), 0);
});

test("gmForceDisableFilters zeroes motion (defense-in-depth)", () => {
  assert.equal(resolveEffectiveMotion(flag(), {}, { ...GM_DEFAULTS, gmForceDisableFilters: true }), 0);
});

test("per-companion motionEnabled=false freezes only via that flag", () => {
  const f = flag({ gmOverrides: { motionEnabled: false } });
  assert.equal(resolveEffectiveMotion(f, {}, GM_DEFAULTS), 0);
});

test("per-template motionEnabled=false freezes companions of that template only", () => {
  const overrides = { simulacrum: { motionEnabled: false } };
  assert.equal(resolveEffectiveMotion(flag(), overrides, GM_DEFAULTS), 0);
  const other = flag({ templateId: "mage-hand", motionOverrides: { profile: "floating-hand", intensity: 1.0 } });
  near(resolveEffectiveMotion(other, overrides, GM_DEFAULTS), 1.0);
});

test("global dial multiplies the resolved base", () => {
  near(resolveEffectiveMotion(flag(), {}, { ...GM_DEFAULTS, gmMotionIntensity: 0.5 }), 0.3);
  near(resolveEffectiveMotion(flag(), {}, { ...GM_DEFAULTS, gmMotionIntensity: 1.5 }), 0.9);
});

test("per-companion GM intensity beats per-template AND player", () => {
  const f = flag({ gmOverrides: { motionIntensity: 0.25 } });
  const overrides = { simulacrum: { motionIntensity: 0.75 } };
  near(resolveEffectiveMotion(f, overrides, GM_DEFAULTS), 0.25);
});

test("per-template GM intensity beats player when no per-companion dial", () => {
  const overrides = { simulacrum: { motionIntensity: 0.75 } };
  near(resolveEffectiveMotion(flag(), overrides, GM_DEFAULTS), 0.75);
});

test("player's Restyle 'Off' (intensity 0) stays 0 — no ?? 1.0 fallthrough", () => {
  const f = flag({ motionOverrides: { profile: "flame-flicker", intensity: 0 } });
  assert.equal(resolveEffectiveMotion(f, {}, { ...GM_DEFAULTS, gmMotionIntensity: 1.5 }), 0);
});

test("per-template intensity 0 is honored as an explicit zero, not treated as unset", () => {
  const overrides = { simulacrum: { motionIntensity: 0 } };
  assert.equal(resolveEffectiveMotion(flag(), overrides, GM_DEFAULTS), 0);
});

test("negative products clamp to 0", () => {
  const f = flag({ gmOverrides: { motionIntensity: -1 } });
  assert.equal(resolveEffectiveMotion(f, {}, GM_DEFAULTS), 0);
});

test("missing/null inputs degrade gracefully", () => {
  near(resolveEffectiveMotion(null, null, null), 1.0);            // no data → neutral default
  near(resolveEffectiveMotion(flag(), undefined, GM_DEFAULTS), 0.6);
  near(resolveEffectiveMotion({ templateId: "x" }, {}, GM_DEFAULTS), 1.0); // no motionOverrides
});

test("non-numeric global multiplier falls back to 1.0", () => {
  near(resolveEffectiveMotion(flag(), {}, { gmMotionEnabled: true, gmMotionIntensity: "1.5" }), 0.6);
});
