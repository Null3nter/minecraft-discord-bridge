# Minecraft Discord Bridge

**Self-contained Paper plugin** — runs entirely on your Minecraft server.  
No Node.js process, no RCON, no external bot host.

Drop the JAR in `plugins/`, set your Discord bot token, restart. Done.

## Features

- **Minecraft ↔ Discord chat** (both directions)
- **Mixed webhooks + bot** — player messages with name + head, or plain bot messages
- **Multi-channel routing** — same event to many channels; independent settings per channel
- **Events**: join, leave, death, advancements, server start/stop
- **Console commands from Discord** (role-restricted)
- **Live bot status**:
  - **Online** (green) — `{players}/{max} online | play.example.com`
  - **Do Not Disturb** — maintenance
  - **Offline** / invisible
- Works on **Paper 26.2** (and nearby versions)

## Install

1. Build (or download a release):
   ```bash
   cd plugin
   mvn -B clean package
   # JAR: plugin/target/minecraft-discord-bridge-1.0.0.jar
   ```
2. Put the JAR in your server’s `plugins/` folder.
3. Start the server once to generate config.
4. Edit `plugins/MinecraftDiscordBridge/config.yml`:
   - Set `discord.token`
   - Set channel IDs under `channels` and `inbound`
   - Set `status.server-ip`
5. Restart the server.

### Discord bot setup

1. [Discord Developer Portal](https://discord.com/developers/applications) → New Application → Bot
2. Enable **Message Content Intent**
3. Invite with: `View Channels`, `Send Messages`, `Manage Webhooks`, `Read Message History`
4. Copy the token into config

## Config (short)

```yaml
discord:
  token: "YOUR_BOT_TOKEN"

status:
  server-ip: "play.example.com"
  default-mode: "online"
  online-activity: "{players}/{max} online | {ip}"

channels:
  chat:
    - channel-id: "123..."
      use-webhook: true          # player name + head
  join:
    - channel-id: "123..."
  console:
    - channel-id: "456..."
      use-webhook: false

inbound:
  chat-channels:
    - "123..."                   # Discord → Minecraft chat
  console-command-channels:
    - "456..."                   # Discord → console commands
  allowed-roles:
    - "Admin"
  command-prefix: "!"
```

### Status commands (in a console command channel)

| Command | Effect |
|---------|--------|
| `!status online` | Online + player count |
| `!status maintenance` | Do Not Disturb |
| `!status offline` | Invisible |

## Build & release

```bash
cd plugin && mvn -B clean package
```

Requires **JDK 21+** (plugin targets 21; Paper 26.2 servers use Java 25).

GitHub Actions:
- `build-plugin.yml` — builds on every plugin change
- `release.yml` — tag `v*` or **Actions → Release → Run workflow** with version `1.0.0`

## License

MIT
