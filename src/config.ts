import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

export interface ChannelDestination {
  channelId: string;
  useWebhook?: boolean;
  webhookUrl?: string;
  webhookName?: string;
}

export interface StatusConfig {
  /** Public address shown in the bot activity (e.g. play.myserver.com) */
  serverIp?: string;
  /** Friendly name of the server */
  serverName?: string;
  /** How often to refresh player count & presence (seconds) */
  updateIntervalSeconds?: number;
  /** Starting mode when the bridge boots */
  defaultMode?: "online" | "maintenance" | "offline";
  /** Activity text templates. Placeholders: {players} {max} {ip} {name} */
  onlineActivity?: string;
  maintenanceActivity?: string;
  offlineActivity?: string;
}

export interface Config {
  discord: {
    token: string;
    guildId?: string;
  };
  minecraft: {
    rcon: {
      host: string;
      port: number;
      password: string;
    };
    logFile: string;
  };
  status?: StatusConfig;
  defaults: {
    useWebhook: boolean;
    webhookName: string;
    playerAvatarUrl: string;
  };
  channels: {
    chat?: ChannelDestination[];
    console?: ChannelDestination[];
    join?: ChannelDestination[];
    leave?: ChannelDestination[];
    death?: ChannelDestination[];
    advancement?: ChannelDestination[];
    server?: ChannelDestination[];
  };
  inbound: {
    chatChannels: string[];
    consoleCommandChannels: string[];
    allowedRoles: string[];
    commandPrefix: string;
  };
  formats: {
    chatToDiscord: string;
    chatToMinecraft: string;
    join: string;
    leave: string;
    death: string;
    advancement: string;
    serverStart: string;
    serverStop: string;
  };
}

const DEFAULTS: Partial<Config> = {
  defaults: {
    useWebhook: true,
    webhookName: "Minecraft Server",
    playerAvatarUrl: "https://mc-heads.net/avatar/{name}",
  },
  status: {
    serverIp: "play.example.com",
    serverName: "Minecraft Server",
    updateIntervalSeconds: 30,
    defaultMode: "online",
    onlineActivity: "{players}/{max} online | {ip}",
    maintenanceActivity: "Under maintenance | {ip}",
    offlineActivity: "Offline | {ip}",
  },
  inbound: {
    chatChannels: [],
    consoleCommandChannels: [],
    allowedRoles: [],
    commandPrefix: "",
  },
  formats: {
    chatToDiscord: "**{player}**: {message}",
    chatToMinecraft: "§9[Discord] §f{user}§7: §f{message}",
    join: "{player} joined the game",
    leave: "{player} left the game",
    death: "{message}",
    advancement: "{player} has made the advancement [{advancement}]",
    serverStart: "Server started",
    serverStop: "Server stopped",
  },
};

export function loadConfig(configPath = "config.yml"): Config {
  const resolved = path.resolve(configPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(
      `Config file not found at ${resolved}. Copy config.example.yml to config.yml and edit it.`
    );
  }

  const raw = fs.readFileSync(resolved, "utf8");
  const parsed = yaml.load(raw) as Partial<Config>;

  if (!parsed.discord?.token) {
    throw new Error("discord.token is required in config.yml");
  }
  if (!parsed.minecraft?.rcon?.password) {
    throw new Error("minecraft.rcon.password is required in config.yml");
  }

  return {
    ...DEFAULTS,
    ...parsed,
    defaults: { ...DEFAULTS.defaults, ...parsed.defaults },
    status: { ...DEFAULTS.status, ...parsed.status },
    inbound: { ...DEFAULTS.inbound, ...parsed.inbound },
    formats: { ...DEFAULTS.formats, ...parsed.formats },
    channels: parsed.channels ?? {},
  } as Config;
}

export type EventType = keyof Config["channels"];
