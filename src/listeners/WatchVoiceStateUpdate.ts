import type { GuildMember, VoiceState } from 'discord.js';
import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { WatchService } from '../lib/WatchService.js';

@ApplyOptions<ListenerOptions>({
    event: Events.VoiceStateUpdate,
})
export default class extends Listener {
    public async run(oldState: VoiceState, newState: VoiceState): Promise<void> {
        const guildId = newState.guild.id;
        const userId = newState.id;

        if (!WatchService.isWatched(guildId, userId)) {
            return;
        }

        const member = (newState.member ?? oldState.member) as GuildMember | null;

        if (!member) {
            return;
        }

        const expired = await WatchService.checkAndExpire(guildId, userId);

        if (expired) {
            await WatchService.logEvent(member, {
                title: 'Temp-watch expired',
                description: 'Watch duration elapsed; auto-removed from the watchlist.',
                tone: 'ending',
            }, expired);

            return;
        }

        const joined = !oldState.channelId && newState.channelId;
        const left = oldState.channelId && !newState.channelId;
        const moved = oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId;

        if (joined && newState.channel) {
            await WatchService.logEvent(member, {
                title: 'Joined voice',
                description: `Joined <#${newState.channel.id}>.`,
                tone: 'active',
            });

            return;
        }

        if (moved && oldState.channel && newState.channel) {
            await WatchService.logEvent(member, {
                title: 'Moved voice channel',
                description: `Moved from <#${oldState.channel.id}> to <#${newState.channel.id}>.`,
                tone: 'active',
            });

            return;
        }

        if (left && oldState.channel) {
            await WatchService.logEvent(member, {
                title: 'Left voice',
                description: `Left <#${oldState.channel.id}>.`,
                tone: 'ending',
            });
        }
    }
}
