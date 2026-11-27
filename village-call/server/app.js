import express from "express";
import { fileURLToPath } from "node:url";
import { publicCharacter } from "./config.js";
import { registerCallRoutes } from "./chat.js";

const dir = (p) => fileURLToPath(new URL(p, import.meta.url));

export function createApp({ config, character, deps = {} }) {
  const app = express();
  // 리버스 프록시 홉 수만큼만 X-Forwarded-For를 믿는다 (맨 왼쪽 값은 클라이언트가 위조 가능).
  app.set("trust proxy", config.trustProxyHops);
  app.use(express.json({ limit: "64kb" }));

  app.get("/api/character", (_req, res) => res.json(publicCharacter(character)));

  if (deps.chat && deps.tts && deps.limits) registerCallRoutes(app, { config, ...deps });

  app.use("/assets", express.static(dir("../character/assets")));
  app.use("/audio", express.static(dir("../character/fallback-audio")));
  app.use(express.static(dir("../public")));
  // 스택 트레이스를 노출하지 않는 오류 응답
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? "server_error" : "bad_request" });
  });
  return app;
}
