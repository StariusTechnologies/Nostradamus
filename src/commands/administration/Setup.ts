import { ChatInputCommandInteraction, type Role } from 'discord.js';
import { ChannelType, InteractionContextType, MessageFlags } from 'discord-api-types/v10';
import { type ApplicationCommandRegistry } from '@sapphire/framework';
import { fetchT } from '@sapphire/plugin-i18next';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { LocalizedSubcommand } from '../../lib/i18n/LocalizedSubcommand.js';
import {
    registerCommandDescriptions,
    registerOptionDescriptions,
    registerSubcommandDescriptions,
    registerSubcommandGroupDescriptions
} from '../../lib/i18n/LanguageManager.js';
import { removeSetting, saveSetting, SettingKey } from '../../lib/Settings.js';
import { InteractionManager } from '../../lib/InteractionManager.js';
import { Components } from '../../lib/Components.js';
import { Emojis } from '../../util/Emojis.js';

const LISTABLE_ROLE_GROUP = 'listable-role';

export default class extends LocalizedSubcommand {
    public constructor(context: Subcommand.LoaderContext, options: Subcommand.Options) {
        super(context, {
            ...options,
            subcommands: [
                { name: 'config', chatInputRun: 'chatInputConfig' },
                { name: 'unset', chatInputRun: 'chatInputUnset' },
                {
                    name: LISTABLE_ROLE_GROUP,
                    type: 'group',
                    entries: [
                        { name: 'add', chatInputRun: 'chatInputListableRoleAdd' },
                        { name: 'remove', chatInputRun: 'chatInputListableRoleRemove' },
                        { name: 'list', chatInputRun: 'chatInputListableRoleList' },
                    ],
                },
            ],
        });
    }

    public async chatInputConfig(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply({ flags: MessageFlags.Ephemeral });

        const t = await fetchT(interaction);
        let savedSomething = false;
        const settings = [
            SettingKey.BotLogChannel,
            SettingKey.NativeLanguageRole,
            SettingKey.AutoCleanupChannel,
            SettingKey.WatchlistChannel,
            SettingKey.ModerationLogChannel,
            SettingKey.PrimaryLocale,
            SettingKey.AdminRole,
            SettingKey.ModeratorRole,
            SettingKey.HelperRole,
        ];

        for (const setting of settings) {
            const value = interaction.options.get(setting)?.value;

            if (value === undefined || value === null) {
                continue;
            }

            await saveSetting(interaction.guild!.id, setting, value);
            savedSomething = true;
        }

        if (!savedSomething) {
            await interactionManager.edit(t('commands:setup.subcommand.config.nothingChanged', { emoji: '🤔' }));

            return;
        }

        await interactionManager.edit(Components.confirm(
            t('commands:setup.subcommand.config.confirm', { emoji: Emojis.RainbowSheep })
        ));
    }

    public async chatInputUnset(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply({ flags: MessageFlags.Ephemeral });

        const t = await fetchT(interaction);
        const key = interaction.options.getString('key', true) as SettingKey;
        const removed = await removeSetting(interaction.guild!.id, key);

        if (!removed) {
            await interactionManager.edit(t('commands:setup.subcommand.unset.notSet', {
                emoji: '🤔',
                key,
            }));

            return;
        }

        await interactionManager.edit(Components.confirm(
            t('commands:setup.subcommand.unset.confirm', {
                emoji: Emojis.RainbowSheep,
                key,
            })
        ));
    }

    public async chatInputListableRoleAdd(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply({ flags: MessageFlags.Ephemeral });

        const t = await fetchT(interaction);
        const guild = interaction.guild!;
        const role = interaction.options.getRole('role', true) as Role;
        const existing = await this.container.prisma.listableRole.findUnique({
            where: { idGuild_idRole: { idGuild: guild.id, idRole: role.id } },
        });

        if (existing) {
            await interactionManager.edit(t('commands:setup.subcommand.listableRole.add.alreadyConfigured', {
                emoji: '🤔',
                roleName: role.name,
            }));

            return;
        }

        await this.container.prisma.listableRole.create({
            data: { idGuild: guild.id, idRole: role.id },
        });

        await interactionManager.edit(Components.confirm(
            t('commands:setup.subcommand.listableRole.add.confirm', {
                emoji: Emojis.RainbowSheep,
                roleName: role.name,
            })
        ));
    }

