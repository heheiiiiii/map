import { makeSineWav, wavDurationMs } from "./wav.js";

const MOCK_MS_PER_CHAR = 90;

// TTS 제공자 인터페이스: synthesize(text) -> { audio: Buffer(wav), durationMs }, warm() -> boolean
export function createTts(config, fetchImpl = fetch) {
  if (config.provider.tts !== "gptsovits") {
    return {
      async synthesize(text) {
        const ms = [...text].length * MOCK_MS_PER_CHAR;
        const audio = makeSineWav(ms, { hz: 220, sampleRate: 16000, syllableMs: MOCK_MS_PER_CHAR });
        return { audio, durationMs: ms };
      },
      async warm() {
        return true;
      },
    };
  }

  const { ttsUrl, ttsToken } = config;
  return {
    async synthesize(text) {
      const res = await fetchImpl(`${ttsUrl}/tts`, {
        method: "POST",
        headers: { Authorization: `Bearer ${ttsToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`tts failed: ${res.status}`);
      const audio = Buffer.from(await res.arrayBuffer());
      return { audio, durationMs: wavDurationMs(audio) };
    },
    async warm() {
      try {
        const res = await fetchImpl(`${ttsUrl}/warm`, {
          headers: { Authorization: `Bearer ${ttsToken}` },
          signal: AbortSignal.timeout(45_000),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}
