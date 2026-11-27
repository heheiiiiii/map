import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
import { loadConfig, loadCharacter } from "../server/config.js";
import { createChat, buildSystemPrompt } from "../server/chat.js";
import { createLimits } from "../server/limits.js";
import { createTts } from "../server/tts.js";
import { listen, parseSSEText } from "./helpers.js";

const character = loadCharacter();

async function setup({ env = {}, chat, tts } = {}) {
  const config = loadConfig({ CHAT_PROVIDER: "mock", TTS_PROVIDER: "mock", ...env });
  const deps = {
    chat: chat ?? createChat({ config, character }),
    tts: tts ?? createTts(config),
    limits: createLimits({ limits: config.limits, secret: "test" }),
  };
  const s = await listen(createApp({ config, character, deps }));
  const start = async () => (await fetch(`${s.base}/api/call/start`, { method: "POST" })).json();
  const send = (token, messages) =>
    fetch(`${s.base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ messages }),
    });
  return { s, start, send };
}

const hello = [{ role: "user", content: "오늘 바다에 다녀왔어요" }];

test("call start then chat streams expression, 3 sentences, done", async () => {
  const { s, start, send } = await setup();
  try {
    const { token, maxSeconds } = await start();
    assert.equal(maxSeconds, 300);
    const res = await send(token, hello);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /text\/event-stream/);
    const evs = parseSSEText(await res.text());
    assert.deepEqual(evs.map((e) => e.event), ["expression", "sentence", "sentence", "sentence", "done"]);
    assert.equal(evs[0].data.expression, "happy");
    assert.deepEqual(evs.slice(1, 4).map((e) => e.data.index), [0, 1, 2]);
    assert.equal(evs[1].data.text, "우와, 그랬군요!");
    assert.ok(evs[1].data.audio.length > 100);
    assert.ok(evs[1].data.durationMs > 0);
    assert.equal(evs[4].data.text, "우와, 그랬군요! 정말 재미있었겠어요. 또 얘기해 주세요~");
  } finally {
    await s.close();
  }
});

test("a failed TTS sentence is sent with audio null and order is kept", async () => {
  const real = createTts(loadConfig({ TTS_PROVIDER: "mock" }));
  let n = 0;
  const tts = { warm: real.warm, synthesize: async (t) => { if (n++ === 1) throw new Error("gpu"); return real.synthesize(t); } };
  const { s, start, send } = await setup({ tts });
  try {
    const { token } = await start();
    const evs = parseSSEText(await (await send(token, hello)).text()).filter((e) => e.event === "sentence");
    assert.deepEqual(evs.map((e) => e.data.index), [0, 1, 2]);
    assert.equal(evs[1].data.audio, null);
    assert.equal(evs[1].data.durationMs, [...evs[1].data.text].length * 110);
    assert.ok(evs[2].data.audio);
  } finally {
    await s.close();
  }
});

test("chat failure yields an error event", async () => {
  const chat = { async *stream() { throw new Error("api down"); } };
  const { s, start, send } = await setup({ chat });
  try {
    const { token } = await start();
    const evs = parseSSEText(await (await send(token, hello)).text());
    assert.deepEqual(evs.at(-1), { event: "error", data: { error: "chat_failed" } });
  } finally {
    await s.close();
  }
});

test("reply without terminator or tag is spoken as one neutral sentence", async () => {
  const chat = { async *stream() { yield "그렇구나"; yield " 정말 좋네요"; } };
  const { s, start, send } = await setup({ chat });
  try {
    const { token } = await start();
    const evs = parseSSEText(await (await send(token, hello)).text());
    assert.equal(evs[0].data.expression, "neutral");
    assert.deepEqual(evs.filter((e) => e.event === "sentence").map((e) => e.data.text), ["그렇구나 정말 좋네요"]);
  } finally {
    await s.close();
  }
});

test("missing token is 401, turn limit is 403 call_over", async () => {
  const { s, start, send } = await setup({ env: { CALL_MAX_TURNS: "1" } });
  try {
    assert.equal((await send(null, hello)).status, 401);
    const { token } = await start();
    assert.equal((await send(token, hello)).status, 200);
    const r = await send(token, hello);
    assert.equal(r.status, 403);
    assert.deepEqual(await r.json(), { error: "call_over" });
  } finally {
    await s.close();
  }
});

test("overlong or empty utterance is 400", async () => {
  const { s, start, send } = await setup();
  try {
    const { token } = await start();
    assert.equal((await send(token, [{ role: "user", content: "가".repeat(301) }])).status, 400);
    assert.equal((await send(token, [{ role: "user", content: "   " }])).status, 400);
    assert.equal((await send(token, "nope")).status, 400);
  } finally {
    await s.close();
  }
});

test("6th call start from same IP is 429 ip_limit", async () => {
  const { s } = await setup();
  try {
    for (let i = 0; i < 5; i++) assert.equal((await fetch(`${s.base}/api/call/start`, { method: "POST" })).status, 200);
    const r = await fetch(`${s.base}/api/call/start`, { method: "POST" });
    assert.equal(r.status, 429);
    assert.deepEqual(await r.json(), { error: "ip_limit" });
  } finally {
    await s.close();
  }
});

test("GET /api/warm reports tts readiness", async () => {
  const { s } = await setup();
  try {
    const { token } = await (await fetch(`${s.base}/api/call/start`, { method: "POST" })).json();
    assert.deepEqual(await (await fetch(`${s.base}/api/warm`, { headers: { Authorization: `Bearer ${token}` } })).json(), { ready: true });
  } finally {
    await s.close();
  }
});

test("system prompt contains persona, greeting and tag rule", () => {
  const p = buildSystemPrompt(character);
  assert.ok(p.includes(character.persona));
  assert.ok(p.includes(character.greeting));
  assert.match(p, /\[neutral\]|\[happy\]/);
  assert.match(p, /1~3문장/);
});

function fakeAnthropic(events, stop_reason = "end_turn") {
  const calls = [];
  return {
    calls,
    beta: {
      messages: {
        stream(params, opts) {
          calls.push({ params, opts });
          return {
            async *[Symbol.asyncIterator]() { yield* events; },
            finalMessage: async () => ({ stop_reason }),
          };
        },
      },
    },
  };
}
const delta = (text) => ({ type: "content_block_delta", delta: { type: "text_delta", text } });

test("anthropic chat sends spec model params and yields text deltas", async () => {
  const fake = fakeAnthropic([delta("[happy] 안"), { type: "message_delta" }, delta("녕!")]);
  const chat = createChat({ config: loadConfig({ CHAT_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "x", CALL_SECRET: "s" }), character, anthropic: fake });
  let out = "";
  for await (const t of chat.stream(hello)) out += t;
  assert.equal(out, "[happy] 안녕!");
  const p = fake.calls[0].params;
  assert.equal(p.model, "claude-opus-5-5");
  assert.deepEqual(p.output_config, { effort: "low" });
  assert.equal(p.fallbacks, "default");
  assert.deepEqual(p.betas, ["server-side-fallback-2026-07-01"]);
  assert.equal(p.system, buildSystemPrompt(character));
});

test("anthropic chat throws on refusal", async () => {
  const fake = fakeAnthropic([delta("x")], "refusal");
  const chat = createChat({ config: loadConfig({ CHAT_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "x", CALL_SECRET: "s" }), character, anthropic: fake });
  await assert.rejects(async () => { for await (const _ of chat.stream(hello)); });
});
