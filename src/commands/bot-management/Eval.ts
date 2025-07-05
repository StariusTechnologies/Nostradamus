import process from 'node:process';
import type { ChatInputCommandInteraction } from 'discord.js';
import { MessageFlags } from 'discord-api-types/v10';
import { ApplicationCommandRegistry, container } from '@sapphire/framework';
import { fetchT } from '@sapphire/plugin-i18next';
import { LocalizedCommand } from '../../lib/i18n/LocalizedCommand.js';
import EmbedBuilder from '../../lib/EmbedBuilder.js';
import { createErrorEmbed } from '../../util/EmbedUtil.js';
import { registerCommandDescriptions, registerOptionDescriptions } from '../../lib/i18n/LanguageManager.js';

export default class extends LocalizedCommand {
    public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
        const t = await fetchT(interaction);

        if (interaction.user.id !== process.env.OWNER) {
            await interaction.reply({ embeds: [createErrorEmbed(
                t('commands:eval.forbidden')
            )], flags: MessageFlags.Ephemeral });

            return;
        }

        let output;
        const embed = new EmbedBuilder()
            .setTitle(t('commands:eval.embed.title'))
            .setFields({
                name: t('commands:eval.embed.codeFieldName'),
                value: `\`\`\`js\n${interaction.options.getString('code')}\`\`\``,
            });

        try {
            output = eval(interaction.options.getString('code', true));
        } catch (error) {
            container.logger.debug(error as Error);
            output = (error as Error).message;
            embed.setTitle(t('commands:eval.embed.resultFieldCrashed'));
        }

        if (!output || output.toString().trim().length < 1) {
            output = '<empty>';
        }

        embed.addFields([{ name: t('commands:eval.embed.resultFieldName'), value: output.toString() }]);

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            command =>
                registerCommandDescriptions(command
                    .setName(this.name)
                    .setDefaultMemberPermissions(0)
                    .addStringOption(option => registerOptionDescriptions(this.name, option
                        .setName('code')
                        .setRequired(true)
                    ))
                ),
            {
                guildIds: [
                    '428002317833469963', // Starius
                ],
            }
        );
    }
}
