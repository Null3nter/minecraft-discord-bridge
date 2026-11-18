package com.null3nter.mcdc;

import com.null3nter.mcdc.discord.DiscordBridge;
import com.null3nter.mcdc.listeners.MinecraftListeners;
import org.bukkit.plugin.java.JavaPlugin;

public final class MinecraftDiscordBridgePlugin extends JavaPlugin {

    private static MinecraftDiscordBridgePlugin instance;
    private DiscordBridge discord;

    @Override
    public void onEnable() {
        instance = this;
        saveDefaultConfig();
        reloadConfig();

        String token = getConfig().getString("discord.token", "");
        if (token == null || token.isBlank() || token.startsWith("YOUR_")) {
            getLogger().severe("Set discord.token in plugins/MinecraftDiscordBridge/config.yml then restart.");
            getServer().getPluginManager().disablePlugin(this);
            return;
        }

        try {
            discord = new DiscordBridge(this);
            discord.start();
            getServer().getPluginManager().registerEvents(new MinecraftListeners(this, discord), this);
            getLogger().info("Minecraft Discord Bridge enabled.");
        } catch (Exception e) {
            getLogger().severe("Failed to start Discord bridge: " + e.getMessage());
            e.printStackTrace();
            getServer().getPluginManager().disablePlugin(this);
        }
    }

    @Override
    public void onDisable() {
        if (discord != null) {
            discord.shutdown();
            discord = null;
        }
        instance = null;
        getLogger().info("Minecraft Discord Bridge disabled.");
    }

    public static MinecraftDiscordBridgePlugin getInstance() {
        return instance;
    }

    public DiscordBridge getDiscord() {
        return discord;
    }
}
