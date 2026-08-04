import type {
    Guild,
    GuildTextBasedChannel,
    Invite,
    Message,
    Snowflake
} from 'discord.js';
import { container } from '@sapphire/framework';

const BULK_DELETE_CHUNK_SIZE = 100;

export type PurgeResult = {
    deletedCount: number,
    invites: Invite[],
    inviteCountTooLarge: boolean,
};

const INVITE_DISPLAY_LIMIT = 60;

export async function purgeUser(
    guild: Guild,
    userId: Snowflake,
    durationMs: number
): Promise<PurgeResult> {
    const sinceTimestamp = Date.now() - durationMs;
    const cacheDeleted = await purgeFromCache(guild, userId, sinceTimestamp);
    const dbDeleted = await purgeFromDb(guild, userId, sinceTimestamp, cacheDeleted);
    const invites = await fetchUserInvites(guild, userId);
    const inviteCountTooLarge = invites.length > INVITE_DISPLAY_LIMIT;

    return {
        deletedCount: cacheDeleted.size + dbDeleted,
        invites: inviteCountTooLarge ? [] : invites,
        inviteCountTooLarge,
    };
}

async function purgeFromCache(
    guild: Guild,
    userId: Snowflake,
    sinceTimestamp: number
): Promise<Set<Snowflake>> {
    const deletedIds = new Set<Snowflake>();

    for (const channel of guild.channels.cache.values()) {
        if (!channel.isTextBased()) {
            continue;
        }

        const textChannel = channel as GuildTextBasedChannel;
        const matches = textChannel.messages.cache.filter((message: Message) =>
            message.author?.id === userId
            && message.createdTimestamp > sinceTimestamp
            && !message.system
        );

        if (matches.size === 0) {
            continue;
        }

        try {
            const deleted = await textChannel.bulkDelete(matches, true);

            for (const id of deleted.keys()) {
                deletedIds.add(id);
            }
        } catch (err) {
            container.logger.warn(`Bulk delete from cache failed in channel ${textChannel.id}: ${err}`);
        }
    }

    if (deletedIds.size > 0) {
        await container.prisma.trackedMessage.deleteMany({
            where: { idGuild: guild.id, idMessage: { in: [...deletedIds] } },
        }).catch(() => null);
    }

    return deletedIds;
}

async function purgeFromDb(
    guild: Guild,
    userId: Snowflake,
    sinceTimestamp: number,
    alreadyDeleted: Set<Snowflake>
): Promise<number> {
    const rows = await container.prisma.trackedMessage.findMany({
        where: {
            idGuild: guild.id,
            idUser: userId,
            createdAt: { gt: new Date(sinceTimestamp) },
            idMessage: alreadyDeleted.size > 0
                ? { notIn: [...alreadyDeleted] }
                : undefined,
        },
    });

    if (rows.length === 0) {
        return 0;
    }

    const byChannel = new Map<Snowflake, Snowflake[]>();

    for (const row of rows) {
        const existing = byChannel.get(row.idChannel);

        if (existing) {
            existing.push(row.idMessage);
        } else {
            byChannel.set(row.idChannel, [row.idMessage]);
        }
    }

    let totalDeleted = 0;

    for (const [channelId, messageIds] of byChannel) {
        const channel = guild.channels.cache.get(channelId);

        if (!channel?.isTextBased()) {
            continue;
        }

        const textChannel = channel as GuildTextBasedChannel;

        for (let i = 0; i < messageIds.length; i += BULK_DELETE_CHUNK_SIZE) {
            const chunk = messageIds.slice(i, i + BULK_DELETE_CHUNK_SIZE);

            try {
                const deleted = await textChannel.bulkDelete(chunk, true);

                totalDeleted += deleted.size;
            } catch (err) {
                container.logger.warn(`Bulk delete from DB failed in channel ${channelId}: ${err}`);
            }
        }
    }

    await container.prisma.trackedMessage.deleteMany({
        where: { idGuild: guild.id, idMessage: { in: rows.map(row => row.idMessage) } },
    }).catch(() => null);

    return totalDeleted;
}

async function fetchUserInvites(guild: Guild, userId: Snowflake): Promise<Invite[]> {
    try {
        const invites = await guild.invites.fetch();

        return [...invites.values()].filter(invite => invite.inviter?.id === userId);
    } catch {
        return [];
    }
}
