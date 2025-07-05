import type { SlashCommandBuilder, SlashCommandSubcommandBuilder } from '@discordjs/builders';
import { container } from '@sapphire/framework';
import {
    type SharedNameAndDescription,
    type SlashCommandAttachmentOption,
    type SlashCommandBooleanOption,
    type SlashCommandChannelOption,
    type SlashCommandIntegerOption,
    type SlashCommandMentionableOption,
    type SlashCommandOptionsOnlyBuilder,
    type SlashCommandRoleOption,
    type SlashCommandStringOption,
    type SlashCommandUserOption
} from 'discord.js';
import { Locale, type LocalizationMap } from 'discord-api-types/v10';
import i18next, { type TFunction } from 'i18next';
import { ApplicationCommandOptionBase } from '@discordjs/builders';
import { Emojis } from '../../util/Emojis.js';

export const Languages: Partial<Record<Locale, string>> = {
    [Locale.EnglishUS]: 'English',
    [Locale.French]: 'Français',
} as const;
export const LanguageEmoji: Partial<Record<Locale, string>> = {
    [Locale.EnglishUS]: Emojis.Anglophonie,
    [Locale.French]: Emojis.Francophonie,
}

export const exists = (key: string) =>
    container.i18n.getT(Locale.EnglishUS)(key, { defaultValue: '#MISSING_TRANSLATION#' }) !== '#MISSING_TRANSLATION#';

export function multipleT(locales: Locale[], key: string, glue = ' / ', prependEmojis = false): string {
    const tFunctions = locales
        .filter(locale => Object.keys(Languages).includes(locale))
        .map(locale => ({ t: container.i18n.getT(locale), locale }));
    const translations = tFunctions.map(({ t, locale }: { t: TFunction, locale: Locale }) => {
        const prefix = prependEmojis ? `${LanguageEmoji[locale]} ` : '';

        return `${prefix}${t(key)}`;
    });

    return translations.join(glue);
}

const setDescriptions = (interactivePiece: SharedNameAndDescription, key: string): typeof interactivePiece => {
    return interactivePiece.setDescription(container.i18n.getT(Locale.EnglishUS)(key)).setDescriptionLocalizations(
        Object.keys(Languages).reduce<LocalizationMap>((carry, language) => {
            if (!i18next.exists(key, { lng: language })) {
                return carry;
            }

            carry[language as Locale] = container.i18n.getT(language)(key);

            return carry;
        }, {})
    );
};

export const registerCommandDescriptions = (
    command: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder
): typeof command => {
    if (!command.name) {
        throw new Error('You have to name the command before trying to register its descriptions.');
    }

    return setDescriptions(
        command,
        `commands:${command.name.toLowerCase()}.definition.description`
    ) as typeof command;
};

export function registerOptionDescriptions(
    commandName: string,
    option: SlashCommandAttachmentOption
): typeof option;
export function registerOptionDescriptions(commandName: string, option: SlashCommandBooleanOption): typeof option;
export function registerOptionDescriptions(commandName: string, option: SlashCommandChannelOption): typeof option;
export function registerOptionDescriptions(commandName: string, option: SlashCommandIntegerOption): typeof option;
export function registerOptionDescriptions(
    commandName: string,
    option: SlashCommandMentionableOption
): typeof option;
export function registerOptionDescriptions(commandName: string, option: SlashCommandRoleOption): typeof option;
export function registerOptionDescriptions(commandName: string, option: SlashCommandStringOption): typeof option;
export function registerOptionDescriptions(commandName: string, option: SlashCommandUserOption): typeof option;
export function registerOptionDescriptions(commandName: string, option: ApplicationCommandOptionBase): typeof option {
    if (!option.name) {
        throw new Error('You have to name the option before trying to register its descriptions.');
    }

    return setDescriptions(
        option,
        `commands:${commandName}.definition.options.${option.name.toLowerCase()}.description`
    ) as typeof option;
}

export const registerSubcommandDescriptions = (
    commandName: string,
    subcommand: SlashCommandSubcommandBuilder
): typeof subcommand => {
    if (!subcommand.name) {
        throw new Error('You have to name the subcommand before trying to register its descriptions.');
    }

    return setDescriptions(
        subcommand,
        `commands:${commandName}.definition.subcommand.${subcommand.name.toLowerCase()}.description`
    ) as typeof subcommand;
};
