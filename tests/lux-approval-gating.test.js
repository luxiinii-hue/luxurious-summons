// tests/lux-approval-gating.test.js — needsGmApproval pure logic (v0.7.0 D-mode).
// approval.js touches Foundry globals only inside its Foundry-side functions,
// so importing the module is node-safe.

import { test } from "node:test";
import assert from "node:assert/strict";
import { needsGmApproval } from "../scripts/approval.js";

test("GMs never need approval, regardless of settings", () => {
  assert.equal(needsGmApproval({ isGM: true, requireAll: true, templateRequires: true }), false);
});

test("global requireAll gates every non-GM spawn", () => {
  assert.equal(needsGmApproval({ isGM: false, requireAll: true, templateRequires: false }), true);
});

test("per-template requiresApproval gates even when the global switch is off", () => {
  assert.equal(needsGmApproval({ isGM: false, requireAll: false, templateRequires: true }), true);
});

test("no gates → no approval (C-mode default)", () => {
  assert.equal(needsGmApproval({ isGM: false, requireAll: false, templateRequires: false }), false);
});

test("missing/undefined inputs default to no approval", () => {
  assert.equal(needsGmApproval({}), false);
  assert.equal(needsGmApproval({ isGM: false }), false);
});
