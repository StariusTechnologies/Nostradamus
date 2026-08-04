import {
    type ChatInputCommandInteraction,
    ContainerBuilder,
    TextDisplayBuilder
} from 'discord.js';
import { type ApplicationCommandRegistry } from '@sapphire/framework';
import { InteractionContextType } from 'discord-api-types/v10';
import { fetchT } from '@sapphire/plugin-i18next';
import { LocalizedCommand } from '../../lib/i18n/LocalizedCommand.js';
import { registerCommandDescriptions } from '../../lib/i18n/LanguageManager.js';
import { InteractionManager } from '../../lib/InteractionManager.js';
import { Components } from '../../lib/Components.js';
import { Emojis } from '../../util/Emojis.js';
import { Colors } from '../../util/Colors.js';
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
            await interactionManager.edit(Components.error(t('commands:sujet.noTopics', { emoji: '❌' })));

            return;
        }

        const container = new ContainerBuilder()
            .setAccentColor(Colors.Info)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## ${t('commands:sujet.title', { emoji: Emojis.RainbowSheep })}`
                ),
                new TextDisplayBuilder().setContent(topic.text)
            );

        await interactionManager.edit({ components: [container] });

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
