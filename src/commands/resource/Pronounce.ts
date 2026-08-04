import {
    type ChatInputCommandInteraction,
    ContainerBuilder,
    type Guild,
    type Message,
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
    registerCommandDescriptions,
    registerOptionDescriptions
} from '../../lib/i18n/LanguageManager.js';
import { InteractionManager } from '../../lib/InteractionManager.js';
import { Components } from '../../lib/Components.js';
import { Colors } from '../../util/Colors.js';
import { DEFAULT_PRIMARY_LOCALE, getSetting, SettingKey } from '../../lib/Settings.js';
import { SECOND } from '../../util/DateTime.js';

const COMMAND_NAME = 'pronounce';
const REQUEST_TIMEOUT = 5 * SECOND;

type LangConfig = {
    code: string,
    youglish: string,
};

const LANG_CONFIG: Record<string, LangConfig> = {
    'en-US': { code: 'en', youglish: 'english' },
    fr: { code: 'fr', youglish: 'french' },
};

type SiteResult = {
    label: string,
    url: string | null,
    unchecked: boolean,
};

export default class extends LocalizedCommand {
    public constructor(context: SapphireCommand.LoaderContext, options?: SapphireCommand.Options) {
        super(context, {
            ...options,
            name: COMMAND_NAME,
            aliases: ['pronunciation', 'prononce', 'prononciation'],
        });
    }

    public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply();

        const t = await fetchT(interaction);
        const guild = interaction.guild!;
        const word = interaction.options.getString('word', true).trim();

        if (word.length === 0) {
            await interactionManager.edit(Components.error(t('commands:pronounce.error.empty', { emoji: '❌' })));

            return;
        }

        const results = await this.lookup(guild, t, word);

        await interactionManager.edit({
            components: [this.buildContainer(t, word, results)],
            allowedMentions: { parse: [] },
        });
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
        const results = await this.lookup(message.guild, t, word);

        await message.reply({
            components: [this.buildContainer(t, word, results)],
            allowedMentions: { parse: [] },
            flags: MessageFlags.IsComponentsV2,
        }).catch(() => null);
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry): void {
        registry.registerChatInputCommand(command =>
            registerCommandDescriptions(command
                .setName(this.name)
                .setContexts(InteractionContextType.Guild)
                .addStringOption(option => registerOptionDescriptions(this.name, option
                    .setName('word')
                    .setRequired(true)
                ))
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

    private async lookup(guild: Guild, t: TFunction, word: string): Promise<SiteResult[]> {
        const guildLocale = await getSetting(guild.id, SettingKey.PrimaryLocale) ?? DEFAULT_PRIMARY_LOCALE;
        const lang = LANG_CONFIG[guildLocale] ?? LANG_CONFIG[DEFAULT_PRIMARY_LOCALE];
        const encoded = encodeURIComponent(word);
        const encodedUnderscored = encodeURIComponent(word.replace(/\s+/gu, '_'));
        const sectionWord = t('commands:pronounce.wiktionarySection');
        const forvoUrl = `https://forvo.com/word/${encoded}/#${lang.code}`;
        const youglishCandidate = `https://youglish.com/pronounce/${encoded}/${lang.youglish}`;
        const youglishFallback = `https://youglish.com/pronounce/${encodedUnderscored}/${lang.youglish}`;
        const wiktionaryCandidate = `https://${lang.code}.wiktionary.org/wiki/${encoded}#${encodeURIComponent(sectionWord)}`;
        const wiktionaryFallback = `https://${lang.code}.wiktionary.org/wiki/${encodedUnderscored}#${encodeURIComponent(sectionWord)}`;
        const [youglishResult, wiktionaryResult] = await Promise.all([
            this.checkWithFallback(youglishCandidate, youglishFallback, 'https://youglish.com'),
            this.checkWithFallback(wiktionaryCandidate, wiktionaryFallback, `https://${lang.code}.wiktionary.org`),
        ]);

        return [
            { label: 'Forvo', url: forvoUrl, unchecked: true },
            { label: 'Youglish', url: youglishResult, unchecked: false },
            { label: 'Wiktionary', url: wiktionaryResult, unchecked: false },
        ];
    }

    private async checkWithFallback(primary: string, fallback: string, baseUri: string): Promise<string | null> {
        const first = await this.checkEndpoint(primary, baseUri);

        if (first) {
            return first;
        }

        if (primary === fallback) {
            return null;
        }

        return this.checkEndpoint(fallback, baseUri);
    }

    private async checkEndpoint(url: string, baseUri: string): Promise<string | null> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

        try {
            const response = await fetch(url, {
                redirect: 'follow',
                signal: controller.signal,
                headers: { 'User-Agent': 'Nostradamus/5 (https://lily.expert)' },
            });

            if (!response.ok) {
                return null;
            }

            const finalUrl = new URL(response.url);
            const baseUrl = new URL(baseUri);

            if (finalUrl.hostname !== baseUrl.hostname) {
                return null;
            }

            if (finalUrl.pathname === '/' || finalUrl.pathname === baseUrl.pathname) {
                return null;
            }

            return url;
        } catch {
            return null;
        } finally {
            clearTimeout(timeout);
        }
    }

    private buildContainer(t: TFunction, word: string, results: SiteResult[]): ContainerBuilder {
        const heading = t('commands:pronounce.heading', { word });
        const noResult = t('commands:pronounce.noResult');
        const noCheck = t('commands:pronounce.noCheck');
        const disclaimer = t('commands:pronounce.disclaimer');
        const container = new ContainerBuilder()
            .setAccentColor(Colors.Info)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${heading}`));

        for (const result of results) {
            const lines: string[] = [`**${result.label}**`];

            if (result.url) {
                lines.push(result.url);

                if (result.unchecked) {
                    lines.push(`-# ${noCheck}`);
                }
            } else {
                lines.push(`-# ${noResult}`);
            }

            container
                .addSeparatorComponents(new SeparatorBuilder())
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
        }

        container
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${disclaimer}`));

        return container;
    }
}
