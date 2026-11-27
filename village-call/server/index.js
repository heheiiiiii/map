import "dotenv/config";
import { createApp } from "./app.js";
import { loadConfig, loadCharacter } from "./config.js";

const config = loadConfig();
const character = loadCharacter();
const app = createApp({ config, character, deps: {} });
app.listen(config.port, () => console.log(`village-call on http://localhost:${config.port}`));
