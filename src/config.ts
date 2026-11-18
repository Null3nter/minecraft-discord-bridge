import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

export interface ChannelDestination {
  channelId: string;
  useWebhook?: boolean;
  webhookUrl?: string;
  webhookName?: string;
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
    inbound: { ...DEFAULTS.inbound, ...parsed.inbound },
    formats: { ...DEFAULTS.formats, ...parsed.formats },
    channels: parsed.channels ?? {},
  } as Config;
}

export type EventType = keyof Config["channels"];
