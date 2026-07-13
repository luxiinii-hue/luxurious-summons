// tests/lux-source-modes.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveCloneData,
  resolveInlineData,
  pickScalingTier,
  applyScalingTier,
  resolveArtFallback
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

// v0.4.7 FIX 4 — resolveInlineData overrideArtPath (Mage Hand custom token art)

test("resolveInlineData: overrideArtPath replaces both img and prototypeToken.texture.src", () => {
  const template = {
    name: "Mage Hand",
    source: {
      mode: "inline-synthesized",
      inline: {
        type: "npc",
        img: "icons/magic/unholy/strike-hand-glow-pink.webp",
        system: { attributes: { hp: { value: 1, max: 1 } } },
        prototypeToken: { name: "Mage Hand", actorLink: false, texture: { scaleX: 0.8, scaleY: 0.8 } }
      }
    }
  };
  const result = resolveInlineData(template, { name: "Mage Hand of Lyra", overrideArtPath: "modules/other/hand.webm" });
  assert.equal(result.img, "modules/other/hand.webm");
  assert.equal(result.prototypeToken.texture.src, "modules/other/hand.webm");
  // scale is preserved — only src is overridden
  assert.equal(result.prototypeToken.texture.scaleX, 0.8);
});

test("resolveInlineData: empty/undefined overrideArtPath leaves template art untouched", () => {
  const template = {
    name: "Mage Hand",
    source: { mode: "inline-synthesized", inline: { type: "npc", img: "default.webp", prototypeToken: { texture: { src: "default.webp" } } } }
  };
  const result = resolveInlineData(template, { overrideArtPath: "" });
  assert.equal(result.img, "default.webp");
  assert.equal(result.prototypeToken.texture.src, "default.webp");
});

