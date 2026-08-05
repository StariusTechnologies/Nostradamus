import {
    ActionRowBuilder,
    type AutocompleteInteraction,
    ButtonBuilder,
    ButtonStyle,
    type ChatInputCommandInteraction,
    ComponentType,
    ContainerBuilder,
    escapeMarkdown,
    type Message,
    type MessageActionRowComponentBuilder,
    SeparatorBuilder,
    TextDisplayBuilder
} from 'discord.js';
import { InteractionContextType, MessageFlags } from 'discord-api-types/v10';
import {
    type ApplicationCommandRegistry,
    type Args,
    Command as SapphireCommand,
    container as sapphireContainer
} from '@sapphire/framework';
import { fetchT } from '@sapphire/plugin-i18next';
import { type TFunction } from 'i18next';
import { LocalizedCommand } from '../../lib/i18n/LocalizedCommand.js';
import {
    Languages,
    registerCommandDescriptions,
    registerOptionDescriptions
} from '../../lib/i18n/LanguageManager.js';
import { InteractionManager } from '../../lib/InteractionManager.js';
import { Components } from '../../lib/Components.js';
import { Colors } from '../../util/Colors.js';
import { DEFAULT_PRIMARY_LOCALE, getSetting, SettingKey } from '../../lib/Settings.js';
import { MINUTE } from '../../util/DateTime.js';
import {
    BOLD_MARKER,
    editionFromLocale,
    editionLanguageName,
    searchUrl,
    Wiktionary,
    type WiktionaryEntry,
    type WiktionaryPage,
    type WiktionarySense
} from '../../lib/Wiktionary.js';

const COMMAND_NAME = 'def';
const COLLECTOR_TIMEOUT = 10 * MINUTE;
const PREVIOUS_BUTTON_ID = 'def-previous';
const NEXT_BUTTON_ID = 'def-next';
const EXAMPLES_BUTTON_ID = 'def-examples';
const BUTTON_IDS: string[] = [PREVIOUS_BUTTON_ID, NEXT_BUTTON_ID, EXAMPLES_BUTTON_ID];
const PAGE_BUDGET = 3000;
const EXAMPLE_BUDGET = 3400;
const TEXT_MAX_LENGTH = 400;
const MAX_SENSE_DEPTH = 2;
const AUTOCOMPLETE_LIMIT = 25;
const CHOICE_MAX_LENGTH = 100;

const EDITION_CHOICES: { name: string, value: string }[] = Object.entries(Languages)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .map(([locale, label]) => ({ name: label, value: editionFromLocale(locale) }));

type ExampleGroup = {
    label: string,
    examples: string[],
};

// One screenful of the entry, plus the parts of speech it covers so the examples button can answer
// for whatever is currently on display.
type RenderedPage = {
    lines: string[],
    entries: WiktionaryEntry[],
};

// Both entry points render the same paginated container: the slash command edits its deferred reply,
// the prefix command edits the message it replied with.
type Presenter = {
    send: (components: ContainerBuilder[]) => Promise<Message>,
    update: (target: Message, components: ContainerBuilder[]) => Promise<unknown>,
};

