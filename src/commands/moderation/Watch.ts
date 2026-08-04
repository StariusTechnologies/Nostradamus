import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    type ChatInputCommandInteraction,
    ComponentType,
    ContainerBuilder,
    type Message,
    type MessageActionRowComponentBuilder,
    SeparatorBuilder,
    TextDisplayBuilder,
    type User
} from 'discord.js';
import { InteractionContextType, MessageFlags } from 'discord-api-types/v10';
import { type ApplicationCommandRegistry } from '@sapphire/framework';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { fetchT } from '@sapphire/plugin-i18next';
import { type TFunction } from 'i18next';
import type { WatchedMember } from '@prisma/client';
import { LocalizedSubcommand } from '../../lib/i18n/LocalizedSubcommand.js';
import {
    registerCommandDescriptions,
    registerOptionDescriptions,
    registerSubcommandDescriptions
} from '../../lib/i18n/LanguageManager.js';
import { InteractionManager } from '../../lib/InteractionManager.js';
import { Components } from '../../lib/Components.js';
import { Colors } from '../../util/Colors.js';
import { Emojis } from '../../util/Emojis.js';
import { parseDuration, MINUTE, WEEK } from '../../util/DateTime.js';
import { WatchService } from '../../lib/WatchService.js';

const PAGE_SIZE = 5;
const COLLECTOR_TIMEOUT = 10 * MINUTE;
const PREV_BUTTON_ID = 'watch-list-prev';
const NEXT_BUTTON_ID = 'watch-list-next';
const REASON_DISPLAY_LIMIT = 500;
const DEFAULT_DURATION_MS = WEEK;
const PERMANENT_SENTINELS: ReadonlySet<string> = new Set(['0', '-1', 'infinite', 'infini', 'never']);

type ResolvedDuration =
    | { kind: 'temp', ms: number }
    | { kind: 'permanent' }
    | { kind: 'invalid' };

export default class extends LocalizedSubcommand {
    public constructor(context: Subcommand.LoaderContext, options: Subcommand.Options) {
        super(context, {
            ...options,
            subcommands: [
                { name: 'add', chatInputRun: 'chatInputAdd' },
                { name: 'remove', chatInputRun: 'chatInputRemove' },
                { name: 'edit', chatInputRun: 'chatInputEdit' },
                { name: 'info', chatInputRun: 'chatInputInfo' },
                { name: 'list', chatInputRun: 'chatInputList' },
            ],
        });
    }

    public async chatInputAdd(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply({ flags: MessageFlags.Ephemeral });

        const t = await fetchT(interaction);
        const guild = interaction.guild!;
        const user = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason', true);
        const durationInput = interaction.options.getString('duration');
        const resolved = this.resolveDurationOption(durationInput);

        if (resolved.kind === 'invalid') {
            await interactionManager.edit(Components.error(
                t('commands:watch.error.invalidDuration', { emoji: '❌' })
            ));

            return;
        }

        const existing = WatchService.get(guild.id, user.id);

        if (existing) {
            await interactionManager.edit(Components.info(
                t('commands:watch.subcommand.add.alreadyWatched', {
                    emoji: '🤔',
                    user: `<@${user.id}>`,
                    reason: this.truncate(existing.reason, REASON_DISPLAY_LIMIT),
                })
            ));

            return;
        }

        const durationMs = resolved.kind === 'temp' ? resolved.ms : null;

        await WatchService.add(guild.id, user.id, reason, durationMs);

        await interactionManager.edit(Components.confirm(
            this.buildConfirmMessage(t, 'add', user.id, resolved)
        ));
    }

    public async chatInputRemove(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply({ flags: MessageFlags.Ephemeral });

        const t = await fetchT(interaction);
        const guild = interaction.guild!;
        const user = interaction.options.getUser('user', true);

        if (!WatchService.isWatched(guild.id, user.id)) {
            await interactionManager.edit(Components.error(
                t('commands:watch.subcommand.remove.notWatched', {
                    emoji: '❌',
                    user: `<@${user.id}>`,
                })
            ));

            return;
        }

        await WatchService.remove(guild.id, user.id);

        await interactionManager.edit(Components.confirm(
            t('commands:watch.subcommand.remove.confirm', {
                emoji: Emojis.RainbowSheep,
                user: `<@${user.id}>`,
            })
        ));
    }

