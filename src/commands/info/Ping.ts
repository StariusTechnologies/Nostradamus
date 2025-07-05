import type { ChatInputCommandInteraction, Message, InteractionCallbackResponse } from 'discord.js';
import { ApplicationCommandRegistry } from '@sapphire/framework';
import { fetchT } from '@sapphire/plugin-i18next';
import { LocalizedCommand } from '../../lib/i18n/LocalizedCommand.js';
import { registerCommandDescriptions } from '../../lib/i18n/LanguageManager.js';
import { InteractionManager } from '../../lib/InteractionManager.js';

export default class extends LocalizedCommand {
    public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
        const t = await fetchT(interaction);
        const interactionManager = new InteractionManager(interaction);
        const response = await interactionManager.reply({ content: 'Ping...', withResponse: true });
        const responseTimestamp = (response as Message).createdTimestamp
            ?? (response as InteractionCallbackResponse).resource!.message!.createdTimestamp;
        const latency = responseTimestamp - interaction.createdTimestamp;

        await interactionManager.edit(t('commands:ping.response', { latency })).catch(
            error => this.container.logger.error(error)
        );
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(command =>
            registerCommandDescriptions(command
                .setName(this.name)
                .setDefaultMemberPermissions(0)
            )
        );
    }
}
