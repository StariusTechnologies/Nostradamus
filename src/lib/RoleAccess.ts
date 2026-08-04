import { type GuildMember, PermissionsBitField } from 'discord.js';
import { getSetting, SettingKey } from './Settings.js';

export type RoleTier = 'admin' | 'mod' | 'helper';

export async function hasRoleAccess(member: GuildMember, tier: RoleTier): Promise<boolean> {
    if (member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        return true;
    }

    const adminRoleId = await getSetting(member.guild.id, SettingKey.AdminRole);

    if (adminRoleId && member.roles.cache.has(adminRoleId)) {
        return true;
    }

    if (tier === 'admin') {
        return false;
    }

    const moderatorRoleId = await getSetting(member.guild.id, SettingKey.ModeratorRole);

    if (moderatorRoleId && member.roles.cache.has(moderatorRoleId)) {
        return true;
    }

    if (tier === 'mod') {
        return false;
    }

    const helperRoleId = await getSetting(member.guild.id, SettingKey.HelperRole);

    if (helperRoleId && member.roles.cache.has(helperRoleId)) {
        return true;
    }

    return false;
}
