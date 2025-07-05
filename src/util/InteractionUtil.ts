import type {
    RepliableInteraction,
    InteractionResponse,
    Message,
    EmbedData,
    ComponentEmojiResolvable, SlashCommandStringOption
} from 'discord.js';
import type { APIEmbed } from 'discord-api-types/v10';
import EmbedBuilder from '../lib/EmbedBuilder.js';

export default class InteractionUtil {
    public static reply(
        interaction: RepliableInteraction,
        embedData: EmbedData | APIEmbed,
        error = false,
        ephemeral = true
    ): Promise<InteractionResponse | Message> {
        const options = { embeds: [new EmbedBuilder(error, embedData)] };

        return interaction.replied || interaction.deferred
            ? interaction.editReply(options)
            : interaction.reply({ ...options, ephemeral });
    }

    public static snowflakeOption(
        option: SlashCommandStringOption,
        name: string,
        description: string
    ): SlashCommandStringOption {
        return option.setName(name).setDescription(description).setRequired(true).setMinLength(16).setMaxLength(19);
    }
}

export interface WaitForOptions {
    timeoutIsReject?: boolean;
    waitTime?: number;
    restrictToId?: string;
}

export interface MessageWaitForOptions extends WaitForOptions {
    messageToEdit?: Message;
}

export interface WaitForConfirmOptions extends MessageWaitForOptions {
    confirmText?: string;
    cancelText?: string;
    confirmEmoji?: ComponentEmojiResolvable;
    cancelEmoji?: ComponentEmojiResolvable;
}
