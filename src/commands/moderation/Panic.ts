import {
    type ChatInputCommandInteraction,
    type Message,
    PermissionsBitField,
    type Role
} from 'discord.js';
import { InteractionContextType, MessageFlags } from 'discord-api-types/v10';
import {
    type ApplicationCommandRegistry,
    type Args,
    Command as SapphireCommand
} from '@sapphire/framework';
import { fetchT } from '@sapphire/plugin-i18next';
import { LocalizedCommand } from '../../lib/i18n/LocalizedCommand.js';
import {
    registerCommandDescriptions,
    registerOptionDescriptions
} from '../../lib/i18n/LanguageManager.js';
import { InteractionManager } from '../../lib/InteractionManager.js';
import { Components } from '../../lib/Components.js';
import { Emojis } from '../../util/Emojis.js';
import { notice } from '../../lib/Logger.js';

const PANIC_OFF_WORDS: ReadonlySet<string> = new Set([
    'off', 'over', 'done', 'stop', 'calm', 'calme', 'calmer',
    'fini', 'finie', 'passé', 'passee', 'passée',
    'arrête', 'arrete', 'arrêter', 'arreter',
]);

const PANIC_PERMS = [
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.Speak,
] as const;

export default class extends LocalizedCommand {
    public constructor(context: SapphireCommand.LoaderContext, options?: SapphireCommand.Options) {
        super(context, {
            ...options,
            preconditions: [{ name: 'RoleTier', context: { tier: 'mod' } }],
        });
    }

    public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply({ flags: MessageFlags.Ephemeral });

        const t = await fetchT(interaction);
        const guild = interaction.guild!;
        const state = interaction.options.getString('state', true) as 'on' | 'off';
        const enable = state === 'on';

        await this.applyPanic(guild, enable, interaction.user.username);

        await interactionManager.edit(Components.confirm(
            t(enable ? 'commands:panic.confirm.enabled' : 'commands:panic.confirm.disabled', {
                emoji: Emojis.RainbowSheep,
            })
        ));
    }

    public override async messageRun(message: Message, args: Args): Promise<void> {
        if (!message.inGuild()) {
            return;
        }

        const firstArg = await args.pick('string').catch(() => null);
        const enable = !firstArg || !PANIC_OFF_WORDS.has(firstArg.toLowerCase());

        await this.applyPanic(message.guild, enable, message.author.username);
        await message.react('✅').catch(() => null);
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry): void {
        registry.registerChatInputCommand(command =>
            registerCommandDescriptions(command
                .setName(this.name)
                .setDefaultMemberPermissions(0)
                .setContexts(InteractionContextType.Guild)
                .addStringOption(option => registerOptionDescriptions(this.name, option
                    .setName('state')
                    .setRequired(true)
                    .addChoices(
                        { name: 'on', value: 'on' },
                        { name: 'off', value: 'off' }
                    )
                ))
            )
        );
    }

    private async applyPanic(
        guild: import('discord.js').Guild,
        enable: boolean,
        invokerUsername: string
    ): Promise<void> {
        notice(
            guild.id,
            `${enable ? 'Entering' : 'Leaving'} server panic mode (called by ${invokerUsername})`,
            this.logFooter
        );

        const { everyone } = guild.roles;
        const panicRoleRows = await this.container.prisma.panicRole.findMany({
            where: { idGuild: guild.id },
        });
        const panicRoles: Role[] = panicRoleRows
            .map(row => guild.roles.cache.get(row.idRole))
            .filter((role): role is Role => Boolean(role));

        await this.updateRolePermissions(everyone, enable);

        for (const role of panicRoles) {
            await this.updateRolePermissions(role, enable);
        }

        notice(
            guild.id,
            `${enable ? 'Entered' : 'Left'} server panic mode`,
            this.logFooter
        );
    }

    private async updateRolePermissions(role: Role, enable: boolean): Promise<void> {
        let perms = role.permissions;

        for (const flag of PANIC_PERMS) {
            perms = enable ? perms.remove(flag) : perms.add(flag);
        }

        await role.setPermissions(perms).catch(err => {
            this.container.logger.warn(`Could not update permissions on role ${role.id}: ${err}`);
        });
    }
}
