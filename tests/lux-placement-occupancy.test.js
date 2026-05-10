// tests/lux-placement-occupancy.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { isCellBlocked } from "../scripts/placement-overlay.js";

test("isCellBlocked returns false when cell is free", () => {
  const placedBounds = [
    { x: 0, y: 0, width: 100, height: 100 }
  ];
  assert.equal(isCellBlocked({ x: 200, y: 200, width: 100, height: 100 }, placedBounds), false);
});

test("isCellBlocked returns true when cell exactly matches a placed token", () => {
  const placedBounds = [
    { x: 100, y: 100, width: 100, height: 100 }
  ];
  assert.equal(isCellBlocked({ x: 100, y: 100, width: 100, height: 100 }, placedBounds), true);
});

test("isCellBlocked returns true on partial overlap", () => {
  const placedBounds = [
    { x: 100, y: 100, width: 100, height: 100 }
  ];
  assert.equal(isCellBlocked({ x: 150, y: 150, width: 100, height: 100 }, placedBounds), true);
});

test("isCellBlocked handles multiple placed tokens", () => {
  const placedBounds = [
    { x: 0, y: 0, width: 100, height: 100 },
    { x: 200, y: 200, width: 100, height: 100 }
  ];
  assert.equal(isCellBlocked({ x: 100, y: 100, width: 100, height: 100 }, placedBounds), false);
  assert.equal(isCellBlocked({ x: 250, y: 250, width: 100, height: 100 }, placedBounds), true);
});

test("isCellBlocked returns false on empty placedBounds list", () => {
  assert.equal(isCellBlocked({ x: 0, y: 0, width: 100, height: 100 }, []), false);
});
