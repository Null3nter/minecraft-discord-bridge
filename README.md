# Minecraft Discord Bridge

A flexible, highly configurable Discord ↔ Minecraft bridge that supports a **mix of webhooks and bot messages**, multi-channel routing, and independent destinations for chat, console, and server events.

## Features

- **Mixed delivery**: Use webhooks for clean player-named messages (with heads) or the bot for everything else — configurable per channel / per event type.
- **Multi-channel routing**: Post the same content (chat, console output, joins, deaths, etc.) to one or many Discord channels at the same time.
- **Bidirectional chat**: Minecraft chat → Discord and Discord → Minecraft.
- **Console bridge**: Relay server console/log lines to Discord and optionally allow trusted roles to run commands via RCON.
- **Event support**: Join/leave, deaths, advancements, server start/stop (via log parsing).
- **Per-type configuration**: Completely independent channel lists and delivery methods for:
  - `chat`
  - `console`
  - `join` / `leave`
  - `death`
  - `advancement`
  - `server` (start/stop)
- **Webhook mode** with player avatar (mc-heads / custom URL) and custom username.
- **Role-based command execution** from Discord.
- Easy YAML/JSON config with hot-reload friendly structure.

## Requirements

- Node.js 18+
- A Minecraft server with **RCON enabled** (for Discord → Minecraft commands & chat)
- Discord bot + (optional) webhooks

## Quick Start

1. **Clone & install**
   ```bash
   git clone https://github.com/Null3nter/minecraft-discord-bridge.git
   cd minecraft-discord-bridge
   npm install
   ```

2. **Create a Discord bot**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create an application → Bot → copy the token
   - Enable **Message Content Intent**
   - Invite the bot with permissions: `View Channels`, `Send Messages`, `Manage Webhooks` (if using webhooks), `Read Message History`

3. **Enable RCON on your Minecraft server** (`server.properties`):
   ```properties
   enable-rcon=true
   rcon.port=25575
   rcon.password=your_strong_password
   ```

4. **Configure**
   ```bash
   cp config.example.yml config.yml
   # Edit config.yml with your token, channel IDs, RCON details, etc.
   ```

5. **Run**
   ```bash
   npm run build
   npm start
   # or for development:
   npm run dev
   ```

## Configuration Overview

The heart of the bridge is the ability to route each type of message to **multiple channels** and choose **webhook or bot** per destination.

Example (`config.yml`):

```yaml
discord:
  token: "YOUR_BOT_TOKEN"
  # Optional: guild restriction
  guildId: "123456789012345678"

minecraft:
  rcon:
    host: "127.0.0.1"
    port: 25575
    password: "your_rcon_password"
  # Path to latest.log (for event + chat detection)
  logFile: "./logs/latest.log"   # or absolute path

# Global defaults
defaults:
  useWebhook: true
  webhookName: "Minecraft Server"
  playerAvatarUrl: "https://mc-heads.net/avatar/{name}"  # {name} or {uuid}

# Routing: each key can have multiple destinations
channels:
  chat:
    - channelId: "111111111111111111"
      useWebhook: true
      webhookUrl: "https://discord.com/api/webhooks/..."  # optional, auto-created if missing + bot has Manage Webhooks
    - channelId: "222222222222222222"          # second channel also receives chat
      useWebhook: false                        # this one uses the bot instead

  console:
    - channelId: "333333333333333333"
      useWebhook: false

  join:
    - channelId: "111111111111111111"
    - channelId: "444444444444444444"

  leave:
    - channelId: "111111111111111111"

  death:
    - channelId: "111111111111111111"

  advancement:
    - channelId: "111111111111111111"

  server:   # start / stop
    - channelId: "333333333333333333"

# Discord → Minecraft
inbound:
  chatChannels:               # channels that relay messages into Minecraft
    - "111111111111111111"
  consoleCommandChannels:     # channels where messages become RCON commands
    - "333333333333333333"
  allowedRoles:               # roles that may run commands (empty = everyone in those channels)
    - "Admin"
    - "Moderator"
  commandPrefix: "!"          # optional prefix for commands (empty = whole message is command)

# Formatting templates (supports {player}, {message}, {server}, etc.)
formats:
  chatToDiscord: "**{player}**: {message}"
  chatToMinecraft: "[Discord] {user}: {message}"
  join: "{player} joined the game"
  leave: "{player} left the game"
  death: "{message}"
  serverStart: "Server started"
  serverStop: "Server stopped"
```

### How multi-channel + mix works

- Put the same `channelId` under multiple keys if you want one channel to receive several event types.
- Put different `channelId`s under the same key to fan-out the same event to many places.
- Override `useWebhook` per destination. When `true` and no `webhookUrl` is given, the bot will try to create/manage a webhook (requires `Manage Webhooks` permission).

## Project Structure

```
src/
  index.ts              # Entry point
  config.ts             # Config loader & types
  discord/
    client.ts           # Discord.js client + webhook helpers
    handlers.ts         # Message & interaction handlers
  minecraft/
    rcon.ts             # RCON client
    logWatcher.ts       # Tail + parse latest.log
  bridge.ts             # Core routing logic
config.example.yml
```

## Development

```bash
npm run dev     # tsx watch
npm run build
npm start
```

## Roadmap / Ideas

- [ ] Account linking
- [ ] Slash commands (`/online`, `/cmd`, `/whitelist` ...)
- [ ] PlaceholderAPI / LuckPerms integration (via plugin companion)
- [ ] Multiple Minecraft servers
- [ ] Docker image
- [ ] Webhook auto-creation & caching improvements

## License

MIT

---

Made for people who want full control over where every message goes and whether it uses a webhook or the bot.