    public async chatInputEdit(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply({ flags: MessageFlags.Ephemeral });

        const t = await fetchT(interaction);
        const guild = interaction.guild!;
        const user = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason', true);
        const durationInput = interaction.options.getString('duration');
        const resolved = this.resolveDurationOption(durationInput);

        if (resolved.kind === 'invalid') {
            await interactionManager.edit(Components.error(
                t('commands:watch.error.invalidDuration', { emoji: '❌' })
            ));

            return;
        }

        if (!WatchService.isWatched(guild.id, user.id)) {
            await interactionManager.edit(Components.error(
                t('commands:watch.subcommand.edit.notWatched', {
                    emoji: '❌',
                    user: `<@${user.id}>`,
                })
            ));

            return;
        }

        const durationMs = resolved.kind === 'temp' ? resolved.ms : null;

        await WatchService.edit(guild.id, user.id, reason, durationMs);

        await interactionManager.edit(Components.confirm(
            this.buildConfirmMessage(t, 'edit', user.id, resolved)
        ));
    }

    public async chatInputInfo(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply({ flags: MessageFlags.Ephemeral });

        const t = await fetchT(interaction);
        const guild = interaction.guild!;
        const user = interaction.options.getUser('user', true);
        const row = WatchService.get(guild.id, user.id);

        if (!row) {
            await interactionManager.edit(Components.error(
                t('commands:watch.subcommand.info.notWatched', {
                    emoji: '❌',
                    user: `<@${user.id}>`,
                })
            ));

            return;
        }

        const container = this.buildInfoContainer(t, user, row);

        await interactionManager.edit({
            components: [container],
            allowedMentions: { parse: [] },
        });
    }

    public async chatInputList(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply({ flags: MessageFlags.Ephemeral });

        const t = await fetchT(interaction);
        const guild = interaction.guild!;
        const rows = WatchService.getByGuild(guild.id)
            .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());

        if (rows.length === 0) {
            await interactionManager.edit(t('commands:watch.subcommand.list.empty', { emoji: '🤷' }));

            return;
        }

        let currentPage = 0;
        const totalPages = Math.ceil(rows.length / PAGE_SIZE);
        const render = (page: number, disabled = false): ContainerBuilder =>
            this.buildListContainer(t, rows, page, totalPages, disabled);
        const message = await interactionManager.edit({
            components: [render(currentPage)],
            allowedMentions: { parse: [] },
        }) as Message;

