// tests/lux-template-shape-consistency.test.js — v0.5.0 TASK 4.
//
// Walks every built-in template (new AND pre-existing) and asserts its
// `effects` descriptor references only registered motion profiles / spawn
// animations / death animations. Complements the existing per-concern tests
// (lux-thumbnail-paths, lux-spell-trigger-matching's placeholder-UUID check,
// lux-source-modes) with a single cross-cutting consistency sweep — this is
// the test the v0.5.0 spec asked for ("make sure they cover the newcomers")
// and it didn't already exist as a standalone file.

import { test } from "node:test";
import assert from "node:assert/strict";
import { templates as builtin } from "../scripts/templates-builtin.js";
import { readEffects } from "../scripts/data-model.js";
import { motionProfiles } from "../scripts/motion-profiles.js";
import { spawnAnimations } from "../scripts/spawn-animations.js";
import { deathAnimations } from "../scripts/death-animations.js";

const VALID_MOTION_PROFILES = new Set(Object.keys(motionProfiles));
const VALID_SPAWN_ANIMATIONS = new Set(Object.keys(spawnAnimations));
const VALID_DEATH_ANIMATIONS = new Set(Object.keys(deathAnimations));

test("every built-in template's effects.motion.profile is a registered motion profile", () => {
  for (const t of builtin) {
    const effects = readEffects(t);
    assert.ok(
      VALID_MOTION_PROFILES.has(effects.motion.profile),
      `template "${t.id}": motion profile "${effects.motion.profile}" is not registered in motion-profiles.js`
    );
  }
});

test("every built-in template's effects.spawn (when set) is a registered spawn animation", () => {
  for (const t of builtin) {
    const effects = readEffects(t);
    if (effects.spawn === null) continue; // legacy templates may have no spawn layer
    assert.ok(
      VALID_SPAWN_ANIMATIONS.has(effects.spawn),
      `template "${t.id}": spawn animation "${effects.spawn}" is not registered in spawn-animations.js`
    );
  }
});

test("every built-in template's effects.death is a registered death animation", () => {
  for (const t of builtin) {
    const effects = readEffects(t);
    assert.ok(
      VALID_DEATH_ANIMATIONS.has(effects.death),
      `template "${t.id}": death animation "${effects.death}" is not registered in death-animations.js`
    );
  }
});

test("every variant's deathEffectOverride / spawnEffectOverride (when set) reference registered animations", () => {
  for (const t of builtin) {
    for (const v of t.variants ?? []) {
      if (v.deathEffectOverride) {
        assert.ok(
          VALID_DEATH_ANIMATIONS.has(v.deathEffectOverride),
          `template "${t.id}" variant "${v.id}": deathEffectOverride "${v.deathEffectOverride}" is not registered`
        );
      }
      if (v.spawnEffectOverride) {
        assert.ok(
          VALID_SPAWN_ANIMATIONS.has(v.spawnEffectOverride),
          `template "${t.id}" variant "${v.id}": spawnEffectOverride "${v.spawnEffectOverride}" is not registered`
        );
      }
    }
  }
});

test("every built-in template has a valid source.mode", () => {
  const VALID_MODES = new Set(["clone", "compendium", "compendium-scaled", "inline-synthesized"]);
  for (const t of builtin) {
    assert.ok(t.source?.mode, `template "${t.id}" has no source.mode`);
    assert.ok(VALID_MODES.has(t.source.mode), `template "${t.id}": unknown source.mode "${t.source.mode}"`);
  }
});

test("compendium and compendium-scaled templates carry a resolvable baseUuid (on the template or every variant)", () => {
  for (const t of builtin) {
    if (t.source?.mode !== "compendium" && t.source?.mode !== "compendium-scaled") continue;
    // v0.7.0: requiresLink templates (Summon X spirit family) SHIP unlinked by
    // design — the GM wires their subscriber-content UUIDs via the Templates
    // editor. Their null baseUuid is validated by lux-template-store tests.
    if (t.source.requiresLink === true) continue;
    if (t.source.baseUuid) {
      assert.match(t.source.baseUuid, /^Compendium\.dnd5e\./, `template "${t.id}": baseUuid "${t.source.baseUuid}" doesn't look like a dnd5e compendium UUID`);
      continue;
    }
    // No template-level baseUuid — every variant must carry its own (Find Familiar / Pact / Animate Dead / Find Steed pattern)
    assert.ok(t.variants?.length > 0, `template "${t.id}": source.mode "${t.source.mode}" has no baseUuid and no variants — nothing resolvable`);
    for (const v of t.variants) {
      assert.ok(v.source?.baseUuid, `template "${t.id}" variant "${v.id}": no baseUuid on template or variant`);
      assert.match(v.source.baseUuid, /^Compendium\.dnd5e\./, `template "${t.id}" variant "${v.id}": baseUuid "${v.source.baseUuid}" doesn't look like a dnd5e compendium UUID`);
    }
  }
});