test("resolveInlineData: overrideArtPath creates prototypeToken.texture when absent", () => {
  const template = {
    name: "Unseen Servant",
    source: { mode: "inline-synthesized", inline: { type: "npc", prototypeToken: { name: "Unseen Servant" } } }
  };
  const result = resolveInlineData(template, { overrideArtPath: "custom/servant.png" });
  assert.equal(result.prototypeToken.texture.src, "custom/servant.png");
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

// v0.4.7 FIX 5 — resolveArtFallback (Draconic Spirit missing-art heal)

const DRAGON_TEMPLATE = { id: "summon-dragon", thumbnail: "icons/creatures/abilities/dragon-fire-breath-orange.webp" };

test("resolveArtFallback: empty img and no token texture both get healed", () => {
  const actorData = { img: "", name: "Draconic Spirit", prototypeToken: {} };
  const { data, healed } = resolveArtFallback(actorData, DRAGON_TEMPLATE);
  assert.equal(healed, true);
  assert.equal(data.img, DRAGON_TEMPLATE.thumbnail);
  assert.equal(data.prototypeToken.texture.src, DRAGON_TEMPLATE.thumbnail);
});

test("resolveArtFallback: Foundry default mystery-man silhouette also counts as missing", () => {
  const actorData = { img: "icons/svg/mystery-man.svg", prototypeToken: { texture: { src: "icons/svg/mystery-man.svg" } } };
  const { data, healed } = resolveArtFallback(actorData, DRAGON_TEMPLATE);
  assert.equal(healed, true);
  assert.equal(data.img, DRAGON_TEMPLATE.thumbnail);
  assert.equal(data.prototypeToken.texture.src, DRAGON_TEMPLATE.thumbnail);
});

test("resolveArtFallback: existing valid art is left untouched", () => {
  const actorData = { img: "systems/dnd5e/tokens/dragon/Wyrmling.webp", prototypeToken: { texture: { src: "systems/dnd5e/tokens/dragon/Wyrmling.webp" } } };
  const { data, healed } = resolveArtFallback(actorData, DRAGON_TEMPLATE);
  assert.equal(healed, false);
  assert.equal(data, actorData);   // returns the SAME object, no clone when nothing changed
});

test("resolveArtFallback: preserves prototypeToken width/height/scale (Large creature stays Large)", () => {
  const actorData = { img: "", prototypeToken: { width: 2, height: 2, texture: { scaleX: 1, scaleY: 1 } } };
  const { data } = resolveArtFallback(actorData, DRAGON_TEMPLATE);
  assert.equal(data.prototypeToken.width, 2);
  assert.equal(data.prototypeToken.height, 2);
  assert.equal(data.prototypeToken.texture.src, DRAGON_TEMPLATE.thumbnail);
});

test("resolveArtFallback: only img missing, token texture already valid — only img healed", () => {
  const actorData = { img: "", prototypeToken: { texture: { src: "systems/dnd5e/tokens/dragon/Wyrmling.webp" } } };
  const { data, healed } = resolveArtFallback(actorData, DRAGON_TEMPLATE);
  assert.equal(healed, true);
  assert.equal(data.img, DRAGON_TEMPLATE.thumbnail);
  assert.equal(data.prototypeToken.texture.src, "systems/dnd5e/tokens/dragon/Wyrmling.webp");
});

test("resolveArtFallback: template with no thumbnail is a safe no-op", () => {
  const actorData = { img: "" };
  const { data, healed } = resolveArtFallback(actorData, { id: "no-thumb" });
  assert.equal(healed, false);
  assert.equal(data, actorData);
});

test("resolveArtFallback: no prototypeToken at all — creates one when healing the token texture", () => {
  const actorData = { img: "systems/dnd5e/tokens/dragon/Wyrmling.webp" };
  const { data, healed } = resolveArtFallback(actorData, DRAGON_TEMPLATE);
  assert.equal(healed, true);
  assert.equal(data.prototypeToken.texture.src, DRAGON_TEMPLATE.thumbnail);
  assert.equal(data.img, "systems/dnd5e/tokens/dragon/Wyrmling.webp");   // img untouched
});

// v0.4.8 — resolveArtFallback variant-priority (a spawned Cold dragon must
// heal to the cold-dragon art, not the template-level fire thumbnail)

const COLD_VARIANT = { id: "cold", name: "Cold", thumbnail: "modules/luxurious-summons/assets/variants/dragon-cold.webp" };

test("resolveArtFallback: variant.thumbnail takes priority over template.thumbnail when healing", () => {
  const actorData = { img: "", prototypeToken: {} };
  const { data, healed } = resolveArtFallback(actorData, DRAGON_TEMPLATE, COLD_VARIANT);
  assert.equal(healed, true);
  assert.equal(data.img, COLD_VARIANT.thumbnail);
  assert.equal(data.prototypeToken.texture.src, COLD_VARIANT.thumbnail);
  assert.notEqual(data.img, DRAGON_TEMPLATE.thumbnail);
});

test("resolveArtFallback: no variant passed — falls back to template.thumbnail exactly as before", () => {
  const actorData = { img: "", prototypeToken: {} };
  const { data, healed } = resolveArtFallback(actorData, DRAGON_TEMPLATE, undefined);
  assert.equal(healed, true);
  assert.equal(data.img, DRAGON_TEMPLATE.thumbnail);
});

test("resolveArtFallback: variant with no thumbnail of its own falls through to template.thumbnail", () => {
  const actorData = { img: "", prototypeToken: {} };
  const bareVariant = { id: "bare-variant" };
  const { data, healed } = resolveArtFallback(actorData, DRAGON_TEMPLATE, bareVariant);
  assert.equal(healed, true);
  assert.equal(data.img, DRAGON_TEMPLATE.thumbnail);
});

test("resolveArtFallback: variant.thumbnail alone (no template.thumbnail) still heals", () => {
  const actorData = { img: "", prototypeToken: {} };
  const { data, healed } = resolveArtFallback(actorData, { id: "no-thumb-template" }, COLD_VARIANT);
  assert.equal(healed, true);
  assert.equal(data.img, COLD_VARIANT.thumbnail);
});
