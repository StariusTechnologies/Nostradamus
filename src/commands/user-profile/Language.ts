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
import { getSetting, SettingKey } from '../../lib/Settings.js';

export default class extends LocalizedCommand {
    public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply({ flags: MessageFlags.Ephemeral });

        const t = await fetchT(interaction);
        const guild = interaction.guild!;
        const selectedRoleId = interaction.options.getString('language', true);
        const nativeLanguageRoleId = await getSetting(guild.id, SettingKey.NativeLanguageRole);
        const nativeLanguageRole = nativeLanguageRoleId ? guild.roles.cache.get(nativeLanguageRoleId) : null;

        if (!nativeLanguageRole) {
            error(
                guild.id,
                `Could not retrieve the native language role ${nativeLanguageRoleId}`,
                this.logFooter
            );

            await interactionManager.edit(Components.error(
                t('commands:language.error.noNativeLanguageRole', { emoji: '❌' })
            ));

            return;
        }

        if (selectedRoleId === nativeLanguageRole.id) {
            await interactionManager.edit(Components.error(t(
                'commands:language.error.nativeLanguageRole',
                { emoji: '❌', roleName: nativeLanguageRole.name }
            )));

            return;
        }

        const member = await guild.members.fetch(interaction.user.id).catch(() => null);

        if (!member) {
            error(guild.id, `Could not retrieve member ${interaction.user.id}`, this.logFooter);
            await interactionManager.edit(Components.error(
                t('commands:language.error.noMember', { emoji: '❌' })
            ));

            return;
        }

        if (member.roles.cache.has(nativeLanguageRole.id)) {
            await interactionManager.edit(Components.error(t(
                'commands:language.error.hasNativeLanguageRole',
                { emoji: '❌', roleName: nativeLanguageRole.name }
            )));

            return;
        }

        const role = guild.roles.cache.get(selectedRoleId);

        if (!role) {
            await interactionManager.edit(Components.error(
                t('commands:language.error.noRole', { emoji: '❌' })
            ));

            return;
        }

        if (member.roles.cache.has(role.id)) {
            try {
                await member.roles.remove(role);
            } catch (err) {
                error(
                    guild.id,
                    `Could not remove native language role for ${member.id}: ${err}`,
                    this.logFooter
                );

                this.container.logger.error(err);
                await interactionManager.edit(Components.error(
                    t('commands:language.error.couldNotRemoveNativeRole', { emoji: '❌' })
                ));

                return;
            }

            await interactionManager.edit(Components.confirm(
                t('commands:language.confirm.removed', { emoji: Emojis.RainbowSheep, roleName: role.name })
            ));

            return;
        }

        const otherNativeLanguageRoles = await this.container.prisma.language.findMany({
            where: {
                idGuild: guild.id,
                idRole: { in: [...member.roles.cache.values()].map(role => role.id) },
            },
        });

        if (otherNativeLanguageRoles.length > 0) {
            try {
                await member.roles.remove(otherNativeLanguageRoles.map(entry => entry.idRole));
            } catch (err) {
                error(
                    guild.id,
                    `Could not remove other native language roles for ${member.id}: ${err}`,
                    this.logFooter
                );

                this.container.logger.error(err);
                await interactionManager.edit(Components.error(
                    t('commands:language.error.couldNotRemoveOtherNativeRoles', { emoji: '❌' })
                ));

                return;
            }
        }

        try {
            await member.roles.add(role);
        } catch (err) {
            error(
                guild.id,
                `Could not add native language role for ${member.id}: ${err}`,
                this.logFooter
            );

            this.container.logger.error(err);
            await interactionManager.edit(Components.error(
                t('commands:language.error.couldNotAddRole', { emoji: '❌' })
            ));

            return;
        }

        await interactionManager.edit(Components.confirm(
            t('commands:language.confirm.newRole', { emoji: Emojis.RainbowSheep, roleName: role.name })
        ));
    }

    public override async autocompleteRun(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name !== 'language') {
            return interaction.respond([]);
        }

        const results = await this.container.prisma.language.findMany({
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
                    .setName('language')
                    .setAutocomplete(true)
                    .setRequired(true)
                ))
            )
        );
    }
}
