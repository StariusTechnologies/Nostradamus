import {
    ActionRowBuilder,
    type AutocompleteInteraction,
    ButtonBuilder,
    ButtonStyle,
    type ChatInputCommandInteraction,
    ComponentType,
    ContainerBuilder,
    escapeMarkdown,
    type GuildMember,
    type MessageActionRowComponentBuilder,
    type Message,
    type Role,
    SeparatorBuilder,
    TextDisplayBuilder
} from 'discord.js';
import { InteractionContextType, MessageFlags } from 'discord-api-types/v10';
import { type ApplicationCommandRegistry } from '@sapphire/framework';
import { fetchT } from '@sapphire/plugin-i18next';
import { type TFunction } from 'i18next';
import { LocalizedCommand } from '../../lib/i18n/LocalizedCommand.js';
import { registerCommandDescriptions, registerOptionDescriptions } from '../../lib/i18n/LanguageManager.js';
import { InteractionManager } from '../../lib/InteractionManager.js';
import { Components } from '../../lib/Components.js';
import { Emojis } from '../../util/Emojis.js';
import { MINUTE } from '../../util/DateTime.js';

const PAGE_SIZE = 25;
const COLLECTOR_TIMEOUT = 10 * MINUTE;
const PREV_BUTTON_ID = 'hasrole-prev';
const NEXT_BUTTON_ID = 'hasrole-next';

export default class extends LocalizedCommand {
    public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply({ flags: MessageFlags.Ephemeral });

        const t = await fetchT(interaction);
        const guild = interaction.guild!;
        const roleId = interaction.options.getString('role', true);
        const listable = await this.container.prisma.listableRole.findUnique({
            where: { idGuild_idRole: { idGuild: guild.id, idRole: roleId } },
        });

        if (!listable) {
            await interactionManager.edit(Components.error(
                t('commands:hasrole.error.notListable', { emoji: '❌' })
            ));

            return;
        }

        const role = guild.roles.cache.get(roleId);

        if (!role) {
            await interactionManager.edit(Components.error(
                t('commands:hasrole.error.noRole', { emoji: '❌' })
            ));

            return;
        }

        const members = [...role.members.values()]
            .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));

        if (members.length === 0) {
            await interactionManager.edit(t('commands:hasrole.empty', {
                emoji: '🤷',
                roleName: `<@&${role.id}>`,
            }));

            return;
        }

        let currentPage = 0;
        const totalPages = Math.ceil(members.length / PAGE_SIZE);
        const render = (page: number, disabled = false): ContainerBuilder =>
            this.buildPageContainer(t, role, members, page, totalPages, disabled);

        const message = await interactionManager.edit({
            components: [render(currentPage)],
            allowedMentions: { parse: [] },
        }) as Message;

        if (totalPages === 1) {
            return;
        }

        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: COLLECTOR_TIMEOUT,
            filter: component =>
                (component.customId === PREV_BUTTON_ID || component.customId === NEXT_BUTTON_ID)
                && component.user.id === interaction.user.id,
        });

        collector.on('collect', async component => {
            if (component.customId === PREV_BUTTON_ID) {
                currentPage = Math.max(0, currentPage - 1);
            } else {
                currentPage = Math.min(totalPages - 1, currentPage + 1);
            }

            await component.deferUpdate();
            await interactionManager.edit({
                components: [render(currentPage)],
                allowedMentions: { parse: [] },
            });
        });

        collector.on('end', async () => {
            await interactionManager.edit({
                components: [render(currentPage, true)],
                allowedMentions: { parse: [] },
            }).catch(() => null);
        });
    }

    public override async autocompleteRun(interaction: AutocompleteInteraction): Promise<void> {
        const focused = interaction.options.getFocused(true);

        if (focused.name !== 'role') {
            await interaction.respond([]);

            return;
        }

        const { guild } = interaction;

        if (!guild) {
            await interaction.respond([]);

            return;
        }

        const configured = await this.container.prisma.listableRole.findMany({
            where: { idGuild: guild.id },
        });
        const search = focused.value.toLowerCase();
        const matches = configured
            .map(row => guild.roles.cache.get(row.idRole))
            .filter((role): role is Role => Boolean(role))
            .filter(role => role.name.toLowerCase().includes(search))
            .slice(0, 25)
            .map(role => ({ name: role.name, value: role.id }));

        await interaction.respond(matches);
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry): void {
        registry.registerChatInputCommand(command =>
            registerCommandDescriptions(command
                .setName(this.name)
                .setContexts(InteractionContextType.Guild)
                .addStringOption(option => registerOptionDescriptions(this.name, option
                    .setName('role')
                    .setAutocomplete(true)
                    .setRequired(true)
                ))
            )
        );
    }

    private buildPageContainer(
        t: TFunction,
        role: Role,
        members: GuildMember[],
        page: number,
        totalPages: number,
        buttonsDisabled = false
    ): ContainerBuilder {
        const start = page * PAGE_SIZE;
        const slice = members.slice(start, start + PAGE_SIZE);
        const heading = t('commands:hasrole.heading', {
            emoji: Emojis.RainbowSheep,
            count: members.length,
            roleName: `<@&${role.id}>`,
        });
        const headingDisplay = new TextDisplayBuilder().setContent(`## ${heading}`);
        const list = slice.map(member => {
            const displayName = escapeMarkdown(member.displayName);
            const username = escapeMarkdown(member.user.username);

            return `- <@${member.id}> ${displayName} (${username})`;
        }).join('\n');
        const listDisplay = new TextDisplayBuilder().setContent(list);
        const container = new ContainerBuilder()
            .addTextDisplayComponents(headingDisplay)
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(listDisplay);

        if (totalPages > 1) {
            const prev = new ButtonBuilder()
                .setCustomId(PREV_BUTTON_ID)
                .setStyle(ButtonStyle.Secondary)
                .setLabel(t('commands:hasrole.previous'))
                .setDisabled(buttonsDisabled || page === 0);
            const next = new ButtonBuilder()
                .setCustomId(NEXT_BUTTON_ID)
                .setStyle(ButtonStyle.Secondary)
                .setLabel(t('commands:hasrole.next'))
                .setDisabled(buttonsDisabled || page === totalPages - 1);
            const actionRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(prev, next);
            const pageInfo = t('commands:hasrole.pageInfo', { current: page + 1, total: totalPages });

            container
                .addSeparatorComponents(new SeparatorBuilder())
                .addActionRowComponents(actionRow)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${pageInfo}`));
        }

        return container;
    }
}
