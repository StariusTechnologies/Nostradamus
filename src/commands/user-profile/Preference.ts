import type { ChatInputCommandInteraction } from 'discord.js';
import { MessageFlags } from 'discord.js';
import { Locale } from 'discord-api-types/v10';
import { ApplicationCommandRegistry } from '@sapphire/framework';
import {
    LanguageEmoji,
    Languages,
    registerCommandDescriptions,
    registerOptionDescriptions
} from '../../lib/i18n/LanguageManager.js';
import { Command } from '../../lib/Command.js';
import { InteractionManager } from '../../lib/InteractionManager.js';
import { Components } from '../../lib/Components.js';

export default class extends Command {
    public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply({ flags: MessageFlags.Ephemeral });

        const selectedLocale = interaction.options.getString('language', true);
        const t = this.container.i18n.getT(selectedLocale);
        const title = t('commands:preference.confirm.title');
        const text = t('commands:preference.confirm.text', { emoji: LanguageEmoji[selectedLocale as Locale]!() });

        await this.container.prisma.userPreference.upsert({
            create: { idUser: interaction.user.id, locale: selectedLocale },
            update: { locale: selectedLocale },
            where: { idUser: interaction.user.id },
        });

        await interactionManager.edit(Components.confirm(`## ${title}\n${text}`));
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(command =>
            registerCommandDescriptions(command
                .setName(this.name)
                .addStringOption(option => registerOptionDescriptions(this.name, option
                    .setName('language')
                    .addChoices(Object.keys(Languages).map(locale => ({
                        name: Languages[locale as Locale]!,
                        value: locale,
                    })))
                    .setRequired(true)
                ))
            )
        );
    }
}