    public async chatInputListableRoleRemove(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply({ flags: MessageFlags.Ephemeral });

        const t = await fetchT(interaction);
        const guild = interaction.guild!;
        const role = interaction.options.getRole('role', true) as Role;

        const existing = await this.container.prisma.listableRole.findUnique({
            where: { idGuild_idRole: { idGuild: guild.id, idRole: role.id } },
        });

        if (!existing) {
            await interactionManager.edit(Components.error(
                t('commands:setup.subcommand.listableRole.remove.notConfigured', {
                    emoji: '❌',
                    roleName: role.name,
                })
            ));

            return;
        }

        await this.container.prisma.listableRole.delete({
            where: { idGuild_idRole: { idGuild: guild.id, idRole: role.id } },
        });

        await interactionManager.edit(Components.confirm(
            t('commands:setup.subcommand.listableRole.remove.confirm', {
                emoji: Emojis.RainbowSheep,
                roleName: role.name,
            })
        ));
    }

    public async chatInputListableRoleList(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply({ flags: MessageFlags.Ephemeral });

        const t = await fetchT(interaction);
        const guild = interaction.guild!;
        const rows = await this.container.prisma.listableRole.findMany({
            where: { idGuild: guild.id },
            orderBy: { idRole: 'asc' },
        });

        if (rows.length === 0) {
            await interactionManager.edit(t('commands:setup.subcommand.listableRole.list.empty', { emoji: '🤷' }));

            return;
        }

        const lines = rows.map(row => `- <@&${row.idRole}>`);
        const heading = t('commands:setup.subcommand.listableRole.list.heading', { emoji: Emojis.RainbowSheep });

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
                    .setName('config')
                    .addChannelOption(option => registerOptionDescriptions(this.name, option
                        .setName(SettingKey.BotLogChannel)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread)
                        .setRequired(false), { subcommand: 'config' }
                    ))
                    .addRoleOption(option => registerOptionDescriptions(this.name, option
                        .setName(SettingKey.NativeLanguageRole)
                        .setRequired(false), { subcommand: 'config' }
                    ))
                    .addChannelOption(option => registerOptionDescriptions(this.name, option
                        .setName(SettingKey.AutoCleanupChannel)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread)
                        .setRequired(false), { subcommand: 'config' }
                    ))
                    .addChannelOption(option => registerOptionDescriptions(this.name, option
                        .setName(SettingKey.WatchlistChannel)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread)
                        .setRequired(false), { subcommand: 'config' }
                    ))
                    .addChannelOption(option => registerOptionDescriptions(this.name, option
                        .setName(SettingKey.ModerationLogChannel)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread)
                        .setRequired(false), { subcommand: 'config' }
                    ))
                    .addStringOption(option => registerOptionDescriptions(this.name, option
                        .setName(SettingKey.PrimaryLocale)
                        .setRequired(false)
                        .addChoices(
                            { name: 'English (US)', value: 'en-US' },
                            { name: 'Français', value: 'fr' }
                        ), { subcommand: 'config' }
                    ))
                    .addRoleOption(option => registerOptionDescriptions(this.name, option
                        .setName(SettingKey.AdminRole)
                        .setRequired(false), { subcommand: 'config' }
                    ))
                    .addRoleOption(option => registerOptionDescriptions(this.name, option
                        .setName(SettingKey.ModeratorRole)
                        .setRequired(false), { subcommand: 'config' }
                    ))
                    .addRoleOption(option => registerOptionDescriptions(this.name, option
                        .setName(SettingKey.HelperRole)
                        .setRequired(false), { subcommand: 'config' }
                    ))
                ))
                .addSubcommand(sub => registerSubcommandDescriptions(this.name, sub
                    .setName('unset')
                    .addStringOption(option => registerOptionDescriptions(this.name, option
                        .setName('key')
                        .setRequired(true)
                        .addChoices(
                            ...Object.values(SettingKey).map(value => ({ name: value, value }))
                        ), { subcommand: 'unset' }
                    ))
                ))
                .addSubcommandGroup(group => registerSubcommandGroupDescriptions(this.name, group
                    .setName(LISTABLE_ROLE_GROUP)
                    .addSubcommand(sub => registerSubcommandDescriptions(this.name, sub
                        .setName('add')
                        .addRoleOption(option => registerOptionDescriptions(this.name, option
                            .setName('role')
                            .setRequired(true), { subcommandGroup: LISTABLE_ROLE_GROUP, subcommand: 'add' }
                        )), LISTABLE_ROLE_GROUP
                    ))
                    .addSubcommand(sub => registerSubcommandDescriptions(this.name, sub
                        .setName('remove')
                        .addRoleOption(option => registerOptionDescriptions(this.name, option
                            .setName('role')
                            .setRequired(true), { subcommandGroup: LISTABLE_ROLE_GROUP, subcommand: 'remove' }
                        )), LISTABLE_ROLE_GROUP
                    ))
                    .addSubcommand(sub => registerSubcommandDescriptions(this.name, sub
                        .setName('list'), LISTABLE_ROLE_GROUP
                    ))
                ))
            )
        );
    }
}
