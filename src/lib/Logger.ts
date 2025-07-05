import type { ColorResolvable } from 'discord.js';
import { EmbedBuilder, type TextChannel } from 'discord.js';
import { container } from '@sapphire/framework';
import { getSetting, SettingKey } from './Settings.js';

export async function log(guildId: string, message: string, footer?: string, colour?: ColorResolvable) {
    const embed = new EmbedBuilder().setTitle('Log').setDescription(message);
    const logChannelId = await getSetting(guildId, SettingKey.BotLogChannel);
    const guild = container.client.guilds.cache.get(guildId);
    const logChannel = guild && logChannelId ? guild.channels.cache.get(logChannelId) : null;

    if (footer) {
        embed.setDescription(`${message}\n-# —\n-# ${footer}`);
    }

    embed.setColor(colour ?? 0x0198E9);

    container.logger.info(`${message} (${footer})`);

    if (logChannel) {
        await (logChannel as TextChannel).send({ embeds: [embed] });
    }
}

export function warn(guildId: string, message: string, footer?: string) {
    log(guildId, message, footer, 0xFDCD01);
}

export function error(guildId: string, message: string, footer?: string) {
    log(guildId, message, footer, 0xFF2921);
}

export function success(guildId: string, message: string, footer?: string) {
    log(guildId, message, footer, 0x7EB301);
}

export function notice(guildId: string, message: string, footer?: string) {
    log(guildId, message, footer, 0x5D0073);
}
