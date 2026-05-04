import process from 'node:process';
import {
    type ChatInputCommandInteraction,
    ContainerBuilder,
    TextDisplayBuilder
} from 'discord.js';
import { MessageFlags } from 'discord-api-types/v10';
import { ApplicationCommandRegistry, container } from '@sapphire/framework';
import { fetchT } from '@sapphire/plugin-i18next';
import { LocalizedCommand } from '../../lib/i18n/LocalizedCommand.js';
import { registerCommandDescriptions, registerOptionDescriptions } from '../../lib/i18n/LanguageManager.js';
import { InteractionManager } from '../../lib/InteractionManager.js';
import { Components } from '../../lib/Components.js';

export default class extends LocalizedCommand {
    public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        const t = await fetchT(interaction);

        if (interaction.user.id !== process.env.OWNER) {
            await interactionManager.reply({
                ...Components.error(t('commands:eval.forbidden')),
                flags: MessageFlags.Ephemeral,
            });

            return;
        }

        const code: string = interaction.options.getString('code', true);
        let output: string;
        let crashed: boolean = false;

        try {
            const result: unknown = eval(code);

            output = result === undefined || result === null
                ? '<empty>'
                : String(result);
        } catch (error) {
            container.logger.debug(error as Error);
            output = (error as Error).message;
            crashed = true;
        }

        if (output.trim().length < 1) {
            output = '<empty>';
        }

        const title: string = crashed
            ? t('commands:eval.embed.resultFieldCrashed')
            : t('commands:eval.embed.title');

        const resultContainer = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`## ${title}`),
                new TextDisplayBuilder().setContent(
                    `**${t('commands:eval.embed.codeFieldName')}**\n\`\`\`js\n${code}\n\`\`\``
                ),
                new TextDisplayBuilder().setContent(
                    `**${t('commands:eval.embed.resultFieldName')}**\n\`\`\`\n${output}\n\`\`\``
                )
            );

        await interactionManager.reply({
            components: [resultContainer],
            flags: MessageFlags.Ephemeral,
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry): void {
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
                    '428002317833469963',
                ],
            }
        );
    }
}
