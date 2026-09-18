import type { GuildMember } from 'discord.js';
import { getSetting, SettingKey } from './SettingsService.js';

export async function isMemberStaff(
    member: GuildMember,
    atLeast: 'helper' | 'moderator' | 'administrator' = 'helper',
): Promise<boolean> {
    const includeModerator = atLeast === 'moderator' || atLeast === 'helper';
    const includeHelper = atLeast === 'helper';
    const staffRoles = [
        await getSetting(member.guild.id, SettingKey.AdminRole),
        includeModerator && await getSetting(member.guild.id, SettingKey.ModeratorRole),
        includeHelper && await getSetting(member.guild.id, SettingKey.HelperRole),
    ];

    return [...member.roles.cache.values()].some(role => staffRoles.includes(role.id));
}
