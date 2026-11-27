// 첫 인사·작별·실패 대사를 미리 음성으로 만들어 character/fallback-audio/ 에 저장한다.
// 배포 전에 실제 TTS 설정(TTS_PROVIDER=gptsovits, TTS_URL, TTS_TOKEN)으로 실행하세요.
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadConfig, loadCharacter } from "../server/config.js";
import { createTts } from "../server/tts.js";
import { cleanForSpeech } from "../server/text.js";

const config = loadConfig();
const character = loadCharacter();
const tts = createTts(config);
const dir = fileURLToPath(new URL("../character/fallback-audio/", import.meta.url));
mkdirSync(dir, { recursive: true });

const lines = [
  ["greeting", character.greeting],
  ["farewell", character.farewell],
  ...(character.fallbackLines || []).map((t, i) => [`fallback_${i}`, t]),
];

if (config.provider.tts === "mock") console.warn("주의: TTS_PROVIDER가 mock이라 테스트용 소리가 만들어집니다.");
if (!(await tts.warm())) {
  console.error("TTS 서버가 응답하지 않습니다. TTS_URL / TTS_TOKEN을 확인하세요.");
  process.exit(1);
}
for (const [name, text] of lines) {
  if (!text) continue;
  const { audio, durationMs } = await tts.synthesize(cleanForSpeech(text));
  writeFileSync(`${dir}${name}.wav`, audio);
  console.log(`${name}.wav  ${Math.round(durationMs)}ms  "${text}"`);
}
