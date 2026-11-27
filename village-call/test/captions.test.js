import { test } from "node:test";
import assert from "node:assert/strict";
import { charSchedule } from "../public/js/captions.js";

test("schedule has one time per character, increasing, within 95%", () => {
  const s = charSchedule("안녕, 보리", 1000);
  assert.equal(s.length, 6);
  for (let i = 1; i < s.length; i++) assert.ok(s[i] >= s[i - 1]);
  assert.ok(s.at(-1) <= 950);
  assert.equal(s[0], 0);
});

test("a comma creates a longer pause before the next character", () => {
  const s = charSchedule("안녕, 보리", 1000);
  const gaps = s.slice(1).map((t, i) => t - s[i]);
  const afterComma = s[4] - s[2]; // "," 다음 공백을 지나 "보"
  assert.ok(afterComma > Math.max(gaps[0], gaps[4]));
});

test("empty text yields empty schedule", () => {
  assert.deepEqual(charSchedule("", 500), []);
});
