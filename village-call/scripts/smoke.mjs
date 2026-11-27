// 통화 한 사이클 스모크 확인 (mock Claude + mock TTS + 가짜 음성 인식).
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const PORT = 3911;
const out = new URL("./out/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const server = spawn("node", ["server/index.js"], {
  env: { ...process.env, PORT: String(PORT), CHAT_PROVIDER: "mock", TTS_PROVIDER: "mock", ANTHROPIC_API_KEY: "", CALL_SECRET: "smoke" },
  stdio: ["ignore", "pipe", "inherit"],
});
await new Promise((r) => server.stdout.on("data", (d) => String(d).includes("village-call on") && r()));

const fakeSR = () => {
  let n = 0;
  class FakeSR {
    start() {
      const said = n++ === 0 ? "오늘 날씨 좋네요" : "";
      this._t = setTimeout(() => {
        if (said) {
          this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: said }], { isFinal: true })] });
        }
        this.onend?.();
      }, said ? 1000 : 60000);
    }
    abort() { clearTimeout(this._t); setTimeout(() => this.onend?.(), 0); }
    stop() { this.abort(); }
  }
  window.webkitSpeechRecognition = FakeSR;
  window.SpeechRecognition = FakeSR;
};

const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
let ok = false;
try {
  for (const [w, h, tag] of [[1280, 720, "desktop"], [390, 844, "mobile"]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(fakeSR);
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForSelector(".avatar .base");
    await page.screenshot({ path: `${out}${tag}-start.png` });
    await page.click("#dial");
    await page.waitForFunction(() => document.querySelector("#app").dataset.state === "listening", null, { timeout: 15000 });
    await page.waitForFunction(() => document.querySelector("#app").dataset.state === "speaking", null, { timeout: 10000 });
    const mouths = new Set();
    let cap = "";
    for (let i = 0; i < 40; i++) {
      cap += (await page.textContent(".cap-character")) + "|";
      const v = await page.evaluate(() => [...document.querySelectorAll(".mouth")].findIndex((m) => !m.hidden));
      mouths.add(v);
      if (i === 15) await page.screenshot({ path: `${out}${tag}-speaking.png` });
      await page.waitForTimeout(50);
    }
    await page.waitForFunction(() => document.querySelector("#app").dataset.state === "listening", null, { timeout: 15000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    await page.click("#hangup");
    await page.waitForFunction(() => document.querySelector("#app").dataset.state === "ended");
    await page.screenshot({ path: `${out}${tag}-ended.png` });
    console.log(tag, { mouthStages: [...mouths].sort(), sawGreetingWord: cap.includes("우와"), overflow, errors });
    if (!cap.includes("우와") || mouths.size < 2 || overflow || errors.length) throw new Error(`${tag} check failed`);
    await page.close();
  }
  ok = true;
} finally {
  await browser.close();
  server.kill();
}
console.log(ok ? "SMOKE OK" : "SMOKE FAILED");
process.exit(ok ? 0 : 1);
