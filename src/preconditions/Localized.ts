import { container, Precondition } from '@sapphire/framework';
import {
    ActionRowBuilder,
    CommandInteraction,
    ComponentType,
    ContextMenuCommandInteraction,
    type MessageActionRowComponentBuilder,
    MessageFlags,
    StringSelectMenuBuilder,
    type StringSelectMenuInteraction,
    TextDisplayBuilder,
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

    public override messageRun() {
        return this.ok();
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
        const titleDisplay = new TextDisplayBuilder().setContent(`## ${title}\n${text}`);

        const interactionResponse = await interaction.reply({
            components: [titleDisplay, actionRow],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });

        let selection: StringSelectMenuInteraction;

        try {
            selection = await interactionResponse.awaitMessageComponent({
                componentType: ComponentType.StringSelect,
                time: 10 * MINUTE,
                filter: component => component.customId === 'locale-select',
            });
        } catch {
            const timeoutText = multipleT(locales, 'preconditions:localized.configuration.timeout', '\n', true);

            await interaction.editReply({
                components: [new TextDisplayBuilder().setContent(`## ${title}\n${timeoutText}`)],
            });

            return this.error({ message: 'No locale was selected before the prompt expired.' });
        }

        const [selectedLocale] = selection.values;
        const t = container.i18n.getT(selectedLocale);
        const confirmText = t(
            'preconditions:localized.configuration.confirm',
            { emoji: LanguageEmoji[selectedLocale as Locale]!() },
        );

        const confirmDisplay = new TextDisplayBuilder().setContent(`## ${title}\n${confirmText}`);

        await interaction.editReply({
            components: [confirmDisplay],
        });

        await this.container.prisma.userPreference.upsert({
            where: { idUser: interaction.user.id },
            create: { idUser: interaction.user.id, locale: selectedLocale },
            update: { locale: selectedLocale },
        });

        return this.ok();
    }
}
