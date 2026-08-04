import {
    ContainerBuilder,
    type Guild,
    type Message,
    SectionBuilder,
    type TextChannel,
    TextDisplayBuilder,
    ThumbnailBuilder,
    type User
} from 'discord.js';
import { MessageFlags } from 'discord-api-types/v10';
import { container } from '@sapphire/framework';
import { DEFAULT_PRIMARY_LOCALE, getSetting, SettingKey } from './Settings.js';
import { Colors } from '../util/Colors.js';

export type ModerationAction = 'ban' | 'kick' | 'unban';

const ACTION_COLOR: Record<ModerationAction, number> = {
    ban: Colors.Error,
    kick: Colors.LogWarn,
    unban: Colors.Confirm,
};

const ACTION_KEY: Record<ModerationAction, string> = {
    ban: 'banned',
    kick: 'kicked',
    unban: 'unbanned',
};

const URL_REGEX = /https?:\/\/[^\s.]+\.[^\s]+/giu;

export class ModerationLogPostError extends Error {}
export class ModerationLogMessageNotFoundError extends Error {}
export class ModerationLogInvalidMessageError extends Error {}

type EntryShape = {
    displayName: string,
    sentence: string,
    avatarURL: string | null,
    accent: number,
};

export async function post(
    guild: Guild,
    user: User,
    action: ModerationAction,
    rawReason: string | null
): Promise<Message | null> {
    const channel = await resolveChannel(guild);

    if (!channel) {
        throw new ModerationLogPostError('No moderation log channel configured.');
    }

    const locale = await getPrimaryLocale(guild);
    const reason = sanitizeReason(rawReason, locale);
    const t = container.i18n.getT(locale);
    const sentence = t(`commands:mod-log.entry.${ACTION_KEY[action]}`, {
        mention: `<@${user.id}>`,
        reason,
    });
    const shape: EntryShape = {
        displayName: user.globalName ?? user.username,
        sentence,
        avatarURL: user.displayAvatarURL({ size: 128 }),
        accent: ACTION_COLOR[action],
    };

    return channel.send({
        flags: MessageFlags.IsComponentsV2,
        components: [renderContainer(shape)],
        allowedMentions: { parse: [] },
    });
}

export async function edit(guild: Guild, messageId: string, rawReason: string): Promise<Message> {
    const message = await loadEntry(guild, messageId);
    const locale = await getPrimaryLocale(guild);
    const reason = sanitizeReason(rawReason, locale);
    const shape = extractShape(message);

    if (!shape) {
        throw new ModerationLogInvalidMessageError('Message does not look like a moderation log entry.');
    }

    const colonIndex = shape.sentence.indexOf(':');

    if (colonIndex === -1) {
        throw new ModerationLogInvalidMessageError('Could not locate the reason boundary in the entry.');
    }

    const newSentence = `${shape.sentence.slice(0, colonIndex)}: ${reason}`;

    return message.edit({
        flags: MessageFlags.IsComponentsV2,
        components: [renderContainer({ ...shape, sentence: newSentence })],
        allowedMentions: { parse: [] },
    });
}

export async function removeAvatar(guild: Guild, messageId: string): Promise<Message> {
    const message = await loadEntry(guild, messageId);
    const shape = extractShape(message);

    if (!shape) {
        throw new ModerationLogInvalidMessageError('Message does not look like a moderation log entry.');
    }

    return message.edit({
        flags: MessageFlags.IsComponentsV2,
        components: [renderContainer({ ...shape, avatarURL: null })],
        allowedMentions: { parse: [] },
    });
}

function sanitizeReason(rawReason: string | null, locale: string): string {
    if (!rawReason || rawReason.trim().length === 0) {
        return container.i18n.getT(locale)('commands:mod-log.entry.noReason');
    }

    return rawReason.replace(URL_REGEX, '[CENSORED LINK]');
}

async function resolveChannel(guild: Guild): Promise<TextChannel | null> {
    const channelId = await getSetting(guild.id, SettingKey.ModerationLogChannel);

    if (!channelId) {
        return null;
    }

    const channel = guild.channels.cache.get(channelId);

    if (!channel || !channel.isTextBased()) {
        return null;
    }

    return channel as TextChannel;
}

async function getPrimaryLocale(guild: Guild): Promise<string> {
    return await getSetting(guild.id, SettingKey.PrimaryLocale) ?? DEFAULT_PRIMARY_LOCALE;
}

async function loadEntry(guild: Guild, messageId: string): Promise<Message> {
    const channel = await resolveChannel(guild);

    if (!channel) {
        throw new ModerationLogPostError('No moderation log channel configured.');
    }

    const message = await channel.messages.fetch(messageId).catch(() => null);

    if (!message) {
        throw new ModerationLogMessageNotFoundError('Message not found in the moderation log channel.');
    }

    if (message.author.id !== container.client.user!.id) {
        throw new ModerationLogInvalidMessageError('Cannot edit a message the bot did not author.');
    }

    return message;
}

function renderContainer(shape: EntryShape): ContainerBuilder {
    const container_ = new ContainerBuilder().setAccentColor(shape.accent);
    const nameBlock = new TextDisplayBuilder().setContent(`**${shape.displayName}**`);
    const sentenceBlock = new TextDisplayBuilder().setContent(shape.sentence);

    if (shape.avatarURL) {
        const section = new SectionBuilder()
            .addTextDisplayComponents(nameBlock, sentenceBlock)
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(shape.avatarURL));

        container_.addSectionComponents(section);
    } else {
        container_.addTextDisplayComponents(nameBlock, sentenceBlock);
    }

    return container_;
}

function extractShape(message: Message): EntryShape | null {
    const raw = message.components[0] as
        | {
              accent_color?: number,
              accentColor?: number,
              components?: {
                  type: number,
                  content?: string,
                  components?: { type: number, content?: string }[],
                  accessory?: { type: number, media?: { url?: string }, url?: string },
              }[],
          }
        | undefined;

    if (!raw?.components) {
        return null;
    }

    const accent = raw.accent_color ?? raw.accentColor ?? Colors.Info;
    const section = raw.components.find(c => c.type === 9);

    if (section) {
        const textBlocks = section.components?.filter(c => c.type === 10) ?? [];

        if (textBlocks.length < 2) {
            return null;
        }

        const { accessory } = section;

        return {
            displayName: stripBold(textBlocks[0].content ?? ''),
            sentence: textBlocks[1].content ?? '',
            avatarURL: accessory?.media?.url ?? accessory?.url ?? null,
            accent,
        };
    }

    const textBlocks = raw.components.filter(c => c.type === 10);

    if (textBlocks.length < 2) {
        return null;
    }

    return {
        displayName: stripBold(textBlocks[0].content ?? ''),
        sentence: textBlocks[1].content ?? '',
        avatarURL: null,
        accent,
    };
}

function stripBold(text: string): string {
    return text.startsWith('**') && text.endsWith('**') ? text.slice(2, -2) : text;
}
