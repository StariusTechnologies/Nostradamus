import {
    type ChatInputCommandInteraction,
    ContainerBuilder,
    type Role,
    SeparatorBuilder,
    TextDisplayBuilder
} from 'discord.js';
import { InteractionContextType, MessageFlags } from 'discord-api-types/v10';
import { type ApplicationCommandRegistry } from '@sapphire/framework';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { fetchT } from '@sapphire/plugin-i18next';
import { type TFunction } from 'i18next';
import { LocalizedSubcommand } from '../../lib/i18n/LocalizedSubcommand.js';
import {
    registerCommandDescriptions,
    registerOptionDescriptions,
    registerSubcommandDescriptions,
    registerSubcommandGroupDescriptions
} from '../../lib/i18n/LanguageManager.js';
import { InteractionManager } from '../../lib/InteractionManager.js';
import { Components } from '../../lib/Components.js';
import { Emojis } from '../../util/Emojis.js';
import { Colors } from '../../util/Colors.js';

const IGNORED_ROLE_GROUP = 'ignored-role';
const MAX_LIST_ITEMS = 50;

type BrokenEntry = { id: number, enName: string, frName: string, idRole: string };

export default class extends LocalizedSubcommand {
    public constructor(context: Subcommand.LoaderContext, options: Subcommand.Options) {
        super(context, {
            ...options,
            subcommands: [
                { name: 'run', chatInputRun: 'chatInputRun' },
                {
                    name: IGNORED_ROLE_GROUP,
                    type: 'group',
                    entries: [
                        { name: 'add', chatInputRun: 'chatInputIgnoredRoleAdd' },
                        { name: 'remove', chatInputRun: 'chatInputIgnoredRoleRemove' },
                        { name: 'list', chatInputRun: 'chatInputIgnoredRoleList' },
                    ],
                },
            ],
        });
    }

    public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply({ flags: MessageFlags.Ephemeral });

        const t = await fetchT(interaction);
        const guild = interaction.guild!;
        const [languages, countries, listableRoles, ignoredRoles] = await Promise.all([
            this.container.prisma.language.findMany({ where: { idGuild: guild.id } }),
            this.container.prisma.country.findMany({ where: { idGuild: guild.id } }),
            this.container.prisma.listableRole.findMany({ where: { idGuild: guild.id } }),
            this.container.prisma.auditIgnoredRole.findMany({ where: { idGuild: guild.id } }),
        ]);
        const trackedRoleIds = new Set<string>([
            ...languages.map(language => language.idRole),
            ...countries.map(country => country.idRole),
            ...listableRoles.map(row => row.idRole),
        ]);
        const ignoredRoleIds = new Set<string>(ignoredRoles.map(row => row.idRole));
        const serverRoles = [...guild.roles.cache.values()];
        const brokenLanguages: BrokenEntry[] = languages.filter(language => !guild.roles.cache.has(language.idRole));
        const brokenCountries: BrokenEntry[] = countries.filter(country => !guild.roles.cache.has(country.idRole));
        const untrackedRoles: Role[] = serverRoles
            .filter(role => role.id !== guild.id)
            .filter(role => !role.managed)
            .filter(role => !trackedRoleIds.has(role.id))
            .filter(role => !ignoredRoleIds.has(role.id))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

        const container = this.buildReportContainer(t, {
            languageCount: languages.length,
            countryCount: countries.length,
            serverRoleCount: serverRoles.length,
            brokenLanguages,
            brokenCountries,
            untrackedRoles,
        });

