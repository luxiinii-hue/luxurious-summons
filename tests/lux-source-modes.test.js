// tests/lux-source-modes.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveCloneData,
  resolveInlineData,
  pickScalingTier,
  applyScalingTier
} from "../scripts/source-modes.js";

test("resolveCloneData: copies actor data, strips _id, applies name prefix/suffix", () => {
  const sourceActor = { id: "abc", name: "Lyra", toObject: () => ({ _id: "abc", name: "Lyra", system: { attributes: { hp: { value: 50, max: 50 } } } }) };
  const result = resolveCloneData(sourceActor, { prefix: "Simulacrum of ", suffix: "", folderId: "f1" });
  assert.equal(result._id, undefined);
  assert.equal(result.name, "Simulacrum of Lyra");
  assert.equal(result.folder, "f1");
  assert.equal(result.system.attributes.hp.value, 50);
});

test("resolveCloneData: empty prefix/suffix produces clean name", () => {
  const sourceActor = { id: "abc", name: "Lyra", toObject: () => ({ _id: "abc", name: "Lyra" }) };
  const result = resolveCloneData(sourceActor);
  assert.equal(result.name, "Lyra");
});

test("resolveInlineData: produces actor doc from template.source.inline", () => {
  const template = {
    name: "Mage Hand",
    source: {
      mode: "inline-synthesized",
      inline: {
        type: "npc",
        system: { attributes: { ac: { flat: 10 }, hp: { value: 1, max: 1 } } },
        prototypeToken: { name: "Mage Hand", actorLink: false }
      }
    }
  };
  const result = resolveInlineData(template, { name: "Mage Hand of Lyra", folderId: "f1" });
  assert.equal(result.type, "npc");
  assert.equal(result.name, "Mage Hand of Lyra");
  assert.equal(result.folder, "f1");
  assert.equal(result.system.attributes.hp.value, 1);
  assert.equal(result.system.attributes.ac.flat, 10);
});

test("resolveInlineData: deep-clones inline so subsequent calls don't share state", () => {
  const template = { name: "Mage Hand", source: { mode: "inline-synthesized", inline: { type: "npc", system: { attributes: { hp: { value: 1 } } } } } };
  const a = resolveInlineData(template, { name: "A", folderId: "f1" });
  const b = resolveInlineData(template, { name: "B", folderId: "f1" });
  a.system.attributes.hp.value = 99;
  assert.equal(b.system.attributes.hp.value, 1);
});

test("resolveInlineData: throws on missing source.inline", () => {
  assert.throws(() => resolveInlineData({ id: "broken", name: "Broken" }), /no source.inline/);
});

const SCALING_TABLE = [
  { slotLevel: 5, hpAdd: 0,  damageAdd: 0, attackBonus: 0 },
  { slotLevel: 6, hpAdd: 10, damageAdd: 1, attackBonus: 1 },
  { slotLevel: 7, hpAdd: 20, damageAdd: 2, attackBonus: 1 },
  { slotLevel: 8, hpAdd: 30, damageAdd: 3, attackBonus: 2 }
];

test("pickScalingTier: exact slot-level match", () => {
  assert.deepEqual(pickScalingTier(SCALING_TABLE, 6), SCALING_TABLE[1]);
});

test("pickScalingTier: no match falls back to first tier", () => {
  assert.deepEqual(pickScalingTier(SCALING_TABLE, 99), SCALING_TABLE[0]);
});

test("pickScalingTier: empty table returns null", () => {
  assert.equal(pickScalingTier([], 5), null);
});

test("pickScalingTier: non-array returns null", () => {
  assert.equal(pickScalingTier(null, 5), null);
  assert.equal(pickScalingTier(undefined, 5), null);
});

test("applyScalingTier: applies hpAdd to max + value", () => {
  const base = { system: { attributes: { hp: { value: 50, max: 50 } } } };
  const tier = { slotLevel: 6, hpAdd: 10 };
  const result = applyScalingTier(base, tier);
  assert.equal(result.system.attributes.hp.max, 60);
  assert.equal(result.system.attributes.hp.value, 60);
});

test("applyScalingTier: null tier returns base unchanged", () => {
  const base = { system: { attributes: { hp: { value: 50, max: 50 } } } };
  assert.equal(applyScalingTier(base, null), base);
});

test("applyScalingTier: deep-clones (mutating result doesn't touch base)", () => {
  const base = { system: { attributes: { hp: { value: 50, max: 50 } } } };
  const result = applyScalingTier(base, { hpAdd: 10 });
  result.system.attributes.hp.value = 999;
  assert.equal(base.system.attributes.hp.value, 50);
});

test("applyScalingTier: handles missing hp attributes gracefully", () => {
  const base = { system: { attributes: {} } };
  const result = applyScalingTier(base, { hpAdd: 10 });
  assert.equal(result.system.attributes.hp, undefined);
});
