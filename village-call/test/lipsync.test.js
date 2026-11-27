import { test } from "node:test";
import assert from "node:assert/strict";
import { rms, createMouthDriver } from "../public/js/lipsync.js";

const cfg = { thresholds: [0.02, 0.06, 0.12], attack: 0.6, release: 0.15 };

test("rms of a symmetric square is its amplitude", () => {
  assert.equal(rms(new Float32Array([0.5, -0.5])), 0.5);
  assert.equal(rms(new Float32Array(0)), 0);
});

test("loud input opens the mouth fully", () => {
  const d = createMouthDriver(cfg);
  let m = 0;
  for (let i = 0; i < 10; i++) m = d.update(0.2);
  assert.equal(m, 3);
});

test("mouth closes gradually, not in one frame", () => {
  const d = createMouthDriver(cfg);
  for (let i = 0; i < 10; i++) d.update(0.2);
  assert.ok(d.update(0) > 0, "release keeps mouth open for at least one frame");
  let m = 3;
  for (let i = 0; i < 60; i++) m = d.update(0);
  assert.equal(m, 0);
});

test("silence keeps mouth closed and mid level maps to middle stages", () => {
  const d = createMouthDriver(cfg);
  assert.equal(d.update(0), 0);
  const d2 = createMouthDriver(cfg);
  let m = 0;
  for (let i = 0; i < 30; i++) m = d2.update(0.04);
  assert.equal(m, 1);
});
