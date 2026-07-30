import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeCompanionTokenData, DISPOSITION, DISPLAY } from "../scripts/token-normalize.js";

// The exact shape dnd5e release-5.2.1 ships for a monster stat block
// (packs/_source/monsters/undead/skeleton.yml) — the input we actually get.
const SKELETON_PROTOTYPE = {
  name: "Skeleton",
  displayName: 20,
  actorLink: false,
  width: 1,
  height: 1,
  disposition: -1,
  displayBars: 40,
  bar1: { attribute: "attributes.hp" },
  bar2: { attribute: null },
  texture: { src: "systems/dnd5e/tokens/undead/Skeleton.webp" }
};

test("a hostile compendium monster becomes a friendly companion", () => {
  const out = normalizeCompanionTokenData(SKELETON_PROTOTYPE);
  assert.equal(out.disposition, DISPOSITION.FRIENDLY);
});

test("companion tokens are actor-linked so HP readouts track the actor", () => {
  const out = normalizeCompanionTokenData(SKELETON_PROTOTYPE);
  assert.equal(out.actorLink, true);
});

test("the input prototypeToken is not mutated", () => {
  const input = { ...SKELETON_PROTOTYPE };
  normalizeCompanionTokenData(input);
  assert.equal(input.disposition, -1);
  assert.equal(input.actorLink, false);
});

test("unrelated prototypeToken fields survive untouched", () => {
  const out = normalizeCompanionTokenData(SKELETON_PROTOTYPE);
  assert.equal(out.name, "Skeleton");
  assert.equal(out.width, 1);
  assert.equal(out.texture.src, "systems/dnd5e/tokens/undead/Skeleton.webp");
});

test("display modes are raised to at least owner-visible", () => {
  const out = normalizeCompanionTokenData({ displayName: 0, displayBars: 0 });
  assert.equal(out.displayName, DISPLAY.OWNER_HOVER);
  assert.equal(out.displayBars, DISPLAY.OWNER);
});

test("a stat block that is already more visible keeps its setting", () => {
  const out = normalizeCompanionTokenData({ displayName: DISPLAY.ALWAYS, displayBars: DISPLAY.ALWAYS });
  assert.equal(out.displayName, DISPLAY.ALWAYS);
  assert.equal(out.displayBars, DISPLAY.ALWAYS);
});

test("a missing bar attribute is filled in so displayBars has something to draw", () => {
  const out = normalizeCompanionTokenData({});
  assert.deepEqual(out.bar1, { attribute: "attributes.hp" });

  const nulled = normalizeCompanionTokenData({ bar1: { attribute: null } });
  assert.deepEqual(nulled.bar1, { attribute: "attributes.hp" });
});

test("an existing bar attribute is respected", () => {
  const out = normalizeCompanionTokenData({ bar1: { attribute: "resources.primary" } });
  assert.deepEqual(out.bar1, { attribute: "resources.primary" });
});

test("disposition is overridable for GMs who want neutral summons", () => {
  const out = normalizeCompanionTokenData(SKELETON_PROTOTYPE, { disposition: DISPOSITION.NEUTRAL });
  assert.equal(out.disposition, DISPOSITION.NEUTRAL);
});

test("a non-integer disposition override falls back to friendly", () => {
  for (const bad of [undefined, null, "friendly", NaN, {}]) {
    const out = normalizeCompanionTokenData(SKELETON_PROTOTYPE, { disposition: bad });
    assert.equal(out.disposition, DISPOSITION.FRIENDLY, `bad override: ${String(bad)}`);
  }
});

test("disposition 0 (neutral) is honored and not swallowed by falsy checks", () => {
  const out = normalizeCompanionTokenData(SKELETON_PROTOTYPE, { disposition: 0 });
  assert.equal(out.disposition, DISPOSITION.NEUTRAL);
});

test("handles a completely empty prototypeToken", () => {
  const out = normalizeCompanionTokenData();
  assert.equal(out.actorLink, true);
  assert.equal(out.disposition, DISPOSITION.FRIENDLY);
});
