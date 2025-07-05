import type { ChatInputCommandInteraction } from 'discord.js';
import { MessageFlags } from 'discord.js';
import { ApplicationCommandRegistry, Command } from '@sapphire/framework';
import {
    LanguageEmoji,
    Languages,
    registerCommandDescriptions,
    registerOptionDescriptions,
} from '../../lib/i18n/LanguageManager.js';
import { Locale } from 'discord-api-types/v10';

export default class extends Command {
    public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const selectedLocale = interaction.options.getString('locale', true);
        const t = this.container.i18n.getT(selectedLocale);
        const title = t('commands:language.confirm.title');
        const text = t('commands:language.confirm.text', { emoji: LanguageEmoji[selectedLocale as Locale] });

        await this.container.prisma.userPreference.upsert({
            create: { idUser: interaction.user.id, locale: selectedLocale },
            update: { locale: selectedLocale },
            where: { idUser: interaction.user.id },
        });

        await interaction.editReply({ content: `## ${title}\n${text}` });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(command =>
            registerCommandDescriptions(command
                .setName(this.name)
                .addStringOption(option => registerOptionDescriptions(this.name, option
                    .setName('locale')
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
