import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
import { loadConfig, loadCharacter } from "../server/config.js";
import { createChat } from "../server/chat.js";
import { createLimits } from "../server/limits.js";
import { createTts } from "../server/tts.js";
import { createStt } from "../public/js/stt.js";
import { listen, parseSSEText } from "./helpers.js";

const character = loadCharacter();
const hello = [{ role: "user", content: "안녕하세요" }];

async function setup({ env = {}, chat, tts } = {}) {
  const config = loadConfig({ CHAT_PROVIDER: "mock", TTS_PROVIDER: "mock", ...env });
  const deps = {
    chat: chat ?? createChat({ config, character }),
    tts: tts ?? createTts(config),
    limits: createLimits({ limits: config.limits, secret: "test" }),
  };
  return listen(createApp({ config, character, deps }));
}
const post = (s, path, { headers = {}, body } = {}) =>
  fetch(`${s.base}${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: body && JSON.stringify(body) });

test("spoofed leftmost X-Forwarded-For does not bypass the per-IP limit", async () => {
  const s = await setup();
  try {
    for (let i = 0; i < 5; i++) {
      const r = await post(s, "/api/call/start", { headers: { "X-Forwarded-For": `10.0.0.${i}, 9.9.9.9` } });
      assert.equal(r.status, 200);
    }
    const r = await post(s, "/api/call/start", { headers: { "X-Forwarded-For": "10.0.0.99, 9.9.9.9" } });
    assert.equal(r.status, 429);
  } finally {
    await s.close();
  }
});

test("real Claude provider refuses to start without CALL_SECRET", () => {
  assert.throws(() => loadConfig({ ANTHROPIC_API_KEY: "x" }), /CALL_SECRET/);
  assert.doesNotThrow(() => loadConfig({ ANTHROPIC_API_KEY: "x", CALL_SECRET: "long-secret" }));
});

test("/api/warm requires a valid call token", async () => {
  const s = await setup();
  try {
    assert.equal((await fetch(`${s.base}/api/warm`)).status, 401);
    const { token } = await (await post(s, "/api/call/start")).json();
    const r = await fetch(`${s.base}/api/warm`, { headers: { Authorization: `Bearer ${token}` } });
    assert.deepEqual(await r.json(), { ready: true });
  } finally {
    await s.close();
  }
});

test("at most 2 sentences are synthesized at once per reply", async () => {
  const real = createTts(loadConfig({ TTS_PROVIDER: "mock" }));
  let active = 0;
  let peak = 0;
  const tts = {
    warm: real.warm,
    async synthesize(t) {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 30));
      active--;
      return real.synthesize(t);
    },
  };
  const chat = { async *stream() { yield "하나. 둘. 셋. 넷. 다섯."; } };
  const s = await setup({ tts, chat });
  try {
    const { token } = await (await post(s, "/api/call/start")).json();
    const evs = parseSSEText(await (await post(s, "/api/chat", { headers: { Authorization: `Bearer ${token}` }, body: { messages: hello } })).text());
    assert.equal(evs.filter((e) => e.event === "sentence").length, 5);
    assert.ok(peak <= 2, `peak concurrency ${peak}`);
  } finally {
    await s.close();
  }
});

test("malformed history is 400 (no crash) and cap applies to the kept last message", async () => {
  const s = await setup();
  try {
    const { token } = await (await post(s, "/api/call/start")).json();
    const auth = { Authorization: `Bearer ${token}` };
    const r1 = await post(s, "/api/chat", { headers: auth, body: { messages: [...hello, null] } });
    assert.equal(r1.status, 400);
    const r2 = await post(s, "/api/chat", { headers: auth, body: { messages: [{ role: "user", content: "가".repeat(1500) }, { role: "x", content: "a" }] } });
    assert.equal(r2.status, 400);
  } finally {
    await s.close();
  }
});

test("a space after the expression tag chunk is kept between words", async () => {
  const chat = { async *stream() { yield "[happy] 우와, "; yield "정말 좋아요."; } };
  const s = await setup({ chat });
  try {
    const { token } = await (await post(s, "/api/call/start")).json();
    const evs = parseSSEText(await (await post(s, "/api/chat", { headers: { Authorization: `Bearer ${token}` }, body: { messages: hello } })).text());
    assert.deepEqual(evs.filter((e) => e.event === "sentence").map((e) => e.data.text), ["우와, 정말 좋아요."]);
  } finally {
    await s.close();
  }
});

test("stt can start again immediately after stop (quick mute/unmute)", () => {
  const made = [];
  class FakeSR {
    constructor() { made.push(this); this.started = false; }
    start() { this.started = true; }
    abort() { setTimeout(() => this.onend?.(), 0); }
  }
  globalThis.SpeechRecognition = FakeSR;
  try {
    const stt = createStt({});
    stt.start();
    stt.stop();
    stt.start();
    assert.equal(made.length, 2);
    assert.equal(made[1].started, true);
  } finally {
    delete globalThis.SpeechRecognition;
  }
});
