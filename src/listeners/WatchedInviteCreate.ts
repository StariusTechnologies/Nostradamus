import type { Invite } from 'discord.js';
import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { InviteCache } from '../lib/InviteCache.js';
import { WatchService } from '../lib/WatchService.js';

@ApplyOptions<ListenerOptions>({
    event: Events.InviteCreate,
})
export default class extends Listener {
    public async run(invite: Invite): Promise<void> {
        if (!invite.guild) {
            return;
        }

        const guild = this.container.client.guilds.cache.get(invite.guild.id);

        if (!guild) {
            return;
        }

        InviteCache.setInvite(guild.id, invite.code, invite.uses ?? 0);

        const inviterId = invite.inviter?.id;

        if (!inviterId || !WatchService.isWatched(guild.id, inviterId)) {
            return;
        }

        const member = await guild.members.fetch(inviterId).catch(() => null);

        if (!member) {
            return;
        }

        await WatchService.logEvent(member, {
            title: 'Created an invite',
            description: `Generated invite code \`${invite.code}\`.`,
            tone: 'active',
        });
    }
}
