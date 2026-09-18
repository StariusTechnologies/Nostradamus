import { type ChatInputCommandInteraction, MessageFlags, type TextChannel } from 'discord.js';
import { type ApplicationCommandRegistry } from '@sapphire/framework';
import { InteractionContextType } from 'discord-api-types/v10';
import { fetchT } from '@sapphire/plugin-i18next';
import { LocalizedCommand } from '../../lib/i18n/LocalizedCommand.js';
import {
    registerCommandDescriptions,
    registerOptionDescriptions,
    registerOptionNames,
} from '../../lib/i18n/LanguageManager.js';
import { InteractionManager } from '../../lib/InteractionManager.js';
import { Components } from '../../lib/Components.js';
import { fetchSnippetForReading, sendSnippet, SNIPPET_NAME_MAX_LENGTH } from '../../lib/SnippetService.js';

export default class extends LocalizedCommand {
    public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply({ flags: MessageFlags.Ephemeral });

        const t = await fetchT(interaction);
        const trigger = interaction.options.getString('name', true);
        const member = await interaction.guild?.members.fetch(interaction.user.id);
        const snippet = member ? await fetchSnippetForReading(trigger, interaction.guildId!, member) : null;
        const { channel } = interaction;

        if (!snippet) {
            await interactionManager.edit(Components.error(t('commands:snippet.noSnippet', { emoji: '❌' })));

            return;
        }

        if (!channel || !channel.isTextBased()) {
            await interactionManager.edit(Components.error(t('commands:snippet.invalidChannel', { emoji: '❌' })));

            return;
        }

        await sendSnippet(channel as TextChannel, snippet);
        await interactionManager.edit(Components.confirm(t('commands:snippet.success', { emoji: '✅' })));
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry): void {
        registry.registerChatInputCommand(command =>
            registerCommandDescriptions(command
                .setName(this.name)
                .setContexts(InteractionContextType.Guild)
                .addStringOption(option => registerOptionNames(this.name, registerOptionDescriptions(this.name, option
                    .setName('name')
                    .setMaxLength(SNIPPET_NAME_MAX_LENGTH)
                    .setAutocomplete(true)
                    .setRequired(true),
                ))),
            ),
        );
    }
}
