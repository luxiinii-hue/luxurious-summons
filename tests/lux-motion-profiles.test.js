// tests/lux-motion-profiles.test.js
// node:test (no npm deps). Validates motion profile contract:
//  - each profile returns an object with exactly the 5 expected delta keys
//  - all returned values are finite numbers
//  - intensity = 0 zeroes every delta
//  - intensity scales linearly (dx@2 = 2 × dx@1) for the same t
//  - peak magnitudes stay within the bounds we documented
//  - `none` always returns zeros regardless of t / intensity
//  - getMotionProfile() falls back to `none` for unknown names

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  motionProfiles,
  getMotionProfile,
  motionProfileNames,
  motionProfileBounds
} from "../scripts/motion-profiles.js";

const DELTA_KEYS = ["dx", "dy", "dRotation", "dScale", "dAlpha"];

// Sample a profile across a t-grid covering its longest period to find peak magnitudes.
function sampleProfile(profile, intensity, samples = 2000) {
  const peaks = { dx: 0, dy: 0, dRotation: 0, dScale: 0, dAlpha: 0 };
  for (let i = 0; i < samples; i++) {
    // Sample over t ∈ [0, 30] seconds — covers multiple cycles of even the slowest profile (0.4 Hz).
    const t = (i / samples) * 30;
    const out = profile(t, intensity);
    for (const k of DELTA_KEYS) {
      const v = Math.abs(out[k]);
      if (v > peaks[k]) peaks[k] = v;
    }
  }
  return peaks;
}

test("every profile returns an object with all 5 delta keys", () => {
  for (const [name, profile] of Object.entries(motionProfiles)) {
    const out = profile(1.0, 1.0);
    assert.ok(out && typeof out === "object", `${name} returned non-object`);
    for (const key of DELTA_KEYS) {
      assert.ok(key in out, `${name} missing key ${key}`);
      assert.equal(typeof out[key], "number", `${name}.${key} is not a number`);
      assert.ok(Number.isFinite(out[key]), `${name}.${key} is not finite (got ${out[key]})`);
    }
  }
});

test("intensity = 0 zeroes every delta for every profile", () => {
  for (const [name, profile] of Object.entries(motionProfiles)) {
    // Sample at a handful of t values to make sure it's truly zero across the domain.
    // Use Math.abs to tolerate -0 (IEEE 754: -1 * 0 === -0, semantically identical to +0 for our
    // additive usage: `position.x += -0` is a no-op the same as `+= 0`).
    for (const t of [0, 0.5, 1.7, 5, 10, 100]) {
      const out = profile(t, 0);
      for (const key of DELTA_KEYS) {
        assert.equal(Math.abs(out[key]), 0, `${name} at t=${t} intensity=0 — ${key} = ${out[key]}, expected 0 (or -0)`);
      }
    }
  }
});

test("intensity scales linearly (dx@2 = 2 × dx@1)", () => {
  for (const [name, profile] of Object.entries(motionProfiles)) {
    if (name === "none") continue; // trivially passes
    for (const t of [0.3, 1.5, 4.2, 9.0]) {
      const at1 = profile(t, 1.0);
      const at2 = profile(t, 2.0);
      for (const key of DELTA_KEYS) {
        const expected = at1[key] * 2;
        const actual = at2[key];
        // Allow tiny float epsilon.
        assert.ok(Math.abs(actual - expected) < 1e-9,
          `${name} at t=${t} — ${key} did not scale linearly (intensity=1 → ${at1[key]}, intensity=2 → ${actual}, expected ${expected})`);
      }
    }
  }
});

test("none profile always returns zeros regardless of t and intensity", () => {
  for (const t of [0, 1, 10, 100, -5]) {
    for (const intensity of [0, 0.5, 1, 2, 10]) {
      const out = motionProfiles.none(t, intensity);
      for (const key of DELTA_KEYS) {
        assert.equal(out[key], 0, `none at t=${t} intensity=${intensity} — ${key} = ${out[key]}`);
      }
    }
  }
});

test("each profile's peak magnitude matches its documented bound (intensity=1)", () => {
  for (const name of motionProfileNames) {
    const peaks = sampleProfile(motionProfiles[name], 1.0);
    const bounds = motionProfileBounds[name];
    for (const key of DELTA_KEYS) {
      // The observed peak must not exceed the documented bound (allow small float slack).
      assert.ok(peaks[key] <= bounds[key] + 1e-6,
        `${name}: peak ${key} = ${peaks[key]} exceeds documented bound ${bounds[key]}`);
      // The observed peak should also be close to the bound for non-zero bounds (within 5 %).
      // Catches the case where a profile is silently emitting smaller-than-documented motion.
      if (bounds[key] > 0) {
        assert.ok(peaks[key] >= bounds[key] * 0.95,
          `${name}: peak ${key} = ${peaks[key]} is much smaller than documented bound ${bounds[key]} — bound may need updating`);
      }
    }
  }
});

test("getMotionProfile falls back to `none` for unknown names", () => {
  const fallback = getMotionProfile("definitely-not-a-real-profile");
  const out = fallback(5.0, 1.0);
  for (const key of DELTA_KEYS) {
    assert.equal(out[key], 0, `fallback returned non-zero ${key} = ${out[key]}`);
  }
});

test("getMotionProfile returns the right profile for known names", () => {
  for (const name of motionProfileNames) {
    assert.strictEqual(getMotionProfile(name), motionProfiles[name], `getMotionProfile("${name}") returned the wrong function`);
  }
});

test("motionProfileNames matches motionProfiles keys", () => {
  assert.deepEqual(motionProfileNames.sort(), Object.keys(motionProfiles).sort());
});

test("motionProfileBounds has an entry for every profile", () => {
  for (const name of motionProfileNames) {
    assert.ok(name in motionProfileBounds, `motionProfileBounds missing entry for ${name}`);
  }
});
