// tests/lux-batch-restrictions.test.js
//
// performSpawn's authoritative re-check (v1.0.1) asks "would the LAST token of
// this batch still be allowed?" by padding activeCompanions with the other N-1
// placements. These tests pin that semantic down — without it, a single request
// carrying N placements passes a single-spawn check and creates N actors,
// which is exactly how a hostile or buggy client would blow past the GM's caps.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkRestrictions } from "../scripts/spawn-engine.js";

const config = { globalCap: 10, antispamMax: 5, antispamWindowSeconds: 60 };

/** Mirrors the padding performSpawn applies before calling checkRestrictions. */
function checkBatch(template, liveActive, batchSize) {
  const pending = Array.from({ length: Math.max(0, batchSize - 1) },
                             () => ({ actorId: "pending", templateId: template.id }));
  return checkRestrictions({
    template,
    activeCompanions: [...liveActive, ...pending],
    recentSpawnTimestamps: [],
    now: Date.now(),
    config
  });
}

const animateDead = { id: "animate-dead", maxActive: 4 };

test("a batch that exactly fills the template cap is allowed", () => {
  assert.equal(checkBatch(animateDead, [], 4).allowed, true);
});

test("a batch one over the template cap is refused", () => {
  const verdict = checkBatch(animateDead, [], 5);
  assert.equal(verdict.allowed, false);
  assert.equal(verdict.reason, "template-cap");
});

test("an oversized batch cannot sneak past a single-spawn check", () => {
  // The bug this guards: unpadded, checkRestrictions sees 0 active and says yes.
  const unpadded = checkRestrictions({
    template: animateDead, activeCompanions: [], recentSpawnTimestamps: [],
    now: Date.now(), config
  });
  assert.equal(unpadded.allowed, true, "single-spawn check is permissive by design");
  assert.equal(checkBatch(animateDead, [], 100).allowed, false, "batch check must refuse");
});

test("a batch accounts for companions the player already has", () => {
  const existing = [{ actorId: "a", templateId: "animate-dead" },
                    { actorId: "b", templateId: "animate-dead" }];
  assert.equal(checkBatch(animateDead, existing, 2).allowed, true, "2 + 2 == cap of 4");
  assert.equal(checkBatch(animateDead, existing, 3).allowed, false, "2 + 3 exceeds cap");
});

test("a batch is bounded by the global cap across different templates", () => {
  const nineOthers = Array.from({ length: 9 }, (_, i) => ({ actorId: `x${i}`, templateId: "mage-hand" }));
  assert.equal(checkBatch(animateDead, nineOthers, 1).allowed, true, "9 + 1 == globalCap of 10");
  const verdict = checkBatch(animateDead, nineOthers, 2);
  assert.equal(verdict.allowed, false);
  assert.equal(verdict.reason, "global-cap");
});

test("a single-placement batch behaves exactly like the old single check", () => {
  const existing = [{ actorId: "a", templateId: "animate-dead" }];
  const batch = checkBatch(animateDead, existing, 1);
  const single = checkRestrictions({
    template: animateDead, activeCompanions: existing, recentSpawnTimestamps: [],
    now: Date.now(), config
  });
  assert.equal(batch.allowed, single.allowed);
});
