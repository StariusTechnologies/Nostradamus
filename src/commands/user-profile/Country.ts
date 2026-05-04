import type { ChatInputCommandInteraction } from 'discord.js';
import { AutocompleteInteraction, MessageFlags } from 'discord.js';
import { ApplicationCommandRegistry } from '@sapphire/framework';
import { registerCommandDescriptions, registerOptionDescriptions } from '../../lib/i18n/LanguageManager.js';
import { fetchT } from '@sapphire/plugin-i18next';
import { Emojis } from '../../util/Emojis.js';
import { LocalizedCommand } from '../../lib/i18n/LocalizedCommand.js';
import { InteractionManager } from '../../lib/InteractionManager.js';
import { Components } from '../../lib/Components.js';
import { InteractionContextType } from 'discord-api-types/v10';
import { error } from '../../lib/Logger.js';

export default class extends LocalizedCommand {
    public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply({ flags: MessageFlags.Ephemeral });

        const t = await fetchT(interaction);
        const guild = interaction.guild!;
        const selectedRoleId = interaction.options.getString('country', true);
        const member = await guild.members.fetch(interaction.user.id).catch(() => null);

        if (!member) {
            error(guild.id, `Could not retrieve member ${interaction.user.id}`, this.logFooter);
            await interactionManager.edit(Components.error(
                t('commands:country.error.noMember', { emoji: '❌' })
            ));

            return;
        }

        const role = guild.roles.cache.get(selectedRoleId);

        if (!role) {
            await interactionManager.edit(Components.error(
                t('commands:country.error.noRole', { emoji: '❌' })
            ));

            return;
        }

        if (member.roles.cache.has(role.id)) {
            try {
                await member.roles.remove(role);
            } catch (err) {
                error(
                    guild.id,
                    `Could not remove country role for ${member.id}: ${err}`,
                    this.logFooter
                );

                this.container.logger.error(err);
                await interactionManager.edit(Components.error(
                    t('commands:country.error.couldNotRemoveCountryRole', { emoji: '❌' })
                ));

                return;
            }

            await interactionManager.edit(Components.confirm(
                t('commands:country.confirm.removed', { emoji: Emojis.RainbowSheep, roleName: role.name })
            ));

            return;
        }

        const otherCountryRoles = await this.container.prisma.country.findMany({
            where: {
                idGuild: guild.id,
                idRole: { in: [...member.roles.cache.values()].map(role => role.id) },
            },
        });

        if (otherCountryRoles.length > 0) {
            try {
                await member.roles.remove(otherCountryRoles.map(entry => entry.idRole));
            } catch (err) {
                error(
                    guild.id,
                    `Could not remove other country roles for ${member.id}: ${err}`,
                    this.logFooter
                );

                this.container.logger.error(err);
                await interactionManager.edit(Components.error(
                    t('commands:country.error.couldNotRemoveOtherCountryRoles', { emoji: '❌' })
                ));

                return;
            }
        }

        try {
            await member.roles.add(role);
        } catch (err) {
            error(
                guild.id,
                `Could not add country role for ${member.id}: ${err}`,
                this.logFooter
            );

            this.container.logger.error(err);
            await interactionManager.edit(Components.error(
                t('commands:country.error.couldNotAddRole', { emoji: '❌' })
            ));

            return;
        }

        await interactionManager.edit(Components.confirm(
            t('commands:country.confirm.newRole', { emoji: Emojis.RainbowSheep, roleName: role.name })
        ));
    }

    public override async autocompleteRun(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name !== 'country') {
            return interaction.respond([]);
        }

        const results = await this.container.prisma.country.findMany({
            where: {
                AND: [
                    { OR: [
                        { frName: { contains: focusedOption.value.toLowerCase() } },
                        { enName: { contains: focusedOption.value.toLowerCase() } },
                        { aliases: { some: { alias: { contains: focusedOption.value.toLowerCase() } } } },
                    ] },
                    { idGuild: interaction.guildId! },
                ],
            },
            take: 25,
        });

        const autocompleteResult = results.map(result => ({
            name: `${result.frName} / ${result.enName}`,
            value: result.idRole,
        }));

        return interaction.respond(autocompleteResult);
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(command =>
            registerCommandDescriptions(command
                .setName(this.name)
                .setContexts(InteractionContextType.Guild)
                .addStringOption(option => registerOptionDescriptions(this.name, option
                    .setName('country')
                    .setAutocomplete(true)
                    .setRequired(true)
                ))
            )
        );
    }
}
