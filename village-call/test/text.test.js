import { test } from "node:test";
import assert from "node:assert/strict";
import { createSentenceSplitter, parseExpression, cleanForSpeech, EXPRESSIONS } from "../server/text.js";

test("splitter emits sentences as they complete across chunks", () => {
  const s = createSentenceSplitter();
  assert.deepEqual(s.push("안녕하세요! 반가"), ["안녕하세요!"]);
  assert.deepEqual(s.push("워요. 오늘"), ["반가워요."]);
  assert.deepEqual(s.flush(), ["오늘"]);
});

test("splitter does not cut punctuation runs split across chunks", () => {
  const s = createSentenceSplitter();
  const out = [...s.push("정말요?"), ...s.push("! 와~"), ...s.flush()];
  assert.deepEqual(out, ["정말요?!", "와~"]);
});

test("splitter flushes trailing text without terminator", () => {
  const s = createSentenceSplitter();
  assert.deepEqual(s.push("마침표 없이 끝나요"), []);
  assert.deepEqual(s.flush(), ["마침표 없이 끝나요"]);
  assert.deepEqual(s.flush(), []);
});

test("splitter splits on newline and drops blank sentences", () => {
  const s = createSentenceSplitter();
  assert.deepEqual(s.push("첫 줄\n\n둘째 줄. "), ["첫 줄", "둘째 줄."]);
});

test("parseExpression reads a leading known tag", () => {
  assert.deepEqual(parseExpression("[happy] 좋아요!"), { expression: "happy", rest: "좋아요!" });
  assert.deepEqual(parseExpression("  [sad]괜찮아요"), { expression: "sad", rest: "괜찮아요" });
});

test("parseExpression falls back to neutral on unknown or missing tag", () => {
  assert.deepEqual(parseExpression("[angry] 흥"), { expression: "neutral", rest: "흥" });
  assert.deepEqual(parseExpression("좋아요"), { expression: "neutral", rest: "좋아요" });
});

test("cleanForSpeech strips markdown, emoji and tags", () => {
  assert.equal(cleanForSpeech("**정말** 좋아요 😊"), "정말 좋아요");
  assert.equal(cleanForSpeech("[happy] _안녕_ #섬"), "안녕 섬");
});

test("EXPRESSIONS lists the five spec values", () => {
  assert.deepEqual(EXPRESSIONS, ["neutral", "happy", "surprised", "sad", "thinking"]);
});
