import { container, Precondition } from '@sapphire/framework';
import {
    ActionRowBuilder,
    CommandInteraction,
    ComponentType,
    ContextMenuCommandInteraction,
    type MessageActionRowComponentBuilder,
    MessageFlags,
    StringSelectMenuBuilder
} from 'discord.js';
import { LanguageEmoji, Languages, multipleT } from '../lib/i18n/LanguageManager.js';
import { Locale } from 'discord-api-types/v10';
import { MINUTE } from '../util/DateTime.js';

export class Localized extends Precondition {
    public override async chatInputRun(interaction: CommandInteraction) {
        return this.checkLocalizationPreference(interaction);
    }

    public override async contextMenuRun(interaction: ContextMenuCommandInteraction) {
        return this.checkLocalizationPreference(interaction);
    }

    private async checkLocalizationPreference(interaction: CommandInteraction) {
        const preference = await this.container.prisma.userPreference.findUnique({
            where: { idUser: interaction.user.id },
        });

        if (preference) {
            return this.ok();
        }

        const locales = [Locale.EnglishUS, Locale.French];
        const localeOptions = Object.keys(Languages).map(locale => ({
            default: false,
            label: Languages[locale as Locale]!,
            value: locale,
        }));

        const localeInput = new StringSelectMenuBuilder().setCustomId('locale-select').addOptions(localeOptions);
        const actionRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(localeInput);
        const title = multipleT(locales, 'preconditions:localized.configuration.title');
        const text = multipleT(locales, 'preconditions:localized.configuration.text', '\n', true);

        const interactionResponse = await interaction.reply({
            content: `## ${title}\n${text}`,
            components: [actionRow],
            flags: MessageFlags.Ephemeral,
        });

        const selection = await interactionResponse.awaitMessageComponent({
            componentType: ComponentType.StringSelect,
            time: 10 * MINUTE,
            filter: component => component.customId === 'locale-select',
        });

        const [selectedLocale] = selection.values;
        const t = container.i18n.getT(selectedLocale);
        const confirmText = t(
            'preconditions:localized.configuration.confirm',
            { emoji: LanguageEmoji[selectedLocale as Locale]!() }
        );

        await interaction.editReply({
            content: `## ${title}\n${confirmText}`,
            components: [],
        });

        await this.container.prisma.userPreference.create({
            data: { idUser: interaction.user.id, locale: selectedLocale },
        });

        return this.ok();
    }
}
