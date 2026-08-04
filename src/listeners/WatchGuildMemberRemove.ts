import type { GuildMember, PartialGuildMember } from 'discord.js';
import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { WatchService } from '../lib/WatchService.js';

@ApplyOptions<ListenerOptions>({
    event: Events.GuildMemberRemove,
})
export default class extends Listener {
    public async run(member: GuildMember | PartialGuildMember): Promise<void> {
        if (!WatchService.isWatched(member.guild.id, member.id)) {
            return;
        }

        await WatchService.logEvent(member as GuildMember, {
            title: 'Left the server',
            description: 'Member is no longer in the guild.',
            tone: 'ending',
        });
    }
}
