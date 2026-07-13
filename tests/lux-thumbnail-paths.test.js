// tests/lux-thumbnail-paths.test.js — v0.4.6 FIX 6.
//
// Walks every template + variant thumbnail field and asserts:
//   - `modules/luxurious-summons/...` paths exist ON DISK relative to the repo
//     root (strip the module-id prefix — that's how the path resolves once
//     installed under Foundry's Data/modules/<module-id>/).
//   - `systems/...` and `icons/...` paths are allowed through unchecked — they
//     live inside the dnd5e system / Foundry core and can't be verified
//     without a running Foundry instance.
//   - anything else (bare filename, http(s) URL, empty string, wrong prefix)
//     fails the test — that's exactly the class of bug this fix closes
//     (a path that LOOKS plausible but 404s at runtime).

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { templates as builtin } from "../scripts/templates-builtin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const MODULE_PREFIX = "modules/luxurious-summons/";

function collectThumbnails(templates) {
  const entries = [];
  for (const t of templates) {
    if (t.thumbnail) entries.push({ label: `template "${t.id}"`, thumbnail: t.thumbnail });
    for (const v of t.variants ?? []) {
      if (v.thumbnail) entries.push({ label: `template "${t.id}" variant "${v.id}"`, thumbnail: v.thumbnail });
    }
  }
  return entries;
}

test("every template + variant thumbnail resolves to an allowed path shape", () => {
  const entries = collectThumbnails(builtin);
  assert.ok(entries.length > 0, "collected zero thumbnail entries — test fixture or template data is broken");

  for (const { label, thumbnail } of entries) {
    if (thumbnail.startsWith(MODULE_PREFIX)) {
      const relPath = thumbnail.slice(MODULE_PREFIX.length);
      const onDisk = path.join(REPO_ROOT, relPath);
      assert.ok(existsSync(onDisk), `${label}: thumbnail "${thumbnail}" does not exist on disk at ${onDisk}`);
    } else if (thumbnail.startsWith("systems/") || thumbnail.startsWith("icons/")) {
      // Can't verify offline — these live in the dnd5e system / Foundry core,
      // not this repo. Allowed through.
      continue;
    } else {
      assert.fail(`${label}: thumbnail "${thumbnail}" is neither a modules/luxurious-summons/ path, a systems/ path, nor an icons/ path — unrecognized shape`);
    }
  }
});

// v0.4.8: assets/variants/ now ships real generated dragon-<type>.webp art
// (asset-planner pass, 2026-07-13) — the v0.4.6 FIX 6 "never generated"
// constraint above is obsolete and has been superseded by this positive
// assertion that every dragon variant points at its own distinct, on-disk
// webp (guards against a copy-paste regression back to the single shared
// dragon-fire-breath stopgap icon).
test("summon-dragon variants each point at their own distinct on-disk assets/variants/ webp", () => {
  const dragon = builtin.find(t => t.id === "summon-dragon");
  assert.ok(dragon, "summon-dragon template not found");
  const seen = new Set();
  for (const v of dragon.variants) {
    assert.match(v.thumbnail, /^modules\/luxurious-summons\/assets\/variants\/dragon-[a-z]+\.webp$/,
      `variant "${v.id}": thumbnail "${v.thumbnail}" doesn't match the expected per-type webp path shape`);
    assert.ok(!seen.has(v.thumbnail), `variant "${v.id}": thumbnail "${v.thumbnail}" is shared with another variant, expected distinct art per type`);
    seen.add(v.thumbnail);
  }
});
