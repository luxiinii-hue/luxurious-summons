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
