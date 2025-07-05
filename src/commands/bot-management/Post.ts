import { ChatInputCommandInteraction, type GuildBasedChannel } from 'discord.js';
import { InteractionContextType, MessageFlags } from 'discord-api-types/v10';
import { type ApplicationCommandRegistry, container } from '@sapphire/framework';
import { fetchT } from '@sapphire/plugin-i18next';
import { LocalizedCommand } from '../../lib/i18n/LocalizedCommand.js';
import EmbedBuilder from '../../lib/EmbedBuilder.js';
import { registerCommandDescriptions, registerOptionDescriptions } from '../../lib/i18n/LanguageManager.js';

export default class extends LocalizedCommand {
    public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const t = await fetchT(interaction);

        if (interaction.user.id !== process.env.OWNER) {
            const embed = new EmbedBuilder(true)
                .setTitle(t('commands:post.unauthorized.title'))
                .setDescription(t('commands:post.unauthorized.description'));

            await interaction.editReply({ embeds: [embed] });

            return;
        }

        const guild = interaction.guild!;
        let replyTo = interaction.options.getString('reply-to');
        let channel: GuildBasedChannel | null = null;

        if (replyTo && !/\d{16,18}(-\d{16,18})?/u.test(replyTo)) {
            await this.sendInvalidMessageIdError(interaction);

            return;
        } else if (replyTo && /\d{16,18}-\d{16,18}/u.test(replyTo)) {
            const [channelId, messageId] = replyTo.split('-');

            if (!guild.channels.cache.has(channelId) || !guild.channels.cache.get(channelId)!.isTextBased()) {
                await this.sendInvalidMessageIdError(interaction);

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
            const embed = new EmbedBuilder(true)
                .setTitle(t('commands:post.invalidChannel.title'))
                .setDescription(t('commands:post.invalidChannel.description'));

            await interaction.editReply({ embeds: [embed] });

            return;
        }

        if (replyTo && !repliedMessage) {
            await this.sendInvalidMessageIdError(interaction);

            return;
        }

        try {
            if (repliedMessage) {
                await repliedMessage.reply(message);
            } else {
                await channel.send(message)
            }
        } catch (error) {
            container.logger.debug(error as Error);
            const embed = new EmbedBuilder(true)
                .setTitle(t('commands:post.unknownError.title'))
                .setDescription(t('commands:post.unknownError.title', { errorMessage: String(error) }));

            await interaction.editReply({ embeds: [embed] });
        }

        const embed = new EmbedBuilder()
            .setTitle(t('commands:post.posted.title'))
            .setDescription(t('commands:post.posted.description'));

        await interaction.editReply({ embeds: [embed] });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
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
                ))
                .addStringOption(builder => registerOptionDescriptions(this.name, builder
                    .setName('reply-to')
                ))
            )
        );
    }

    private async sendInvalidMessageIdError(interaction: ChatInputCommandInteraction): Promise<void> {
        const t = await fetchT(interaction);
        const embed = new EmbedBuilder(true)
            .setTitle(t('commands:post.invalidMessageId.title'))
            .setDescription(t('commands:post.invalidMessageId.description'));

        await interaction.editReply({ embeds: [embed] });
    }
}