        await interactionManager.edit({
            components: [container],
            allowedMentions: { parse: [] },
        });
    }

    public async chatInputIgnoredRoleAdd(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply({ flags: MessageFlags.Ephemeral });

        const t = await fetchT(interaction);
        const guild = interaction.guild!;
        const role = interaction.options.getRole('role', true) as Role;
        const existing = await this.container.prisma.auditIgnoredRole.findUnique({
            where: { idGuild_idRole: { idGuild: guild.id, idRole: role.id } },
        });

        if (existing) {
            await interactionManager.edit(t('commands:audit.subcommand.ignoredRole.add.alreadyConfigured', {
                emoji: '🤔',
                roleName: role.name,
            }));

            return;
        }

        await this.container.prisma.auditIgnoredRole.create({
            data: { idGuild: guild.id, idRole: role.id },
        });

        await interactionManager.edit(Components.confirm(
            t('commands:audit.subcommand.ignoredRole.add.confirm', {
                emoji: Emojis.RainbowSheep,
                roleName: role.name,
            })
        ));
    }

    public async chatInputIgnoredRoleRemove(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply({ flags: MessageFlags.Ephemeral });

        const t = await fetchT(interaction);
        const guild = interaction.guild!;
        const role = interaction.options.getRole('role', true) as Role;
        const existing = await this.container.prisma.auditIgnoredRole.findUnique({
            where: { idGuild_idRole: { idGuild: guild.id, idRole: role.id } },
        });

        if (!existing) {
            await interactionManager.edit(Components.error(
                t('commands:audit.subcommand.ignoredRole.remove.notConfigured', {
                    emoji: '❌',
                    roleName: role.name,
                })
            ));

            return;
        }

        await this.container.prisma.auditIgnoredRole.delete({
            where: { idGuild_idRole: { idGuild: guild.id, idRole: role.id } },
        });

        await interactionManager.edit(Components.confirm(
            t('commands:audit.subcommand.ignoredRole.remove.confirm', {
                emoji: Emojis.RainbowSheep,
                roleName: role.name,
            })
        ));
    }

    public async chatInputIgnoredRoleList(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply({ flags: MessageFlags.Ephemeral });

        const t = await fetchT(interaction);
        const guild = interaction.guild!;
        const rows = await this.container.prisma.auditIgnoredRole.findMany({
            where: { idGuild: guild.id },
            orderBy: { idRole: 'asc' },
        });

        if (rows.length === 0) {
            await interactionManager.edit(t('commands:audit.subcommand.ignoredRole.list.empty', { emoji: '🤷' }));

            return;
        }

        const lines = rows.map(row => `- <@&${row.idRole}>`);
        const heading = t('commands:audit.subcommand.ignoredRole.list.heading', { emoji: Emojis.RainbowSheep });

        await interactionManager.edit({
            ...Components.info(`## ${heading}\n${lines.join('\n')}`),
            allowedMentions: { parse: [] },
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry): void {
        registry.registerChatInputCommand(command =>
            registerCommandDescriptions(command
                .setName(this.name)
                .setDefaultMemberPermissions(0)
                .setContexts(InteractionContextType.Guild)
                .addSubcommand(sub => registerSubcommandDescriptions(this.name, sub
                    .setName('run')
                ))
                .addSubcommandGroup(group => registerSubcommandGroupDescriptions(this.name, group
                    .setName(IGNORED_ROLE_GROUP)
                    .addSubcommand(sub => registerSubcommandDescriptions(this.name, sub
                        .setName('add')
                        .addRoleOption(option => registerOptionDescriptions(this.name, option
                            .setName('role')
                            .setRequired(true), { subcommandGroup: IGNORED_ROLE_GROUP, subcommand: 'add' }
                        )), IGNORED_ROLE_GROUP
                    ))
                    .addSubcommand(sub => registerSubcommandDescriptions(this.name, sub
                        .setName('remove')
                        .addRoleOption(option => registerOptionDescriptions(this.name, option
                            .setName('role')
                            .setRequired(true), { subcommandGroup: IGNORED_ROLE_GROUP, subcommand: 'remove' }
                        )), IGNORED_ROLE_GROUP
                    ))
                    .addSubcommand(sub => registerSubcommandDescriptions(this.name, sub
                        .setName('list'), IGNORED_ROLE_GROUP
                    ))
                ))
            )
        );
    }

    private buildReportContainer(
        t: TFunction,
        data: {
            languageCount: number,
            countryCount: number,
            serverRoleCount: number,
            brokenLanguages: BrokenEntry[],
            brokenCountries: BrokenEntry[],
            untrackedRoles: Role[],
        }
    ): ContainerBuilder {
        const heading = t('commands:audit.subcommand.run.heading', { emoji: Emojis.RainbowSheep });
        const counts = t('commands:audit.subcommand.run.counts', {
            languages: data.languageCount,
            countries: data.countryCount,
            roles: data.serverRoleCount,
        });
        const brokenLanguagesSection = this.formatBrokenSection(
            t,
            'commands:audit.subcommand.run.brokenLanguages',
            data.brokenLanguages
        );
        const brokenCountriesSection = this.formatBrokenSection(
            t,
            'commands:audit.subcommand.run.brokenCountries',
            data.brokenCountries
        );
        const untrackedRolesSection = this.formatUntrackedSection(t, data.untrackedRoles);
        const container = new ContainerBuilder()
            .setAccentColor(Colors.Info)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${heading}`))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(counts))
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(brokenLanguagesSection))
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(brokenCountriesSection))
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(untrackedRolesSection));

        return container;
    }

    private formatBrokenSection(t: TFunction, key: string, entries: BrokenEntry[]): string {
        const header = t(key, { count: entries.length });

        if (entries.length === 0) {
            return header;
        }

        const shown = entries.slice(0, MAX_LIST_ITEMS);
        const lines = shown.map(entry => `- **${entry.enName} / ${entry.frName}** — \`${entry.idRole}\``);
        const trail = entries.length > MAX_LIST_ITEMS
            ? `\n-# ${t('commands:audit.subcommand.run.truncated', { count: entries.length - MAX_LIST_ITEMS })}`
            : '';

        return `${header}\n${lines.join('\n')}${trail}`;
    }

    private formatUntrackedSection(t: TFunction, roles: Role[]): string {
        const header = t('commands:audit.subcommand.run.untrackedRoles', { count: roles.length });

        if (roles.length === 0) {
            return header;
        }

        const shown = roles.slice(0, MAX_LIST_ITEMS);
        const lines = shown.map(role => `- <@&${role.id}>`);
        const trail = roles.length > MAX_LIST_ITEMS
            ? `\n-# ${t('commands:audit.subcommand.run.truncated', { count: roles.length - MAX_LIST_ITEMS })}`
            : '';

        return `${header}\n${lines.join('\n')}${trail}`;
    }
}
