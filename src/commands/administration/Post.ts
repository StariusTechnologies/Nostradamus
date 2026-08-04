import type { ChatInputCommandInteraction, GuildBasedChannel } from 'discord.js';
import { ChannelType, InteractionContextType, MessageFlags } from 'discord-api-types/v10';
import { type ApplicationCommandRegistry } from '@sapphire/framework';
import { fetchT } from '@sapphire/plugin-i18next';
import { LocalizedCommand } from '../../lib/i18n/LocalizedCommand.js';
import { registerCommandDescriptions, registerOptionDescriptions } from '../../lib/i18n/LanguageManager.js';
import { InteractionManager } from '../../lib/InteractionManager.js';
import { Components } from '../../lib/Components.js';

export default class extends LocalizedCommand {
    public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply({ flags: MessageFlags.Ephemeral });

        const t = await fetchT(interaction);

        if (interaction.user.id !== process.env.OWNER) {
            await interactionManager.edit(Components.error(
                `## ${t('commands:post.unauthorized.title')}\n${t('commands:post.unauthorized.description')}`
            ));

            return;
        }

        const guild = interaction.guild!;
        let replyTo = interaction.options.getString('reply-to');
        let channel: GuildBasedChannel | null = null;

        if (replyTo && !/\d{16,18}(-\d{16,18})?/u.test(replyTo)) {
            await this.sendInvalidMessageIdError(interactionManager, t);

            return;
        } else if (replyTo && /\d{16,18}-\d{16,18}/u.test(replyTo)) {
            const [channelId, messageId] = replyTo.split('-');

            if (!guild.channels.cache.has(channelId) || !guild.channels.cache.get(channelId)!.isTextBased()) {
                await this.sendInvalidMessageIdError(interactionManager, t);

                return;
            }

            replyTo = messageId;
            channel = guild.channels.cache.get(channelId)!;
        }

        if (!channel) {
            channel = (interaction.options.getChannel('channel') ?? interaction.channel) as GuildBasedChannel | null;
        }

        const repliedMessage = channel?.isTextBased() && replyTo
            ? await channel.messages.fetch(replyTo).catch(() => null)
            : null;
        const message = interaction.options.getString('message', true);

        if (!channel || !channel.isTextBased()) {
            await interactionManager.edit(Components.error(
                `## ${t('commands:post.invalidChannel.title')}\n${t('commands:post.invalidChannel.description')}`
            ));

            return;
        }

        if (replyTo && !repliedMessage) {
            await this.sendInvalidMessageIdError(interactionManager, t);

            return;
        }

        try {
            if (repliedMessage) {
                await repliedMessage.reply(message);
            } else {
                await channel.send(message);
            }
        } catch (error) {
            this.container.logger.debug(error as Error);
            await interactionManager.edit(Components.error(
                `## ${t('commands:post.unknownError.title')}\n`
                + `${t('commands:post.unknownError.description', { errorMessage: String(error) })}`
            ));

            return;
        }

        await interactionManager.edit(Components.confirm(
            `## ${t('commands:post.posted.title')}\n${t('commands:post.posted.description')}`
        ));
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry): void {
        registry.registerChatInputCommand(command =>
            registerCommandDescriptions(command
                .setName(this.name)
                .setDefaultMemberPermissions(0)
                .setContexts(InteractionContextType.Guild)
                .addStringOption(builder => registerOptionDescriptions(this.name, builder
                    .setName('message')
                    .setRequired(true)
                ))
                .addChannelOption(builder => registerOptionDescriptions(this.name, builder
                    .setName('channel')
                    .addChannelTypes(ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread)
                ))
                .addStringOption(builder => registerOptionDescriptions(this.name, builder
                    .setName('reply-to')
                ))
            )
        );
    }

    private async sendInvalidMessageIdError(
        interactionManager: InteractionManager,
        t: Awaited<ReturnType<typeof fetchT>>
    ): Promise<void> {
        await interactionManager.edit(Components.error(
            `## ${t('commands:post.invalidMessageId.title')}\n${t('commands:post.invalidMessageId.description')}`
        ));
    }
}
