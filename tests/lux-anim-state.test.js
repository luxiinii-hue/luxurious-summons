// tests/lux-anim-state.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { markAnimating, clearAnimating, isAnimating } from "../scripts/anim-state.js";

test("isAnimating is false for an untouched token id", () => {
  assert.equal(isAnimating("never-marked"), false);
});

test("markAnimating then isAnimating is true", () => {
  markAnimating("tok-1");
  assert.equal(isAnimating("tok-1"), true);
  clearAnimating("tok-1"); // cleanup for subsequent tests
});

test("clearAnimating removes the mark", () => {
  markAnimating("tok-2");
  clearAnimating("tok-2");
  assert.equal(isAnimating("tok-2"), false);
});

test("markAnimating is idempotent (marking twice does not require double-clear)", () => {
  markAnimating("tok-3");
  markAnimating("tok-3");
  clearAnimating("tok-3");
  assert.equal(isAnimating("tok-3"), false);
});

test("multiple token ids are tracked independently", () => {
  markAnimating("tok-a");
  markAnimating("tok-b");
  assert.equal(isAnimating("tok-a"), true);
  assert.equal(isAnimating("tok-b"), true);
  clearAnimating("tok-a");
  assert.equal(isAnimating("tok-a"), false);
  assert.equal(isAnimating("tok-b"), true);
  clearAnimating("tok-b");
});

test("clearAnimating on a never-marked id is a no-op, does not throw", () => {
  assert.doesNotThrow(() => clearAnimating("never-existed"));
});

test("markAnimating / clearAnimating with null or undefined tokenId are no-ops", () => {
  assert.doesNotThrow(() => markAnimating(null));
  assert.doesNotThrow(() => markAnimating(undefined));
  assert.doesNotThrow(() => clearAnimating(null));
  assert.equal(isAnimating(null), false);
  assert.equal(isAnimating(undefined), false);
});
