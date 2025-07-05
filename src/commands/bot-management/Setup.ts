import { ChatInputCommandInteraction } from 'discord.js';
import { ChannelType, InteractionContextType, MessageFlags } from 'discord-api-types/v10';
import { type ApplicationCommandRegistry } from '@sapphire/framework';
import { fetchT } from '@sapphire/plugin-i18next';
import { LocalizedCommand } from '../../lib/i18n/LocalizedCommand.js';
import { registerCommandDescriptions, registerOptionDescriptions } from '../../lib/i18n/LanguageManager.js';
import { saveSetting, SettingKey } from '../../lib/Settings.js';
import { InteractionManager } from '../../lib/InteractionManager.js';
import { Emojis } from '../../util/Emojis.js';

export default class extends LocalizedCommand {
    public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply({ flags: MessageFlags.Ephemeral });

        const t = await fetchT(interaction);
        let savedSomething = false;
        const settings = [
            SettingKey.BotLogChannel,
            SettingKey.NativeLanguageRole,
        ];

        for (const setting of settings) {
            const value = interaction.options.get(setting)?.value;

            if (value === undefined || value === null) {
                continue;
            }

            await saveSetting(interaction.guild!.id, setting, value);
            savedSomething = true;
        }

        if (!savedSomething) {
            await interactionManager.edit(t('commands:setup.nothingChanged', { emoji: '🤔' }));

            return;
        }

        await interactionManager.edit(t('commands:setup.confirm', { emoji: Emojis.RainbowSheep }));
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(command =>
            registerCommandDescriptions(command
                .setName(this.name)
                .setDefaultMemberPermissions(0)
                .setContexts(InteractionContextType.Guild)
                .addChannelOption(option => registerOptionDescriptions(this.name, option
                    .setName(SettingKey.BotLogChannel)
                    .addChannelTypes(ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread)
                    .setRequired(false)
                ))
                .addRoleOption(option => registerOptionDescriptions(this.name, option
                    .setName(SettingKey.NativeLanguageRole)
                    .setRequired(false)
                ))
            )
        );
    }
}
