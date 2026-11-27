import { test } from "node:test";
import assert from "node:assert/strict";
import { bobOffset, breath, nextBlinkDelay } from "../public/js/motion.js";

test("bob is still when silent and bounded when loud", () => {
  for (const t of [0, 123, 999, 5000]) {
    assert.equal(bobOffset(0, t).y, 0);
    assert.equal(bobOffset(0, t).rot, 0);
    const b = bobOffset(1, t);
    assert.ok(b.y >= 0 && b.y <= 3);
    assert.ok(Math.abs(b.rot) <= 1.2);
  }
});

test("breath stays within 1.000..1.010 over a 4s period", () => {
  let min = 9, max = 0;
  for (let t = 0; t < 8000; t += 50) {
    const v = breath(t);
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  assert.ok(min >= 1.0 && max <= 1.01 + 1e-9);
  assert.ok(Math.abs(breath(0) - breath(4000)) < 1e-9);
});

test("blink delay is between 2s and 6s", () => {
  assert.equal(nextBlinkDelay(() => 0), 2000);
  assert.ok(nextBlinkDelay(() => 0.999) < 6000);
});
