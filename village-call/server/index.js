import "dotenv/config";
import { createApp } from "./app.js";
import { loadConfig, loadCharacter } from "./config.js";
import { createChat } from "./chat.js";
import { createTts } from "./tts.js";
import { createLimits } from "./limits.js";

const config = loadConfig();
const character = loadCharacter();

if (config.provider.chat === "mock") console.warn("[village-call] ANTHROPIC_API_KEY 없음 → 답변은 mock 모드");
if (config.provider.tts === "mock") console.warn("[village-call] TTS_PROVIDER=gptsovits 아님 → 음성은 mock 모드");
if (!process.env.CALL_SECRET) console.warn("[village-call] CALL_SECRET 미설정 → 배포 전에 꼭 설정하세요");

const deps = {
  chat: createChat({ config, character }),
  tts: createTts(config),
  limits: createLimits({ limits: config.limits, secret: config.callSecret }),
};
createApp({ config, character, deps }).listen(config.port, () =>
  console.log(`village-call on http://localhost:${config.port}`),
);
