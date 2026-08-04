import {
    type ChatInputCommandInteraction,
    Collection,
    ContainerBuilder,
    type Guild,
    type GuildMember,
    type Message,
    SeparatorBuilder,
    TextDisplayBuilder
} from 'discord.js';
import { MessageFlags } from 'discord.js';
import { InteractionContextType } from 'discord-api-types/v10';
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
import { Emojis } from '../../util/Emojis.js';
import { Colors } from '../../util/Colors.js';
import { DEFAULT_PRIMARY_LOCALE, getSetting, SettingKey } from '../../lib/Settings.js';
import { parseUserToken } from '../../util/Discord.js';

const COMMAND_NAME = 'get-member-id';
const MAX_RESULTS = 5;

export default class extends LocalizedCommand {
    public constructor(context: SapphireCommand.LoaderContext, options?: SapphireCommand.Options) {
        super(context, {
            ...options,
            name: COMMAND_NAME,
            aliases: ['gmid'],
            preconditions: [{ name: 'RoleTier', context: { tier: 'helper' } }],
        });
    }

    public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply({ flags: MessageFlags.Ephemeral });

        const t = await fetchT(interaction);
        const guild = interaction.guild!;
        const query = interaction.options.getString('query', true).trim();

        if (query.length === 0) {
            await interactionManager.edit(Components.error(
                t('commands:get-member-id.error.emptyQuery', { emoji: '❌' })
            ));

            return;
        }

        const matches = await this.findMembers(guild, query);

        if (matches.length === 0) {
            await interactionManager.edit(Components.info(
                t('commands:get-member-id.empty', { emoji: '🤷' })
            ));

            return;
        }

        await interactionManager.edit({
            components: [this.buildResultsContainer(t, matches)],
            allowedMentions: { parse: [] },
        });
    }

    public override async messageRun(message: Message, args: Args): Promise<void> {
        if (!message.inGuild()) {
            return;
        }

        const rawQuery = await args.rest('string').catch(() => null);

        if (!rawQuery) {
            return;
        }

        const query = rawQuery.trim();

        if (query.length === 0) {
            return;
        }

        const locale = await this.resolveMessageLocale(message.author.id, message.guild.id);
        const t = sapphireContainer.i18n.getT(locale);
        const matches = await this.findMembers(message.guild, query);

        if (matches.length === 0) {
            await message.reply(t('commands:get-member-id.empty', { emoji: '🤷' })).catch(() => null);

            return;
        }

        await message.reply({
            flags: MessageFlags.IsComponentsV2,
            components: [this.buildResultsContainer(t, matches)],
            allowedMentions: { parse: [] },
        }).catch(() => null);
    }

    private async resolveMessageLocale(userId: string, guildId: string): Promise<string> {
        const preference = await this.container.prisma.userPreference.findUnique({
            where: { idUser: userId },
        });

        if (preference?.locale) {
            return preference.locale;
        }

        return await getSetting(guildId, SettingKey.PrimaryLocale) ?? DEFAULT_PRIMARY_LOCALE;
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry): void {
        registry.registerChatInputCommand(command =>
            registerCommandDescriptions(command
                .setName(this.name)
                .setDefaultMemberPermissions(0)
                .setContexts(InteractionContextType.Guild)
                .addStringOption(option => registerOptionDescriptions(this.name, option
                    .setName('query')
                    .setRequired(true)
                ))
            )
        );
    }

    private async findMembers(guild: Guild, query: string): Promise<GuildMember[]> {
        const results = new Collection<string, GuildMember>();
        const directId = parseUserToken(query);

        if (directId) {
            const byId = await guild.members.fetch(directId).catch(() => null);

            if (byId) {
                results.set(byId.id, byId);
            }

            return [...results.values()];
        }

        const lowerQuery = query.toLowerCase();

        for (const member of guild.members.cache.values()) {
            if (results.has(member.id)) {
                continue;
            }

            const username = member.user.username.toLowerCase();
            const globalName = member.user.globalName?.toLowerCase() ?? '';
            const nickname = member.nickname?.toLowerCase() ?? '';
            const displayName = member.displayName.toLowerCase();

            if (username.includes(lowerQuery)
                || globalName.includes(lowerQuery)
                || nickname.includes(lowerQuery)
                || displayName.includes(lowerQuery)) {
                results.set(member.id, member);
            }

            if (results.size >= MAX_RESULTS) {
                break;
            }
        }

        return [...results.values()].slice(0, MAX_RESULTS);
    }

    private buildResultsContainer(t: TFunction, members: GuildMember[]): ContainerBuilder {
        const heading = t('commands:get-member-id.heading', {
            emoji: Emojis.RainbowSheep,
            count: members.length,
        });
        const container = new ContainerBuilder()
            .setAccentColor(Colors.Info)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${heading}`));

        for (const member of members) {
            const lines: string[] = [
                `<@${member.id}> — \`${member.user.username}\``,
            ];

            if (member.displayName && member.displayName !== member.user.username) {
                lines.push(`-# Display name: ${member.displayName}`);
            }

            lines.push(`**ID:** \`${member.id}\``);

            container
                .addSeparatorComponents(new SeparatorBuilder())
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
        }

        return container;
    }
}
