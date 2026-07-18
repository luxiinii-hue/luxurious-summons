// tests/lux-template-store.test.js — effective-template merge layer (v0.7.0).

import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeTemplateOverrides, templateNeedsLink, variantHasLink } from "../scripts/template-store.js";

const TPL = () => ({
  id: "find-steed",
  name: "Find Steed",
  thumbnail: "icons/steed.webp",
  source: { mode: "compendium" },
  variants: [
    { id: "celestial", name: "Celestial Steed", thumbnail: "a.webp", source: { baseUuid: "Compendium.x.Actor.AAA" } },
    { id: "fey",       name: "Fey Steed",       thumbnail: "b.webp", source: { baseUuid: "Compendium.x.Actor.BBB" } }
  ]
});

test("no override returns the builtin reference unchanged", () => {
  const t = TPL();
  assert.equal(mergeTemplateOverrides(t, undefined), t);
  assert.equal(mergeTemplateOverrides(t, null), t);
});

test("GM-Console-only override keys (motion) do not clone the template", () => {
  const t = TPL();
  assert.equal(mergeTemplateOverrides(t, { motionEnabled: false, motionIntensity: 0.5 }), t);
});

test("name and thumbnail overrides apply without mutating the builtin", () => {
  const t = TPL();
  const m = mergeTemplateOverrides(t, { nameOverride: "Otherworldly Mounts", thumbnailOverride: "custom.webp" });
  assert.equal(m.name, "Otherworldly Mounts");
  assert.equal(m.thumbnail, "custom.webp");
  assert.equal(t.name, "Find Steed");
  assert.equal(t.thumbnail, "icons/steed.webp");
});

test("variant override: rename, rethumb, and relink uuid", () => {
  const m = mergeTemplateOverrides(TPL(), {
    variantOverrides: { fey: { name: "Glimmermane", thumbnail: "fey2.webp", uuid: "Compendium.y.Actor.ZZZ" } }
  });
  const fey = m.variants.find(v => v.id === "fey");
  assert.equal(fey.name, "Glimmermane");
  assert.equal(fey.thumbnail, "fey2.webp");
  assert.equal(fey.source.baseUuid, "Compendium.y.Actor.ZZZ");
  const celestial = m.variants.find(v => v.id === "celestial");
  assert.equal(celestial.source.baseUuid, "Compendium.x.Actor.AAA");
});

test("variant removal hides the variant", () => {
  const m = mergeTemplateOverrides(TPL(), { variantOverrides: { fey: { removed: true } } });
  assert.deepEqual(m.variants.map(v => v.id), ["celestial"]);
});

test("empty-string uuid override normalizes to null (unlinked)", () => {
  const m = mergeTemplateOverrides(TPL(), { variantOverrides: { fey: { uuid: "" } } });
  assert.equal(m.variants.find(v => v.id === "fey").source.baseUuid, null);
});

test("custom variants append with fallback thumbnail and _custom marker", () => {
  const m = mergeTemplateOverrides(TPL(), {
    customVariants: [{ id: "nightmare", name: "Nightmare", uuid: "Compendium.y.Actor.NNN" }]
  });
  const custom = m.variants.find(v => v.id === "nightmare");
  assert.equal(custom.name, "Nightmare");
  assert.equal(custom.thumbnail, "icons/steed.webp");
  assert.equal(custom.source.baseUuid, "Compendium.y.Actor.NNN");
  assert.equal(custom._custom, true);
});

test("custom variant colliding with a builtin id is ignored", () => {
  const m = mergeTemplateOverrides(TPL(), { customVariants: [{ id: "fey", name: "Impostor", uuid: "X" }] });
  assert.equal(m.variants.filter(v => v.id === "fey").length, 1);
  assert.equal(m.variants.find(v => v.id === "fey").name, "Fey Steed");
});

test("templateNeedsLink: only requiresLink templates with zero usable uuids", () => {
  assert.equal(templateNeedsLink(TPL()), false);
  const sub = { id: "summon-beast", source: { mode: "compendium-scaled", requiresLink: true },
    variants: [{ id: "land", source: { baseUuid: null } }, { id: "sky", source: { baseUuid: null } }] };
  assert.equal(templateNeedsLink(sub), true);
  const partiallyLinked = mergeTemplateOverrides(sub, { variantOverrides: { land: { uuid: "Compendium.w.Actor.LLL" } } });
  assert.equal(templateNeedsLink(partiallyLinked), false);
});

test("variantHasLink gates per-variant on requiresLink templates only", () => {
  const sub = { id: "summon-beast", source: { mode: "compendium-scaled", requiresLink: true },
    variants: [{ id: "land", source: { baseUuid: "X" } }, { id: "sky", source: { baseUuid: null } }] };
  assert.equal(variantHasLink(sub, sub.variants[0]), true);
  assert.equal(variantHasLink(sub, sub.variants[1]), false);
  const normal = TPL();
  assert.equal(variantHasLink(normal, normal.variants[0]), true);
});
