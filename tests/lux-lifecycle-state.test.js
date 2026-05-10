// tests/lux-lifecycle-state.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectHpDeath } from "../scripts/lifecycle.js";

test("detectHpDeath returns true when HP transitions from positive to 0", () => {
  assert.equal(detectHpDeath({ before: 14, after: 0 }), true);
});

test("detectHpDeath returns true when HP goes negative", () => {
  assert.equal(detectHpDeath({ before: 5, after: -3 }), true);
});

test("detectHpDeath returns false when HP stays positive", () => {
  assert.equal(detectHpDeath({ before: 14, after: 7 }), false);
});

test("detectHpDeath returns false when HP was already 0", () => {
  assert.equal(detectHpDeath({ before: 0, after: 0 }), false);
});

test("detectHpDeath returns false when HP increases (heal)", () => {
  assert.equal(detectHpDeath({ before: 0, after: 5 }), false);
});

test("detectHpDeath returns false when before is undefined (initial state)", () => {
  assert.equal(detectHpDeath({ before: undefined, after: 0 }), false);
});
