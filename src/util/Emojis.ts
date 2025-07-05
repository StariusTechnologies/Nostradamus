import type { Client } from 'discord.js';

export const Emojis = {
    Anglophonie: '<a:anglophonie:1391130284409487410>',
    Francophonie: '<a:francophonie:1391130295146909937>',
    RainbowSheep: '<a:rainbowsheep:1391130303703289980>',
};

export async function loadEmojis(client: Client) {
    const emojis = ((await client.rest.get(`/applications/${client.user!.id}/emojis`)) as any).items;

    for (const key of Object.keys(Emojis)) {
        const [, emojiName] = Emojis[key as keyof typeof Emojis].split(':');

        const emoji = emojis.find((emoji: any) => emoji.name === emojiName);

        if (emoji) {
            Emojis[key as keyof typeof Emojis] = `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`;
        }
    }
}
