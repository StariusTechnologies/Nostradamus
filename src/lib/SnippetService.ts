import { container } from '@sapphire/framework';
import type { GuildMember } from 'discord.js';
import type { Snippet } from '@prisma/client';
import { isMemberStaff } from './StaffService.js';

export const SNIPPET_NAME_MAX_LENGTH = 80;
export const SNIPPET_CONTENT_MAX_LENGTH = 4000;
export const SNIPPET_NAME_REGEX = /^[a-z0-9_-]+$/u;

export type SNIPPET_PERMISSION = 'read' | 'edit' | 'restrict';

export async function isSnippetAllowed(
    snippet: Snippet,
    member: GuildMember,
    permission: SNIPPET_PERMISSION,
) {
    let allowed = member && (permission === 'restrict' ? await isMemberStaff(member, 'moderator') : false);

    if (permission !== 'restrict') {
        const permissionValue = permission === 'read' ? snippet?.canRead : snippet?.canEdit;
        const allowedIds = Array.isArray(permissionValue) ? permissionValue : [];

        allowed = permission === 'read' && allowedIds.length < 1 ||
            permission === 'edit' && snippet?.idUser === member.id ||
            allowedIds.includes(member.id) ||
            member && await isMemberStaff(member, 'moderator') ||
            [...(member.roles.cache.values() ?? [])].some(role => allowedIds.includes(role.id));
    }

    return snippet && allowed ? snippet : null;
}

export async function fetchSnippetAutocompleteResponse(
    trigger: string,
    guildId: string,
    member: GuildMember,
    permission: SNIPPET_PERMISSION,
) {
    const snippets = await container.prisma.snippet.findMany({
        where: {
            OR: [
                { aliases: { some: { alias: { contains: trigger } } } },
                { content: { contains: trigger } },
            ],
            idGuild: guildId!,
        },
        include: { aliases: true },
    });

    const allowedSnippets = (await Promise.all(snippets.map(async snippet => {
        return await isSnippetAllowed(snippet, member, permission) ? snippet : null;
    }))).filter(snippet => snippet !== null);

    return allowedSnippets.map(snippet => {
        const alias = snippet.aliases.find(alias => alias.isPrimary)!;
        const nameStart = `${alias.alias} - "`;
        const lengthLeft = 100 - nameStart.length - 1;
        const content = snippet.content.replace(/\r?\n/gu, ' ').replace(/<a?(?<code>:[^:]+:)\d+>/gu, '$<code>');
        const nameEnd = content.length > lengthLeft ? `${content.slice(0, lengthLeft - 1)}…"` : `${content}"`;

        return {
            name: `${nameStart}${nameEnd}`,
            value: alias.alias,
        }
    }).slice(0, 25);
}

export async function fetchSnippet(trigger: string, guildId: string) {
    return container.prisma.snippet.findFirst({
        where: { aliases: { some: { alias: trigger.toLowerCase() } }, idGuild: guildId },
        include: { aliases: true },
    });
}

export async function memberHasSnippets(member: GuildMember) {
    return (await container.prisma.snippet.count({
        where: {
            idGuild: member.guild.id,
            idUser: member.id,
        },
    })) > 0;
}

export async function fetchAllowedSnippet(
    trigger: string,
    guildId: string,
    member: GuildMember,
    permission: SNIPPET_PERMISSION,
) {
    const snippet = await fetchSnippet(trigger, guildId);
    const allowed = member && snippet ? await isSnippetAllowed(snippet, member, permission) : false;

    return allowed ? snippet : null;
}

export async function fetchSnippetForReading(trigger: string, guildId: string, member: GuildMember) {
    return fetchAllowedSnippet(trigger, guildId, member, 'read');
}

export async function fetchSnippetForEditing(trigger: string, guildId: string, member: GuildMember) {
    return fetchAllowedSnippet(trigger, guildId, member, 'edit');
}

export async function fetchSnippetForRestricting(trigger: string, guildId: string, member: GuildMember) {
    return fetchAllowedSnippet(trigger, guildId, member, 'restrict');
}

export async function createSnippet(
    name: string,
    content: string,
    guildId: string,
    userId: string,
    attachmentUrl?: string | null,
): Promise<Snippet> {
    return container.prisma.snippet.create({
        data: {
            idGuild: guildId,
            idUser: userId,
            content,
            attachmentUrl,
            createdAt: new Date(),
            canRead: [],
            canEdit: [],
            aliases: { create: [{ alias: name, isPrimary: 'PRIMARY' }] },
        },
    });
}

export async function editSnippet(
    id: number,
    content?: string | null,
    attachmentUrl?: string | null,
): Promise<void> {
    if (!content && !attachmentUrl) {
        return;
    }

    await container.prisma.snippet.update({
        where: { id },
        data: {
            ...(content ? { content } : {}),
            ...(attachmentUrl ? { attachmentUrl } : {}),
        },
    });
}

export async function deleteSnippet(id: number): Promise<void> {
    await container.prisma.snippet.delete({ where: { id } });
}

export async function restrictSnippet(
    id: number,
    canRead?: string[] | null,
    canEdit?: string[] | null,
): Promise<void> {
    if (!Array.isArray(canRead) && !Array.isArray(canEdit)) {
        return;
    }

    await container.prisma.snippet.update({
        where: { id },
        data: {
            ...(canRead ? { canRead } : {}),
            ...(canEdit ? { canEdit } : {}),
        },
    });
}

export async function addSnippetAlias(
    idSnippet: number,
    alias: string,
    isPrimary: boolean = false,
) {
    const snippet = await container.prisma.snippet.findUniqueOrThrow({ where: { id: idSnippet } });
    const { idGuild } = snippet;

    // noinspection ES6MissingAwait
    await container.prisma.$transaction([
        ...(isPrimary ? [container.prisma.snippetAlias.updateMany({
            where: { idSnippet },
            data: { isPrimary: null },
        })] : []),
        container.prisma.snippetAlias.create({
            data: {
                idGuild,
                idSnippet,
                alias,
                isPrimary: isPrimary ? 'PRIMARY' : null,
            },
        }),
    ]);
}

export async function editSnippetAlias(
    idSnippet: number,
    idAlias: number,
    alias: string,
    isPrimary?: boolean,
) {
    const snippetAlias = await container.prisma.snippetAlias.findUniqueOrThrow({ where: { id: idAlias } });

    if (snippetAlias.isPrimary && isPrimary === false) {
        throw new Error(`Removing this snippet's alias' primary status would leave this snippet with no primary alias, which is impossible.`);
    }

    if (isPrimary) {
        // noinspection ES6MissingAwait
        await container.prisma.$transaction([
            container.prisma.snippetAlias.updateMany({
                where: { idSnippet },
                data: { isPrimary: null },
            }),
            container.prisma.snippetAlias.update({
                where: { id: idAlias },
                data: { alias, isPrimary: 'PRIMARY' },
            }),
        ]);
    } else {
        await container.prisma.snippetAlias.update({
            where: { id: idAlias },
            data: { alias },
        });
    }
}

export async function deleteSnippetAlias(idAlias: number) {
    const snippetAlias = await container.prisma.snippetAlias.findUniqueOrThrow({ where: { id: idAlias } });

    if (snippetAlias.isPrimary) {
        throw new Error(`You cannot delete a snippet's primary alias`);
    }

    await container.prisma.snippetAlias.delete({ where: { id: snippetAlias.id } });
}
