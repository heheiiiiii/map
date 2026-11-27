import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DEFAULT_CHARACTER = fileURLToPath(new URL("../character/character.json", import.meta.url));

const int = (v, d) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : d;
};

export function loadConfig(env = process.env) {
  const config = {
    port: int(env.PORT, 3000),
    provider: {
      chat: env.CHAT_PROVIDER === "mock" || (!env.ANTHROPIC_API_KEY && env.CHAT_PROVIDER !== "anthropic") ? "mock" : "anthropic",
      tts: env.TTS_PROVIDER === "gptsovits" ? "gptsovits" : "mock",
    },
    ttsUrl: (env.TTS_URL || "").replace(/\/+$/, ""),
    ttsToken: env.TTS_TOKEN || "",
    callSecret: env.CALL_SECRET || "dev-insecure-secret",
    trustProxyHops: Number.parseInt(env.TRUST_PROXY_HOPS ?? "1", 10) || 0,
    limits: {
      callMaxSeconds: int(env.CALL_MAX_SECONDS, 300),
      callMaxTurns: int(env.CALL_MAX_TURNS, 30),
      ipDailyCalls: int(env.IP_DAILY_CALLS, 5),
      globalDailyCalls: int(env.GLOBAL_DAILY_CALLS, 300),
      maxUtteranceChars: int(env.MAX_UTTERANCE_CHARS, 300),
    },
  };
  if (config.provider.chat === "anthropic" && !env.CALL_SECRET) {
    throw new Error("CALL_SECRET이 없습니다. 실제 Claude를 쓸 때는 통화 토큰 위조를 막기 위해 CALL_SECRET을 꼭 설정하세요.");
  }
  return config;
}

export function loadCharacter(path = DEFAULT_CHARACTER) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function publicCharacter(c) {
  const { name, layout, lipsync, simpleMode, assets } = c;
  return { name, layout, lipsync, simpleMode, assets };
}
