// tests/lux-visual-overrides.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { describeFilters } from "../scripts/visual-filters.js";

const defaults = { hueColor: "#ffffff", hueIntensity: 0, alpha: 1,
  saturation: 1, brightness: 1, outlineColor: "#ffffff",
  outlineThickness: 0, shimmer: false, shimmerIntensity: 0,
  namePrefix: "", nameSuffix: "", borderColor: "#ffffff" };

test("describeFilters returns empty list when all defaults are pass-through", () => {
  const list = describeFilters(defaults);
  assert.deepEqual(list, []);
});

test("describeFilters emits a colorMatrix entry when hueIntensity > 0", () => {
  const list = describeFilters({ ...defaults, hueColor: "#88ccff", hueIntensity: 0.5 });
  assert.equal(list.length, 1);
  assert.equal(list[0].kind, "colorMatrix");
  assert.equal(list[0].hueColor, "#88ccff");
  assert.equal(list[0].hueIntensity, 0.5);
});

test("describeFilters emits an alpha entry when alpha < 1", () => {
  const list = describeFilters({ ...defaults, alpha: 0.85 });
  assert.equal(list.length, 1);
  assert.equal(list[0].kind, "alpha");
  assert.equal(list[0].value, 0.85);
});

test("describeFilters emits an outline entry when outlineThickness > 0", () => {
  const list = describeFilters({ ...defaults, outlineColor: "#aaffff", outlineThickness: 3 });
  assert.equal(list.length, 1);
  assert.equal(list[0].kind, "outline");
  assert.equal(list[0].thickness, 3);
});

test("describeFilters composes multiple filters in order: hue, saturation, brightness, alpha, outline, shimmer", () => {
  const list = describeFilters({
    ...defaults,
    hueColor: "#88ccff", hueIntensity: 0.15,
    saturation: 0.7, brightness: 0.8, alpha: 0.85,
    outlineColor: "#aaffff", outlineThickness: 3,
    shimmer: true, shimmerIntensity: 0.4
  });
  assert.deepEqual(list.map(f => f.kind), ["colorMatrix", "saturation", "brightness", "alpha", "outline", "shimmer"]);
});
