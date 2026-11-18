import { loadConfig } from "./config.js";
import { Bridge } from "./bridge.js";

async function main() {
  const configPath = process.env.CONFIG_PATH ?? "config.yml";
  const config = loadConfig(configPath);

  const bridge = new Bridge(config);

  const shutdown = async (signal: string) => {
    console.log(`\n[Bridge] Received ${signal}, shutting down...`);
    await bridge.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  try {
    await bridge.start();
  } catch (err) {
    console.error("[Bridge] Failed to start:", err);
    process.exit(1);
  }
}

main();
