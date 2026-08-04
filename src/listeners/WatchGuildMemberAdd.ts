import type { GuildMember } from 'discord.js';
import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { WatchService } from '../lib/WatchService.js';

@ApplyOptions<ListenerOptions>({
    event: Events.GuildMemberAdd,
})
export default class extends Listener {
    public async run(member: GuildMember): Promise<void> {
        if (!WatchService.isWatched(member.guild.id, member.id)) {
            return;
        }

        await WatchService.logEvent(member, {
            title: 'Joined the server',
            description: 'Member rejoined while watched.',
            tone: 'active',
        });
    }
}
