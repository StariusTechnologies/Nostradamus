import {
    type ChatInputCommandInteraction,
    type Guild,
    type GuildMember,
    type Message
} from 'discord.js';
import { MessageFlags } from 'discord.js';
import { InteractionContextType } from 'discord-api-types/v10';
import {
    type ApplicationCommandRegistry,
    type Args,
    Command as SapphireCommand,
    container as sapphireContainer
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
import { DEFAULT_PRIMARY_LOCALE, getSetting, SettingKey } from '../../lib/Settings.js';
import { parseUserToken } from '../../util/Discord.js';
import { type TFunction } from 'i18next';

const COMMAND_NAME = 'prevent-suicide';

export default class extends LocalizedCommand {
    public constructor(context: SapphireCommand.LoaderContext, options?: SapphireCommand.Options) {
        super(context, {
            ...options,
            name: COMMAND_NAME,
            preconditions: [{ name: 'RoleTier', context: { tier: 'helper' } }],
        });
    }

    public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply({ flags: MessageFlags.Ephemeral });

        const t = await fetchT(interaction);
        const guild = interaction.guild!;
        const user = interaction.options.getUser('user', true);
        const member = await guild.members.fetch(user.id).catch(() => null);

        if (!member) {
            await interactionManager.edit(Components.error(
                t('commands:prevent-suicide.error.notFound', { emoji: '❌' })
            ));

            return;
        }

        const sent = await this.sendPreventionDm(guild, member);

        if (!sent) {
            await interactionManager.edit(Components.error(
                t('commands:prevent-suicide.error.dmFailed', { emoji: '❌' })
            ));

            return;
        }

        await interactionManager.edit(Components.confirm(
            t('commands:prevent-suicide.confirm', {
                emoji: Emojis.RainbowSheep,
                user: `<@${member.id}>`,
            })
        ));
    }

    public override async messageRun(message: Message, args: Args): Promise<void> {
        if (!message.inGuild()) {
            return;
        }

        const t = await this.resolveMessageTranslator(message);
        const member = await this.resolveMember(message, args);

        if (!member) {
            await message.reply(Components.error(
                t('commands:prevent-suicide.error.notFound', { emoji: '❌' })
            )).catch(() => null);

            return;
        }

        const sent = await this.sendPreventionDm(message.guild, member);

        if (sent) {
            await message.react('✅').catch(() => null);

            return;
        }

        await message.reply(Components.error(
            t('commands:prevent-suicide.error.dmFailed', { emoji: '❌' })
        )).catch(() => null);
    }

    private async resolveMessageTranslator(message: Message<true>): Promise<TFunction> {
        const preference = await this.container.prisma.userPreference.findUnique({
            where: { idUser: message.author.id },
        });
        const locale = preference?.locale
            ?? await getSetting(message.guild.id, SettingKey.PrimaryLocale)
            ?? DEFAULT_PRIMARY_LOCALE;

        return sapphireContainer.i18n.getT(locale);
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry): void {
        registry.registerChatInputCommand(command =>
            registerCommandDescriptions(command
                .setName(this.name)
                .setDefaultMemberPermissions(0)
                .setContexts(InteractionContextType.Guild)
                .addUserOption(option => registerOptionDescriptions(this.name, option
                    .setName('user')
                    .setRequired(true)
                ))
            )
        );
    }

    private async resolveMember(message: Message<true>, args: Args): Promise<GuildMember | null> {
        const mentioned = message.mentions.members?.first();

        if (mentioned) {
            return mentioned;
        }

        const raw = await args.pick('string').catch(() => null);

        if (!raw) {
            return null;
        }

        const id = parseUserToken(raw);

        if (!id) {
            return null;
        }

        return message.guild.members.fetch(id).catch(() => null);
    }

    private async sendPreventionDm(guild: Guild, member: GuildMember): Promise<boolean> {
        const locales = await this.resolveLocalesForMember(guild, member);
        const parts = locales.map(locale => sapphireContainer.i18n.getT(locale)(
            'commands:prevent-suicide.dm',
            { user: `<@${member.id}>`, guildName: guild.name }
        ));
        const body = parts.join('\n\n');

        try {
            await member.send(body);

            return true;
        } catch (err) {
            this.container.logger.warn(`prevent-suicide DM to ${member.id} failed: ${err}`);

            return false;
        }
    }

    private async resolveLocalesForMember(guild: Guild, member: GuildMember): Promise<string[]> {
        const primaryLocale = await getSetting(guild.id, SettingKey.PrimaryLocale)
            ?? DEFAULT_PRIMARY_LOCALE;
        const nativeRoleId = await getSetting(guild.id, SettingKey.NativeLanguageRole);
        const isNative = Boolean(nativeRoleId && member.roles.cache.has(nativeRoleId));

        if (isNative) {
            return [primaryLocale];
        }

        if (primaryLocale === DEFAULT_PRIMARY_LOCALE) {
            return [DEFAULT_PRIMARY_LOCALE];
        }

        return [primaryLocale, DEFAULT_PRIMARY_LOCALE];
    }
}
