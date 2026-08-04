import type { Collection, GuildTextBasedChannel, Message, PartialMessage, Snowflake } from 'discord.js';
import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

@ApplyOptions<ListenerOptions>({
    event: Events.MessageBulkDelete,
})
export default class extends Listener {
    public async run(
        messages: Collection<Snowflake, Message | PartialMessage>,
        channel: GuildTextBasedChannel
    ): Promise<void> {
        const ids = [...messages.keys()];

        if (ids.length === 0) {
            return;
        }

        await this.container.prisma.trackedMessage.deleteMany({
            where: { idGuild: channel.guild.id, idMessage: { in: ids } },
        }).catch(() => null);
    }
}
