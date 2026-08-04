import type { Message } from 'discord.js';
import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { getSetting, SettingKey } from '../lib/Settings.js';
import { MINUTE } from '../util/DateTime.js';

const CLEANUP_DELAY = MINUTE;

@ApplyOptions<ListenerOptions>({
    event: Events.MessageCreate,
})
export default class extends Listener {
    public async run(message: Message): Promise<void> {
        if (!message.inGuild()) {
            return;
        }

        const cleanupChannelId = await getSetting(message.guild.id, SettingKey.AutoCleanupChannel);

        if (!cleanupChannelId || message.channelId !== cleanupChannelId) {
            return;
        }

        setTimeout(() => {
            message.delete().catch(err => {
                this.container.logger.warn(`Failed to auto-cleanup message ${message.id}: ${err}`);
            });
        }, CLEANUP_DELAY);
    }
}
