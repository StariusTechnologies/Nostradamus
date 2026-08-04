import {
    type ChatInputCommandInteraction,
    ContainerBuilder,
    type Invite,
    type Message,
    TextDisplayBuilder
} from 'discord.js';
import { InteractionContextType, MessageFlags } from 'discord-api-types/v10';
import {
    type ApplicationCommandRegistry,
    type Args,
    Command as SapphireCommand,
    container as sapphireContainer
} from '@sapphire/framework';
import { fetchT } from '@sapphire/plugin-i18next';
import { type TFunction } from 'i18next';
import { LocalizedCommand } from '../../lib/i18n/LocalizedCommand.js';
import {
    registerCommandDescriptions,
    registerOptionDescriptions
} from '../../lib/i18n/LanguageManager.js';
import { InteractionManager } from '../../lib/InteractionManager.js';
import { Components } from '../../lib/Components.js';
import { Colors } from '../../util/Colors.js';
import { DAY, HOUR, MINUTE, WEEK } from '../../util/DateTime.js';
import { DEFAULT_PRIMARY_LOCALE, getSetting, SettingKey } from '../../lib/Settings.js';
import { purgeUser, type PurgeResult } from '../../lib/PurgeUserService.js';
import { parseUserToken } from '../../util/Discord.js';

const COMMAND_NAME = 'purge-user';
const DURATION_REGEX = /^(\d+)([mhdw])$/iu;
const DEFAULT_DURATION_MS = 2 * WEEK;
const DURATION_UNITS: Record<string, number> = {
    m: MINUTE,
    h: HOUR,
    d: DAY,
    w: WEEK,
};

export default class extends LocalizedCommand {
    public constructor(context: SapphireCommand.LoaderContext, options?: SapphireCommand.Options) {
        super(context, {
            ...options,
            name: COMMAND_NAME,
            aliases: ['purgeuser', 'puser', 'purgeu', 'purjus', 'pu'],
            preconditions: [{ name: 'RoleTier', context: { tier: 'helper' } }],
        });
    }

    public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply({ flags: MessageFlags.Ephemeral });

        const t = await fetchT(interaction);
        const guild = interaction.guild!;
        const user = interaction.options.getUser('user', true);
        const durationInput = interaction.options.getString('duration');
        const durationMs = this.parseDuration(durationInput) ?? DEFAULT_DURATION_MS;

        if (durationInput && this.parseDuration(durationInput) === null) {
            await interactionManager.edit(Components.error(
                t('commands:purge-user.error.invalidDuration', { emoji: '❌' })
            ));

            return;
        }

        if (interaction.user.id === user.id) {
            await interactionManager.edit(Components.error(
                t('commands:purge-user.error.selfPurge', { emoji: '❌' })
            ));

            return;
        }

        const result = await purgeUser(guild, user.id, durationMs);

        await interactionManager.edit({
            components: [this.buildResultContainer(t, user.id, user.username, result)],
            allowedMentions: { parse: [] },
        });
    }

    public override async messageRun(message: Message, args: Args): Promise<void> {
        if (!message.inGuild()) {
            return;
        }

        const t = await this.resolveTranslator(message);
        const rest = (await args.rest('string').catch(() => null))?.trim();

        if (!rest) {
            await message.reply(Components.error(
                t('commands:purge-user.error.missingTarget', { emoji: '❌' })
            )).catch(() => null);

            return;
        }

        const tokens = rest.split(/\s+/u);
        let durationMs = DEFAULT_DURATION_MS;

        if (tokens.length > 1 && DURATION_REGEX.test(tokens[0])) {
            durationMs = this.parseDuration(tokens.shift()!) ?? DEFAULT_DURATION_MS;
        }

        const ids: string[] = [];

        for (const token of tokens) {
            const id = parseUserToken(token);

            if (id && !ids.includes(id)) {
                ids.push(id);
            }
        }

        if (ids.length === 0) {
            await message.reply(Components.error(
                t('commands:purge-user.error.noValidIds', { emoji: '❌' })
            )).catch(() => null);

            return;
        }

        const containers: ContainerBuilder[] = [];

        for (const id of ids) {
            if (id === message.author.id) {
                containers.push(this.buildSelfPurgeContainer(t));
                continue;
            }

            const result = await purgeUser(message.guild, id, durationMs);
            const username = await this.resolveUsername(id);

            containers.push(this.buildResultContainer(t, id, username, result));
        }

        for (let i = 0; i < containers.length; i += 5) {
            const chunk = containers.slice(i, i + 5);

            await message.reply({
                flags: MessageFlags.IsComponentsV2,
                components: chunk,
                allowedMentions: { parse: [] },
            }).catch(() => null);
        }
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry): void {
        registry.registerChatInputCommand(command =>
            registerCommandDescriptions(command
                .setName(this.name)
                .setDefaultMemberPermissions(0)
                .setContexts(InteractionContextType.Guild)
                .addUserOption(option => registerOptionDescriptions(this.name, option
                    .setName('user')
                    .setRequired(true)
                ))
                .addStringOption(option => registerOptionDescriptions(this.name, option
                    .setName('duration')
                    .setRequired(false)
                ))
            )
        );
    }

    private parseDuration(input: string | null): number | null {
        if (!input) {
            return null;
        }

        const match = input.trim().match(DURATION_REGEX);

        if (!match) {
            return null;
        }

        const value = parseInt(match[1], 10);
        const unit = match[2].toLowerCase();

        if (!Number.isFinite(value) || value <= 0) {
            return null;
        }

        return value * DURATION_UNITS[unit];
    }

    private async resolveTranslator(message: Message<true>): Promise<TFunction> {
        const preference = await this.container.prisma.userPreference.findUnique({
            where: { idUser: message.author.id },
        });
        const locale = preference?.locale
            ?? await getSetting(message.guild.id, SettingKey.PrimaryLocale)
            ?? DEFAULT_PRIMARY_LOCALE;

        return sapphireContainer.i18n.getT(locale);
    }

    private async resolveUsername(userId: string): Promise<string> {
        const user = await this.container.client.users.fetch(userId).catch(() => null);

        return user?.username ?? userId;
    }

    private buildResultContainer(
        t: TFunction,
        userId: string,
        username: string,
        result: PurgeResult
    ): ContainerBuilder {
        const heading = t('commands:purge-user.heading', { username, userId });
        const deletedLine = result.deletedCount > 0
            ? t('commands:purge-user.deleted', { count: result.deletedCount })
            : t('commands:purge-user.noneDeleted');
        const lines: string[] = [
            `## ${heading}`,
            deletedLine,
        ];

        if (result.inviteCountTooLarge) {
            lines.push('');
            lines.push(t('commands:purge-user.tooManyInvites'));
        } else if (result.invites.length > 0) {
            lines.push('');
            lines.push(`**${t('commands:purge-user.invitesHeading', { count: result.invites.length })}**`);
            lines.push(...this.formatInvites(result.invites));
        }

        return new ContainerBuilder()
            .setAccentColor(result.deletedCount > 0 ? Colors.Confirm : Colors.Info)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
    }

    private buildSelfPurgeContainer(t: TFunction): ContainerBuilder {
        return new ContainerBuilder()
            .setAccentColor(Colors.Error)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                t('commands:purge-user.error.selfPurge', { emoji: '❌' })
            ));
    }

    private formatInvites(invites: Invite[]): string[] {
        return invites
            .slice(0, 20)
            .map(invite => `- \`${invite.code}\` — ${invite.url}`)
            .concat(
                invites.length > 20
                    ? [`-# (… and ${invites.length - 20} more)`]
                    : []
            );
    }
}
