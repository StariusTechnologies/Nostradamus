import { ApplyOptions } from '@sapphire/decorators';
import { ApplicationCommandType, InteractionContextType, MessageFlags, PermissionFlagsBits } from 'discord-api-types/v10';
import {
    type ContextMenuCommandBuilder,
    type ContextMenuCommandInteraction,
    ModalBuilder,
    type ModalSubmitInteraction,
    TextInputStyle,
} from 'discord.js';
import { type ApplicationCommandRegistry, Command } from '@sapphire/framework';
import { fetchT } from '@sapphire/plugin-i18next';
import { LocalizedCommand } from '../../lib/i18n/LocalizedCommand.js';
import { registerCommandNames } from '../../lib/i18n/LanguageManager.js';
import { InteractionManager } from '../../lib/InteractionManager.js';
import { Components } from '../../lib/Components.js';
import { Emojis } from '../../util/Emojis.js';
import { MINUTE } from '../../util/DateTime.js';
import { repostAttachment } from '../../lib/AttachmentService.js';
import { isMemberStaff } from '../../lib/StaffService.js';
import {
    createSnippet,
    fetchSnippet,
    memberHasSnippets,
    SNIPPET_CONTENT_MAX_LENGTH,
    SNIPPET_NAME_MAX_LENGTH,
    SNIPPET_NAME_REGEX,
} from '../../lib/SnippetService.js';

const COMMAND_NAME: string = 'save-as-snippet';

export const SNIPPET_FROM_MESSAGE_MODAL_PREFIX: string = 'snippet-from-message';

@ApplyOptions<Command.Options>({
    description: 'Save an existing message as a snippet',
})
export default class extends LocalizedCommand {
    public override async contextMenuRun(interaction: ContextMenuCommandInteraction): Promise<void> {
        if (!interaction.isMessageContextMenuCommand()) {
            return;
        }

        const interactionManager = new InteractionManager(interaction);
        const t = await fetchT(interaction);
        const { targetMessage } = interaction;
        const { content } = targetMessage;

        if (content.length < 1) {
            await interactionManager.reply({
                ...Components.error(t('commands:manage-snippets.add.noContent', { emoji: '❌' })),
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        if (content.length > SNIPPET_CONTENT_MAX_LENGTH) {
            await interactionManager.reply({
                ...Components.error(t('commands:manage-snippets.add.contentTooLong', {
                    emoji: '❌',
                    max: SNIPPET_CONTENT_MAX_LENGTH,
                })),
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

        const customId: string = `${SNIPPET_FROM_MESSAGE_MODAL_PREFIX}:${targetMessage.id}`;
        const modal: ModalBuilder = new ModalBuilder()
            .setCustomId(customId)
            .setTitle(t('commands:manage-snippets.add.modal.title'))
            .addLabelComponents(
                label => label
                    .setLabel(t('commands:manage-snippets.modalFields.name'))
                    .setTextInputComponent(input => input
                        .setCustomId('name')
                        .setStyle(TextInputStyle.Short)
                        .setMaxLength(SNIPPET_NAME_MAX_LENGTH)
                        .setRequired(true),
                    ),
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

        const name: string = submit.fields.getTextInputValue('name').toLowerCase();

        if (!SNIPPET_NAME_REGEX.test(name)) {
            await submit.reply({
                ...Components.error(t('commands:manage-snippets.add.wrongName', { emoji: '❌' })),
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            });

            return;
        }

        if (await fetchSnippet(name, interaction.guildId!)) {
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
            await repostAttachment(interaction.guildId!, targetMessage.attachments.first()?.url),
        );

        await submit.reply({
            ...Components.confirm(t('commands:manage-snippets.add.confirm', {
                emoji: Emojis.RainbowSheep,
                name,
            })),
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry): void {
        registry.registerContextMenuCommand((builder: ContextMenuCommandBuilder) =>
            registerCommandNames(builder, COMMAND_NAME)
                .setType(ApplicationCommandType.Message)
                .setContexts(InteractionContextType.Guild)
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        );
    }
}
