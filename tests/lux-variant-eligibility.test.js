// tests/lux-variant-eligibility.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { filterVariants, isVariantEligible } from "../scripts/variant-eligibility.js";

const variants = [
  { id: "owl",  name: "Owl" },
  { id: "imp",  name: "Imp",  requires: { class: "warlock", subclass: "pact-of-the-chain" } },
  { id: "drake-cold", name: "Cold Drake", requires: { class: "ranger", subclass: "drakewarden", classLevel: 3 } }
];

test("isVariantEligible: no requires — always eligible", () => {
  assert.equal(isVariantEligible(variants[0], { classes: [] }), true);
});

test("isVariantEligible: matches class + subclass", () => {
  const caster = { classes: [{ name: "warlock", subclass: "pact-of-the-chain", level: 3 }] };
  assert.equal(isVariantEligible(variants[1], caster), true);
});

test("isVariantEligible: class match but subclass mismatch", () => {
  const caster = { classes: [{ name: "warlock", subclass: "fiend", level: 3 }] };
  assert.equal(isVariantEligible(variants[1], caster), false);
});

test("isVariantEligible: class mismatch", () => {
  const caster = { classes: [{ name: "wizard", level: 5 }] };
  assert.equal(isVariantEligible(variants[1], caster), false);
});

test("isVariantEligible: classLevel gate fails if too low", () => {
  const caster = { classes: [{ name: "ranger", subclass: "drakewarden", level: 2 }] };
  assert.equal(isVariantEligible(variants[2], caster), false);
});

test("isVariantEligible: classLevel gate passes at exact level", () => {
  const caster = { classes: [{ name: "ranger", subclass: "drakewarden", level: 3 }] };
  assert.equal(isVariantEligible(variants[2], caster), true);
});

test("filterVariants: returns only eligible", () => {
  const caster = { classes: [{ name: "warlock", subclass: "pact-of-the-chain", level: 3 }] };
  const result = filterVariants(variants, caster);
  assert.equal(result.length, 2);     // owl + imp
  assert.deepEqual(result.map(v => v.id), ["owl", "imp"]);
});

test("filterVariants: null/undefined inputs handled", () => {
  assert.deepEqual(filterVariants(null, null), []);
  assert.deepEqual(filterVariants([], null), []);
});

// v0.4.6 FIX 2: Pact of the Chain is a warlock FEATURE (owned feat-item), not a
// subclass. requires.feature matches against caster.featureNames.
const pactImp = { id: "imp", name: "Imp", requires: { class: "warlock", feature: "Pact of the Chain" } };

test("isVariantEligible: requires.feature present (case-insensitive) — eligible", () => {
  const caster = { classes: [{ name: "warlock", level: 3 }], featureNames: ["pact of the chain"] };
  assert.equal(isVariantEligible(pactImp, caster), true);
});

test("isVariantEligible: requires.feature present with different case in caster list — still eligible", () => {
  const caster = { classes: [{ name: "warlock", level: 3 }], featureNames: ["PACT OF THE CHAIN".toLowerCase()] };
  assert.equal(isVariantEligible(pactImp, caster), true);
});

test("isVariantEligible: requires.feature absent from caster's feature list — ineligible", () => {
  const caster = { classes: [{ name: "warlock", level: 3 }], featureNames: ["pact of the tome"] };
  assert.equal(isVariantEligible(pactImp, caster), false);
});

test("isVariantEligible: requires.feature with no featureNames on caster at all — ineligible, does not throw", () => {
  const caster = { classes: [{ name: "warlock", level: 3 }] };
  assert.equal(isVariantEligible(pactImp, caster), false);
});

test("isVariantEligible: requires.class passes but requires.feature still gates independently", () => {
  // Right class, wrong (missing) feature — must not fall back to "class matched, good enough".
  const caster = { classes: [{ name: "warlock", level: 5 }], featureNames: [] };
  assert.equal(isVariantEligible(pactImp, caster), false);
});

test("isVariantEligible: requires.feature is independent of requires.subclass — a variant with only feature never checks subclass", () => {
  const caster = { classes: [{ name: "warlock", subclass: "the-fiend", level: 3 }], featureNames: ["pact of the chain"] };
  assert.equal(isVariantEligible(pactImp, caster), true);
});
