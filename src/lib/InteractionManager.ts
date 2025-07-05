import {
    CommandInteraction,
    type InteractionCallbackResponse,
    type InteractionResponse,
    type Message
} from 'discord.js';

export class InteractionManager
{
    private interaction: CommandInteraction;
    private followedUpMessage?: Message;

    public constructor(interaction: CommandInteraction) {
        this.interaction = interaction;
    }

    public async deferReply(...args: Parameters<CommandInteraction['deferReply']>) {
        if (this.interaction.deferred || this.interaction.replied) {
            return;
        }

        await this.interaction.deferReply(...args);

        return this;
    }

    public async reply(
        ...args: Parameters<CommandInteraction['reply']>
    ): Promise<InteractionCallbackResponse | InteractionResponse | Message> {
        return this.interaction.replied
            ? this.replyReplied(...args)
            : this.replyNotReplied(...args);
    }

    public async edit(
        ...args: Parameters<Message['edit']>
    ): Promise<InteractionResponse | Message> {
        if (!this.followedUpMessage) {
            return this.interaction.editReply(...args);
        }

        return this.followedUpMessage.edit(...args);
    }

    private async replyNotReplied(
        ...args: Parameters<CommandInteraction['reply']>
    ): Promise<InteractionCallbackResponse | InteractionResponse | Message> {
        return this.interaction.reply(...args);
    }

    private async replyReplied(
        ...args: Parameters<CommandInteraction['reply']>
    ): Promise<InteractionCallbackResponse | InteractionResponse | Message> {
        this.followedUpMessage = await this.interaction.followUp(...args);

        return this.followedUpMessage;
    }
}
