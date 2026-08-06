import {
    ContainerBuilder,
    type GuildMember,
    type Message,
    SeparatorBuilder,
    TextDisplayBuilder,
    type User
} from 'discord.js';
import { MessageFlags } from 'discord-api-types/v10';
import { container } from '@sapphire/framework';
import { Colors } from '../../util/Colors.js';
import { BASE_SEARCH_WORDS, CANCEL_WORDS } from './Words.js';

class AnsyDetectionImpl {
    public async handle(message: Message): Promise<void> {
        if (!message.inGuild() || message.author.bot) {
            return;
        }

        const ownerId: string = process.env.OWNER;

        if (!ownerId || message.author.id === ownerId || message.mentions.users.has(ownerId)) {
            return;
        }

        const content: string = message.content.toLowerCase();

        if (this.isCancelled(content)) {
            return;
        }

        const owner: User | null = await this.resolveOwner(message, ownerId);

        if (!owner) {
            return;
        }

        const ownerMember: GuildMember | undefined = message.guild.members.cache.get(ownerId);
        const searchWords: string[] = this.buildSearchWords(owner, ownerId, ownerMember);

        if (!this.matches(content, searchWords)) {
            return;
        }

        await this.notify(message, owner);
    }

    private isCancelled(content: string): boolean {
        return CANCEL_WORDS.some(word => content.includes(word));
    }

    private matches(content: string, searchWords: string[]): boolean {
        return searchWords.some(word => content.includes(word));
    }

    private buildSearchWords(owner: User, ownerId: string, ownerMember: GuildMember | undefined): string[] {
        const words: string[] = [
            ownerId,
            owner.username,
            owner.displayName,
            ...BASE_SEARCH_WORDS,
        ];

        if (ownerMember?.nickname) {
            words.push(ownerMember.nickname);
        }

        return words
            .map(word => word.toLowerCase())
            .filter(word => word.length > 0);
    }

    private async resolveOwner(message: Message<true>, ownerId: string): Promise<User | null> {
        const cached: User | undefined = message.client.users.cache.get(ownerId);

        if (cached) {
            return cached;
        }

        return message.client.users.fetch(ownerId).catch(() => null);
    }

    private async notify(message: Message<true>, owner: User): Promise<void> {
        const authorName: string = message.member?.displayName ?? message.author.username;
        const channelName: string = message.channel.name;
        const meta: string = `**${authorName}** — #${channelName} in ${message.guild.name}`;

        const notification: ContainerBuilder = new ContainerBuilder()
            .setAccentColor(Colors.Info)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### 💬 Someone talked about you\n${meta}`)
            )
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(message.content),
                new TextDisplayBuilder().setContent(`-# [Jump to message](${message.url})`)
            );

        await owner.send({
            flags: MessageFlags.IsComponentsV2,
            components: [notification],
            allowedMentions: { parse: [] },
        }).catch(err => {
            container.logger.warn(`AnsyDetection: failed to DM the owner: ${err}`);
        });
    }
}

export const AnsyDetection = new AnsyDetectionImpl();
