import { test } from "node:test";
import assert from "node:assert/strict";
import { createLimits } from "../server/limits.js";

const base = { callMaxSeconds: 300, callMaxTurns: 30, ipDailyCalls: 5, globalDailyCalls: 300, maxUtteranceChars: 300 };
const clock = (start = Date.UTC(2026, 10, 27, 10)) => {
  let t = start;
  const now = () => t;
  now.advance = (ms) => { t += ms; };
  return now;
};

test("same IP gets 5 calls per day, 6th is ip_limit", () => {
  const l = createLimits({ limits: base, secret: "s", now: clock() });
  for (let i = 0; i < 5; i++) assert.equal(l.startCall("1.1.1.1").ok, true);
  assert.deepEqual(l.startCall("1.1.1.1"), { ok: false, reason: "ip_limit" });
  assert.equal(l.startCall("2.2.2.2").ok, true);
});

test("global daily cap returns closed_today", () => {
  const l = createLimits({ limits: { ...base, globalDailyCalls: 2 }, secret: "s", now: clock() });
  assert.equal(l.startCall("a").ok, true);
  assert.equal(l.startCall("b").ok, true);
  assert.deepEqual(l.startCall("c"), { ok: false, reason: "closed_today" });
});

test("counters reset on the next UTC day", () => {
  const now = clock();
  const l = createLimits({ limits: { ...base, ipDailyCalls: 1 }, secret: "s", now });
  assert.equal(l.startCall("1.1.1.1").ok, true);
  assert.equal(l.startCall("1.1.1.1").ok, false);
  now.advance(24 * 3600 * 1000);
  assert.equal(l.startCall("1.1.1.1").ok, true);
});

test("checkTurn accepts a valid token and rejects a tampered one", () => {
  const l = createLimits({ limits: base, secret: "s", now: clock() });
  const { token, expiresAt } = l.startCall("1.1.1.1");
  assert.ok(expiresAt > 0);
  assert.deepEqual(l.checkTurn(token), { ok: true });
  const bad = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
  assert.deepEqual(l.checkTurn(bad), { ok: false, reason: "invalid" });
  assert.deepEqual(l.checkTurn("garbage"), { ok: false, reason: "invalid" });
});

test("token signed with another secret is invalid", () => {
  const a = createLimits({ limits: base, secret: "a", now: clock() });
  const b = createLimits({ limits: base, secret: "b", now: clock() });
  assert.deepEqual(b.checkTurn(a.startCall("x").token), { ok: false, reason: "invalid" });
});

test("checkTurn returns call_over after max seconds", () => {
  const now = clock();
  const l = createLimits({ limits: base, secret: "s", now });
  const { token } = l.startCall("1.1.1.1");
  now.advance(301 * 1000);
  assert.deepEqual(l.checkTurn(token), { ok: false, reason: "call_over" });
});

test("checkTurn returns call_over after max turns", () => {
  const l = createLimits({ limits: { ...base, callMaxTurns: 2 }, secret: "s", now: clock() });
  const { token } = l.startCall("1.1.1.1");
  assert.equal(l.checkTurn(token).ok, true);
  assert.equal(l.checkTurn(token).ok, true);
  assert.deepEqual(l.checkTurn(token), { ok: false, reason: "call_over" });
});
