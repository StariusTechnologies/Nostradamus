import {
    type CommandInteraction,
    type InteractionCallbackResponse,
    type InteractionDeferReplyOptions,
    type InteractionEditReplyOptions,
    type InteractionReplyOptions,
    type InteractionResponse,
    type Message,
    type MessageEditOptions,
    MessageFlags,
    TextDisplayBuilder
} from 'discord.js';

type ReplyInput = string | InteractionReplyOptions;
type EditInput = string | InteractionEditReplyOptions | MessageEditOptions;

function withV2Flag<T>(flags: T): T {
    const numeric: number = typeof flags === 'number' ? flags : 0;

    return (numeric | MessageFlags.IsComponentsV2) as unknown as T;
}

function normalizeReply(input: ReplyInput): InteractionReplyOptions {
    const options: InteractionReplyOptions = typeof input === 'string'
        ? { components: [new TextDisplayBuilder().setContent(input)] }
        : { ...input };

    options.flags = withV2Flag(options.flags);

    return options;
}

function normalizeEdit(input: EditInput): InteractionEditReplyOptions {
    const options: InteractionEditReplyOptions = typeof input === 'string'
        ? { components: [new TextDisplayBuilder().setContent(input)] }
        : { ...input } as InteractionEditReplyOptions;

    options.flags = withV2Flag(options.flags);

    return options;
}

export class InteractionManager
{
    private interaction: CommandInteraction;
    private followedUpMessage?: Message;

    public constructor(interaction: CommandInteraction) {
        this.interaction = interaction;
    }

    public async deferReply(options: InteractionDeferReplyOptions = {}) {
        if (this.interaction.deferred || this.interaction.replied) {
            return this;
        }

        await this.interaction.deferReply({
            ...options,
            flags: withV2Flag(options.flags),
        });

        return this;
    }

    public async reply(
        input: ReplyInput
    ): Promise<InteractionCallbackResponse | InteractionResponse | Message> {
        const options = normalizeReply(input);

        return this.interaction.replied
            ? this.replyReplied(options)
            : this.replyNotReplied(options);
    }

    public async edit(input: EditInput): Promise<InteractionResponse | Message> {
        const options = normalizeEdit(input);

        if (!this.followedUpMessage) {
            return this.interaction.editReply(options);
        }

        return this.followedUpMessage.edit(options as MessageEditOptions);
    }

    private async replyNotReplied(
        options: InteractionReplyOptions
    ): Promise<InteractionCallbackResponse | InteractionResponse | Message> {
        return this.interaction.reply(options);
    }

    private async replyReplied(
        options: InteractionReplyOptions
    ): Promise<InteractionCallbackResponse | InteractionResponse | Message> {
        this.followedUpMessage = await this.interaction.followUp(options);

        return this.followedUpMessage;
    }
}
