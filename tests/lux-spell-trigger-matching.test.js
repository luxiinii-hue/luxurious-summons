// tests/lux-spell-trigger-matching.test.js — findTemplatesByItem pure logic.
//
// spell-trigger.js only touches Foundry globals inside installSpellCastTrigger,
// so importing the module (and the built-in template data) is node-safe.

import { test } from "node:test";
import assert from "node:assert/strict";
import { findTemplatesByItem, extractCastSlotLevel } from "../scripts/spell-trigger.js";
import { templates as builtin } from "../scripts/templates-builtin.js";

test("matches Simulacrum spell by exact name, case-insensitive", () => {
  const matches = findTemplatesByItem({ name: "sIMULACRUM", type: "spell" });
  assert.deepEqual(matches.map(t => t.id), ["simulacrum"]);
});

test("Find Familiar cast matches both find-familiar and pact-of-the-chain", () => {
  const ids = findTemplatesByItem({ name: "Find Familiar", type: "spell" }).map(t => t.id).sort();
  assert.deepEqual(ids, ["find-familiar", "pact-of-the-chain"]);
});

test("Summon Dragon: BOTH the Tasha's and the 2024-SRD spell names trigger", () => {
  for (const name of ["Summon Draconic Spirit", "Summon Dragon"]) {
    const matches = findTemplatesByItem({ name, type: "spell" });
    assert.deepEqual(matches.map(t => t.id), ["summon-dragon"], `spell name "${name}" should match summon-dragon`);
  }
});

test("spell-type trigger does not match a feat of the same name", () => {
  assert.deepEqual(findTemplatesByItem({ name: "Simulacrum", type: "feat" }), []);
});

test("feature-type trigger (Manifest Echo) matches feat, not spell", () => {
  const asFeat = findTemplatesByItem({ name: "Manifest Echo", type: "feat" });
  assert.deepEqual(asFeat.map(t => t.id), ["echo-knight-echo"]);
  assert.deepEqual(findTemplatesByItem({ name: "Manifest Echo", type: "spell" }), []);
});

test("null / nameless items match nothing", () => {
  assert.deepEqual(findTemplatesByItem(null), []);
  assert.deepEqual(findTemplatesByItem({ type: "spell" }), []);
});

test("alias arrays: custom template with string trigger still works alongside array trigger", () => {
  const custom = [
    { id: "a", trigger: { type: "spell", name: "Solo Name" } },
    { id: "b", trigger: { type: "spell", name: ["First Alias", "Second Alias"] } }
  ];
  assert.deepEqual(findTemplatesByItem({ name: "solo name", type: "spell" }, custom).map(t => t.id), ["a"]);
  assert.deepEqual(findTemplatesByItem({ name: "SECOND ALIAS", type: "spell" }, custom).map(t => t.id), ["b"]);
});

test("every built-in template has a resolvable trigger name list", () => {
  for (const t of builtin) {
    const raw = t.trigger?.name ?? t.triggerSpell;
    const names = (Array.isArray(raw) ? raw : [raw]).filter(n => typeof n === "string");
    assert.ok(names.length > 0, `template "${t.id}" has no usable trigger name`);
  }
});

test("no built-in template still carries a placeholder compendium UUID", () => {
  const json = JSON.stringify(builtin);
  assert.ok(!json.includes("uuid-tbd"), "found a *-uuid-tbd placeholder in templates-builtin");
});

// v0.4.6 FIX 4 — extractCastSlotLevel. Verified against dnd5e 5.2.1
// activity/mixin.mjs: usageConfig.spell.slot is a key string ("spell6", "pact"),
// never a number; usageConfig.consume.spellSlot is a boolean, not a level.

test("extractCastSlotLevel: numeric slot passes through unchanged", () => {
  assert.equal(extractCastSlotLevel({ spell: { slot: 6 } }, null, null), 6);
});

test('extractCastSlotLevel: "spell6" key string parses to 6', () => {
  assert.equal(extractCastSlotLevel({ spell: { slot: "spell6" } }, null, null), 6);
});

test('extractCastSlotLevel: "spell9" key string parses to 9', () => {
  assert.equal(extractCastSlotLevel({ spell: { slot: "spell9" } }, null, null), 9);
});

test('extractCastSlotLevel: "pact" resolves via item.actor.system.spells.pact.level', () => {
  const item = { actor: { system: { spells: { pact: { level: 3 } } } } };
  assert.equal(extractCastSlotLevel({ spell: { slot: "pact" } }, null, item), 3);
});

test('extractCastSlotLevel: "pact" with no resolvable pact level falls through to base/scaling', () => {
  const item = { system: { level: 2 }, actor: {} };
  assert.equal(extractCastSlotLevel({ spell: { slot: "pact" } }, null, item), 2);
});

test("extractCastSlotLevel: usageConfig.consume.spellSlot boolean is NOT mistaken for a level", () => {
  // Old bug: `?? usageConfig?.consume?.spellSlot` would return `true` here — a
  // boolean masquerading as a level. The rewrite must ignore this field entirely
  // and fall through to base level.
  const item = { system: { level: 4 } };
  const result = extractCastSlotLevel({ consume: { spellSlot: true } }, null, item);
  assert.equal(result, 4);
  assert.notEqual(result, true);
});

test("extractCastSlotLevel: scaling fallback — base 5 + scaling 2 = 7", () => {
  const item = { system: { level: 5 } };
  assert.equal(extractCastSlotLevel({ scaling: 2 }, null, item), 7);
});

test("extractCastSlotLevel: base-level fallback when no slot/scaling present", () => {
  const item = { system: { level: 3 } };
  assert.equal(extractCastSlotLevel({}, null, item), 3);
});

test("extractCastSlotLevel: null on nothing resolvable", () => {
  assert.equal(extractCastSlotLevel({}, null, {}), null);
  assert.equal(extractCastSlotLevel(null, null, null), null);
});

test("extractCastSlotLevel: unrecognized slot key string (not spellN, not pact) falls through to base level", () => {
  const item = { system: { level: 1 } };
  assert.equal(extractCastSlotLevel({ spell: { slot: "at-will" } }, null, item), 1);
});
