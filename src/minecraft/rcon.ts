import { Rcon } from "rcon-client";
import type { Config } from "../config.js";

export class MinecraftRcon {
  private client: Rcon | null = null;
  private connecting = false;

  constructor(private readonly config: Config["minecraft"]["rcon"]) {}

  async connect(): Promise<void> {
    if (this.client || this.connecting) return;
    this.connecting = true;
    try {
      this.client = await Rcon.connect({
        host: this.config.host,
        port: this.config.port,
        password: this.config.password,
      });
      console.log("[RCON] Connected");
      this.client.on("end", () => {
        console.warn("[RCON] Connection closed");
        this.client = null;
      });
    } finally {
      this.connecting = false;
    }
  }

  async ensureConnected(): Promise<void> {
    if (!this.client) {
      await this.connect();
    }
  }

  async send(command: string): Promise<string> {
    await this.ensureConnected();
    if (!this.client) throw new Error("RCON not connected");
    return this.client.send(command);
  }

  /** Send a tellraw-style chat message to all players */
  async broadcastChat(message: string): Promise<void> {
    // Escape for Minecraft JSON
    const escaped = message
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');
    await this.send(`tellraw @a {"text":"${escaped}"}`);
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.end();
      this.client = null;
    }
  }
}
