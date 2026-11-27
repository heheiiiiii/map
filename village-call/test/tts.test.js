import { test } from "node:test";
import assert from "node:assert/strict";
import { createTts } from "../server/tts.js";
import { wavDurationMs, makeSineWav } from "../server/wav.js";
import { loadConfig } from "../server/config.js";

test("wavDurationMs reads the length of a generated wav", () => {
  const buf = makeSineWav(1000, { hz: 220, sampleRate: 16000 });
  assert.equal(buf.toString("ascii", 0, 4), "RIFF");
  assert.ok(Math.abs(wavDurationMs(buf) - 1000) <= 1);
});

test("mock tts returns 90ms per character", async () => {
  const tts = createTts(loadConfig({ TTS_PROVIDER: "mock" }));
  const { audio, durationMs } = await tts.synthesize("안녕");
  assert.ok(Math.abs(durationMs - 180) <= 1);
  assert.ok(Math.abs(wavDurationMs(audio) - 180) <= 1);
  assert.equal(await tts.warm(), true);
});

test("gptsovits tts posts text with bearer token", async () => {
  const calls = [];
  const wav = makeSineWav(500, { hz: 200, sampleRate: 32000 });
  const fakeFetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(wav, { status: 200, headers: { "content-type": "audio/wav" } });
  };
  const cfg = loadConfig({ TTS_PROVIDER: "gptsovits", TTS_URL: "https://tts.example/", TTS_TOKEN: "tok" });
  const tts = createTts(cfg, fakeFetch);
  const r = await tts.synthesize("안녕하세요");
  assert.equal(calls[0].url, "https://tts.example/tts");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.Authorization, "Bearer tok");
  assert.deepEqual(JSON.parse(calls[0].init.body), { text: "안녕하세요" });
  assert.ok(Math.abs(r.durationMs - 500) <= 1);
});

test("gptsovits tts rejects on non-200", async () => {
  const fakeFetch = async () => new Response("boom", { status: 500 });
  const cfg = loadConfig({ TTS_PROVIDER: "gptsovits", TTS_URL: "https://tts.example", TTS_TOKEN: "tok" });
  await assert.rejects(createTts(cfg, fakeFetch).synthesize("x"));
});

test("gptsovits warm returns false when endpoint fails", async () => {
  const calls = [];
  const fakeFetch = async (url) => { calls.push(url); throw new Error("down"); };
  const cfg = loadConfig({ TTS_PROVIDER: "gptsovits", TTS_URL: "https://tts.example", TTS_TOKEN: "tok" });
  assert.equal(await createTts(cfg, fakeFetch).warm(), false);
  assert.equal(calls[0], "https://tts.example/warm");
});
