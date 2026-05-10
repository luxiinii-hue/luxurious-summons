// tests/lux-dnd5e-mods.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeModUpdates } from "../scripts/dnd5e-mods.js";

test("computeModUpdates halves HP when halveMaxHp is true", () => {
  const updates = computeModUpdates({
    masterHp: { max: 50 },
    mods: { halveMaxHp: true }
  });
  assert.equal(updates["system.attributes.hp.max"], 25);
  assert.equal(updates["system.attributes.hp.value"], 25);
});

test("computeModUpdates floors odd HP halving", () => {
  const updates = computeModUpdates({
    masterHp: { max: 35 },
    mods: { halveMaxHp: true }
  });
  assert.equal(updates["system.attributes.hp.max"], 17);
});

test("computeModUpdates produces no HP changes when halveMaxHp is false", () => {
  const updates = computeModUpdates({
    masterHp: { max: 50 },
    mods: {}
  });
  assert.equal(updates["system.attributes.hp.max"], undefined);
});
