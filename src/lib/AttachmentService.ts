import { getSetting, SettingKey } from './SettingsService.js';
import { container } from '@sapphire/framework';
import type { Attachment } from 'discord.js';

const MIME_TYPES: Record<string, string[]> = {
    images: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
};

export async function isAttachmentStorageChannelConfigured(guildId: string) {
    return Boolean(await getSetting(guildId, SettingKey.AttachmentStorageChannel));
}

export async function getAttachmentStorageChannel(guildId: string) {
    return container.client.guilds.cache.get(guildId)?.channels.fetch(
        await getSetting(guildId, SettingKey.AttachmentStorageChannel) ?? '',
    );
}

export function isAttachmentImage(attachment: Attachment) {
    return Boolean(attachment.contentType && MIME_TYPES.images.includes(attachment.contentType));
}

export async function repostAttachment(guildId: string, url?: string | null) {
    if (!url) {
        return;
    }

    const channel = await getAttachmentStorageChannel(guildId);

    if (!channel || !channel.isTextBased()) {
        return;
    }

    const repost = await channel.send({ files: [url] });
    const attachment = repost?.attachments?.first();

    if (!attachment) {
        return;
    }

    return attachment.url;
}
