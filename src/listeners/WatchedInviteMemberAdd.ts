import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    type GuildMember,
    type MessageActionRowComponentBuilder,
    type TextChannel,
    TextDisplayBuilder
} from 'discord.js';
import { MessageFlags } from 'discord-api-types/v10';
import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { InviteCache } from '../lib/InviteCache.js';
import { WatchService } from '../lib/WatchService.js';
import { getSetting, SettingKey } from '../lib/Settings.js';
import { Colors } from '../util/Colors.js';

const WATCH_PERM_PREFIX = 'watch-invite-perm';
const WATCH_1W_PREFIX = 'watch-invite-1w';
const DISMISS_ID = 'watch-invite-dismiss';

@ApplyOptions<ListenerOptions>({
    event: Events.GuildMemberAdd,
})
export default class extends Listener {
    public async run(member: GuildMember): Promise<void> {
        if (member.user.bot) {
            return;
        }

        const used = await InviteCache.detectUsedInvite(member.guild.id);

        if (!used) {
            return;
        }

        if (!WatchService.isWatched(member.guild.id, used.inviterId)) {
            return;
        }

        const channelId = await getSetting(member.guild.id, SettingKey.WatchlistChannel);

        if (!channelId) {
            return;
        }

        const channel = member.guild.channels.cache.get(channelId);

        if (!channel || !channel.isTextBased()) {
            return;
        }

        const joinerWatched = WatchService.isWatched(member.guild.id, member.id);
        const lines: string[] = [
            '### Watched member\'s invite was used',
            `<@${member.id}> — \`${member.user.username}\``,
            `Joined using <@${used.inviterId}>'s invite code \`${used.code}\`.`,
        ];

        if (joinerWatched) {
            lines.push('');
            lines.push('-# Joiner is already on the watchlist.');
        }

        const container_ = new ContainerBuilder()
            .setAccentColor(Colors.Error)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));

        if (!joinerWatched) {
            const buttons = this.buildButtons(member.id, used.inviterId, used.code);

            container_.addActionRowComponents(buttons);
        }

        await (channel as TextChannel).send({
            flags: MessageFlags.IsComponentsV2,
            components: [container_],
            allowedMentions: { parse: [] },
        }).catch(err => {
            this.container.logger.warn(`Failed to send watched-invite event: ${err}`);
        });
    }

    private buildButtons(
        joinerId: string,
        inviterId: string,
        code: string
    ): ActionRowBuilder<MessageActionRowComponentBuilder> {
        const payload = `${joinerId}:${inviterId}:${code}`;
        const watchPerm = new ButtonBuilder()
            .setCustomId(`${WATCH_PERM_PREFIX}:${payload}`)
            .setStyle(ButtonStyle.Danger)
            .setLabel('Watch permanently');
        const watch1w = new ButtonBuilder()
            .setCustomId(`${WATCH_1W_PREFIX}:${payload}`)
            .setStyle(ButtonStyle.Primary)
            .setLabel('Watch for 1w');
        const dismiss = new ButtonBuilder()
            .setCustomId(DISMISS_ID)
            .setStyle(ButtonStyle.Secondary)
            .setLabel('Dismiss');

        return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(watchPerm, watch1w, dismiss);
    }
}
