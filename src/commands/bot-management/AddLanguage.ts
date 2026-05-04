import type { ChatInputCommandInteraction } from 'discord.js';
import { MessageFlags } from 'discord.js';
import { ApplicationCommandRegistry } from '@sapphire/framework';
import { registerCommandDescriptions, registerOptionDescriptions } from '../../lib/i18n/LanguageManager.js';
import { fetchT } from '@sapphire/plugin-i18next';
import { Emojis } from '../../util/Emojis.js';
import { LocalizedCommand } from '../../lib/i18n/LocalizedCommand.js';
import { InteractionManager } from '../../lib/InteractionManager.js';
import { Components } from '../../lib/Components.js';
import { InteractionContextType } from 'discord-api-types/v10';
import { error } from '../../lib/Logger.js';

export default class extends LocalizedCommand {
    public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply({ flags: MessageFlags.Ephemeral });

        const t = await fetchT(interaction);
        const guild = interaction.guild!;
        const englishName = interaction.options.getString('english-name', true);
        const frenchName = interaction.options.getString('french-name', true);
        const existingRole = guild.roles.cache.find(role => role.name.toLowerCase() === frenchName.toLowerCase());

        if (existingRole) {
            await interactionManager.edit(Components.error(t(
                'commands:addlanguage.error.alreadyExists',
                { emoji: '❌', role: `<@&${existingRole.id}>` }
            )));

            return;
        }

        if (guild.roles.cache.size > 249) {
            await interactionManager.edit(Components.error(
                t('commands:addlanguage.error.noSlotLeft', { emoji: '❌' })
            ));

            return;
        }

        let role;

        try {
            role = await guild.roles.create({ name: frenchName });
        } catch (err) {
            error(
                guild.id,
                `Could not create language role ${frenchName}: ${err}`,
                this.logFooter
            );

            this.container.logger.error(err);
            await interactionManager.edit(Components.error(
                t('commands:addlanguage.error.couldNotCreateRole', { emoji: '❌' })
            ));

            return;
        }

        await this.container.prisma.language.create({
            data: {
                frName: frenchName.toLowerCase(),
                enName: englishName.toLowerCase(),
                idGuild: guild.id,
                idRole: role.id,
            },
        });

        await interactionManager.edit(Components.confirm(t('commands:addlanguage.confirm', {
            emoji: Emojis.RainbowSheep,
            role: `<@&${role.id}>`,
            slotsTaken: guild.roles.cache.size,
        })));
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(command =>
            registerCommandDescriptions(command
                .setName(this.name)
                .setDefaultMemberPermissions(0)
                .setContexts(InteractionContextType.Guild)
                .addStringOption(option => registerOptionDescriptions(this.name, option
                    .setName('english-name')
                    .setRequired(true)
                ))
                .addStringOption(option => registerOptionDescriptions(this.name, option
                    .setName('french-name')
                    .setRequired(true)
                ))
            )
        );
    }
}
