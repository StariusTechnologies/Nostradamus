import { ApplyOptions } from '@sapphire/decorators';
import { Subcommand } from '@sapphire/plugin-subcommands';
import {
    InteractionContextType,
    MessageFlags,
    PermissionFlagsBits,
    SelectMenuDefaultValueType,
} from 'discord-api-types/v10';
import { LocalizedSubcommand } from '../../lib/i18n/LocalizedSubcommand.js';
import {
    addSnippetAlias,
    createSnippet,
    deleteSnippet, deleteSnippetAlias,
    editSnippet, editSnippetAlias,
    fetchSnippet,
    fetchSnippetForEditing,
    fetchSnippetForRestricting, memberHasSnippets,
    restrictSnippet,
    SNIPPET_CONTENT_MAX_LENGTH,
    SNIPPET_NAME_MAX_LENGTH,
    SNIPPET_NAME_REGEX,
} from '../../lib/SnippetService.js';
import { InteractionManager } from '../../lib/InteractionManager.js';
import { Components } from '../../lib/Components.js';
import { fetchT } from '@sapphire/plugin-i18next';
import { ModalBuilder, type ModalSelectedMentionables, type ModalSubmitInteraction, TextInputStyle } from 'discord.js';
import { MINUTE } from '../../util/DateTime.js';
import { Emojis } from '../../util/Emojis.js';
import { isAttachmentStorageChannelConfigured, repostAttachment } from '../../lib/AttachmentService.js';
import { LabelBuilder } from '@discordjs/builders';
import {
    registerCommandDescriptions,
    registerOptionDescriptions,
    registerSubcommandDescriptions, registerSubcommandGroupDescriptions,
} from '../../lib/i18n/LanguageManager.js';
import { isMemberStaff } from '../../lib/StaffService.js';

const COMMAND_NAME: string = 'manage-snippets';

export const SNIPPET_ADD_MODAL_PREFIX: string = 'snippet-add';
export const SNIPPET_EDIT_MODAL_PREFIX: string = 'snippet-edit';
export const SNIPPET_RESTRICT_MODAL_PREFIX: string = 'snippet-restrict';

@ApplyOptions<Subcommand.Options>({
    description: 'Create, edit and delete snippets',
    subcommands: [
        {
            name: 'add',
            chatInputRun: 'runAdd',
        },
        {
            name: 'edit',
            chatInputRun: 'runEdit',
        },
        {
            name: 'delete',
            chatInputRun: 'runDelete',
        },
        {
            name: 'restrict',
            chatInputRun: 'runRestrict',
        },
        {
            name: 'alias',
            type: 'group',
            entries: [
                {
                    name: 'add',
                    chatInputRun: 'runAliasAdd',
                },
                {
                    name: 'edit',
                    chatInputRun: 'runAliasEdit',
                },
                {
                    name: 'delete',
                    chatInputRun: 'runAliasDelete',
                },
            ],
        },
    ],
})
export default class extends LocalizedSubcommand {
    public async runAdd(interaction: Subcommand.ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);
        const t = await fetchT(interaction);
        const name = interaction.options.getString('name', true).toLowerCase();

