import type { Snowflake } from 'discord.js';
import { container } from '@sapphire/framework';

export enum SettingKey {
    BotLogChannel = 'bot-log-channel',
    NativeLanguageRole = 'native-language-role',
    AutoCleanupChannel = 'auto-cleanup-channel',
    WatchlistChannel = 'watchlist-channel',
    ModerationLogChannel = 'moderation-log-channel',
    PrimaryLocale = 'primary-locale',
    AdminRole = 'admin-role',
    ModeratorRole = 'moderator-role',
    HelperRole = 'helper-role',
    AttachmentStorageChannel = 'attachment-storage-channel',
}

export const DEFAULT_PRIMARY_LOCALE = 'en-US';

type CacheKey = `${string}:${string}`;

function buildCacheKey(idGuild: string, key: string): CacheKey {
    return `${idGuild}:${key}`;
}

const cache = new Map<CacheKey, string | null>();

export async function warmSettingsCache() {
    const settings = await container.prisma.settings.findMany();

    for (const setting of settings) {
        cache.set(buildCacheKey(setting.idGuild, setting.key), setting.value);
    }
}

const formatters: Partial<Record<SettingKey, (status: string) => string | /*boolean | */null>> = {
    // [SettingKey.BooleanSetting]: v => v.length < 1 ? null : ['true', '1'].includes(v.toLowerCase()),
}

/*
async function getSetting(guildId: Snowflake, key: SettingKey.BooleanSetting): Promise<boolean | null>;
async function getSetting(
    guildId: Snowflake,
    key: Omit<SettingKey, SettingKey.WaitingRoomAlerts>
): Promise<string | null>;
 */
export async function getSetting(guildId: Snowflake, key: SettingKey): Promise<string | /*boolean | */null> {
    const cacheKey = buildCacheKey(guildId, key);

    if (!cache.has(cacheKey)) {
        const setting = await container.prisma.settings.findUnique({
            where: {
                idGuild_key: { idGuild: guildId, key: key },
            },
        });

        cache.set(cacheKey, setting ? String(setting.value) : null);
    }

    const value = cache.get(cacheKey) ?? null;

    return value !== null && formatters[key] ? formatters[key](value) : value;
}

export async function saveSetting(
    guildId: Snowflake,
    key: SettingKey,
    value: string | number | boolean,
) {
    let formattedValue = String(value);

    if (typeof value === 'boolean') {
        formattedValue = value ? 'true' : 'false';
    }

    await container.prisma.settings.upsert({
        create: { idGuild: guildId, key, value: formattedValue },
        update: { value: formattedValue },
        where: { idGuild_key: { idGuild: guildId, key: key } },
    });

    cache.set(buildCacheKey(guildId, key), formattedValue);
}

export async function removeSetting(guildId: Snowflake, key: SettingKey): Promise<boolean> {
    const result = await container.prisma.settings.deleteMany({
        where: { idGuild: guildId, key },
    });

    cache.set(buildCacheKey(guildId, key), null);

    return result.count > 0;
}
