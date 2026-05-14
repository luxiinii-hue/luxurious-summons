// tests/lux-effects-fallback.test.js — tests for readEffects() migration helper.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readEffects } from "../scripts/data-model.js";

test("readEffects: new shape — returns effects object as-is", () => {
  const tpl = { effects: { motion: { profile: "ethereal-drift", intensity: 1.0 }, spawn: "hex-crystal-form", death: "hex-shatter" } };
  assert.deepEqual(readEffects(tpl), tpl.effects);
});

test("readEffects: legacy shape with motion + death — translates to new shape", () => {
  const tpl = { defaults: { motionProfile: "flame-flicker", motionIntensity: 0.6 }, deathAnimation: "icyShatter" };
  const result = readEffects(tpl);
  assert.deepEqual(result.motion, { profile: "flame-flicker", intensity: 0.6 });
  assert.equal(result.spawn, null);
  assert.equal(result.death, "icyShatter");
});

test("readEffects: legacy shape without motion — uses none profile", () => {
  const tpl = { deathAnimation: "softFade" };
  const result = readEffects(tpl);
  assert.deepEqual(result.motion, { profile: "none", intensity: 0 });
  assert.equal(result.death, "softFade");
});

test("readEffects: empty template — returns sensible defaults", () => {
  const result = readEffects({});
  assert.deepEqual(result.motion, { profile: "none", intensity: 0 });
  assert.equal(result.spawn, null);
  assert.equal(result.death, "softFade");
});
