// tests/lux-restrictions.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkRestrictions } from "../scripts/spawn-engine.js";

const baseConfig = { globalCap: 10, antispamMax: 5, antispamWindowSeconds: 60 };

test("checkRestrictions allows spawn when under all caps", () => {
  const result = checkRestrictions({
    template: { id: "simulacrum", maxActive: 1 },
    activeCompanions: [],
    recentSpawnTimestamps: [],
    now: 1_000_000,
    config: baseConfig
  });
  assert.equal(result.allowed, true);
});

test("checkRestrictions blocks when per-template maxActive is hit", () => {
  const result = checkRestrictions({
    template: { id: "simulacrum", maxActive: 1 },
    activeCompanions: [{ templateId: "simulacrum" }],
    recentSpawnTimestamps: [],
    now: 1_000_000,
    config: baseConfig
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "template-cap");
});

test("checkRestrictions blocks when global cap is hit", () => {
  const result = checkRestrictions({
    template: { id: "find-familiar", maxActive: 1 },
    activeCompanions: Array(10).fill({ templateId: "other" }),
    recentSpawnTimestamps: [],
    now: 1_000_000,
    config: baseConfig
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "global-cap");
});

test("checkRestrictions blocks when anti-spam window saturated", () => {
  const now = 1_000_000;
  const within = now - 30_000; // 30s ago, within 60s window
  const result = checkRestrictions({
    template: { id: "find-familiar", maxActive: 1 },
    activeCompanions: [],
    recentSpawnTimestamps: Array(5).fill(within),
    now,
    config: baseConfig
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "antispam");
});

test("checkRestrictions ignores anti-spam timestamps outside the window", () => {
  const now = 1_000_000;
  const outside = now - 120_000; // 120s ago, outside 60s window
  const result = checkRestrictions({
    template: { id: "find-familiar", maxActive: 1 },
    activeCompanions: [],
    recentSpawnTimestamps: Array(5).fill(outside),
    now,
    config: baseConfig
  });
  assert.equal(result.allowed, true);
});
