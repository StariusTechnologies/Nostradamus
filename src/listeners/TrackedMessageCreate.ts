import type { Message } from 'discord.js';
import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

@ApplyOptions<ListenerOptions>({
    event: Events.MessageCreate,
})
export default class extends Listener {
    public async run(message: Message): Promise<void> {
        if (!message.inGuild() || message.system || message.author.bot) {
            return;
        }

        await this.container.prisma.trackedMessage.create({
            data: {
                idGuild: message.guild.id,
                idUser: message.author.id,
                idChannel: message.channelId,
                idMessage: message.id,
                createdAt: message.createdAt,
            },
        }).catch(() => null);
    }
}
