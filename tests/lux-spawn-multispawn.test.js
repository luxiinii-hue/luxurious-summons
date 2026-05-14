// tests/lux-spawn-multispawn.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createCounter,
  increment,
  decrement,
  totalCount,
  canIncrement,
  toPlacementSequence
} from "../scripts/multi-spawn-counter.js";

test("createCounter: empty counts", () => {
  const c = createCounter({ maxActive: 4 });
  assert.equal(totalCount(c), 0);
  assert.deepEqual(c.counts, {});
});

test("increment: increases variant's count", () => {
  let c = createCounter({ maxActive: 4 });
  c = increment(c, "skeleton");
  assert.equal(c.counts.skeleton, 1);
  assert.equal(totalCount(c), 1);
});

test("increment: same variant twice", () => {
  let c = createCounter({ maxActive: 4 });
  c = increment(c, "skeleton");
  c = increment(c, "skeleton");
  assert.equal(c.counts.skeleton, 2);
});

test("increment: caps at maxActive", () => {
  let c = createCounter({ maxActive: 4 });
  for (let i = 0; i < 5; i++) c = increment(c, "skeleton");
  assert.equal(totalCount(c), 4);
});

test("canIncrement: false at cap", () => {
  let c = createCounter({ maxActive: 2 });
  c = increment(c, "skeleton");
  c = increment(c, "zombie");
  assert.equal(canIncrement(c), false);
});

test("canIncrement: true under cap", () => {
  let c = createCounter({ maxActive: 4 });
  c = increment(c, "skeleton");
  assert.equal(canIncrement(c), true);
});

test("decrement: lowers variant's count, floor at 0", () => {
  let c = createCounter({ maxActive: 4 });
  c = increment(c, "skeleton");
  c = decrement(c, "skeleton");
  c = decrement(c, "skeleton");
  assert.equal(c.counts.skeleton, undefined);
});

test("decrement: removes zero-count entries (clean shape)", () => {
  let c = createCounter({ maxActive: 4 });
  c = increment(c, "skeleton");
  c = decrement(c, "skeleton");
  assert.deepEqual(c.counts, {});
});

test("decrement: preserves other-variant counts", () => {
  let c = createCounter({ maxActive: 4 });
  c = increment(c, "skeleton");
  c = increment(c, "zombie");
  c = decrement(c, "skeleton");
  assert.deepEqual(c.counts, { zombie: 1 });
});

test("totalCount: sums all variant counts", () => {
  let c = createCounter({ maxActive: 4 });
  c = increment(c, "skeleton");
  c = increment(c, "skeleton");
  c = increment(c, "zombie");
  assert.equal(totalCount(c), 3);
});

test("toPlacementSequence: flattens per-variant counts to a sequential array", () => {
  let c = createCounter({ maxActive: 4 });
  c = increment(c, "skeleton");
  c = increment(c, "skeleton");
  c = increment(c, "zombie");
  assert.deepEqual(toPlacementSequence(c), ["skeleton", "skeleton", "zombie"]);
});

test("toPlacementSequence: empty counter returns empty array", () => {
  const c = createCounter({ maxActive: 4 });
  assert.deepEqual(toPlacementSequence(c), []);
});

test("increment + decrement: returns new objects (immutability)", () => {
  const c = createCounter({ maxActive: 4 });
  const c2 = increment(c, "skeleton");
  assert.notStrictEqual(c, c2);
  assert.notStrictEqual(c.counts, c2.counts);
});
