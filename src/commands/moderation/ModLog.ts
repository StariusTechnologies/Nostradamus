import type { ChatInputCommandInteraction } from 'discord.js';
import { InteractionContextType, MessageFlags } from 'discord-api-types/v10';
import { type ApplicationCommandRegistry, Command as SapphireCommand } from '@sapphire/framework';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { fetchT } from '@sapphire/plugin-i18next';
import { LocalizedSubcommand } from '../../lib/i18n/LocalizedSubcommand.js';
import {
    registerCommandDescriptions,
    registerOptionDescriptions,
    registerSubcommandDescriptions
} from '../../lib/i18n/LanguageManager.js';
import { InteractionManager } from '../../lib/InteractionManager.js';
import { Components } from '../../lib/Components.js';
import { Emojis } from '../../util/Emojis.js';
import {
    edit,
    ModerationLogInvalidMessageError,
    ModerationLogMessageNotFoundError,
    ModerationLogPostError,
    post,
    removeAvatar,
    type ModerationAction
} from '../../lib/ModerationLog.js';

const COMMAND_NAME = 'mod-log';
const ACTIONS: ReadonlyArray<ModerationAction> = ['ban', 'kick', 'unban'];

export default class extends LocalizedSubcommand {
    public constructor(context: SapphireCommand.LoaderContext, options: Subcommand.Options) {
        super(context, {
            ...options,
            name: COMMAND_NAME,
            subcommands: [
                { name: 'post', chatInputRun: 'chatInputPost' },
                { name: 'edit', chatInputRun: 'chatInputEdit' },
                { name: 'remove-avatar', chatInputRun: 'chatInputRemoveAvatar' },
            ],
        });
    }

    public async chatInputPost(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply({ flags: MessageFlags.Ephemeral });

        const t = await fetchT(interaction);
        const user = interaction.options.getUser('user', true);
        const action = interaction.options.getString('action', true) as ModerationAction;
        const reason = interaction.options.getString('reason', true);

        if (!ACTIONS.includes(action)) {
            await interactionManager.edit(Components.error(
                t('commands:mod-log.error.invalidAction', { emoji: '❌' })
            ));

            return;
        }

        try {
            const message = await post(interaction.guild!, user, action, reason);

            if (!message) {
                await interactionManager.edit(Components.error(
                    t('commands:mod-log.error.noChannel', { emoji: '❌' })
                ));

                return;
            }

            await interactionManager.edit(Components.confirm(
                t('commands:mod-log.subcommand.post.confirm', {
                    emoji: Emojis.RainbowSheep,
                    messageId: message.id,
                })
            ));
        } catch (err) {
            if (err instanceof ModerationLogPostError) {
                await interactionManager.edit(Components.error(
                    t('commands:mod-log.error.noChannel', { emoji: '❌' })
                ));

                return;
            }

            this.container.logger.warn(`/mod-log post failed: ${err}`);
            await interactionManager.edit(Components.error(
                t('commands:mod-log.error.unknown', { emoji: '❌' })
            ));
        }
    }

    public async chatInputEdit(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply({ flags: MessageFlags.Ephemeral });

        const t = await fetchT(interaction);
        const messageId = interaction.options.getString('message-id', true).trim();
        const reason = interaction.options.getString('reason', true);

        try {
            await edit(interaction.guild!, messageId, reason);

            await interactionManager.edit(Components.confirm(
                t('commands:mod-log.subcommand.edit.confirm', {
                    emoji: Emojis.RainbowSheep,
                    messageId,
                })
            ));
        } catch (err) {
            if (err instanceof ModerationLogPostError) {
                await interactionManager.edit(Components.error(
                    t('commands:mod-log.error.noChannel', { emoji: '❌' })
                ));

                return;
            }

            if (err instanceof ModerationLogMessageNotFoundError) {
                await interactionManager.edit(Components.error(
                    t('commands:mod-log.error.messageNotFound', { emoji: '❌' })
                ));

                return;
            }

            if (err instanceof ModerationLogInvalidMessageError) {
                await interactionManager.edit(Components.error(
                    t('commands:mod-log.error.notAModLogEntry', { emoji: '❌' })
                ));

                return;
            }

            this.container.logger.warn(`/mod-log edit failed: ${err}`);
            await interactionManager.edit(Components.error(
                t('commands:mod-log.error.unknown', { emoji: '❌' })
            ));
        }
    }

    public async chatInputRemoveAvatar(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply({ flags: MessageFlags.Ephemeral });

        const t = await fetchT(interaction);
        const messageId = interaction.options.getString('message-id', true).trim();

        try {
            await removeAvatar(interaction.guild!, messageId);

            await interactionManager.edit(Components.confirm(
                t('commands:mod-log.subcommand.remove-avatar.confirm', {
                    emoji: Emojis.RainbowSheep,
                    messageId,
                })
            ));
        } catch (err) {
            if (err instanceof ModerationLogPostError) {
                await interactionManager.edit(Components.error(
                    t('commands:mod-log.error.noChannel', { emoji: '❌' })
                ));

                return;
            }

            if (err instanceof ModerationLogMessageNotFoundError) {
                await interactionManager.edit(Components.error(
                    t('commands:mod-log.error.messageNotFound', { emoji: '❌' })
                ));

                return;
            }

            if (err instanceof ModerationLogInvalidMessageError) {
                await interactionManager.edit(Components.error(
                    t('commands:mod-log.error.notAModLogEntry', { emoji: '❌' })
                ));

                return;
            }

            this.container.logger.warn(`/mod-log remove-avatar failed: ${err}`);
            await interactionManager.edit(Components.error(
                t('commands:mod-log.error.unknown', { emoji: '❌' })
            ));
        }
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry): void {
        registry.registerChatInputCommand(command =>
            registerCommandDescriptions(command
                .setName(this.name)
                .setDefaultMemberPermissions(0)
                .setContexts(InteractionContextType.Guild)
                .addSubcommand(sub => registerSubcommandDescriptions(this.name, sub
                    .setName('post')
                    .addUserOption(option => registerOptionDescriptions(this.name, option
                        .setName('user')
                        .setRequired(true), { subcommand: 'post' }
                    ))
                    .addStringOption(option => registerOptionDescriptions(this.name, option
                        .setName('action')
                        .setRequired(true)
                        .addChoices(
                            { name: 'ban', value: 'ban' },
                            { name: 'kick', value: 'kick' },
                            { name: 'unban', value: 'unban' }
                        ), { subcommand: 'post' }
                    ))
                    .addStringOption(option => registerOptionDescriptions(this.name, option
                        .setName('reason')
                        .setRequired(true), { subcommand: 'post' }
                    ))
                ))
                .addSubcommand(sub => registerSubcommandDescriptions(this.name, sub
                    .setName('edit')
                    .addStringOption(option => registerOptionDescriptions(this.name, option
                        .setName('message-id')
                        .setRequired(true), { subcommand: 'edit' }
                    ))
                    .addStringOption(option => registerOptionDescriptions(this.name, option
                        .setName('reason')
                        .setRequired(true), { subcommand: 'edit' }
                    ))
                ))
                .addSubcommand(sub => registerSubcommandDescriptions(this.name, sub
                    .setName('remove-avatar')
                    .addStringOption(option => registerOptionDescriptions(this.name, option
                        .setName('message-id')
                        .setRequired(true), { subcommand: 'remove-avatar' }
                    ))
                ))
            )
        );
    }
}
