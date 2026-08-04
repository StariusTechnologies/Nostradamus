import type { Message } from 'discord.js';
import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { WatchService } from '../lib/WatchService.js';

@ApplyOptions<ListenerOptions>({
    event: Events.MessageCreate,
})
export default class extends Listener {
    public async run(message: Message): Promise<void> {
        if (!message.inGuild() || message.author.bot || !message.member) {
            return;
        }

        const { id: guildId } = message.guild;
        const userId = message.author.id;

        if (!WatchService.isWatched(guildId, userId)) {
            return;
        }

        const expired = await WatchService.checkAndExpire(guildId, userId);

        if (expired) {
            await WatchService.logEvent(message.member, {
                title: 'Temp-watch expired',
                description: 'Watch duration elapsed; auto-removed from the watchlist.',
                tone: 'ending',
            }, expired);

            return;
        }

        if (!WatchService.shouldLogActivity(guildId, userId)) {
            return;
        }

        await WatchService.logEvent(message.member, {
            title: 'Active',
            description: `Sent a message in <#${message.channelId}>.`,
            tone: 'active',
        });
    }
}