function truncate(text: string, maxLength: number): string {
    return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

// Wiktionary marks the looked-up word inside its text, which survives as a sentinel through parsing.
// Emphasis is applied after escaping so the asterisks live through it, whitespace is pushed out of the
// emphasis because Discord renders no bold when it hugs the markers, and a marker left unpaired by
// truncation simply closes at the end of the text.
function formatText(text: string): string {
    const parts = escapeMarkdown(truncate(text, TEXT_MAX_LENGTH)).split(BOLD_MARKER);
    let [result] = parts;

    for (let index = 1; index < parts.length; index += 2) {
        const emphasis = parts[index];
        const rest = parts[index + 1] ?? '';
        const [leading] = /^\s*/u.exec(emphasis)!;
        const [trailing] = /\s*$/u.exec(emphasis)!;
        const core = emphasis.slice(leading.length, emphasis.length - trailing.length);

        result += core.length === 0 ? emphasis + rest : `${leading}**${core}**${trailing}${rest}`;
    }

    // Whitespace pushed out of an emphasis can end up doubled against what already followed it.
    return result.replace(/ {2,}/gu, ' ');
}

export default class extends LocalizedCommand {
    public constructor(context: SapphireCommand.LoaderContext, options?: SapphireCommand.Options) {
        super(context, {
            ...options,
            name: COMMAND_NAME,
            aliases: ['define', 'definition', 'définition', 'defi'],
        });
    }

    public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply();

        const t = await fetchT(interaction);
        const word = interaction.options.getString('word', true).trim();
        const presenter: Presenter = {
            send: async components => await interactionManager.edit({
                components,
                allowedMentions: { parse: [] },
            }) as Message,
            update: async (_target, components) => interactionManager.edit({
                components,
                allowedMentions: { parse: [] },
            }),
        };

        await this.lookupAndPresent(
            t,
            interaction.guildId!,
            word,
            interaction.options.getString('language'),
            interaction.user.id,
            presenter
        );
    }

    public override async messageRun(message: Message, args: Args): Promise<void> {
        if (!message.inGuild()) {
            return;
        }

        const word = (await args.rest('string').catch(() => null))?.trim();

        if (!word) {
            return;
        }

        const t = await this.resolveTranslator(message);
        const presenter: Presenter = {
            send: components => message.reply({
                components,
                allowedMentions: { parse: [] },
                flags: MessageFlags.IsComponentsV2,
            }),
            update: (target, components) => target.edit({
                components,
                allowedMentions: { parse: [] },
                flags: MessageFlags.IsComponentsV2,
            }),
        };

        await this.lookupAndPresent(t, message.guild.id, word, null, message.author.id, presenter);
    }

    public override async autocompleteRun(interaction: AutocompleteInteraction): Promise<void> {
        const focused = interaction.options.getFocused(true);

        if (focused.name !== 'word' || focused.value.trim().length === 0) {
            await interaction.respond([]);

            return;
        }

        const edition = await this.resolveEdition(interaction.guildId, interaction.options.getString('language'));
        const suggestions = await Wiktionary.suggest(edition, focused.value.trim());

        // The value has to stay the exact page title, so over-long ones are dropped rather than cut short.
        await interaction.respond(suggestions
            .filter(title => title.length <= CHOICE_MAX_LENGTH)
            .slice(0, AUTOCOMPLETE_LIMIT)
            .map(title => ({ name: title, value: title })));
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry): void {
        registry.registerChatInputCommand(command =>
            registerCommandDescriptions(command
                .setName(this.name)
                .setContexts(InteractionContextType.Guild)
                .addStringOption(option => registerOptionDescriptions(this.name, option
                    .setName('word')
                    .setAutocomplete(true)
                    .setRequired(true)
                ))
                .addStringOption(option => registerOptionDescriptions(this.name, option
                    .setName('language')
                    .setRequired(false)
                ).addChoices(...EDITION_CHOICES))
            )
        );
    }

    private async resolveTranslator(message: Message<true>): Promise<TFunction> {
        const preference = await this.container.prisma.userPreference.findUnique({
            where: { idUser: message.author.id },
        });
        const locale = preference?.locale
            ?? await getSetting(message.guild.id, SettingKey.PrimaryLocale)
            ?? DEFAULT_PRIMARY_LOCALE;

        return sapphireContainer.i18n.getT(locale);
    }

    private async resolveEdition(guildId: string | null, override: string | null): Promise<string> {
        if (override) {
            return override;
        }

        const locale = (guildId ? await getSetting(guildId, SettingKey.PrimaryLocale) : null)
            ?? DEFAULT_PRIMARY_LOCALE;

        return editionFromLocale(locale);
    }

    private async lookupAndPresent(
        t: TFunction,
        guildId: string,
        word: string,
        languageOverride: string | null,
        userId: string,
        presenter: Presenter
    ): Promise<void> {
        if (word.length === 0) {
            await presenter.send(Components.error(t('commands:def.error.empty', { emoji: '❌' })).components);

            return;
        }

        const edition = await this.resolveEdition(guildId, languageOverride);
        const lookup = await Wiktionary.lookup(edition, word);

        if (lookup.status === 'error') {
            await presenter.send(Components.error(t('commands:def.error.unavailable', { emoji: '❌' })).components);

            return;
        }

        if (lookup.status === 'missing') {
            await presenter.send(Components.error(t('commands:def.error.missing', {
                emoji: '❌',
                word: escapeMarkdown(word),
                url: searchUrl(edition, word),
            })).components);

            return;
        }

        if (lookup.status === 'empty') {
            await presenter.send(Components.error(t('commands:def.error.noDefinition', {
                emoji: '❌',
                word: escapeMarkdown(lookup.title),
                url: lookup.url,
            })).components);

            return;
        }

        if (lookup.status === 'otherLanguages') {
            await presenter.send(Components.error(t('commands:def.error.otherLanguages', {
                emoji: '❌',
                word: escapeMarkdown(lookup.title),
                language: editionLanguageName(edition),
                languages: lookup.languages.map(language => escapeMarkdown(language)).join(', '),
                url: lookup.url,
            })).components);

            return;
        }

        await this.present(t, lookup.page, userId, presenter);
    }

    private async present(
        t: TFunction,
        page: WiktionaryPage,
        userId: string,
        presenter: Presenter
    ): Promise<void> {
        const pages = this.paginate(page.entries);
        const render = (index: number, disabled = false): ContainerBuilder =>
            this.buildPageContainer(t, page, pages, index, disabled);
        let currentPage = 0;
        const message = await presenter.send([render(currentPage)]);
        const interactive = pages.length > 1
            || pages.some(rendered => this.collectExamples(rendered.entries).length > 0);

        if (!interactive) {
            return;
        }

        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: COLLECTOR_TIMEOUT,
            filter: component => BUTTON_IDS.includes(component.customId),
        });

        collector.on('collect', async component => {
            try {
                if (component.customId === EXAMPLES_BUTTON_ID) {
                    await component.reply({
                        components: [this.buildExamplesContainer(t, page, pages[currentPage])],
                        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                    });

                    return;
                }

                if (component.user.id !== userId) {
                    await component.reply({
                        components: Components.info(t('commands:def.notYours', {
                            emoji: '🔒',
                            user: `<@${userId}>`,
                        })).components,
                        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                        allowedMentions: { parse: [] },
                    });

                    return;
                }

                currentPage = component.customId === PREVIOUS_BUTTON_ID
                    ? Math.max(0, currentPage - 1)
                    : Math.min(pages.length - 1, currentPage + 1);

                await component.deferUpdate();
                await presenter.update(message, [render(currentPage)]);
            } catch (error) {
                this.container.logger.warn(`Could not handle a ${this.name} button: ${error}`);
            }
        });

        collector.on('end', async () => {
            await presenter.update(message, [render(currentPage, true)]).catch(() => null);
        });
    }

    // Parts of speech are packed into as few pages as Discord's size limit allows. One that does not fit
    // on its own spills onto the next page with its heading repeated, so a page never starts unlabelled.
    private paginate(entries: WiktionaryEntry[]): RenderedPage[] {
        const pages: RenderedPage[] = [];
        let lines: string[] = [];
        let covered: WiktionaryEntry[] = [];
        let used = 0;
        const push = (line: string): void => {
            lines.push(line);
            used += line.length + 1;
        };
        const flush = (): void => {
            if (lines.length > 0) {
                pages.push({ lines, entries: covered });
                lines = [];
                covered = [];
                used = 0;
            }
        };

        for (const entry of entries) {
            const heading = `**${escapeMarkdown(entry.partOfSpeech)}**`;

            if (lines.length > 0) {
                push('');
            }

            push(heading);
            covered.push(entry);

            for (const line of this.renderSenseLines(entry.senses, 0)) {
                if (used + line.length + 1 > PAGE_BUDGET) {
                    flush();
                    push(heading);
                    covered.push(entry);
                }

                push(line);
            }
        }

        flush();

        return pages;
    }

    private renderSenseLines(senses: WiktionarySense[], depth: number): string[] {
        if (depth > MAX_SENSE_DEPTH) {
            return [];
        }

        const lines: string[] = [];
        let position = 0;

        for (const sense of senses) {
            position++;

            if (sense.text.length > 0) {
                const text = formatText(sense.text);

                lines.push(depth === 0 ? `${position}. ${text}` : `${'  '.repeat(depth)}- ${text}`);
            }

            lines.push(...this.renderSenseLines(sense.subSenses, depth + 1));
        }

        return lines;
    }

    private buildPageContainer(
        t: TFunction,
        page: WiktionaryPage,
        pages: RenderedPage[],
        index: number,
        disabled: boolean
    ): ContainerBuilder {
        const heading = t('commands:def.heading', {
            word: escapeMarkdown(page.title),
            language: escapeMarkdown(page.language),
        });
        const container = new ContainerBuilder()
            .setAccentColor(Colors.Info)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${heading}`))
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(pages[index].lines.join('\n').trim()));
        const buttons = this.buildButtons(t, pages, index, disabled);

        if (buttons.length > 0) {
            const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(...buttons);

            container
                .addSeparatorComponents(new SeparatorBuilder())
                .addActionRowComponents(row);
        }

        const footer: string[] = [];

        if (pages.length > 1) {
            footer.push(`-# ${t('commands:def.pageInfo', { current: index + 1, total: pages.length })}`);
        }

        footer.push(`-# ${page.url}`);
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(footer.join('\n')));

        return container;
    }

    private buildButtons(
        t: TFunction,
        pages: RenderedPage[],
        index: number,
        disabled: boolean
    ): ButtonBuilder[] {
        const buttons: ButtonBuilder[] = [];

        if (pages.length > 1) {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(PREVIOUS_BUTTON_ID)
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel(t('commands:def.previous'))
                    .setDisabled(disabled || index === 0),
                new ButtonBuilder()
                    .setCustomId(NEXT_BUTTON_ID)
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel(t('commands:def.next'))
                    .setDisabled(disabled || index === pages.length - 1)
            );
        }

        if (this.collectExamples(pages[index].entries).length > 0) {
            buttons.push(new ButtonBuilder()
                .setCustomId(EXAMPLES_BUTTON_ID)
                .setStyle(ButtonStyle.Primary)
                .setLabel(t('commands:def.examples'))
                .setDisabled(disabled));
        }

        return buttons;
    }

    private buildExamplesContainer(t: TFunction, page: WiktionaryPage, rendered: RenderedPage): ContainerBuilder {
        const groups = this.collectExamples(rendered.entries);
        const heading = t('commands:def.examplesHeading', {
            word: escapeMarkdown(page.title),
            language: escapeMarkdown(page.language),
        });

        if (groups.length === 0) {
            return new ContainerBuilder()
                .setAccentColor(Colors.Info)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    t('commands:def.noExamples', { emoji: '🤷' })
                ));
        }

        const lines: string[] = [];
        let used = 0;
        let truncated = false;

        for (const group of groups) {
            const groupLines = [
                `**${escapeMarkdown(group.label)}**`,
                ...group.examples.map(example => `> ${formatText(example)}`),
            ];

            for (const line of groupLines) {
                if (used + line.length + 1 > EXAMPLE_BUDGET) {
                    truncated = true;

                    break;
                }

                lines.push(line);
                used += line.length + 1;
            }

            if (truncated) {
                break;
            }
        }

        const container = new ContainerBuilder()
            .setAccentColor(Colors.Info)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${heading}`))
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
        const footer: string[] = [];

        if (truncated) {
            footer.push(`-# ${t('commands:def.truncated')}`);
        }

        footer.push(`-# ${page.url}`);
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(footer.join('\n')));

        return container;
    }

    private collectExamples(entries: WiktionaryEntry[]): ExampleGroup[] {
        const groups: ExampleGroup[] = [];

        for (const entry of entries) {
            this.collectSenseExamples(entry.partOfSpeech, entry.senses, [], groups);
        }

        return groups;
    }

    private collectSenseExamples(
        partOfSpeech: string,
        senses: WiktionarySense[],
        path: number[],
        groups: ExampleGroup[]
    ): void {
        let position = 0;

        for (const sense of senses) {
            position++;

            const currentPath = [...path, position];

            if (sense.examples.length > 0) {
                groups.push({
                    label: `${partOfSpeech} · ${currentPath.join('.')}`,
                    examples: sense.examples,
                });
            }

            this.collectSenseExamples(partOfSpeech, sense.subSenses, currentPath, groups);
        }
    }
}
