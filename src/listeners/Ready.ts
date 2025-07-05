import type { Client } from 'discord.js';
import { Events } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { Listener, type ListenerOptions } from '@sapphire/framework';
import { loadEmojis } from '../util/Emojis.js';

@ApplyOptions<ListenerOptions>({
    event: Events.ClientReady,
})
export default class extends Listener {
    public async run(client: Client): Promise<void> {
        const nbGuilds = client.guilds.cache.size;

        await loadEmojis(client);

        this.container.logger.info(`Logged in as ${client.user!.username}#${client.user!.discriminator}`);
        this.container.logger.info(`Serving in ${nbGuilds} guild${nbGuilds > 1 ? 's' : ''}`);
    }
}
