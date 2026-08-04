import { container } from '@sapphire/framework';

type GuildId = string;
type InviteCode = string;

export type UsedInvite = {
    code: string,
    inviterId: string,
};

class InviteCacheImpl {
    private cache = new Map<GuildId, Map<InviteCode, number>>();

    public async init(): Promise<void> {
        const guilds = [...container.client.guilds.cache.values()];

        await Promise.all(guilds.map(guild => this.refresh(guild.id)));
        container.logger.info(`InviteCache initialised for ${guilds.length} guild(s).`);
    }

    public async refresh(guildId: GuildId): Promise<void> {
        const guild = container.client.guilds.cache.get(guildId);

        if (!guild) {
            return;
        }

        try {
            const invites = await guild.invites.fetch();
            const map = new Map<InviteCode, number>();

            for (const invite of invites.values()) {
                map.set(invite.code, invite.uses ?? 0);
            }

            this.cache.set(guildId, map);
        } catch (err) {
            container.logger.warn(`Could not fetch invites for guild ${guildId}: ${err}`);
        }
    }

    public setInvite(guildId: GuildId, code: InviteCode, uses: number): void {
        let perGuild = this.cache.get(guildId);

        if (!perGuild) {
            perGuild = new Map();
            this.cache.set(guildId, perGuild);
        }

        perGuild.set(code, uses);
    }

    public removeInvite(guildId: GuildId, code: InviteCode): void {
        this.cache.get(guildId)?.delete(code);
    }

    public async detectUsedInvite(guildId: GuildId): Promise<UsedInvite | null> {
        const guild = container.client.guilds.cache.get(guildId);

        if (!guild) {
            return null;
        }

        const before = this.cache.get(guildId);

        try {
            const after = await guild.invites.fetch();
            let used: UsedInvite | null = null;

            for (const invite of after.values()) {
                if (!invite.inviter) {
                    continue;
                }

                const previousUses = before?.get(invite.code) ?? 0;
                const currentUses = invite.uses ?? 0;

                if (currentUses > previousUses) {
                    used = { code: invite.code, inviterId: invite.inviter.id };
                    break;
                }
            }

            const refreshed = new Map<InviteCode, number>();

            for (const invite of after.values()) {
                refreshed.set(invite.code, invite.uses ?? 0);
            }

            this.cache.set(guildId, refreshed);

            return used;
        } catch (err) {
            container.logger.warn(`detectUsedInvite failed for guild ${guildId}: ${err}`);

            return null;
        }
    }
}

export const InviteCache = new InviteCacheImpl();
