import type { Invite } from 'discord.js';
import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { InviteCache } from '../lib/InviteCache.js';

@ApplyOptions<ListenerOptions>({
    event: Events.InviteDelete,
})
export default class extends Listener {
    public run(invite: Invite): void {
        if (!invite.guild) {
            return;
        }

        InviteCache.removeInvite(invite.guild.id, invite.code);
    }
}
