import { container } from '@sapphire/framework';
import EmbedBuilder from '../lib/EmbedBuilder.js';

export function createEmbed(error = false, message: string | null) {
    const embed = new EmbedBuilder(error)
        .setTitle(container.client.user!.username)
        .setTimestamp()
        .setFooter({
            text: container.client.user!.username,
            iconURL: container.client.user!.displayAvatarURL({ size: 128 }),
        });

    if (message) {
        embed.setDescription(message);
    }

    return embed;
}

export function createInfoEmbed(message: string | null) {
    return createEmbed(false, message);
}

export function createErrorEmbed(message: string | null) {
    return createEmbed(true, message);
}
