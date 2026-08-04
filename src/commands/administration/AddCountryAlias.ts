import type { ChatInputCommandInteraction } from 'discord.js';
import { AutocompleteInteraction, MessageFlags } from 'discord.js';
import { ApplicationCommandRegistry } from '@sapphire/framework';
import { fetchT } from '@sapphire/plugin-i18next';
import { InteractionContextType } from 'discord-api-types/v10';
import { registerCommandDescriptions, registerOptionDescriptions } from '../../lib/i18n/LanguageManager.js';
import { Emojis } from '../../util/Emojis.js';
import { LocalizedCommand } from '../../lib/i18n/LocalizedCommand.js';
import { InteractionManager } from '../../lib/InteractionManager.js';
import { Components } from '../../lib/Components.js';

export default class extends LocalizedCommand {
    public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply({ flags: MessageFlags.Ephemeral });

        const t = await fetchT(interaction);
        const guild = interaction.guild!;
        const selectedRoleId = interaction.options.getString('country', true);
        const alias = interaction.options.getString('alias', true);
        const role = guild.roles.cache.get(selectedRoleId);

        if (!role) {
            await interactionManager.edit(Components.error(
                t('commands:addcountryalias.error.noRole', { emoji: '❌' })
            ));

            return;
        }

        const countryEntry = await this.container.prisma.country.findUnique({ where: { idRole: role.id } });

        if (!countryEntry) {
            await interactionManager.edit(Components.error(
                t('commands:addcountryalias.error.noEntry', { emoji: '❌' })
            ));

            return;
        }

        await this.container.prisma.countryAlias.create({
            data: { idCountry: countryEntry.id, alias },
        });

        await interactionManager.edit(Components.confirm(
            t('commands:addcountryalias.confirm', { emoji: Emojis.RainbowSheep, role: `<@&${role.id}>` })
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
                .setDefaultMemberPermissions(0)
                .setContexts(InteractionContextType.Guild)
                .addStringOption(option => registerOptionDescriptions(this.name, option
                    .setName('country')
                    .setAutocomplete(true)
                    .setRequired(true)
                ))
                .addStringOption(option => registerOptionDescriptions(this.name, option
                    .setName('alias')
                    .setRequired(true)
                ))
            )
        );
    }
}
