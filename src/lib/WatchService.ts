import {
    ContainerBuilder,
    type GuildMember,
    type TextChannel,
    TextDisplayBuilder
} from 'discord.js';
import { MessageFlags } from 'discord-api-types/v10';
import { container } from '@sapphire/framework';
import type { WatchedMember } from '@prisma/client';
import { getSetting, SettingKey } from './Settings.js';
import { Colors } from '../util/Colors.js';
import { HOUR } from '../util/DateTime.js';

const ACTIVITY_THROTTLE = HOUR;

type CacheKey = `${string}:${string}`;
type LogTone = 'active' | 'ending';

type LogPayload = {
    title: string,
    description: string,
    tone?: LogTone,
};

function cacheKey(idGuild: string, idUser: string): CacheKey {
    return `${idGuild}:${idUser}`;
}

class WatchServiceImpl {
    private cache = new Map<CacheKey, WatchedMember>();
    private lastActive = new Map<CacheKey, number>();
    private initialized = false;

    public async init(): Promise<void> {
        const rows = await container.prisma.watchedMember.findMany();

        this.cache.clear();
        this.lastActive.clear();

        for (const row of rows) {
            this.cache.set(cacheKey(row.idGuild, row.idUser), row);
        }

        this.initialized = true;
        container.logger.info(`WatchService loaded ${rows.length} watched member(s).`);
    }

    public isReady(): boolean {
        return this.initialized;
    }

    public isWatched(idGuild: string, idUser: string): boolean {
        return this.cache.has(cacheKey(idGuild, idUser));
    }

    public get(idGuild: string, idUser: string): WatchedMember | undefined {
        return this.cache.get(cacheKey(idGuild, idUser));
    }

    public getByGuild(idGuild: string): WatchedMember[] {
        return [...this.cache.values()].filter(row => row.idGuild === idGuild);
    }

    public async add(
        idGuild: string,
        idUser: string,
        reason: string,
        durationMs: number | null
    ): Promise<WatchedMember> {
        const now = new Date();
        const expiresAt = durationMs !== null ? new Date(now.getTime() + durationMs) : null;
        const row = await container.prisma.watchedMember.create({
            data: {
                idGuild,
                idUser,
                reason,
                startedAt: now,
                expiresAt,
            },
        });

        this.cache.set(cacheKey(idGuild, idUser), row);

        return row;
    }

    public async edit(
        idGuild: string,
        idUser: string,
        reason: string,
        durationMs: number | null
    ): Promise<WatchedMember> {
        const now = new Date();
        const expiresAt = durationMs !== null ? new Date(now.getTime() + durationMs) : null;
        const row = await container.prisma.watchedMember.update({
            where: { idGuild_idUser: { idGuild, idUser } },
            data: { reason, expiresAt },
        });

        this.cache.set(cacheKey(idGuild, idUser), row);

        return row;
    }

    public async remove(idGuild: string, idUser: string): Promise<void> {
        await container.prisma.watchedMember.delete({
            where: { idGuild_idUser: { idGuild, idUser } },
        }).catch(() => null);

        this.cache.delete(cacheKey(idGuild, idUser));
        this.lastActive.delete(cacheKey(idGuild, idUser));
    }

    public shouldLogActivity(idGuild: string, idUser: string): boolean {
        const key = cacheKey(idGuild, idUser);
        const now = Date.now();
        const last = this.lastActive.get(key);

        this.lastActive.set(key, now);

        return last === undefined || now - last >= ACTIVITY_THROTTLE;
    }

    public async checkAndExpire(idGuild: string, idUser: string): Promise<WatchedMember | null> {
        const row = this.get(idGuild, idUser);

        if (!row || row.expiresAt === null) {
            return null;
        }

        if (row.expiresAt.getTime() > Date.now()) {
            return null;
        }

        await this.remove(idGuild, idUser);

        return row;
    }

    public async logEvent(member: GuildMember, payload: LogPayload, watchRow?: WatchedMember): Promise<void> {
        const row = watchRow ?? this.get(member.guild.id, member.id);

        if (!row) {
            return;
        }

        const channelId = await getSetting(member.guild.id, SettingKey.WatchlistChannel);

        if (!channelId) {
            return;
        }

        const channel = member.guild.channels.cache.get(channelId);

        if (!channel || !channel.isTextBased()) {
            return;
        }

        const accent = payload.tone === 'ending' ? Colors.Error : Colors.Confirm;
        const startedUnix = Math.floor(row.startedAt.getTime() / 1000);
        const lines: string[] = [];
        const suffix = member.nickname ? ` aka ${member.nickname}` : '';

        lines.push(`### ${payload.title}`);
        lines.push(`<@${member.id}> — \`${member.user.username}${suffix}\``);
        lines.push(payload.description);
        lines.push('');
        lines.push(`**Reason:** ${row.reason}`);
        lines.push(`**Watched since:** <t:${startedUnix}:R>`);

        if (row.expiresAt) {
            const expiresUnix = Math.floor(row.expiresAt.getTime() / 1000);

            lines.push(`**Expires:** <t:${expiresUnix}:R>`);
        } else {
            lines.push(`**Expires:** never`);
        }

        const container_ = new ContainerBuilder()
            .setAccentColor(accent)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));

        await (channel as TextChannel).send({
            flags: MessageFlags.IsComponentsV2,
            components: [container_],
            allowedMentions: { parse: [] },
        }).catch(err => {
            container.logger.warn(`Failed to send watchlist event for ${member.id}: ${err}`);
        });
    }
}

export const WatchService = new WatchServiceImpl();
