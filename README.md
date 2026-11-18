# Minecraft Discord Bridge

A flexible, highly configurable Discord ↔ Minecraft bridge that supports a **mix of webhooks and bot messages**, multi-channel routing, live server status via the bot presence, and a Paper 26.2 companion plugin built with Maven.

## Features

- **Mixed delivery**: Use webhooks for clean player-named messages (with heads) or the bot for everything else — configurable per channel / per event type.
- **Multi-channel routing**: Post the same content (chat, console, joins, deaths, etc.) to one or many Discord channels at the same time.
- **Live server status** (bot presence):
  - **Online** (green) — server is up, shows player count + IP
  - **Do Not Disturb** (red) — maintenance mode
  - **Offline** (invisible) — cannot reach the server
- **Bidirectional chat** + console commands via RCON
- **Event support**: Join/leave, deaths, advancements, server start/stop
- **Paper 26.2 companion plugin** (Maven) for future richer integration
- GitHub Actions workflow that compiles the plugin automatically

## Live Status Setup

In `config.yml`:

```yaml
status:
  serverIp: "play.example.com"          # shown in the activity
  serverName: "My Minecraft Server"
  updateIntervalSeconds: 30
  defaultMode: "online"                 # online | maintenance | offline
  onlineActivity: "{players}/{max} online | {ip}"
  maintenanceActivity: "Under maintenance | {ip}"
  offlineActivity: "Offline | {ip}"
```

### Switch status from Discord

In any configured console command channel:

| Command                    | Effect                          |
|---------------------------|---------------------------------|
| `!status online`          | Green Online + player count     |
| `!status maintenance`     | Do Not Disturb (maintenance)    |
| `!status offline`         | Invisible / Offline             |
| `!maintenance on/off`     | Shortcuts for maintenance       |

The bot also auto-detects when RCON becomes unreachable and switches to Offline (unless you forced maintenance).

## Requirements

- Node.js 18+
- Minecraft server with **RCON enabled**
- Discord bot (Message Content Intent enabled)
- (Optional) Paper 26.2+ for the companion plugin

## Quick Start (Node bridge)

```bash
git clone https://github.com/Null3nter/minecraft-discord-bridge.git
cd minecraft-discord-bridge
npm install
cp config.example.yml config.yml
# Edit config.yml → token, channels, RCON, status.serverIp, etc.
npm run build && npm start
```

## Paper 26.2 Plugin (Maven)

A lightweight companion plugin lives in `plugin/`.

### Build locally

```bash
cd plugin
mvn -B clean package
# JAR appears in plugin/target/
```

Requires **JDK 25** (Paper 26.x requirement).

### GitHub Actions

Pushing changes under `plugin/` (or running the workflow manually) builds the plugin against **Paper 26.2** and uploads the JAR as an artifact:

`.github/workflows/build-plugin.yml`

## Project Structure

```
src/                        # Node.js Discord bridge
  index.ts
  config.ts
  status.ts                 # Online / DND / Offline presence + player count
  bridge.ts
  discord/
  minecraft/
plugin/                     # Paper 26.2 companion (Maven)
  pom.xml
  src/main/java/...
  src/main/resources/
.github/workflows/
  build-plugin.yml          # Maven CI for Paper 26.2
config.example.yml
```

## Configuration Overview (routing)

```yaml
channels:
  chat:
    - channelId: "111..."
      useWebhook: true          # player name + head
    - channelId: "222..."
      useWebhook: false         # sent as the bot
  console:
    - channelId: "333..."
```

Same event type can fan-out to many channels; each destination can independently choose webhook or bot.

## Development

```bash
npm run dev     # Node side (tsx watch)
npm run build && npm start

# Plugin
cd plugin && mvn clean package
```

## License

MIT