test("substituteSpellLevel templates carry a numeric baseSpellLevel", () => {
  for (const t of builtin) {
    if (!t.source?.substituteSpellLevel) continue;
    assert.equal(typeof t.source.baseSpellLevel, "number", `template "${t.id}": substituteSpellLevel is true but baseSpellLevel is not a number`);
    assert.ok(t.source.baseSpellLevel >= 1, `template "${t.id}": baseSpellLevel should be >= 1`);
  }
});

test("substituteSpellLevel set: the v0.5.0 pair + the nine v0.7.0 Summon X spirit templates", () => {
  const flagged = builtin.filter(t => t.source?.substituteSpellLevel === true).map(t => t.id).sort();
  assert.deepEqual(flagged, [
    "arcane-hand", "spiritual-weapon",
    "summon-aberration", "summon-beast", "summon-celestial", "summon-construct",
    "summon-elemental", "summon-fey", "summon-fiend", "summon-shadowspawn", "summon-undead"
  ].sort());
});

test("v0.7.0: all nine Summon X templates are requiresLink with a single unlinked 'spirit' variant", () => {
  const spirits = builtin.filter(t => t.source?.requiresLink === true);
  assert.equal(spirits.length, 9, `expected 9 requiresLink templates, found ${spirits.length}`);
  for (const t of spirits) {
    assert.match(t.id, /^summon-/, `unexpected requiresLink template "${t.id}"`);
    assert.equal(t.variants?.length, 1, `template "${t.id}" should ship exactly one variant`);
    assert.equal(t.variants[0].id, "spirit");
    assert.equal(t.variants[0].source.baseUuid, null, `template "${t.id}" must ship UNlinked`);
    assert.equal(typeof t.source.baseSpellLevel, "number");
  }
});

test("mirror-image: fixed multi-spawn of 3, no variants array (single stat block spawned 3x)", () => {
  const tpl = builtin.find(t => t.id === "mirror-image");
  assert.ok(tpl, "mirror-image template not found");
  assert.equal(tpl.maxActive, 3);
  assert.equal(tpl.variants, undefined, "mirror-image should have no variants array — fixed count of the same duplicate");
  assert.equal(tpl.source.mode, "compendium");
  assert.equal(tpl.source.baseUuid, "Compendium.dnd5e.actors24.Actor.phbDuplicate0000");
});

test("find-steed: 3 named variants, no redundant generic 'otherworldly' entry", () => {
  const tpl = builtin.find(t => t.id === "find-steed");
  assert.ok(tpl, "find-steed template not found");
  const ids = tpl.variants.map(v => v.id).sort();
  assert.deepEqual(ids, ["celestial", "fey", "fiend"]);
  for (const v of tpl.variants) {
    assert.match(v.source.baseUuid, /^Compendium\.dnd5e\.actors24\.Actor\.phbost/, `find-steed variant "${v.id}": unexpected UUID shape "${v.source.baseUuid}"`);
  }
});

test("arcane-hand: Large size preserved — no scaleX/scaleY shrink override in template data", () => {
  const tpl = builtin.find(t => t.id === "arcane-hand");
  assert.ok(tpl, "arcane-hand template not found");
  // The template itself must not carry any inline prototypeToken scale
  // override that would fight the compendium clone's native Large (2x2) size.
  assert.equal(tpl.source.inline, undefined, "arcane-hand should be compendium-sourced, not inline (would need manual size data)");
});

test("v0.5.0 templates all use real (non-placeholder) UUIDs — no *-uuid-tbd", () => {
  const newIds = ["spiritual-weapon", "arcane-hand", "mirror-image", "find-steed", "phantom-steed", "flaming-sphere"];
  for (const id of newIds) {
    const tpl = builtin.find(t => t.id === id);
    assert.ok(tpl, `template "${id}" not found`);
    const json = JSON.stringify(tpl);
    assert.ok(!json.includes("uuid-tbd"), `template "${id}" still carries a placeholder UUID`);
  }
});

test("templates-builtin.js count: 14 (v0.5.0) + 9 Summon X spirits (v0.7.0) = 23", () => {
  assert.equal(builtin.length, 23, `expected 23 built-in templates, found ${builtin.length}`);
});
