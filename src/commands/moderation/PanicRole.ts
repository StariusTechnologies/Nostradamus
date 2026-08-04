import { ChatInputCommandInteraction, type Role } from 'discord.js';
import { InteractionContextType, MessageFlags } from 'discord-api-types/v10';
import { type ApplicationCommandRegistry, Command as SapphireCommand } from '@sapphire/framework';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { fetchT } from '@sapphire/plugin-i18next';
import { LocalizedSubcommand } from '../../lib/i18n/LocalizedSubcommand.js';
import {
    registerCommandDescriptions,
    registerOptionDescriptions,
    registerSubcommandDescriptions
} from '../../lib/i18n/LanguageManager.js';
import { InteractionManager } from '../../lib/InteractionManager.js';
import { Components } from '../../lib/Components.js';
import { Emojis } from '../../util/Emojis.js';

const COMMAND_NAME = 'panic-role';

export default class extends LocalizedSubcommand {
    public constructor(context: SapphireCommand.LoaderContext, options: Subcommand.Options) {
        super(context, {
            ...options,
            name: COMMAND_NAME,
            subcommands: [
                { name: 'add', chatInputRun: 'chatInputAdd' },
                { name: 'remove', chatInputRun: 'chatInputRemove' },
                { name: 'list', chatInputRun: 'chatInputList' },
            ],
        });
    }

    public async chatInputAdd(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply({ flags: MessageFlags.Ephemeral });

        const t = await fetchT(interaction);
        const guild = interaction.guild!;
        const role = interaction.options.getRole('role', true) as Role;
        const existing = await this.container.prisma.panicRole.findUnique({
            where: { idGuild_idRole: { idGuild: guild.id, idRole: role.id } },
        });

        if (existing) {
            await interactionManager.edit(t('commands:panic-role.subcommand.add.alreadyConfigured', {
                emoji: '🤔',
                roleName: role.name,
            }));

            return;
        }

        await this.container.prisma.panicRole.create({
            data: { idGuild: guild.id, idRole: role.id },
        });

        await interactionManager.edit(Components.confirm(
            t('commands:panic-role.subcommand.add.confirm', {
                emoji: Emojis.RainbowSheep,
                roleName: role.name,
            })
        ));
    }

    public async chatInputRemove(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply({ flags: MessageFlags.Ephemeral });

        const t = await fetchT(interaction);
        const guild = interaction.guild!;
        const role = interaction.options.getRole('role', true) as Role;
        const existing = await this.container.prisma.panicRole.findUnique({
            where: { idGuild_idRole: { idGuild: guild.id, idRole: role.id } },
        });

        if (!existing) {
            await interactionManager.edit(Components.error(
                t('commands:panic-role.subcommand.remove.notConfigured', {
                    emoji: '❌',
                    roleName: role.name,
                })
            ));

            return;
        }

        await this.container.prisma.panicRole.delete({
            where: { idGuild_idRole: { idGuild: guild.id, idRole: role.id } },
        });

        await interactionManager.edit(Components.confirm(
            t('commands:panic-role.subcommand.remove.confirm', {
                emoji: Emojis.RainbowSheep,
                roleName: role.name,
            })
        ));
    }

    public async chatInputList(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply({ flags: MessageFlags.Ephemeral });

        const t = await fetchT(interaction);
        const guild = interaction.guild!;
        const rows = await this.container.prisma.panicRole.findMany({
            where: { idGuild: guild.id },
            orderBy: { idRole: 'asc' },
        });

        if (rows.length === 0) {
            await interactionManager.edit(t('commands:panic-role.subcommand.list.empty', { emoji: '🤷' }));

            return;
        }

        const lines = rows.map(row => `- <@&${row.idRole}>`);
        const heading = t('commands:panic-role.subcommand.list.heading', { emoji: Emojis.RainbowSheep });

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
                    .setName('add')
                    .addRoleOption(option => registerOptionDescriptions(this.name, option
                        .setName('role')
                        .setRequired(true), { subcommand: 'add' }
                    ))
                ))
                .addSubcommand(sub => registerSubcommandDescriptions(this.name, sub
                    .setName('remove')
                    .addRoleOption(option => registerOptionDescriptions(this.name, option
                        .setName('role')
                        .setRequired(true), { subcommand: 'remove' }
                    ))
                ))
                .addSubcommand(sub => registerSubcommandDescriptions(this.name, sub
                    .setName('list')
                ))
            )
        );
    }
}
