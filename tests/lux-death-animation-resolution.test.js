// tests/lux-death-animation-resolution.test.js — v0.4.6 FIX 7.
//
// resolveDeathAnimationId is pure-logic (readEffects is injected so this file
// doesn't need to mock Foundry globals). lifecycle.js only touches Foundry
// globals inside runDeathAndCleanup / the hook installers, so importing it at
// module scope is node-safe (mirrors the existing lux-lifecycle-state.test.js
// convention already in this suite).

import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveDeathAnimationId } from "../scripts/lifecycle.js";
import { readEffects } from "../scripts/data-model.js";

const impVariant = { id: "imp", deathEffectOverride: "infernalFade" };
const pseudodragonVariant = { id: "pseudodragon" }; // no override
const pactTemplate = {
  id: "pact-of-the-chain",
  effects: { death: "belleFade" },
  variants: [impVariant, pseudodragonVariant]
};

test("variant deathEffectOverride wins over the template's effects.death", () => {
  assert.equal(resolveDeathAnimationId(pactTemplate, "imp", readEffects), "infernalFade");
});

test("no override on the selected variant falls through to template effects.death", () => {
  assert.equal(resolveDeathAnimationId(pactTemplate, "pseudodragon", readEffects), "belleFade");
});

test("no variantId at all falls through to template effects.death", () => {
  assert.equal(resolveDeathAnimationId(pactTemplate, null, readEffects), "belleFade");
  assert.equal(resolveDeathAnimationId(pactTemplate, undefined, readEffects), "belleFade");
});

test("legacy template (deathAnimation field, no effects) migrates via readEffects", () => {
  const legacyTemplate = { id: "legacy", deathAnimation: "icyShatter" };
  assert.equal(resolveDeathAnimationId(legacyTemplate, null, readEffects), "icyShatter");
});

test("template is undefined (deleted/unknown templateId) falls back to softFade, does not throw", () => {
  assert.equal(resolveDeathAnimationId(undefined, "imp", readEffects), "softFade");
});

test("template has neither effects nor deathAnimation falls back to softFade", () => {
  assert.equal(resolveDeathAnimationId({ id: "bare" }, null, readEffects), "softFade");
});

test("variantId set but template has no variants array falls through to template death, does not throw", () => {
  const noVariantsTemplate = { id: "solo", effects: { death: "hexShatter" } };
  assert.equal(resolveDeathAnimationId(noVariantsTemplate, "nonexistent", readEffects), "hexShatter");
});
