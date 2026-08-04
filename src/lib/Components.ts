import { ContainerBuilder, TextDisplayBuilder } from 'discord.js';
import { Colors } from '../util/Colors.js';

export type ComponentMessage = { components: ContainerBuilder[] };

function coloredContainer(text: string, accentColor: number): ComponentMessage {
    const container = new ContainerBuilder()
        .setAccentColor(accentColor)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));

    return { components: [container] };
}

export const Components = {
    error: (text: string): ComponentMessage => coloredContainer(text, Colors.Error),
    confirm: (text: string): ComponentMessage => coloredContainer(text, Colors.Confirm),
    info: (text: string): ComponentMessage => coloredContainer(text, Colors.Info),
};
