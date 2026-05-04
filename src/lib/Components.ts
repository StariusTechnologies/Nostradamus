import { ContainerBuilder, TextDisplayBuilder } from 'discord.js';

const ColorError: number = 0xfc3e5c;
const ColorConfirm: number = 0x7eb301;
const ColorInfo: number = 0x43adfc;

export type ComponentMessage = { components: ContainerBuilder[] };

function coloredContainer(text: string, accentColor: number): ComponentMessage {
    const container = new ContainerBuilder()
        .setAccentColor(accentColor)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));

    return { components: [container] };
}

export const Components = {
    error: (text: string): ComponentMessage => coloredContainer(text, ColorError),
    confirm: (text: string): ComponentMessage => coloredContainer(text, ColorConfirm),
    info: (text: string): ComponentMessage => coloredContainer(text, ColorInfo),
};
