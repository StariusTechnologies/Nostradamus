import type { Client } from 'discord.js';

export const Emojis = {
    Francophonie: '<a:francophonie:1390707250297049260>',
    Anglophonie: '<a:anglophonie:1390707262586228927>',
};

export function getEmojiURL(emoji: string) {
    const [, emojiName] = emoji.split(':');

    if (!emojiName) {
        throw new Error(`Invalid emoji: ${emoji}`);
    }

    return `${process.env.STATIC_ROOT_URL}emojis/${emojiName}.png`;
}

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
