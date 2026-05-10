// tests/lux-broker.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { electPrimaryGM } from "../scripts/chat-broker.js";

test("electPrimaryGM picks the lowest-id active GM", () => {
  const users = [
    { id: "z9", isGM: true,  active: true },
    { id: "b1", isGM: true,  active: true },
    { id: "a0", isGM: true,  active: false },   // inactive — skipped
    { id: "p5", isGM: false, active: true }     // not GM — skipped
  ];
  assert.equal(electPrimaryGM(users), "b1");
});

test("electPrimaryGM returns null when no active GM", () => {
  const users = [
    { id: "p5", isGM: false, active: true },
    { id: "a0", isGM: true,  active: false }
  ];
  assert.equal(electPrimaryGM(users), null);
});

test("electPrimaryGM picks the only active GM", () => {
  const users = [
    { id: "g1", isGM: true,  active: true }
  ];
  assert.equal(electPrimaryGM(users), "g1");
});
