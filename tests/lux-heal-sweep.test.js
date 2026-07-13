// tests/lux-heal-sweep.test.js — v0.4.7 FIX 1 pure-logic pieces, reworked
// v0.4.8 for the probe-based classification.
//
// isHealCandidateArtPath / isStalePendingSpawn / resolveHealedArtPath are
// pure-logic (no Foundry globals touched — HEAD-probing itself is Foundry-side
// and covered by manual live-Foundry verification, same as
// lux-lifecycle-state.test.js / lux-death-animation-resolution.test.js).
// isHealCandidateArtPath takes pre-gathered probe results as a Map so the
// classification decision itself stays fully unit-testable without mocking
// fetch.

import { test } from "node:test";
import assert from "node:assert/strict";
import { isHealCandidateArtPath, isStalePendingSpawn, resolveHealedArtPath } from "../scripts/heal-sweep.js";

// ── isHealCandidateArtPath ───────────────────────────────────────────

test("isHealCandidateArtPath: empty/falsy src is always a heal candidate", () => {
  assert.equal(isHealCandidateArtPath("", new Map()), true);
  assert.equal(isHealCandidateArtPath(undefined, new Map()), true);
  assert.equal(isHealCandidateArtPath(null, new Map()), true);
});

test("isHealCandidateArtPath: Foundry's mystery-man default silhouette is a heal candidate", () => {
  assert.equal(isHealCandidateArtPath("icons/svg/mystery-man.svg", new Map()), true);
});

test("isHealCandidateArtPath: v0.4.8 REAL shipped webp art under assets/tokens/ is NOT flagged when the probe says it exists", () => {
  const probes = new Map([["modules/luxurious-summons/assets/tokens/unseen-servant.webp", true]]);
  assert.equal(isHealCandidateArtPath("modules/luxurious-summons/assets/tokens/unseen-servant.webp", probes), false);
});

test("isHealCandidateArtPath: v0.4.8 REAL shipped webp art under assets/variants/ is NOT flagged when the probe says it exists (regression guard for the old bare-prefix-match bug)", () => {
  const probes = new Map([["modules/luxurious-summons/assets/variants/dragon-cold.webp", true]]);
  assert.equal(isHealCandidateArtPath("modules/luxurious-summons/assets/variants/dragon-cold.webp", probes), false);
});

test("isHealCandidateArtPath: stale pre-0.4.6 baked .png path under assets/tokens/ IS flagged when the probe says it 404s", () => {
  const probes = new Map([["modules/luxurious-summons/assets/tokens/unseen-servant.png", false]]);
  assert.equal(isHealCandidateArtPath("modules/luxurious-summons/assets/tokens/unseen-servant.png", probes), true);
});

test("isHealCandidateArtPath: module-local path with no probe entry yet is conservatively NOT flagged", () => {
  // Callers are expected to probe every module-local candidate before calling
  // this; a missing entry means "not yet probed", not "probed and broken".
  assert.equal(isHealCandidateArtPath("modules/luxurious-summons/assets/tokens/unseen-servant.webp", new Map()), false);
});

test("isHealCandidateArtPath: module-local path with no probeResults map at all is conservatively NOT flagged", () => {
  assert.equal(isHealCandidateArtPath("modules/luxurious-summons/assets/tokens/unseen-servant.webp", undefined), false);
});

test("isHealCandidateArtPath: non-module-local valid art paths (dnd5e system, Foundry core) are never flagged, no probe needed", () => {
  assert.equal(isHealCandidateArtPath("icons/magic/unholy/strike-hand-glow-pink.webp", new Map()), false);
  assert.equal(isHealCandidateArtPath("systems/dnd5e/tokens/beast/Bat.webp", new Map()), false);
});

test("isHealCandidateArtPath: handles non-string input without throwing", () => {
  assert.equal(isHealCandidateArtPath(42, new Map()), false);
});

// ── isStalePendingSpawn ──────────────────────────────────────────────

const FIVE_MIN = 5 * 60 * 1000;

test("isStalePendingSpawn: pending-spawn older than 5 minutes is stale", () => {
  const now = 1_000_000_000_000;
  const flag = { spawnState: "pending-spawn", spawnedAt: now - FIVE_MIN - 1 };
  assert.equal(isStalePendingSpawn(flag, now), true);
});

test("isStalePendingSpawn: pending-spawn under 5 minutes is NOT stale (in-flight spawn)", () => {
  const now = 1_000_000_000_000;
  const flag = { spawnState: "pending-spawn", spawnedAt: now - 1000 };
  assert.equal(isStalePendingSpawn(flag, now), false);
});

test("isStalePendingSpawn: exactly at the 5-minute boundary is NOT yet stale", () => {
  const now = 1_000_000_000_000;
  const flag = { spawnState: "pending-spawn", spawnedAt: now - FIVE_MIN };
  assert.equal(isStalePendingSpawn(flag, now), false);
});

