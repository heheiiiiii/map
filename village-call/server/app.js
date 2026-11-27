import express from "express";
import { fileURLToPath } from "node:url";
import { publicCharacter } from "./config.js";

const dir = (p) => fileURLToPath(new URL(p, import.meta.url));

export function createApp({ config, character, deps = {} }) {
  const app = express();
  app.set("trust proxy", true);
  app.use(express.json({ limit: "64kb" }));

  app.get("/api/character", (_req, res) => res.json(publicCharacter(character)));

  if (deps.routes) deps.routes(app, { config, character });

  app.use("/assets", express.static(dir("../character/assets")));
  app.use("/audio", express.static(dir("../character/fallback-audio")));
  app.use(express.static(dir("../public")));
  return app;
}
