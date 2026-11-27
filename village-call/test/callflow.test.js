import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldSend, nextState, parseSSE } from "../public/js/callflow.js";

test("shouldSend ignores empty and one-character utterances", () => {
  assert.equal(shouldSend(""), false);
  assert.equal(shouldSend(" 음 "), false);
  assert.equal(shouldSend(undefined), false);
  assert.equal(shouldSend("안녕"), true);
});

test("nextState follows the spec transition table", () => {
  const rows = [
    ["start", "dial", "ringing"],
    ["ringing", "warm_ready", "greeting"],
    ["ringing", "warm_timeout", "failed"],
    ["greeting", "playback_idle", "listening"],
    ["listening", "final_transcript", "thinking"],
    ["thinking", "first_sentence", "speaking"],
    ["thinking", "chat_error", "speaking"],
    ["speaking", "chat_error", "speaking"],
    ["speaking", "playback_idle", "listening"],
    ["listening", "hangup", "ended"],
    ["speaking", "call_over", "ended"],
    ["thinking", "time_up", "ended"],
    ["ended", "dial", "ringing"],
    ["failed", "dial", "ringing"],
  ];
  for (const [from, ev, to] of rows) assert.equal(nextState(from, ev), to, `${from} + ${ev}`);
});

test("nextState keeps state on undefined transitions", () => {
  assert.equal(nextState("listening", "first_sentence"), "listening");
  assert.equal(nextState("start", "hangup"), "start");
  assert.equal(nextState("ended", "playback_idle"), "ended");
});

test("parseSSE handles events split across chunks", () => {
  const a = 'event: expression\ndata: {"expression":"happy"}\n\nevent: sentence\ndata: {"index":0}\n\nevent: do';
  const r1 = parseSSE(a, "");
  assert.deepEqual(r1.events, [
    { event: "expression", data: { expression: "happy" } },
    { event: "sentence", data: { index: 0 } },
  ]);
  const r2 = parseSSE('ne\ndata: {"text":"hi"}\n\n', r1.carry);
  assert.deepEqual(r2.events, [{ event: "done", data: { text: "hi" } }]);
  assert.equal(r2.carry, "");
});