test("isStalePendingSpawn: no spawnState at all is never stale", () => {
  const now = 1_000_000_000_000;
  assert.equal(isStalePendingSpawn({ spawnedAt: now - FIVE_MIN - 1 }, now), false);
  assert.equal(isStalePendingSpawn({}, now), false);
  assert.equal(isStalePendingSpawn(null, now), false);
  assert.equal(isStalePendingSpawn(undefined, now), false);
});

test("isStalePendingSpawn: spawnState set but spawnedAt missing/non-numeric never throws, never stale", () => {
  const now = 1_000_000_000_000;
  assert.equal(isStalePendingSpawn({ spawnState: "pending-spawn" }, now), false);
  assert.equal(isStalePendingSpawn({ spawnState: "pending-spawn", spawnedAt: "not-a-number" }, now), false);
});

test("isStalePendingSpawn: a non-pending-spawn state is never stale regardless of age", () => {
  const now = 1_000_000_000_000;
  assert.equal(isStalePendingSpawn({ spawnState: "done", spawnedAt: now - FIVE_MIN * 100 }, now), false);
});

// ── resolveHealedArtPath ─────────────────────────────────────────────

test("resolveHealedArtPath: inline-synthesized templates use source.inline.img when no variant is selected", () => {
  const template = {
    id: "mage-hand",
    thumbnail: "modules/luxurious-summons/assets/tokens/mage-hand.webp",
    source: { mode: "inline-synthesized", inline: { img: "modules/luxurious-summons/assets/tokens/mage-hand.webp" } }
  };
  assert.equal(resolveHealedArtPath(template), "modules/luxurious-summons/assets/tokens/mage-hand.webp");
});

test("resolveHealedArtPath: falls back to template.thumbnail when no source.inline.img and no variant", () => {
  const template = { id: "find-familiar", thumbnail: "icons/creatures/birds/corvid-flying-wings-purple.webp" };
  assert.equal(resolveHealedArtPath(template), "icons/creatures/birds/corvid-flying-wings-purple.webp");
});

test("resolveHealedArtPath: returns null when template is undefined (deleted/unknown templateId)", () => {
  assert.equal(resolveHealedArtPath(undefined), null);
});

test("resolveHealedArtPath: returns null when template has neither inline img nor thumbnail, and no variant", () => {
  assert.equal(resolveHealedArtPath({ id: "bare" }), null);
});

// v0.4.8 — variant-aware priority (a spawned Cold dragon must heal to the
// cold-dragon art, not the template-level fire thumbnail or a Mage-Hand-style
// inline img that doesn't even apply to this template)

test("resolveHealedArtPath: variant.thumbnail takes priority over template.thumbnail", () => {
  const template = { id: "summon-dragon", thumbnail: "modules/luxurious-summons/assets/variants/dragon-fire.webp" };
  const variant = { id: "cold", thumbnail: "modules/luxurious-summons/assets/variants/dragon-cold.webp" };
  assert.equal(resolveHealedArtPath(template, variant), "modules/luxurious-summons/assets/variants/dragon-cold.webp");
});

test("resolveHealedArtPath: variant.thumbnail takes priority over template.source.inline.img too", () => {
  const template = {
    id: "hypothetical",
    thumbnail: "modules/luxurious-summons/assets/templates-thumbs/fallback.webp",
    source: { inline: { img: "modules/luxurious-summons/assets/tokens/inline-default.webp" } }
  };
  const variant = { id: "special", thumbnail: "modules/luxurious-summons/assets/variants/special.webp" };
  assert.equal(resolveHealedArtPath(template, variant), "modules/luxurious-summons/assets/variants/special.webp");
});

test("resolveHealedArtPath: variant with no thumbnail of its own falls through to source.inline.img then template.thumbnail", () => {
  const template = {
    id: "mage-hand",
    thumbnail: "modules/luxurious-summons/assets/templates-thumbs/fallback.webp",
    source: { inline: { img: "modules/luxurious-summons/assets/tokens/mage-hand.webp" } }
  };
  const bareVariant = { id: "bare-variant" };
  assert.equal(resolveHealedArtPath(template, bareVariant), "modules/luxurious-summons/assets/tokens/mage-hand.webp");
});

test("resolveHealedArtPath: no variantId on the companion flag (variant undefined) behaves exactly like the pre-0.4.8 signature", () => {
  const template = {
    id: "echo-knight-echo",
    thumbnail: "modules/luxurious-summons/assets/templates-thumbs/fallback.webp",
    source: { inline: { img: "modules/luxurious-summons/assets/tokens/echo-knight-echo.webp" } }
  };
  assert.equal(resolveHealedArtPath(template, undefined), "modules/luxurious-summons/assets/tokens/echo-knight-echo.webp");
});
