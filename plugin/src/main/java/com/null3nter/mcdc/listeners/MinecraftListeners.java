package com.null3nter.mcdc.listeners;

import com.null3nter.mcdc.MinecraftDiscordBridgePlugin;
import com.null3nter.mcdc.discord.DiscordBridge;
import io.papermc.paper.event.player.AsyncChatEvent;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.PlayerDeathEvent;
import org.bukkit.event.player.PlayerAdvancementDoneEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.event.server.ServerCommandEvent;

public class MinecraftListeners implements Listener {

    private final MinecraftDiscordBridgePlugin plugin;
    private final DiscordBridge discord;

    public MinecraftListeners(MinecraftDiscordBridgePlugin plugin, DiscordBridge discord) {
        this.plugin = plugin;
        this.discord = discord;
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onChat(AsyncChatEvent event) {
        String player = event.getPlayer().getName();
        String message = PlainTextComponentSerializer.plainText().serialize(event.message());
        discord.sendChat(player, message);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onJoin(PlayerJoinEvent event) {
        discord.sendJoin(event.getPlayer().getName());
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onQuit(PlayerQuitEvent event) {
        discord.sendLeave(event.getPlayer().getName());
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onDeath(PlayerDeathEvent event) {
        String player = event.getEntity().getName();
        String msg = event.deathMessage() != null
                ? PlainTextComponentSerializer.plainText().serialize(event.deathMessage())
                : player + " died";
        discord.sendDeath(player, msg);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onAdvancement(PlayerAdvancementDoneEvent event) {
        var adv = event.getAdvancement();
        // Skip recipes
        if (adv.getKey().getKey().startsWith("recipes/")) return;
        var display = adv.getDisplay();
        if (display == null) return;
        String title = PlainTextComponentSerializer.plainText().serialize(display.title());
        discord.sendAdvancement(event.getPlayer().getName(), title);
    }
}
