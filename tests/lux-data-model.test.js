// tests/lux-data-model.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateCompanionRecord, makeCompanionFlag } from "../scripts/data-model.js";

test("validateCompanionRecord accepts a complete record", () => {
  const record = {
    isCompanion: true,
    templateId: "simulacrum",
    sourceActorId: "abc123",
    sourcePlayerId: "user1",
    sourceMode: "snapshot",
    visualOverrides: { hueColor: "#88ccff", hueIntensity: 0.15, alpha: 0.85,
      saturation: 1.0, brightness: 1.0, outlineColor: "#aaffff",
      outlineThickness: 3, shimmer: false, shimmerIntensity: 0,
      namePrefix: "Simulacrum of ", nameSuffix: "", borderColor: "#88ccff" },
    spawnedAt: 1730000000000,
    notes: ""
  };
  const result = validateCompanionRecord(record);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("validateCompanionRecord rejects missing required fields", () => {
  const result = validateCompanionRecord({ isCompanion: true });
  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
  assert.ok(result.errors.some(e => e.includes("templateId")));
  assert.ok(result.errors.some(e => e.includes("sourceActorId")));
});

test("validateCompanionRecord rejects invalid sourceMode", () => {
  const result = validateCompanionRecord({
    isCompanion: true, templateId: "x", sourceActorId: "y",
    sourcePlayerId: "z", sourceMode: "invalid-mode",
    visualOverrides: {}, spawnedAt: 0, notes: ""
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes("sourceMode")));
});

test("makeCompanionFlag produces the canonical default shape", () => {
  const flag = makeCompanionFlag({
    templateId: "simulacrum",
    sourceActorId: "src1",
    sourcePlayerId: "u1",
    sourceMode: "snapshot",
    visualDefaults: { hueColor: "#fff", hueIntensity: 0, alpha: 1,
      saturation: 1, brightness: 1, outlineColor: "#000",
      outlineThickness: 0, shimmer: false, shimmerIntensity: 0,
      namePrefix: "", nameSuffix: "", borderColor: "#fff" }
  });
  assert.equal(flag.isCompanion, true);
  assert.equal(flag.templateId, "simulacrum");
  assert.equal(flag.notes, "");
  assert.ok(typeof flag.spawnedAt === "number");
});

import { regenerateUserIndex } from "../scripts/data-model.js";

test("regenerateUserIndex groups companions by sourcePlayerId", () => {
  const actors = [
    { id: "a1", flags: { "luxurious-summons": { isCompanion: true, templateId: "simulacrum",
        sourceActorId: "src1", sourcePlayerId: "u1", sourceMode: "snapshot",
        visualOverrides: {}, spawnedAt: 1000 } }, _sceneId: "sceneA" },
    { id: "a2", flags: { "luxurious-summons": { isCompanion: true, templateId: "find-familiar",
        sourceActorId: "src2", sourcePlayerId: "u1", sourceMode: "snapshot",
        visualOverrides: {}, spawnedAt: 2000 } }, _sceneId: "sceneA" },
    { id: "a3", flags: { "luxurious-summons": { isCompanion: true, templateId: "simulacrum",
        sourceActorId: "src3", sourcePlayerId: "u2", sourceMode: "snapshot",
        visualOverrides: {}, spawnedAt: 3000 } }, _sceneId: "sceneB" },
    { id: "a4", flags: {} }   // not a companion — should be ignored
  ];
  const sceneOf = (actor) => actor._sceneId;
  const index = regenerateUserIndex(actors, sceneOf);
  assert.equal(index.get("u1").length, 2);
  assert.equal(index.get("u2").length, 1);
  assert.equal(index.has("u3"), false);
  assert.equal(index.get("u1")[0].actorId, "a1");
  assert.equal(index.get("u1")[0].sceneId, "sceneA");
  assert.equal(index.get("u1")[0].templateId, "simulacrum");
});

test("regenerateUserIndex returns empty map for empty input", () => {
  const index = regenerateUserIndex([], () => null);
  assert.equal(index.size, 0);
});
