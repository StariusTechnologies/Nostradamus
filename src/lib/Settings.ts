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
}

export const DEFAULT_PRIMARY_LOCALE = 'en-US';

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
    const setting = await container.prisma.settings.findUnique({ where: {
        idGuild_key: { idGuild: guildId, key: key },
    } });

    if (setting) {
        const value = String(setting.value);

        return formatters[key] ? formatters[key](value) : value;
    } else {
        return null;
    }
}

export async function saveSetting(
    guildId: Snowflake,
    key: SettingKey,
    value: string | number | boolean
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
}

export async function removeSetting(guildId: Snowflake, key: SettingKey): Promise<boolean> {
    const result = await container.prisma.settings.deleteMany({
        where: { idGuild: guildId, key },
    });

    return result.count > 0;
}
