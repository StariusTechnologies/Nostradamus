import type { Message, PartialMessage } from 'discord.js';
import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

@ApplyOptions<ListenerOptions>({
    event: Events.MessageDelete,
})
export default class extends Listener {
    public async run(message: Message | PartialMessage): Promise<void> {
        if (!message.guildId) {
            return;
        }

        await this.container.prisma.trackedMessage.deleteMany({
            where: { idGuild: message.guildId, idMessage: message.id },
        }).catch(() => null);
    }
}