        if (!SNIPPET_NAME_REGEX.test(name)) {
            await interactionManager.reply({
                ...Components.error(t('commands:manage-snippets.add.wrongName', { emoji: '❌' })),
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        const existingSnippet = await fetchSnippet(name, interaction.guildId!);

        if (existingSnippet) {
            await interactionManager.reply({
                ...Components.error(t('commands:manage-snippets.add.alreadyExists', { emoji: '❌' })),
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        const member = (await interaction.guild?.members.fetch(interaction.user.id))!;

        if (!await isMemberStaff(member) && await memberHasSnippets(member)) {
            await interactionManager.reply({
                ...Components.error(t('commands:manage-snippets.add.onlyOne', { emoji: '❌' })),
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        const customId: string = `${SNIPPET_ADD_MODAL_PREFIX}:${name}`;
        const withAttachment = await isAttachmentStorageChannelConfigured(interaction.guildId!);
        const components: Array<((builder: LabelBuilder) => LabelBuilder)> = [
            label => label
                .setLabel(t('commands:manage-snippets.modalFields.content'))
                .setTextInputComponent(input => input
                    .setCustomId('content')
                    .setStyle(TextInputStyle.Paragraph)
                    .setMaxLength(SNIPPET_CONTENT_MAX_LENGTH)
                    .setRequired(true),
                ),
        ];

        if (withAttachment) {
            components.push(
                label => label
                    .setLabel(t('commands:manage-snippets.modalFields.attachment'))
                    .setFileUploadComponent(upload => upload
                        .setCustomId('attachment')
                        .setMaxValues(1)
                        .setRequired(false),
                    ),
            );
        }

        const modal: ModalBuilder = new ModalBuilder()
            .setCustomId(customId)
            .setTitle(t('commands:manage-snippets.add.modal.title'))
            .addLabelComponents(...components);

        await interaction.showModal(modal);

        const submit: ModalSubmitInteraction | null = await interaction.awaitModalSubmit({
            time: 10 * MINUTE,
            filter: (modalInteraction: ModalSubmitInteraction): boolean =>
                modalInteraction.customId === customId &&
                modalInteraction.user.id === interaction.user.id,
        }).catch((): null => null);

        if (!submit) {
            return;
        }

        const content = submit.fields.getTextInputValue('content');
        const attachmentUrl = withAttachment
            ? submit.fields.getUploadedFiles('attachment', false)?.first()?.url
            : null;

        const raced = await fetchSnippet(name, interaction.guildId!);

        if (raced) {
            await submit.reply({
                ...Components.error(t('commands:manage-snippets.add.alreadyExists', { emoji: '❌' })),
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            });

            return;
        }

        await createSnippet(
            name,
            content,
            interaction.guildId!,
            interaction.user.id,
            await repostAttachment(interaction.guildId!, attachmentUrl),
        );

        await submit.reply({
            ...Components.confirm(t('commands:manage-snippets.add.confirm', {
                emoji: Emojis.RainbowSheep,
                name,
            })),
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
    }

    public async runEdit(interaction: Subcommand.ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);
        const t = await fetchT(interaction);
        const name = interaction.options.getString('name', true).toLowerCase();
        const member = await interaction.guild?.members.fetch(interaction.user.id);
        const snippet = member ? await fetchSnippetForEditing(name, interaction.guildId!, member) : null;

        if (!snippet) {
            await interactionManager.reply({
                ...Components.error(t('commands:manage-snippets.edit.notFound', { emoji: '❌' })),
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        const customId: string = `${SNIPPET_EDIT_MODAL_PREFIX}:${name}`;
        const withAttachment = await isAttachmentStorageChannelConfigured(interaction.guildId!);
        const components: Array<((builder: LabelBuilder) => LabelBuilder)> = [
            label => label
                .setLabel(t('commands:manage-snippets.modalFields.content'))
                .setTextInputComponent(input => input
                    .setCustomId('content')
                    .setStyle(TextInputStyle.Paragraph)
                    .setMaxLength(SNIPPET_CONTENT_MAX_LENGTH)
                    .setValue(snippet.content)
                    .setRequired(false),
                ),
        ];

        if (withAttachment) {
            components.push(
                label => label
                    .setLabel(t('commands:manage-snippets.modalFields.attachment'))
                    .setFileUploadComponent(upload => upload
                        .setCustomId('attachment')
                        .setMaxValues(1)
                        .setRequired(false),
                    ),
            );
        }

        const modal: ModalBuilder = new ModalBuilder()
            .setCustomId(customId)
            .setTitle(t('commands:manage-snippets.edit.modal.title'))
            .addLabelComponents(...components);

        await interaction.showModal(modal);

        const submit: ModalSubmitInteraction | null = await interaction.awaitModalSubmit({
            time: 10 * MINUTE,
            filter: (modalInteraction: ModalSubmitInteraction): boolean =>
                modalInteraction.customId === customId &&
                modalInteraction.user.id === interaction.user.id,
        }).catch((): null => null);

        if (!submit) {
            return;
        }

        const content = submit.fields.getTextInputValue('content');
        const attachmentUrl = withAttachment
            ? submit.fields.getUploadedFiles('attachment', false)?.first()?.url
            : null;
        const raced = (await fetchSnippet(name, interaction.guildId!)) === null;

        if (raced) {
            await submit.reply({
                ...Components.error(t('commands:manage-snippets.edit.raced', { emoji: '❌' })),
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            });

            return;
        }

        await editSnippet(
            snippet.id,
            !content ? null : content,
            !attachmentUrl ? null : await repostAttachment(interaction.guildId!, attachmentUrl),
        );

        await submit.reply({
            ...Components.confirm(t('commands:manage-snippets.edit.confirm', {
                emoji: Emojis.RainbowSheep,
                name,
            })),
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
    }

    public async runDelete(interaction: Subcommand.ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);
        const t = await fetchT(interaction);
        const name = interaction.options.getString('name', true).toLowerCase();
        const member = await interaction.guild?.members.fetch(interaction.user.id);
        const snippet = member ? await fetchSnippetForEditing(name, interaction.guildId!, member) : null;

        if (!snippet) {
            await interactionManager.reply({
                ...Components.error(t('commands:manage-snippets.delete.notFound', { emoji: '❌' })),
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        await deleteSnippet(snippet.id);

        await interactionManager.reply({
            ...Components.confirm(t('commands:manage-snippets.delete.confirm', {
                emoji: Emojis.RainbowSheep,
                name,
            })),
            flags: MessageFlags.Ephemeral,
        });
    }

    public async runRestrict(interaction: Subcommand.ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);
        const t = await fetchT(interaction);
        const name = interaction.options.getString('name', true).toLowerCase();
        const member = await interaction.guild?.members.fetch(interaction.user.id);
        const snippet = member ? await fetchSnippetForRestricting(name, interaction.guildId!, member) : null;

        if (!snippet) {
            await interactionManager.reply({
                ...Components.error(t('commands:manage-snippets.restrict.notFound', { emoji: '❌' })),
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        const customId: string = `${SNIPPET_RESTRICT_MODAL_PREFIX}:${name}`;
        const canReadValue = (Array.isArray(snippet.canRead) ? snippet.canRead : []) as string[];
        const canEditValue = (Array.isArray(snippet.canEdit) ? snippet.canEdit : []) as string[];
        const getDefaultValueType = (id: string) => interaction.guild!.roles.cache.has(id)
            ? SelectMenuDefaultValueType.Role
            : SelectMenuDefaultValueType.User;

        const components: Array<((builder: LabelBuilder) => LabelBuilder)> = [
            label => label
                .setLabel(t('commands:manage-snippets.modalFields.canRead'))
                .setMentionableSelectMenuComponent(select => select
                    .setCustomId('can-read')
                    .setMinValues(0)
                    .setMaxValues(25)
                    .setDefaultValues(canReadValue.map(id => ({
                        id,
                        type: getDefaultValueType(id),
                    }))),
                ),
            label => label
                .setLabel(t('commands:manage-snippets.modalFields.canEdit'))
                .setMentionableSelectMenuComponent(select => select
                    .setCustomId('can-edit')
                    .setMinValues(0)
                    .setMaxValues(25)
                    .setDefaultValues(canEditValue.map(id => ({
                        id,
                        type: getDefaultValueType(id),
                    }))),
                ),
        ];

        const modal: ModalBuilder = new ModalBuilder()
            .setCustomId(customId)
            .setTitle(t('commands:manage-snippets.restrict.modal.title'))
            .addLabelComponents(...components)
            .addTextDisplayComponents(
                text => text.setContent(t('commands:manage-snippets.restrict.modal.hint')),
            );

        await interaction.showModal(modal);

        const submit: ModalSubmitInteraction | null = await interaction.awaitModalSubmit({
            time: 10 * MINUTE,
            filter: (modalInteraction: ModalSubmitInteraction): boolean =>
                modalInteraction.customId === customId &&
                modalInteraction.user.id === interaction.user.id,
        }).catch((): null => null);

        if (!submit) {
            return;
        }

        const canRead = submit.fields.getSelectedMentionables('can-read', false);
        const canEdit = submit.fields.getSelectedMentionables('can-edit', false);
        const raced = (await fetchSnippet(name, interaction.guildId!)) === null;

        if (raced) {
            await submit.reply({
                ...Components.error(t('commands:manage-snippets.restrict.raced', { emoji: '❌' })),
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            });

            return;
        }

        await restrictSnippet(
            snippet.id,
            !canRead ? null : this.getIdsFromMentionables(canRead),
            !canEdit ? null : this.getIdsFromMentionables(canEdit),
        );

        await submit.reply({
            ...Components.confirm(t('commands:manage-snippets.restrict.confirm', {
                emoji: Emojis.RainbowSheep,
                name,
            })),
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
    }

    public async runAliasAdd(interaction: Subcommand.ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);
        const t = await fetchT(interaction);
        const snippetName = interaction.options.getString('snippet', true);
        const aliasName = interaction.options.getString('name', true).toLowerCase();

        if (!SNIPPET_NAME_REGEX.test(aliasName)) {
            await interactionManager.reply({
                ...Components.error(t('commands:manage-snippets.alias.add.wrongName', { emoji: '❌' })),
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        const existingSnippet = await fetchSnippet(aliasName, interaction.guildId!);

        if (existingSnippet) {
            await interactionManager.reply({
                ...Components.error(t('commands:manage-snippets.alias.add.alreadyExists', { emoji: '❌' })),
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        const isPrimary = interaction.options.getBoolean('primary') ?? false;
        const member = (await interaction.guild?.members.fetch(interaction.user.id))!;
        const snippet = await fetchSnippetForEditing(snippetName, interaction.guildId!, member);

        if (!snippet) {
            await interactionManager.reply({
                ...Components.error(t('commands:manage-snippets.alias.add.notFound', { emoji: '❌' })),
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        await addSnippetAlias(snippet.id, aliasName, isPrimary);

        await interactionManager.reply({
            ...Components.confirm(t('commands:manage-snippets.alias.add.confirm', {
                emoji: Emojis.RainbowSheep,
                alias: aliasName,
            })),
            flags: MessageFlags.Ephemeral,
        });
    }

    public async runAliasEdit(interaction: Subcommand.ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);
        const t = await fetchT(interaction);
        const aliasName = interaction.options.getString('name', true).toLowerCase();
        const aliasNewName = interaction.options.getString('new-name')?.toLowerCase();

        if (aliasNewName && !SNIPPET_NAME_REGEX.test(aliasNewName)) {
            await interactionManager.reply({
                ...Components.error(t('commands:manage-snippets.alias.edit.wrongName', { emoji: '❌' })),
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        const existingSnippet = aliasNewName ? await fetchSnippet(aliasNewName, interaction.guildId!) : null;

        if (existingSnippet) {
            await interactionManager.reply({
                ...Components.error(t('commands:manage-snippets.alias.edit.alreadyExists', { emoji: '❌' })),
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        const isPrimary = interaction.options.getBoolean('primary');

        if (isPrimary === false) {
            await interactionManager.reply({
                ...Components.error(t('commands:manage-snippets.alias.edit.primaryRequired', { emoji: '❌' })),
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        const member = (await interaction.guild?.members.fetch(interaction.user.id))!;
        const snippet = await fetchSnippetForEditing(aliasName, interaction.guildId!, member);
        const alias = snippet?.aliases.find(alias => alias.alias.toLowerCase() === aliasName);

        if (!snippet || !alias) {
            await interactionManager.reply({
                ...Components.error(t('commands:manage-snippets.alias.edit.notFound', { emoji: '❌' })),
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        await editSnippetAlias(snippet.id, alias.id, aliasNewName ?? aliasName, isPrimary ?? undefined);

        await interactionManager.reply({
            ...Components.confirm(t('commands:manage-snippets.alias.edit.confirm', {
                emoji: Emojis.RainbowSheep,
                alias: aliasName,
            })),
            flags: MessageFlags.Ephemeral,
        });
    }

    public async runAliasDelete(interaction: Subcommand.ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);
        const t = await fetchT(interaction);
        const aliasName = interaction.options.getString('name', true).toLowerCase();
        const member = (await interaction.guild?.members.fetch(interaction.user.id))!;
        const snippet = await fetchSnippetForEditing(aliasName, interaction.guildId!, member);
        const alias = snippet?.aliases.find(alias => alias.alias.toLowerCase() === aliasName);

        if (!snippet || !alias) {
            await interactionManager.reply({
                ...Components.error(t('commands:manage-snippets.alias.delete.notFound', { emoji: '❌' })),
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        if (alias.isPrimary) {
            await interactionManager.reply({
                ...Components.error(t('commands:manage-snippets.alias.delete.primaryRequired', { emoji: '❌' })),
                flags: MessageFlags.Ephemeral,
            });

            return;
        }


        await deleteSnippetAlias(alias.id);

        await interactionManager.reply({
            ...Components.confirm(t('commands:manage-snippets.alias.delete.confirm', {
                emoji: Emojis.RainbowSheep,
                alias: aliasName,
            })),
            flags: MessageFlags.Ephemeral,
        });
    }

    public override registerApplicationCommands(registry: Subcommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            registerCommandDescriptions(builder
                .setName(COMMAND_NAME)
                .setContexts(InteractionContextType.Guild)
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
                .addSubcommand((subCommand) => registerSubcommandDescriptions(COMMAND_NAME, subCommand
                    .setName('add')
                    .addStringOption(option => registerOptionDescriptions(COMMAND_NAME, option
                        .setName('name')
                        .setMaxLength(SNIPPET_NAME_MAX_LENGTH)
                        .setRequired(true), { subcommand: 'add' },
                    )),
                ))
                .addSubcommand((subCommand) => registerSubcommandDescriptions(COMMAND_NAME, subCommand
                    .setName('edit')
                    .addStringOption(option => registerOptionDescriptions(COMMAND_NAME, option
                        .setName('name')
                        .setMaxLength(SNIPPET_NAME_MAX_LENGTH)
                        .setAutocomplete(true)
                        .setRequired(true), { subcommand: 'edit' },
                    )),
                ))
                .addSubcommand((subCommand) => registerSubcommandDescriptions(COMMAND_NAME, subCommand
                    .setName('delete')
                    .addStringOption(option => registerOptionDescriptions(COMMAND_NAME, option
                        .setName('name')
                        .setMaxLength(SNIPPET_NAME_MAX_LENGTH)
                        .setAutocomplete(true)
                        .setRequired(true), { subcommand: 'delete' },
                    )),
                ))
                .addSubcommand((subCommand) => registerSubcommandDescriptions(COMMAND_NAME, subCommand
                    .setName('restrict')
                    .addStringOption(option => registerOptionDescriptions(COMMAND_NAME, option
                        .setName('name')
                        .setMaxLength(SNIPPET_NAME_MAX_LENGTH)
                        .setAutocomplete(true)
                        .setRequired(true), { subcommand: 'restrict' },
                    )),
                ))
                .addSubcommandGroup(subcommandGroup => registerSubcommandGroupDescriptions(COMMAND_NAME, subcommandGroup
                    .setName('alias')
                    .addSubcommand(subcommand => registerSubcommandDescriptions(COMMAND_NAME, subcommand
                        .setName('add')
                        .addStringOption(option => registerOptionDescriptions(COMMAND_NAME, option
                            .setName('snippet')
                            .setMaxLength(SNIPPET_NAME_MAX_LENGTH)
                            .setAutocomplete(true)
                            .setRequired(true), { subcommandGroup: 'alias', subcommand: 'add' },
                        ))
                        .addStringOption(option => registerOptionDescriptions(COMMAND_NAME, option
                            .setName('name')
                            .setMaxLength(SNIPPET_NAME_MAX_LENGTH)
                            .setRequired(true), { subcommandGroup: 'alias', subcommand: 'add' },
                        ))
                        .addBooleanOption(option => registerOptionDescriptions(COMMAND_NAME, option
                            .setName('primary'), { subcommandGroup: 'alias', subcommand: 'add' },
                        )), 'alias',
                    ))
                    .addSubcommand(subcommand => registerSubcommandDescriptions(COMMAND_NAME, subcommand
                        .setName('edit')
                        .addStringOption(option => registerOptionDescriptions(COMMAND_NAME, option
                            .setName('name')
                            .setMaxLength(SNIPPET_NAME_MAX_LENGTH)
                            .setAutocomplete(true)
                            .setRequired(true), { subcommandGroup: 'alias', subcommand: 'edit' },
                        ))
                        .addStringOption(option => registerOptionDescriptions(COMMAND_NAME, option
                            .setName('new-name')
                            .setMaxLength(SNIPPET_NAME_MAX_LENGTH)
                            .setRequired(false), { subcommandGroup: 'alias', subcommand: 'edit' },
                        ))
                        .addBooleanOption(option => registerOptionDescriptions(COMMAND_NAME, option
                            .setName('primary'), { subcommandGroup: 'alias', subcommand: 'edit' },
                        )), 'alias',
                    ))
                    .addSubcommand(subcommand => registerSubcommandDescriptions(COMMAND_NAME, subcommand
                        .setName('delete')
                        .addStringOption(option => registerOptionDescriptions(COMMAND_NAME, option
                            .setName('name')
                            .setMaxLength(SNIPPET_NAME_MAX_LENGTH)
                            .setAutocomplete(true)
                            .setRequired(true), { subcommandGroup: 'alias', subcommand: 'delete' },
                        )), 'alias',
                    )),
                )),
            ),
        );
    }

    private getIdsFromMentionables(mentionables: ModalSelectedMentionables | null) {
        if (!mentionables) {
            return [];
        }

        return [...new Set(
            Object.values(mentionables).flatMap(
                collection => [...collection.values()].map(item => item.id),
            ),
        )];
    }
}
