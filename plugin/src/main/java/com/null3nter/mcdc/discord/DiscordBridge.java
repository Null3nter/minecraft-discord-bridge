package com.null3nter.mcdc.discord;

import com.null3nter.mcdc.MinecraftDiscordBridgePlugin;
import net.dv8tion.jda.api.JDA;
import net.dv8tion.jda.api.JDABuilder;
import net.dv8tion.jda.api.OnlineStatus;
import net.dv8tion.jda.api.entities.Activity;
import net.dv8tion.jda.api.entities.Member;
import net.dv8tion.jda.api.entities.Message;
import net.dv8tion.jda.api.entities.Role;
import net.dv8tion.jda.api.entities.Webhook;
import net.dv8tion.jda.api.entities.channel.concrete.TextChannel;
import net.dv8tion.jda.api.entities.emoji.Emoji;
import net.dv8tion.jda.api.events.message.MessageReceivedEvent;
import net.dv8tion.jda.api.hooks.ListenerAdapter;
import net.dv8tion.jda.api.requests.GatewayIntent;
import net.dv8tion.jda.api.utils.ChunkingFilter;
import net.dv8tion.jda.api.utils.MemberCachePolicy;
import org.bukkit.Bukkit;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class DiscordBridge extends ListenerAdapter {

    public enum Mode { ONLINE, MAINTENANCE, OFFLINE }

    private final MinecraftDiscordBridgePlugin plugin;
    private JDA jda;
    private Mode mode = Mode.ONLINE;
    private final Map<String, String> webhookCache = new ConcurrentHashMap<>();

    public DiscordBridge(MinecraftDiscordBridgePlugin plugin) {
        this.plugin = plugin;
        String def = plugin.getConfig().getString("status.default-mode", "online");
        mode = switch (def.toLowerCase()) {
            case "maintenance" -> Mode.MAINTENANCE;
            case "offline" -> Mode.OFFLINE;
            default -> Mode.ONLINE;
        };
    }

    public void start() throws InterruptedException {
        String token = plugin.getConfig().getString("discord.token");
        jda = JDABuilder.createDefault(token)
                .enableIntents(GatewayIntent.GUILD_MESSAGES, GatewayIntent.MESSAGE_CONTENT, GatewayIntent.GUILD_MEMBERS)
                .setMemberCachePolicy(MemberCachePolicy.ALL)
                .setChunkingFilter(ChunkingFilter.ALL)
                .addEventListeners(this)
                .setStatus(OnlineStatus.ONLINE)
                .build()
                .awaitReady();

        plugin.getLogger().info("Logged into Discord as " + jda.getSelfUser().getAsTag());

        int interval = plugin.getConfig().getInt("status.update-interval-seconds", 30);
        Bukkit.getScheduler().runTaskTimerAsynchronously(plugin, this::updatePresence, 20L, interval * 20L);

        sendTo("server", format("formats.server-start", Map.of()), null, null, true);
    }

    public void shutdown() {
        if (jda != null) {
            try {
                sendTo("server", format("formats.server-stop", Map.of()), null, null, true);
            } catch (Exception ignored) {}
            jda.shutdown();
            jda = null;
        }
    }

    public void setMode(Mode mode) {
        this.mode = mode;
        updatePresence();
    }

    public Mode getMode() {
        return mode;
    }

    private void updatePresence() {
        if (jda == null) return;

        String ip = plugin.getConfig().getString("status.server-ip", "play.example.com");
        int online = Bukkit.getOnlinePlayers().size();
        int max = Bukkit.getMaxPlayers();

        OnlineStatus status;
        String activity;

        switch (mode) {
            case MAINTENANCE -> {
                status = OnlineStatus.DO_NOT_DISTURB;
                activity = plugin.getConfig().getString("status.maintenance-activity", "Under maintenance | {ip}")
                        .replace("{ip}", ip);
            }
            case OFFLINE -> {
                status = OnlineStatus.INVISIBLE;
                activity = plugin.getConfig().getString("status.offline-activity", "Offline | {ip}")
                        .replace("{ip}", ip);
            }
            default -> {
                status = OnlineStatus.ONLINE;
                activity = plugin.getConfig().getString("status.online-activity", "{players}/{max} online | {ip}")
                        .replace("{players}", String.valueOf(online))
                        .replace("{max}", String.valueOf(max))
                        .replace("{ip}", ip);
            }
        }

        jda.getPresence().setStatus(status);
        jda.getPresence().setActivity(Activity.playing(activity));
    }

    public void sendChat(String player, String message) {
        String content = format("formats.chat-to-discord", Map.of(
                "player", player,
                "message", message
        ));
        sendTo("chat", content, player, avatar(player), false);
    }

    public void sendJoin(String player) {
        sendTo("join", format("formats.join", Map.of("player", player)), player, avatar(player), false);
    }

    public void sendLeave(String player) {
        sendTo("leave", format("formats.leave", Map.of("player", player)), player, avatar(player), false);
    }

    public void sendDeath(String player, String deathMessage) {
        sendTo("death", format("formats.death", Map.of("player", player, "message", deathMessage)), null, null, false);
    }

    public void sendAdvancement(String player, String advancement) {
        sendTo("advancement", format("formats.advancement", Map.of(
                "player", player,
                "advancement", advancement
        )), player, avatar(player), false);
    }

    public void sendConsole(String line) {
        if (line == null || line.length() < 3 || line.length() > 1800) return;
        sendTo("console", "```\n" + line + "\n```", null, null, true);
    }

    /**
     * Reads each list entry as:
     *   channel: "id"
     *   mode: webhook | bot
     *   webhook-url: "https://..."   (when mode is webhook)
     */
    private void sendTo(String type, String content, String username, String avatarUrl, boolean forceBot) {
        if (jda == null || content == null || content.isBlank()) return;

        List<Map<?, ?>> destinations = plugin.getConfig().getMapList("channels." + type);
        if (destinations == null || destinations.isEmpty()) return;

        String defaultMode = plugin.getConfig().getString("defaults.mode", "webhook");
        String defaultName = plugin.getConfig().getString("defaults.webhook-name", "Minecraft Server");

        for (Map<?, ?> dest : destinations) {
            String channelId = str(dest, "channel", str(dest, "channel-id", null));
            if (channelId == null || channelId.isBlank()) continue;

            String modeText = str(dest, "mode", defaultMode).toLowerCase().trim();
            // Also accept legacy use-webhook: true/false
            if (dest.containsKey("use-webhook") && !dest.containsKey("mode")) {
                modeText = Boolean.parseBoolean(String.valueOf(dest.get("use-webhook"))) ? "webhook" : "bot";
            }

            boolean useWebhook = !forceBot && modeText.equals("webhook");
            String webhookUrl = str(dest, "webhook-url", str(dest, "webhook-link", ""));
            if (webhookUrl != null && webhookUrl.isBlank()) webhookUrl = null;

            String webhookName = username != null ? username : defaultName;

            final String finalWebhookUrl = webhookUrl;
            final String finalChannelId = channelId;
            final boolean finalUseWebhook = useWebhook;

            Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
                try {
                    if (finalUseWebhook) {
                        sendWebhook(finalChannelId, finalWebhookUrl, content, webhookName, avatarUrl);
                    } else {
                        TextChannel ch = jda.getTextChannelById(finalChannelId);
                        if (ch != null) ch.sendMessage(content).queue();
                        else plugin.getLogger().warning("Unknown channel id: " + finalChannelId);
                    }
                } catch (Exception e) {
                    plugin.getLogger().warning("Failed to send to " + finalChannelId + ": " + e.getMessage());
                }
            });
        }
    }

    private static String str(Map<?, ?> map, String key, String fallback) {
        Object v = map.get(key);
        if (v == null) return fallback;
        String s = String.valueOf(v);
        return s;
    }

    private void sendWebhook(String channelId, String configuredUrl, String content, String username, String avatarUrl) {
        String url = configuredUrl;
        if (url == null || url.isBlank()) {
            url = webhookCache.get(channelId);
        }
        if (url == null || url.isBlank()) {
            TextChannel ch = jda.getTextChannelById(channelId);
            if (ch == null) {
                plugin.getLogger().warning("Unknown channel id for webhook: " + channelId);
                return;
            }
            List<Webhook> existing = ch.retrieveWebhooks().complete();
            Webhook found = existing.stream()
                    .filter(w -> w.getOwner() != null && w.getOwner().getId().equals(jda.getSelfUser().getId()))
                    .findFirst()
                    .orElse(null);
            if (found == null) {
                found = ch.createWebhook(plugin.getConfig().getString("defaults.webhook-name", "Minecraft Server")).complete();
            }
            url = found.getUrl();
            webhookCache.put(channelId, url);
        }

        TextChannel ch = jda.getTextChannelById(channelId);
        if (ch == null) return;

        final String finalUrl = url;
        ch.retrieveWebhooks().queue(hooks -> {
            Webhook hook = hooks.stream()
                    .filter(w -> finalUrl.contains(w.getId()))
                    .findFirst()
                    .orElse(hooks.isEmpty() ? null : hooks.get(0));
            if (hook == null) {
                ch.sendMessage(content).queue();
                return;
            }
            hook.sendMessage(content)
                    .setUsername(username)
                    .setAvatarUrl(avatarUrl)
                    .queue(null, err -> ch.sendMessage(content).queue());
        }, err -> ch.sendMessage(content).queue());
    }

    private String avatar(String player) {
        return plugin.getConfig().getString("defaults.player-avatar-url", "https://mc-heads.net/avatar/{name}")
                .replace("{name}", player)
                .replace("{uuid}", player);
    }

    private String format(String path, Map<String, String> vars) {
        String template = plugin.getConfig().getString(path, "");
        for (Map.Entry<String, String> e : vars.entrySet()) {
            template = template.replace("{" + e.getKey() + "}", e.getValue() == null ? "" : e.getValue());
        }
        return template;
    }

    @Override
    public void onMessageReceived(MessageReceivedEvent event) {
        if (event.getAuthor().isBot() || event.getAuthor().isSystem()) return;
        if (!event.isFromGuild() || event.getMember() == null) return;

        String guildFilter = plugin.getConfig().getString("discord.guild-id");
        if (guildFilter != null && !guildFilter.isBlank()
                && !event.getGuild().getId().equals(guildFilter)) {
            return;
        }

        String channelId = event.getChannel().getId();
        Message message = event.getMessage();
        String content = message.getContentDisplay().trim();
        if (content.isEmpty()) return;

        List<String> chatChannels = plugin.getConfig().getStringList("inbound.chat-channels");
        List<String> consoleChannels = plugin.getConfig().getStringList("inbound.console-command-channels");

        if (consoleChannels.contains(channelId)) {
            String lower = content.toLowerCase();
            if (lower.equals("!status online") || lower.equals("!maintenance off")) {
                setMode(Mode.ONLINE);
                message.reply("Status set to **Online**").queue();
                return;
            }
            if (lower.equals("!status maintenance") || lower.equals("!maintenance on")) {
                setMode(Mode.MAINTENANCE);
                message.reply("Status set to **Do Not Disturb** (maintenance)").queue();
                return;
            }
            if (lower.equals("!status offline")) {
                setMode(Mode.OFFLINE);
                message.reply("Status set to **Offline**").queue();
                return;
            }
        }

        if (chatChannels.contains(channelId)) {
            String name = event.getMember().getEffectiveName();
            String formatted = format("formats.chat-to-minecraft", Map.of(
                    "user", name,
                    "message", content
            ));
            Bukkit.getScheduler().runTask(plugin, () -> Bukkit.broadcastMessage(formatted));
            return;
        }

        if (consoleChannels.contains(channelId)) {
            if (!canRunCommands(event.getMember())) {
                message.addReaction(Emoji.fromUnicode("\uD83D\uDEAB")).queue();
                return;
            }

            String prefix = plugin.getConfig().getString("inbound.command-prefix", "!");
            String cmd = content;
            if (prefix != null && !prefix.isEmpty()) {
                if (!cmd.startsWith(prefix)) return;
                cmd = cmd.substring(prefix.length()).trim();
            }
            if (cmd.isEmpty()) return;

            final String command = cmd;
            Bukkit.getScheduler().runTask(plugin, () -> {
                boolean ok = Bukkit.dispatchCommand(Bukkit.getConsoleSender(), command);
                message.reply(ok ? "\u2705 Executed: `" + command + "`" : "\u274C Failed: `" + command + "`").queue();
            });
        }
    }

    private boolean canRunCommands(Member member) {
        List<String> allowed = plugin.getConfig().getStringList("inbound.allowed-roles");
        if (allowed == null || allowed.isEmpty()) return true;
        for (Role role : member.getRoles()) {
            if (allowed.contains(role.getName()) || allowed.contains(role.getId())) {
                return true;
            }
        }
        return false;
    }
}
