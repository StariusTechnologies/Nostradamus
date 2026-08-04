import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    type ButtonInteraction,
    ContainerBuilder,
    type MessageActionRowComponentBuilder,
    type Message,
    PermissionsBitField,
    TextDisplayBuilder
} from 'discord.js';
import { MessageFlags } from 'discord-api-types/v10';
import {
    InteractionHandler,
    InteractionHandlerTypes
} from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { WatchService } from '../lib/WatchService.js';
import { Colors } from '../util/Colors.js';
import { WEEK } from '../util/DateTime.js';

const WATCH_PERM_PREFIX = 'watch-invite-perm';
const WATCH_1W_PREFIX = 'watch-invite-1w';
const DISMISS_ID = 'watch-invite-dismiss';

type ParsedDismiss = { kind: 'dismiss' };
type ParsedWatch = {
    kind: 'watch-perm' | 'watch-1w',
    joinerId: string,
    inviterId: string,
    code: string,
};
type Parsed = ParsedDismiss | ParsedWatch;

@ApplyOptions<InteractionHandler.Options>({
    interactionHandlerType: InteractionHandlerTypes.Button,
})
export default class extends InteractionHandler {
    public override parse(interaction: ButtonInteraction) {
        const id = interaction.customId;

        if (id === DISMISS_ID) {
            return this.some({ kind: 'dismiss' });
        }

        if (id.startsWith(`${WATCH_PERM_PREFIX}:`)) {
            const parts = id.split(':');

            if (parts.length !== 4) {
                return this.none();
            }

            return this.some({ kind: 'watch-perm', joinerId: parts[1], inviterId: parts[2], code: parts[3] });
        }

        if (id.startsWith(`${WATCH_1W_PREFIX}:`)) {
            const parts = id.split(':');

            if (parts.length !== 4) {
                return this.none();
            }

            return this.some({ kind: 'watch-1w', joinerId: parts[1], inviterId: parts[2], code: parts[3] });
        }

        return this.none();
    }

    public async run(interaction: ButtonInteraction, parsed: Parsed): Promise<void> {
        if (!interaction.inGuild()) {
            return;
        }

        const { member } = interaction;
        const permissions = member?.permissions;
        const hasPerms = typeof permissions === 'string'
            ? false
            : permissions?.has(PermissionsBitField.Flags.ManageGuild) ?? false;

        if (!hasPerms) {
            await interaction.reply({
                content: 'You do not have permission to use this button.',
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        if (parsed.kind === 'dismiss') {
            await this.updateMessage(interaction, 'Dismissed by the moderation team.');

            return;
        }

        const guildId = interaction.guildId!;
        const durationMs = parsed.kind === 'watch-perm' ? null : WEEK;
        const reason = `Joined via watched member <@${parsed.inviterId}>'s invite (code: ${parsed.code}).`;

        if (WatchService.isWatched(guildId, parsed.joinerId)) {
            await this.updateMessage(interaction, `<@${parsed.joinerId}> is already on the watchlist.`);

            return;
        }

        await WatchService.add(guildId, parsed.joinerId, reason, durationMs);

        const statusLine = parsed.kind === 'watch-perm'
            ? `Added <@${parsed.joinerId}> to the watchlist **permanently**.`
            : `Added <@${parsed.joinerId}> to the watchlist for **1w**.`;

        await this.updateMessage(interaction, statusLine);
    }

    private async updateMessage(interaction: ButtonInteraction, statusLine: string): Promise<void> {
        const sourceMessage = interaction.message as Message;
        const [sourceContainer] = sourceMessage.components;
        const body = sourceMessage.content
            ?? this.extractBodyFromContainer(sourceContainer);
        const containerBuilder = new ContainerBuilder()
            .setAccentColor(Colors.Confirm)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(body))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${statusLine}`));
        const disabledRow = this.buildDisabledRow(interaction.customId);

        if (disabledRow) {
            containerBuilder.addActionRowComponents(disabledRow);
        }

        await interaction.update({
            flags: MessageFlags.IsComponentsV2,
            components: [containerBuilder],
        });
    }

    private extractBodyFromContainer(component: unknown): string {
        const raw = component as { components?: { type: number, content?: string }[] } | undefined;
        const textBlocks = raw?.components?.filter(c => c.type === 10) ?? [];

        return textBlocks.map(c => c.content ?? '').join('\n');
    }

    private buildDisabledRow(
        customId: string
    ): ActionRowBuilder<MessageActionRowComponentBuilder> | null {
        if (customId === DISMISS_ID) {
            return null;
        }

        const isPerm = customId.startsWith(`${WATCH_PERM_PREFIX}:`);
        const isOneWeek = customId.startsWith(`${WATCH_1W_PREFIX}:`);
        const watchPerm = new ButtonBuilder()
            .setCustomId(`${WATCH_PERM_PREFIX}:done`)
            .setStyle(ButtonStyle.Danger)
            .setLabel(isPerm ? 'Watched permanently' : 'Watch permanently')
            .setDisabled(true);
        const watch1w = new ButtonBuilder()
            .setCustomId(`${WATCH_1W_PREFIX}:done`)
            .setStyle(ButtonStyle.Primary)
            .setLabel(isOneWeek ? 'Watched for 1w' : 'Watch for 1w')
            .setDisabled(true);
        const dismiss = new ButtonBuilder()
            .setCustomId(`${DISMISS_ID}:done`)
            .setStyle(ButtonStyle.Secondary)
            .setLabel('Dismiss')
            .setDisabled(true);

        return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(watchPerm, watch1w, dismiss);
    }
}