        if (totalPages === 1) {
            return;
        }

        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: COLLECTOR_TIMEOUT,
            filter: component =>
                (component.customId === PREV_BUTTON_ID || component.customId === NEXT_BUTTON_ID)
                && component.user.id === interaction.user.id,
        });

        collector.on('collect', async component => {
            if (component.customId === PREV_BUTTON_ID) {
                currentPage = Math.max(0, currentPage - 1);
            } else {
                currentPage = Math.min(totalPages - 1, currentPage + 1);
            }

            await component.deferUpdate();
            await interactionManager.edit({
                components: [render(currentPage)],
                allowedMentions: { parse: [] },
            });
        });

        collector.on('end', async () => {
            await interactionManager.edit({
                components: [render(currentPage, true)],
                allowedMentions: { parse: [] },
            }).catch(() => null);
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry): void {
        registry.registerChatInputCommand(command =>
            registerCommandDescriptions(command
                .setName(this.name)
                .setDefaultMemberPermissions(0)
                .setContexts(InteractionContextType.Guild)
                .addSubcommand(sub => registerSubcommandDescriptions(this.name, sub
                    .setName('add')
                    .addUserOption(option => registerOptionDescriptions(this.name, option
                        .setName('user')
                        .setRequired(true), { subcommand: 'add' }
                    ))
                    .addStringOption(option => registerOptionDescriptions(this.name, option
                        .setName('reason')
                        .setRequired(true), { subcommand: 'add' }
                    ))
                    .addStringOption(option => registerOptionDescriptions(this.name, option
                        .setName('duration')
                        .setRequired(false), { subcommand: 'add' }
                    ))
                ))
                .addSubcommand(sub => registerSubcommandDescriptions(this.name, sub
                    .setName('remove')
                    .addUserOption(option => registerOptionDescriptions(this.name, option
                        .setName('user')
                        .setRequired(true), { subcommand: 'remove' }
                    ))
                ))
                .addSubcommand(sub => registerSubcommandDescriptions(this.name, sub
                    .setName('edit')
                    .addUserOption(option => registerOptionDescriptions(this.name, option
                        .setName('user')
                        .setRequired(true), { subcommand: 'edit' }
                    ))
                    .addStringOption(option => registerOptionDescriptions(this.name, option
                        .setName('reason')
                        .setRequired(true), { subcommand: 'edit' }
                    ))
                    .addStringOption(option => registerOptionDescriptions(this.name, option
                        .setName('duration')
                        .setRequired(false), { subcommand: 'edit' }
                    ))
                ))
                .addSubcommand(sub => registerSubcommandDescriptions(this.name, sub
                    .setName('info')
                    .addUserOption(option => registerOptionDescriptions(this.name, option
                        .setName('user')
                        .setRequired(true), { subcommand: 'info' }
                    ))
                ))
                .addSubcommand(sub => registerSubcommandDescriptions(this.name, sub
                    .setName('list')
                ))
            )
        );
    }

    private resolveDurationOption(input: string | null): ResolvedDuration {
        if (input === null) {
            return { kind: 'temp', ms: DEFAULT_DURATION_MS };
        }

        const trimmed = input.trim().toLowerCase();

        if (PERMANENT_SENTINELS.has(trimmed)) {
            return { kind: 'permanent' };
        }

        const ms = parseDuration(trimmed);

        if (ms === null) {
            return { kind: 'invalid' };
        }

        return { kind: 'temp', ms };
    }

    private truncate(text: string, limit: number): string {
        return text.length > limit ? `${text.slice(0, limit)}…` : text;
    }

    private buildConfirmMessage(
        t: TFunction,
        subcommand: 'add' | 'edit',
        userId: string,
        resolved: Exclude<ResolvedDuration, { kind: 'invalid' }>
    ): string {
        if (resolved.kind === 'permanent') {
            return t(`commands:watch.subcommand.${subcommand}.confirmPermanent`, {
                emoji: Emojis.RainbowSheep,
                user: `<@${userId}>`,
            });
        }

        const expiresUnix = Math.floor((Date.now() + resolved.ms) / 1000);

        return t(`commands:watch.subcommand.${subcommand}.confirmTemp`, {
            emoji: Emojis.RainbowSheep,
            user: `<@${userId}>`,
            expires: `<t:${expiresUnix}:R>`,
        });
    }

    private buildInfoContainer(t: TFunction, user: User, row: WatchedMember): ContainerBuilder {
        const startedUnix = Math.floor(row.startedAt.getTime() / 1000);
        const lines: string[] = [
            `## ${t('commands:watch.subcommand.info.heading', { emoji: Emojis.RainbowSheep })}`,
            `<@${user.id}> — \`${user.username}\``,
            '',
            `**${t('commands:watch.field.reason')}** ${this.truncate(row.reason, REASON_DISPLAY_LIMIT)}`,
            `**${t('commands:watch.field.startedAt')}** <t:${startedUnix}:R>`,
        ];

        if (row.expiresAt) {
            const expiresUnix = Math.floor(row.expiresAt.getTime() / 1000);

            lines.push(`**${t('commands:watch.field.expiresAt')}** <t:${expiresUnix}:R>`);
        } else {
            lines.push(`**${t('commands:watch.field.expiresAt')}** ${t('commands:watch.field.never')}`);
        }

        return new ContainerBuilder()
            .setAccentColor(Colors.Info)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
    }

    private buildListContainer(
        t: TFunction,
        rows: WatchedMember[],
        page: number,
        totalPages: number,
        buttonsDisabled = false
    ): ContainerBuilder {
        const start = page * PAGE_SIZE;
        const slice = rows.slice(start, start + PAGE_SIZE);
        const heading = t('commands:watch.subcommand.list.heading', {
            emoji: Emojis.RainbowSheep,
            count: rows.length,
        });
        const headingDisplay = new TextDisplayBuilder().setContent(`## ${heading}`);
        const container = new ContainerBuilder()
            .setAccentColor(Colors.Info)
            .addTextDisplayComponents(headingDisplay);

        for (const row of slice) {
            const startedUnix = Math.floor(row.startedAt.getTime() / 1000);
            const expiresValue = row.expiresAt
                ? `<t:${Math.floor(row.expiresAt.getTime() / 1000)}:R>`
                : t('commands:watch.field.never');
            const itemLines: string[] = [
                `### <@${row.idUser}>`,
                `**${t('commands:watch.field.reason')}** ${this.truncate(row.reason, REASON_DISPLAY_LIMIT)}`,
                `-# ${t('commands:watch.field.startedAt')} <t:${startedUnix}:R> · ${t('commands:watch.field.expiresAt')} ${expiresValue}`,
            ];

            container
                .addSeparatorComponents(new SeparatorBuilder())
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(itemLines.join('\n')));
        }

        if (totalPages > 1) {
            const prev = new ButtonBuilder()
                .setCustomId(PREV_BUTTON_ID)
                .setStyle(ButtonStyle.Secondary)
                .setLabel(t('commands:watch.subcommand.list.previous'))
                .setDisabled(buttonsDisabled || page === 0);
            const next = new ButtonBuilder()
                .setCustomId(NEXT_BUTTON_ID)
                .setStyle(ButtonStyle.Secondary)
                .setLabel(t('commands:watch.subcommand.list.next'))
                .setDisabled(buttonsDisabled || page === totalPages - 1);
            const actionRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(prev, next);
            const pageInfo = t('commands:watch.subcommand.list.pageInfo', { current: page + 1, total: totalPages });

            container
                .addSeparatorComponents(new SeparatorBuilder())
                .addActionRowComponents(actionRow)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${pageInfo}`));
        }

        return container;
    }
}
