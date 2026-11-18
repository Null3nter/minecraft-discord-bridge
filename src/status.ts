import {
  ActivityType,
  PresenceStatusData,
} from "discord.js";
import type { Config } from "./config.js";
import type { DiscordManager } from "./discord/client.js";
import type { MinecraftRcon } from "./minecraft/rcon.js";

export type ServerMode = "online" | "maintenance" | "offline";

export class StatusManager {
  private mode: ServerMode = "online";
  private playerCount = 0;
  private maxPlayers = 0;
  private interval: NodeJS.Timeout | null = null;
  private lastRconOk = false;

  constructor(
    private readonly config: Config,
    private readonly discord: DiscordManager,
    private readonly rcon: MinecraftRcon
  ) {
    this.mode = config.status?.defaultMode ?? "online";
  }

  start(): void {
    const intervalMs = (this.config.status?.updateIntervalSeconds ?? 30) * 1000;
    this.tick(); // immediate
    this.interval = setInterval(() => this.tick(), intervalMs);
    console.log(`[Status] Updater started (every ${intervalMs / 1000}s)`);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /** Manually set maintenance / online mode (e.g. from a Discord command later) */
  setMode(mode: ServerMode): void {
    this.mode = mode;
    this.applyPresence();
  }

  getMode(): ServerMode {
    return this.mode;
  }

  private async tick(): Promise<void> {
    try {
      const list = await this.rcon.send("list");
      // Typical output: "There are 3 of a max of 20 players online: Steve, Alex, ..."
      const match = list.match(/There are (\d+) of a max of (\d+)/i)
        ?? list.match(/(\d+)\/(\d+)/);
      if (match) {
        this.playerCount = parseInt(match[1], 10);
        this.maxPlayers = parseInt(match[2], 10);
      }
      this.lastRconOk = true;

      // If we were offline and RCON is back, go online (unless user forced maintenance)
      if (this.mode === "offline") {
        this.mode = "online";
      }
    } catch {
      this.lastRconOk = false;
      this.playerCount = 0;
      // Only auto-switch to offline if not in intentional maintenance
      if (this.mode !== "maintenance") {
        this.mode = "offline";
      }
    }

    this.applyPresence();
  }

  private applyPresence(): void {
    const user = this.discord.client.user;
    if (!user) return;

    const cfg = this.config.status ?? {};
    const ip = cfg.serverIp ?? "play.example.com";
    const name = cfg.serverName ?? "Minecraft Server";

    let status: PresenceStatusData;
    let activityText: string;

    switch (this.mode) {
      case "maintenance":
        status = "dnd";
        activityText =
          cfg.maintenanceActivity ??
          `Under maintenance | ${ip}`;
        break;
      case "offline":
        status = "invisible"; // or "offline" look
        activityText =
          cfg.offlineActivity ??
          `Offline | ${ip}`;
        break;
      case "online":
default:
        status = "online";
        activityText =
          (cfg.onlineActivity ??
            `{players}/{max} online | {ip}`)
            .replace("{players}", String(this.playerCount))
            .replace("{max}", String(this.maxPlayers || "?"))
            .replace("{ip}", ip)
            .replace("{name}", name);
        break;
    }

    user.setPresence({
      status,
      activities: [
        {
          name: activityText,
          type: ActivityType.Playing,
        },
      ],
    });
  }
}
