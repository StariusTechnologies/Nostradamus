import type { ChatInputCommandInteraction } from 'discord.js';
import { type ApplicationCommandRegistry } from '@sapphire/framework';
import { InteractionContextType } from 'discord-api-types/v10';
import { fetchT } from '@sapphire/plugin-i18next';
import { LocalizedCommand } from '../../lib/i18n/LocalizedCommand.js';
import { registerCommandDescriptions } from '../../lib/i18n/LanguageManager.js';
import { InteractionManager } from '../../lib/InteractionManager.js';
import EmbedBuilder from '../../lib/EmbedBuilder.js';
import { Emojis } from '../../util/Emojis.js';
import type { Topic } from '@prisma/client';

const TOPIC_LOCALE: string = 'fr';

type PickedTopic = Pick<Topic, 'id' | 'text'>;

export default class extends LocalizedCommand {
    public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
        const interactionManager = new InteractionManager(interaction);

        await interactionManager.deferReply();

        const t = await fetchT(interaction);
        const topic = await this.pickLeastUsedTopic();

        if (!topic) {
            await interactionManager.edit(t('commands:sujet.noTopics', { emoji: '❌' }));

            return;
        }

        const embed = new EmbedBuilder()
            .setTitle(t('commands:sujet.title', { emoji: Emojis.RainbowSheep }))
            .setDescription(topic.text);

        await interactionManager.edit({ content: null, embeds: [embed] });

        await this.container.prisma.topic.update({
            where: { id: topic.id },
            data: { postCount: { increment: 1 } },
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry): void {
        registry.registerChatInputCommand(command =>
            registerCommandDescriptions(command
                .setName(this.name)
                .setContexts(InteractionContextType.Guild)
            )
        );
    }

    private async pickLeastUsedTopic(): Promise<PickedTopic | null> {
        const minRow = await this.container.prisma.topic.aggregate({
            _min: { postCount: true },
            where: { locale: TOPIC_LOCALE },
        });
        const minPostCount: number | null = minRow._min.postCount;

        if (minPostCount === null) {
            return null;
        }

        const candidates: PickedTopic[] = await this.container.prisma.topic.findMany({
            where: { locale: TOPIC_LOCALE, postCount: minPostCount },
            select: { id: true, text: true },
        });

        if (candidates.length === 0) {
            return null;
        }

        return candidates[Math.floor(Math.random() * candidates.length)];
    }
}
