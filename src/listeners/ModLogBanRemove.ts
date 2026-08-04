import { AuditLogEvent, type GuildBan } from 'discord.js';
import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { post, ModerationLogPostError } from '../lib/ModerationLog.js';
import { sleep } from '../util/DateTime.js';

const AUDIT_LOG_DELAY_MS = 500;

@ApplyOptions<ListenerOptions>({
    event: Events.GuildBanRemove,
})
export default class extends Listener {
    public async run(ban: GuildBan): Promise<void> {
        const reason = await this.resolveUnbanReason(ban);

        try {
            await post(ban.guild, ban.user, 'unban', reason);
        } catch (err) {
            if (err instanceof ModerationLogPostError) {
                return;
            }

            this.container.logger.warn(`mod-log unban post failed for ${ban.user.id}: ${err}`);
        }
    }

    private async resolveUnbanReason(ban: GuildBan): Promise<string | null> {
        await sleep(AUDIT_LOG_DELAY_MS);

        try {
            const logs = await ban.guild.fetchAuditLogs({
                type: AuditLogEvent.MemberBanRemove,
                limit: 5,
            });
            const entry = logs.entries.find(e => e.target?.id === ban.user.id);

            return entry?.reason ?? null;
        } catch {
            return null;
        }
    }
}
