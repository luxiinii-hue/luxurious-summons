// tests/lux-heal-sweep.test.js — v0.4.7 FIX 1 pure-logic pieces.
//
// isBrokenArtPath / isStalePendingSpawn / resolveHealedArtPath are pure-logic
// (no Foundry globals touched); runHealSweep + the two sweep functions ARE
// Foundry-side (game.actors, game.scenes, electPrimaryGM's game.users) and
// are covered by manual live-Foundry verification per this module's testing
// strategy, mirroring lux-lifecycle-state.test.js / lux-death-animation-resolution.test.js.

import { test } from "node:test";
import assert from "node:assert/strict";
import { isBrokenArtPath, isStalePendingSpawn, resolveHealedArtPath } from "../scripts/heal-sweep.js";

// ── isBrokenArtPath ──────────────────────────────────────────────────

test("isBrokenArtPath: matches the pre-0.4.6 baked tokens/ path prefix", () => {
  assert.equal(isBrokenArtPath("modules/luxurious-summons/assets/tokens/unseen-servant.png"), true);
  assert.equal(isBrokenArtPath("modules/luxurious-summons/assets/tokens/mage-hand.png"), true);
});

test("isBrokenArtPath: valid current art paths are not flagged", () => {
  assert.equal(isBrokenArtPath("icons/magic/unholy/strike-hand-glow-pink.webp"), false);
  assert.equal(isBrokenArtPath("systems/dnd5e/tokens/beast/Bat.webp"), false);
  assert.equal(isBrokenArtPath("modules/luxurious-summons/assets/templates-thumbs/simulacrum.svg"), false);
});

test("isBrokenArtPath: handles missing/non-string input without throwing", () => {
  assert.equal(isBrokenArtPath(undefined), false);
  assert.equal(isBrokenArtPath(null), false);
  assert.equal(isBrokenArtPath(""), false);
  assert.equal(isBrokenArtPath(42), false);
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

test("resolveHealedArtPath: inline-synthesized templates use source.inline.img first", () => {
  const template = {
    id: "mage-hand",
    thumbnail: "icons/magic/unholy/strike-hand-glow-pink.webp",
    source: { mode: "inline-synthesized", inline: { img: "icons/magic/unholy/strike-hand-glow-pink.webp" } }
  };
  assert.equal(resolveHealedArtPath(template), "icons/magic/unholy/strike-hand-glow-pink.webp");
});

test("resolveHealedArtPath: falls back to template.thumbnail when no source.inline.img", () => {
  const template = { id: "find-familiar", thumbnail: "icons/creatures/birds/corvid-flying-wings-purple.webp" };
  assert.equal(resolveHealedArtPath(template), "icons/creatures/birds/corvid-flying-wings-purple.webp");
});

test("resolveHealedArtPath: returns null when template is undefined (deleted/unknown templateId)", () => {
  assert.equal(resolveHealedArtPath(undefined), null);
});

test("resolveHealedArtPath: returns null when template has neither inline img nor thumbnail", () => {
  assert.equal(resolveHealedArtPath({ id: "bare" }), null);
});
