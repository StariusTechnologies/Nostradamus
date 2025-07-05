import {
    BitField,
    CommandInteraction,
    type InteractionCallbackResponse,
    type InteractionReplyOptions,
    type InteractionResponse,
    type Message,
} from 'discord.js';
import { MessageFlags } from 'discord-api-types/v10';

export class InteractionManager
{
    private interaction: CommandInteraction;
    private followedUpMessage?: Message;

    public constructor(interaction: CommandInteraction) {
        this.interaction = interaction;
    }

    public async reply(
        ...replyArguments: Parameters<CommandInteraction['reply']>
    ): Promise<InteractionCallbackResponse | InteractionResponse | Message> {
        return this.interaction.replied
            ? this.replyReplied(...replyArguments)
            : this.replyNotReplied(...replyArguments);
    }

    public async edit(
        ...editArguments: Parameters<Message['edit']>
    ): Promise<InteractionResponse | Message> {
        if (!this.followedUpMessage) {
            return this.interaction.editReply(...editArguments);
        }

        return this.followedUpMessage.edit(...editArguments);
    }

    private async replyNotReplied(
        ...replyArguments: Parameters<CommandInteraction['reply']>
    ): Promise<InteractionCallbackResponse | InteractionResponse | Message> {
        return this.interaction.reply(...replyArguments);
    }

    private async replyReplied(
        ...replyArguments: Parameters<CommandInteraction['reply']>
    ): Promise<InteractionCallbackResponse | InteractionResponse | Message> {
        const options = typeof replyArguments[0] === 'string' ? {} : replyArguments[0] as InteractionReplyOptions;
        const flags = new BitField(options.flags);
        const replyIsEphemeral = options.ephemeral || flags.has(MessageFlags.Ephemeral);

        if (this.interaction.ephemeral && replyIsEphemeral) {
            if (flags.has(MessageFlags.Ephemeral)) {
                flags.remove(MessageFlags.Ephemeral);
                (replyArguments[0] as InteractionReplyOptions).flags = flags;
            }

            return this.interaction.editReply(...replyArguments as Parameters<CommandInteraction['editReply']>);
        }

        this.followedUpMessage = await this.interaction.followUp(...replyArguments);

        return this.followedUpMessage;
    }
}
