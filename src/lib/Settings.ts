import type { Snowflake } from 'discord.js';
import { container } from '@sapphire/framework';

export enum SettingKey {
    BotLogChannel = 'bot-log-channel',
    NativeLanguageRole = 'native-language-role',
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
