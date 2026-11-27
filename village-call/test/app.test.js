import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
import { loadConfig, loadCharacter } from "../server/config.js";

import { listen } from "./helpers.js";

test("loadConfig applies spec default limits", () => {
  const c = loadConfig({});
  assert.equal(c.limits.callMaxSeconds, 300);
  assert.equal(c.limits.callMaxTurns, 30);
  assert.equal(c.limits.ipDailyCalls, 5);
  assert.equal(c.limits.globalDailyCalls, 300);
  assert.equal(c.limits.maxUtteranceChars, 300);
});

test("loadConfig reads env overrides", () => {
  const c = loadConfig({ IP_DAILY_CALLS: "9", TTS_PROVIDER: "mock" });
  assert.equal(c.limits.ipDailyCalls, 9);
  assert.equal(c.provider.tts, "mock");
});

test("GET /api/character returns public fields without persona", async () => {
  const app = createApp({ config: loadConfig({}), character: loadCharacter(), deps: {} });
  const s = await listen(app);
  try {
    const res = await fetch(`${s.base}/api/character`);
    const body = await res.json();
    assert.equal(body.name, "보리");
    assert.equal("persona" in body, false);
    assert.ok(body.lipsync.thresholds.length === 3);
    const page = await fetch(`${s.base}/`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type"), /text\/html/);
  } finally {
    await s.close();
  }
});
