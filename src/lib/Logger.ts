import { ContainerBuilder, TextDisplayBuilder, type TextChannel } from 'discord.js';
import { MessageFlags } from 'discord-api-types/v10';
import { container } from '@sapphire/framework';
import { getSetting, SettingKey } from './Settings.js';

export async function log(guildId: string, message: string, footer?: string, colour?: number): Promise<void> {
    const logChannelId = await getSetting(guildId, SettingKey.BotLogChannel);
    const guild = container.client.guilds.cache.get(guildId);
    const logChannel = guild && logChannelId ? guild.channels.cache.get(logChannelId) : null;

    container.logger.info(`${message} (${footer})`);

    if (!logChannel) {
        return;
    }

    const body: string = footer ? `${message}\n-# —\n-# ${footer}` : message;
    const logContainer = new ContainerBuilder()
        .setAccentColor(colour ?? 0x0198E9)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('## Log'),
            new TextDisplayBuilder().setContent(body)
        );

    await (logChannel as TextChannel).send({
        flags: MessageFlags.IsComponentsV2,
        components: [logContainer],
    });
}

export function warn(guildId: string, message: string, footer?: string): void {
    log(guildId, message, footer, 0xFDCD01);
}

export function error(guildId: string, message: string, footer?: string): void {
    log(guildId, message, footer, 0xFF2921);
}

export function success(guildId: string, message: string, footer?: string): void {
    log(guildId, message, footer, 0x7EB301);
}

export function notice(guildId: string, message: string, footer?: string): void {
    log(guildId, message, footer, 0x5D0073);
}
