import type { Message } from "discord.js";
import type { Config } from "./config.js";
import { DiscordManager } from "./discord/client.js";
import { MinecraftRcon } from "./minecraft/rcon.js";
import { LogWatcher, type ParsedEvent } from "./minecraft/logWatcher.js";
import { StatusManager } from "./status.js";

function format(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

export class Bridge {
  private readonly discord: DiscordManager;
  private readonly rcon: MinecraftRcon;
  private readonly status: StatusManager;
  private logWatcher: LogWatcher | null = null;

  constructor(private readonly config: Config) {
    this.discord = new DiscordManager(config);
    this.rcon = new MinecraftRcon(config.minecraft.rcon);
    this.status = new StatusManager(config, this.discord, this.rcon);
  }

  async start(): Promise<void> {
    await this.discord.login();
    await this.rcon.connect();

    // Live presence: Online / DND (maintenance) / Offline + player count
    this.status.start();

    // Discord → Minecraft
    this.discord.client.on("messageCreate", (msg) => this.handleDiscordMessage(msg));

    // Minecraft → Discord (via log)
    this.logWatcher = new LogWatcher(
      this.config.minecraft.logFile,
      (event) => this.handleMinecraftEvent(event)
    );
    this.logWatcher.start();

    console.log("[Bridge] Ready");
  }

  async stop(): Promise<void> {
    this.status.stop();
    this.logWatcher?.stop();
    await this.rcon.disconnect();
    await this.discord.destroy();
  }

  /** Expose for future slash commands / admin controls */
  getStatusManager(): StatusManager {
    return this.status;
  }

  private async handleMinecraftEvent(event: ParsedEvent): Promise<void> {
    const { channels, formats } = this.config;

    switch (event.type) {
      case "chat": {
        const content = format(formats.chatToDiscord, {
          player: event.player,
          message: event.message,
        });
        await this.discord.sendToDestinations(channels.chat, content, {
          username: event.player,
          avatarURL: this.discord.playerAvatar(event.player),
        });
        break;
      }

      case "join": {
        const content = format(formats.join, { player: event.player });
        await this.discord.sendToDestinations(channels.join, content, {
          username: event.player,
          avatarURL: this.discord.playerAvatar(event.player),
        });
        break;
      }

      case "leave": {
        const content = format(formats.leave, { player: event.player });
        await this.discord.sendToDestinations(channels.leave, content, {
          username: event.player,
          avatarURL: this.discord.playerAvatar(event.player),
        });
        break;
      }

      case "death": {
        const content = format(formats.death, {
          player: event.player,
          message: event.message,
        });
        await this.discord.sendToDestinations(channels.death, content);
        break;
      }

      case "advancement": {
        const content = format(formats.advancement, {
          player: event.player,
          advancement: event.advancement,
        });
        await this.discord.sendToDestinations(channels.advancement, content, {
          username: event.player,
          avatarURL: this.discord.playerAvatar(event.player),
        });
        break;
      }

      case "server": {
        const content =
          event.event === "start"
            ? formats.serverStart
            : formats.serverStop;
        await this.discord.sendToDestinations(channels.server, content, {
          forceBot: true,
        });
        break;
      }

      case "console": {
        if (event.line.length > 5 && event.line.length < 1900) {
          const cleaned = event.line.replace(
            /^\[\d{2}:\d{2}:\d{2}\] \[[^\]]+\]:\s*/,
            ""
          );
          if (cleaned) {
            await this.discord.sendToDestinations(
              channels.console,
              `\`\`\`\n${cleaned}\n\`\`\``,
              { forceBot: true }
            );
          }
        }
        break;
      }
    }
  }

  private async handleDiscordMessage(msg: Message): Promise<void> {
    if (msg.author.bot || !msg.guild) return;
    if (
      this.config.discord.guildId &&
      msg.guild.id !== this.config.discord.guildId
    ) {
      return;
    }

    const channelId = msg.channel.id;
    const { inbound } = this.config;

    // Quick admin status commands in console channels (optional convenience)
    if (inbound.consoleCommandChannels.includes(channelId)) {
      const lower = msg.cleanContent.trim().toLowerCase();
      if (lower === "!status online" || lower === "!maintenance off") {
        this.status.setMode("online");
        await msg.reply("Status set to **Online**");
        return;
      }
      if (lower === "!status maintenance" || lower === "!maintenance on") {
        this.status.setMode("maintenance");
        await msg.reply("Status set to **Do Not Disturb** (maintenance)");
        return;
      }
      if (lower === "!status offline") {
        this.status.setMode("offline");
        await msg.reply("Status set to **Offline**");
        return;
      }
    }

    // Chat relay
    if (inbound.chatChannels.includes(channelId)) {
      const text = format(this.config.formats.chatToMinecraft, {
        user: msg.member?.displayName ?? msg.author.username,
        message: msg.cleanContent,
      });
      try {
        await this.rcon.broadcastChat(text);
      } catch (err) {
        console.error("[Bridge] Failed to send chat to Minecraft:", (err as Error).message);
      }
      return;
    }

    // Console commands
    if (inbound.consoleCommandChannels.includes(channelId)) {
      if (inbound.allowedRoles.length > 0) {
        const memberRoles = msg.member?.roles.cache.map((r) => r.name) ?? [];
        const memberRoleIds = msg.member?.roles.cache.map((r) => r.id) ?? [];
        const allowed = inbound.allowedRoles.some(
          (r) => memberRoles.includes(r) || memberRoleIds.includes(r)
        );
        if (!allowed) {
          await msg.react("🚫").catch(() => {});
          return;
        }
      }

      let command = msg.cleanContent.trim();
      if (inbound.commandPrefix) {
        if (!command.startsWith(inbound.commandPrefix)) return;
        command = command.slice(inbound.commandPrefix.length).trim();
      }

      if (!command) return;

      try {
        const response = await this.rcon.send(command);
        const reply =
          response.trim().length > 0
            ? `\`\`\`\n${response.slice(0, 1900)}\n\`\`\``
            : "✅ Command executed (no output)";
        await msg.reply({ content: reply, allowedMentions: { repliedUser: false } });
      } catch (err) {
        await msg.reply(`❌ RCON error: ${(err as Error).message}`);
      }
    }
  }
}
