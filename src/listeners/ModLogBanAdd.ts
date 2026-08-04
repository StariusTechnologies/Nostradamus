import { AuditLogEvent, type GuildBan } from 'discord.js';
import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { post, ModerationLogPostError } from '../lib/ModerationLog.js';

@ApplyOptions<ListenerOptions>({
    event: Events.GuildBanAdd,
})
export default class extends Listener {
    public async run(ban: GuildBan): Promise<void> {
        const reason = await this.resolveReason(ban);

        try {
            await post(ban.guild, ban.user, 'ban', reason);
        } catch (err) {
            if (err instanceof ModerationLogPostError) {
                return;
            }

            this.container.logger.warn(`mod-log ban post failed for ${ban.user.id}: ${err}`);
        }
    }

    private async resolveReason(ban: GuildBan): Promise<string | null> {
        if (ban.partial) {
            await ban.fetch().catch(err => {
                this.container.logger.warn(`Could not fetch ban for ${ban.user.id}: ${err}`);
            });
        }

        if (ban.reason) {
            return ban.reason;
        }

        try {
            const logs = await ban.guild.fetchAuditLogs({
                type: AuditLogEvent.MemberBanAdd,
                limit: 5,
            });
            const entry = logs.entries.find(e => e.target?.id === ban.user.id);

            return entry?.reason ?? null;
        } catch {
            return null;
        }
    }
}
