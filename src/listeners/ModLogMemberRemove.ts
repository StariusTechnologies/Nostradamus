import { AuditLogEvent, type GuildMember, type PartialGuildMember } from 'discord.js';
import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { post, ModerationLogPostError } from '../lib/ModerationLog.js';
import { sleep } from '../util/DateTime.js';

const RECENT_ENTRY_WINDOW_MS = 10_000;
const AUDIT_LOG_DELAY_MS = 500;

@ApplyOptions<ListenerOptions>({
    event: Events.GuildMemberRemove,
})
export default class extends Listener {
    public async run(member: GuildMember | PartialGuildMember): Promise<void> {
        const kickReason = await this.detectKickReason(member);

        if (kickReason === undefined) {
            return;
        }

        try {
            await post(member.guild, member.user, 'kick', kickReason);
        } catch (err) {
            if (err instanceof ModerationLogPostError) {
                return;
            }

            this.container.logger.warn(`mod-log kick post failed for ${member.id}: ${err}`);
        }
    }

    private async detectKickReason(
        member: GuildMember | PartialGuildMember
    ): Promise<string | null | undefined> {
        await sleep(AUDIT_LOG_DELAY_MS);

        try {
            const logs = await member.guild.fetchAuditLogs({
                type: AuditLogEvent.MemberKick,
                limit: 5,
            });
            const now = Date.now();
            const entry = logs.entries.find(e =>
                e.target?.id === member.id
                && now - e.createdTimestamp <= RECENT_ENTRY_WINDOW_MS
            );

            if (!entry) {
                return undefined;
            }

            return entry.reason ?? null;
        } catch {
            return undefined;
        }
    }
}
