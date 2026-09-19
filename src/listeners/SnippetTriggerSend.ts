import type { Message } from 'discord.js';
import { Events, Listener, type ListenerOptions } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { fetchSnippetForReading, sendSnippet } from '../lib/SnippetService.js';
import { getSetting, SettingKey } from '../lib/SettingsService.js';
import { PermissionFlagsBits } from 'discord-api-types/v10';

@ApplyOptions<ListenerOptions>({
    event: Events.MessageCreate,
})
export default class extends Listener {
    public async run(message: Message): Promise<void> {
        if (!message.inGuild() || message.system || message.author.bot) {
            return;
        }

        const prefix = await getSetting(message.guildId, SettingKey.SnippetPrefix);

        if (message.partial) {
            await message.fetch();
        }

        if (!prefix || !message.content.startsWith(prefix)) {
            return;
        }

        const botMember = await message.guild.members.fetch(message.client.user.id);
        const canPost = message.channel?.permissionsFor(botMember).has(PermissionFlagsBits.SendMessages);
        const member = await message.guild.members.fetch(message.author.id);

        if (!member || !canPost) {
            return;
        }

        const trigger = message.content.slice(prefix.length);
        const snippet = await fetchSnippetForReading(trigger, message.guildId, member);

        if (!snippet) {
            return;
        }

        const responseToId = message.reference?.messageId;
        const responseTo = responseToId
            ? await message.channel.messages.fetch(responseToId).catch(() => undefined)
            : undefined;

        await sendSnippet(message.channel, snippet, responseTo);
    }
}
