import {
  Client,
  GatewayIntentBits,
  TextChannel,
  WebhookClient,
  ChannelType,
} from "discord.js";
import type { Config, ChannelDestination } from "../config.js";

export class DiscordManager {
  readonly client: Client;
  private webhookCache = new Map<string, WebhookClient>();

  constructor(private readonly config: Config) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });
  }

  async login(): Promise<void> {
    await this.client.login(this.config.discord.token);
    console.log(`[Discord] Logged in as ${this.client.user?.tag}`);
  }

  async destroy(): Promise<void> {
    for (const wh of this.webhookCache.values()) {
      wh.destroy();
    }
    this.webhookCache.clear();
    this.client.destroy();
  }

  /**
   * Send a message to one or more destinations.
   * Honours per-destination useWebhook / webhookUrl settings.
   */
  async sendToDestinations(
    destinations: ChannelDestination[] | undefined,
    content: string,
    options?: {
      username?: string;
      avatarURL?: string;
      // When true, never use webhook even if configured
      forceBot?: boolean;
    }
  ): Promise<void> {
    if (!destinations?.length) return;

    const defaults = this.config.defaults;

    for (const dest of destinations) {
      const useWebhook =
        !options?.forceBot &&
        (dest.useWebhook ?? defaults.useWebhook);

      try {
        if (useWebhook) {
          await this.sendViaWebhook(dest, content, {
            username: options?.username ?? dest.webhookName ?? defaults.webhookName,
            avatarURL: options?.avatarURL,
          });
        } else {
          await this.sendViaBot(dest.channelId, content);
        }
      } catch (err) {
        console.error(
          `[Discord] Failed to send to ${dest.channelId}:`,
          (err as Error).message
        );
      }
    }
  }

  private async sendViaBot(channelId: string, content: string): Promise<void> {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      throw new Error(`Channel ${channelId} is not a text channel`);
    }
    await (channel as TextChannel).send({ content });
  }

  private async sendViaWebhook(
    dest: ChannelDestination,
    content: string,
    opts: { username?: string; avatarURL?: string }
  ): Promise<void> {
    let webhook = this.webhookCache.get(dest.channelId);

    if (!webhook) {
      if (dest.webhookUrl) {
        webhook = new WebhookClient({ url: dest.webhookUrl });
      } else {
        // Try to find or create a webhook in the channel
        const channel = await this.client.channels.fetch(dest.channelId);
        if (!channel || channel.type !== ChannelType.GuildText) {
          throw new Error(`Channel ${dest.channelId} is not a text channel`);
        }
        const textChannel = channel as TextChannel;
        const existing = await textChannel.fetchWebhooks();
        let wh = existing.find((w) => w.owner?.id === this.client.user?.id);

        if (!wh) {
          wh = await textChannel.createWebhook({
            name: dest.webhookName ?? this.config.defaults.webhookName,
            reason: "Minecraft Discord Bridge",
          });
        }
        webhook = new WebhookClient({ id: wh.id, token: wh.token! });
      }
      this.webhookCache.set(dest.channelId, webhook);
    }

    await webhook.send({
      content,
      username: opts.username,
      avatarURL: opts.avatarURL,
    });
  }

  /** Build avatar URL for a player */
  playerAvatar(playerName: string, uuid?: string): string {
    return this.config.defaults.playerAvatarUrl
      .replace("{name}", encodeURIComponent(playerName))
      .replace("{uuid}", uuid ?? playerName);
  }
}
