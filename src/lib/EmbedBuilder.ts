import { EmbedBuilder as DiscordEmbedBuilder } from 'discord.js';
import type { EmbedData } from 'discord.js';
import type { APIEmbed } from 'discord-api-types/v10';

export default class EmbedBuilder extends DiscordEmbedBuilder {
    constructor(error = false, data?: EmbedData | APIEmbed) {
        super(data);

        this.setColor(error ? 0xfc3e5c : 0x43adfc);
    }
}
