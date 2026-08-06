import { ChannelType, type Client, type Guild, type GuildTextBasedChannel } from 'discord.js';
import { Events } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { Listener, type ListenerOptions } from '@sapphire/framework';
import { loadEmojis } from '../util/Emojis.js';
import { getSetting, SettingKey } from '../lib/Settings.js';
import { WatchService } from '../lib/WatchService.js';
import { InviteCache } from '../lib/InviteCache.js';
import { DAY, HOUR } from '../util/DateTime.js';

const TRACKED_MESSAGE_TTL: number = 14 * DAY;
const TRACKED_MESSAGE_SWEEP_INTERVAL: number = 6 * HOUR;

@ApplyOptions<ListenerOptions>({
    event: Events.ClientReady,
})
export default class extends Listener {
    private sweepTimer: NodeJS.Timeout | null = null;

    public async run(client: Client): Promise<void> {
        const nbGuilds = client.guilds.cache.size;

        await loadEmojis(client);

        this.container.logger.info(`Logged in as ${client.user!.username}#${client.user!.discriminator}`);
        this.container.logger.info(`Serving in ${nbGuilds} guild${nbGuilds > 1 ? 's' : ''}`);

        await this.warmMemberCaches(client);
        await WatchService.init();
        await InviteCache.init();
        await this.sweepStaleTrackedMessages();

        this.scheduleTrackedMessageSweep();

        await Promise.all(client.guilds.cache.map(guild => this.sweepCleanupChannel(guild)));
    }

    /**
     * Keeps the tracked-message retention window honest even when the bot stays up for weeks: the startup sweep
     * alone would let rows outlive the TTL for as long as the process runs.
     */
    private scheduleTrackedMessageSweep(): void {
        if (this.sweepTimer) {
            clearInterval(this.sweepTimer);
        }

        this.sweepTimer = setInterval((): void => {
            void this.sweepStaleTrackedMessages();
        }, TRACKED_MESSAGE_SWEEP_INTERVAL);

        this.sweepTimer.unref();
    }

    private async sweepStaleTrackedMessages(): Promise<void> {
        const cutoff = new Date(Date.now() - TRACKED_MESSAGE_TTL);

        try {
            const result = await this.container.prisma.trackedMessage.deleteMany({
                where: { createdAt: { lt: cutoff } },
            });

            if (result.count > 0) {
                this.container.logger.info(
                    `Pruned ${result.count} tracked message(s) older than ${TRACKED_MESSAGE_TTL / DAY} days.`
                );
            }
        } catch (err) {
            this.container.logger.warn(`Could not prune stale tracked messages: ${err}`);
        }
    }

    private async warmMemberCaches(client: Client): Promise<void> {
        await Promise.all(client.guilds.cache.map(async guild => {
            try {
                const members = await guild.members.fetch();

                this.container.logger.info(`Cached ${members.size} member(s) for guild ${guild.id}.`);
            } catch (err) {
                this.container.logger.warn(`Could not warm member cache for guild ${guild.id}: ${err}`);
            }
        }));
    }

    private async sweepCleanupChannel(guild: Guild): Promise<void> {
        const channelId = await getSetting(guild.id, SettingKey.AutoCleanupChannel);

        if (!channelId) {
            return;
        }

        const channel = guild.channels.cache.get(channelId);

        if (!channel) {
            this.container.logger.warn(
                `Auto-cleanup channel ${channelId} not found in guild ${guild.id}.`
            );

            return;
        }

        const cleanableTypes: ChannelType[] = [
            ChannelType.GuildText,
            ChannelType.PublicThread,
            ChannelType.PrivateThread,
        ];

        if (!cleanableTypes.includes(channel.type)) {
            this.container.logger.warn(
                `Auto-cleanup channel ${channelId} in guild ${guild.id} is not text-based.`
            );

            return;
        }

        try {
            await (channel as GuildTextBasedChannel).bulkDelete(100, true);
        } catch (err) {
            this.container.logger.warn(
                `Failed to sweep auto-cleanup channel ${channelId} in guild ${guild.id}: ${err}`
            );
        }
    }
}
