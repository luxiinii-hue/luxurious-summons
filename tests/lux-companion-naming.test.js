import { test } from "node:test";
import assert from "node:assert/strict";
import { companionDisplayName } from "../scripts/spawn-engine.js";

test("a lone summon keeps its clean name", () => {
  assert.equal(companionDisplayName("Owl of Lyra", 0, 1, 0), "Owl of Lyra");
});

test("a batch numbers every member from 1", () => {
  const names = [0, 1, 2, 3].map(i => companionDisplayName("Skeleton of Lyra", i, 4, 0));
  assert.deepEqual(names, [
    "Skeleton of Lyra (1)",
    "Skeleton of Lyra (2)",
    "Skeleton of Lyra (3)",
    "Skeleton of Lyra (4)"
  ]);
});

test("a second cast continues the numbering instead of restarting it", () => {
  // Player already has 4 skeletons; a fresh 2-skeleton cast must not collide.
  const names = [0, 1].map(i => companionDisplayName("Skeleton of Lyra", i, 2, 4));
  assert.deepEqual(names, ["Skeleton of Lyra (5)", "Skeleton of Lyra (6)"]);
});

test("a single summon joining existing ones is still numbered", () => {
  assert.equal(companionDisplayName("Skeleton of Lyra", 0, 1, 1), "Skeleton of Lyra (2)");
});

test("Mirror Image's fixed three duplicates are individually addressable", () => {
  const names = [0, 1, 2].map(i => companionDisplayName("Duplicate of Lyra", i, 3, 0));
  assert.equal(new Set(names).size, 3);
});
