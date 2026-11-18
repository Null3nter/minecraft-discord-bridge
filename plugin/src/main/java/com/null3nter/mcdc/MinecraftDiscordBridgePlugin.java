package com.null3nter.mcdc;

import org.bukkit.Bukkit;
import org.bukkit.plugin.java.JavaPlugin;

/**
 * Lightweight Paper companion for the Node.js Discord bridge.
 *
 * Current responsibilities:
 *  - Expose accurate online player count (for future HTTP / socket integration)
 *  - Provide a clean place to add richer events later (chat, deaths, etc.)
 *  - Ready for 26.2 (and compatible with nearby versions)
 *
 * The main Discord logic (webhooks, multi-channel routing, presence) lives
 * in the Node.js side of this repository.
 */
public final class MinecraftDiscordBridgePlugin extends JavaPlugin {

    private static MinecraftDiscordBridgePlugin instance;

    @Override
    public void onEnable() {
        instance = this;
        saveDefaultConfig();

        getLogger().info("Minecraft Discord Bridge companion loaded (Paper 26.2).");
        getLogger().info("Player count: " + Bukkit.getOnlinePlayers().size() + "/" + Bukkit.getMaxPlayers());

        // Simple repeating task that can later push status to the Node bridge
        // or expose it via a small local endpoint.
        long interval = getConfig().getLong("status-broadcast-interval-ticks", 20L * 30); // 30s default
        Bukkit.getScheduler().runTaskTimer(this, () -> {
            // Placeholder for future integration (socket, HTTP callback, etc.)
            // For now we just keep the plugin alive and ready.
        }, interval, interval);
    }

    @Override
    public void onDisable() {
        getLogger().info("Minecraft Discord Bridge companion disabled.");
        instance = null;
    }

    public static MinecraftDiscordBridgePlugin getInstance() {
        return instance;
    }

    /** Convenience helpers used by future status / event modules */
    public int getOnlineCount() {
        return Bukkit.getOnlinePlayers().size();
    }

    public int getMaxPlayers() {
        return Bukkit.getMaxPlayers();
    }
}
