import { container } from '@sapphire/framework';
import { SECOND } from '../util/DateTime.js';

const USER_AGENT: string = 'Nostradamus/5 (https://frenchdiscord.com)';
// Autocomplete has to answer within Discord's 3 second window, so it gives up well before that.
// A full page parse is allowed longer: the biggest entries weigh a few hundred kilobytes.
const SUGGEST_TIMEOUT: number = 2.5 * SECOND;
const LOOKUP_TIMEOUT: number = 8 * SECOND;
const SUGGESTION_LIMIT: number = 25;

export type WiktionarySense = {
    text: string,
    examples: string[],
    subSenses: WiktionarySense[],
};

export type WiktionaryEntry = {
    partOfSpeech: string,
    senses: WiktionarySense[],
};

export type WiktionarySection = {
    language: string,
    code: string | null,
    entries: WiktionaryEntry[],
};

export type WiktionaryPage = {
    title: string,
    url: string,
    language: string,
    entries: WiktionaryEntry[],
};

export type WiktionaryLookup =
    | { status: 'ok', page: WiktionaryPage }
    | { status: 'otherLanguages', title: string, url: string, languages: string[] }
    | { status: 'empty', title: string, url: string }
    | { status: 'missing' }
    | { status: 'error' };

// A language section is headed by that language's name written in the edition's own language, and only
// the French edition tags it with a machine-readable code, so both are used to spot the target section.
const SECTION_NAMES: Record<string, string> = {
    en: 'English',
    fr: 'Français',
};

export function editionLanguageName(edition: string): string {
    return SECTION_NAMES[edition] ?? edition;
}

function matchesEdition(section: WiktionarySection, edition: string): boolean {
    if (section.code) {
        return section.code === edition;
    }

    const expected = SECTION_NAMES[edition];

    return expected ? section.language === expected : true;
}

export function editionFromLocale(locale: string): string {
    return locale.split('-')[0].toLowerCase();
}

export function editionHost(edition: string): string {
    return `${edition}.wiktionary.org`;
}

export function pageUrl(edition: string, title: string): string {
    return `https://${editionHost(edition)}/wiki/${encodeURIComponent(title.replace(/\s+/gu, '_'))}`;
}

export function searchUrl(edition: string, query: string): string {
    return `https://${editionHost(edition)}/w/index.php?search=${encodeURIComponent(query)}`;
}

async function requestJson(url: string, timeoutMs: number): Promise<any> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': USER_AGENT },
        });

        if (!response.ok) {
            return null;
        }

        const payload = await response.json();

        return payload;
    } catch (error) {
        container.logger.warn(`Wiktionary request failed for ${url}: ${error}`);

        return null;
    } finally {
        clearTimeout(timeout);
    }
}

function decodeEntities(text: string): string {
    return text
        .replace(/&#(\d+);/gu, (_, code: string) => String.fromCodePoint(Number(code)))
        .replace(/&#x([\da-f]+);/giu, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
        .replace(/&lt;/gu, '<')
        .replace(/&gt;/gu, '>')
        .replace(/&quot;/gu, '"')
        .replace(/&apos;/gu, '\'')
        .replace(/&nbsp;/gu, ' ')
        .replace(/&amp;/gu, '&');
}

/**
 * Stands in for the `b` tags Wiktionary wraps the looked-up word in inside examples. A sentinel is used
 * rather than `**` directly because callers still have to escape the text for Discord, which would eat
 * real asterisks; they swap this out for bold markup once escaping is done.
 */
export const BOLD_MARKER: string = '\u0001';

// Block-level tags become a space so neighbouring blocks do not run into each other, while inline tags
// are dropped outright so a bolded part of a word stays glued to the rest of it.
function stripTags(html: string): string {
    const withoutNoise = html
        .replace(/<style\b[^>]*>.*?<\/style>/gsu, '')
        .replace(/<sup\b[^>]*class="[^"]*\breference\b[^"]*"[^>]*>.*?<\/sup>/gsu, '')
        .replace(/<\/?(?:div|dl|dt|dd|ul|ol|li|p|br|table|tr|td|th|blockquote)\b[^>]*>/gsu, ' ')
        .replace(/<\/?(?:b|strong)\b[^>]*>/gsu, BOLD_MARKER);

    return decodeEntities(withoutNoise.replace(/<[^>]*>/gsu, ''))
        .replace(/\s+/gu, ' ')
        .trim();
}

// Finds the closing tag matching an element already opened at `innerStart`, accounting for nesting.
function closeElement(html: string, tagPattern: string, innerStart: number): { innerEnd: number, end: number } | null {
    const pattern = new RegExp(`<(/?)(?:${tagPattern})\\b[^>]*>`, 'gsu');
    let depth = 1;
    let match: RegExpExecArray | null;

    pattern.lastIndex = innerStart;

    while ((match = pattern.exec(html)) !== null) {
        depth += match[1] === '/' ? -1 : 1;

        if (depth === 0) {
            return { innerEnd: match.index, end: pattern.lastIndex };
        }
    }

    return null;
}

function splitListItems(listInner: string): string[] {
    const pattern = /<(\/?)(ol|ul|dl|li)\b[^>]*>/gsu;
    const items: string[] = [];
    let listDepth = 0;
    let itemStart: number | null = null;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(listInner)) !== null) {
        const isClosing = match[1] === '/';

        if (match[2] !== 'li') {
            listDepth += isClosing ? -1 : 1;

            continue;
        }

        if (listDepth > 0) {
            continue;
        }

        if (!isClosing) {
            itemStart ??= pattern.lastIndex;

            continue;
        }

        if (itemStart !== null) {
            items.push(listInner.slice(itemStart, match.index));
            itemStart = null;
        }
    }

    if (itemStart !== null) {
        items.push(listInner.slice(itemStart));
    }

    return items;
}

// Usage examples and quotations hang off a sense in nested `ul` / `dl` blocks. Synonym and antonym
// blocks live in the same place but carry none of these classes, so matching on them filters those out.
function extractExamples(block: string): string[] {
    const pattern = /<(div|span|i)\b[^>]*\bclass="[^"]*\b(?:citation-whole|h-usage-example|example)\b[^"]*"[^>]*>/gu;
    const examples: string[] = [];
    let cursor = 0;

    for (;;) {
        pattern.lastIndex = cursor;

        const match = pattern.exec(block);

        if (!match) {
            return examples;
        }

        const innerStart = match.index + match[0].length;
        const closed = closeElement(block, match[1], innerStart);

        if (!closed) {
            return examples;
        }

        const text = stripTags(block.slice(innerStart, closed.innerEnd));

        if (text.length > 0) {
            examples.push(text);
        }

        cursor = closed.end;
    }
}

function parseSense(itemHtml: string): WiktionarySense {
    const opener = /<(ol|ul|dl)\b[^>]*>/gsu;
    const examples: string[] = [];
    const subSenses: WiktionarySense[] = [];
    let text = '';
    let cursor = 0;

    for (;;) {
        opener.lastIndex = cursor;

        const open = opener.exec(itemHtml);

        if (!open) {
            text += itemHtml.slice(cursor);

            break;
        }

        text += itemHtml.slice(cursor, open.index);

        const innerStart = open.index + open[0].length;
        const closed = closeElement(itemHtml, 'ol|ul|dl', innerStart);

        if (!closed) {
            break;
        }

        const inner = itemHtml.slice(innerStart, closed.innerEnd);

        if (open[1] === 'ol') {
            subSenses.push(...splitListItems(inner).map(parseSense));
        } else {
            examples.push(...extractExamples(inner));
        }

        cursor = closed.end;
    }

    return {
        text: stripTags(text),
        examples,
        subSenses: subSenses.filter(isMeaningful),
    };
}

function isMeaningful(sense: WiktionarySense): boolean {
    return sense.text.length > 0 || sense.subSenses.length > 0;
}

// The definition list of a part of speech is the first plain `ol` under its heading. Reference lists
// and navigation boxes always carry a class, which is what the negative lookahead rules out.
function firstDefinitionList(block: string): string | null {
    const opener = /<ol(?![^>]*\bclass=)[^>]*>/u.exec(block);

    if (!opener) {
        return null;
    }

    const innerStart = opener.index + opener[0].length;
    const closed = closeElement(block, 'ol|ul|dl', innerStart);

    return closed ? block.slice(innerStart, closed.innerEnd) : null;
}

function parseSections(html: string): WiktionarySection[] {
    const headings = [...html.matchAll(/<div class="mw-heading mw-heading(\d)">\s*<h\d[^>]*>(.*?)<\/h\d>/gsu)];
    const sections: WiktionarySection[] = [];
    let current: WiktionarySection | null = null;

    for (let index = 0; index < headings.length; index++) {
        const heading = headings[index];
        const level = Number(heading[1]);
        const title = stripTags(heading[2]);

        if (level === 2) {
            const code = /class="sectionlangue"\s+id="([^"]+)"/u.exec(heading[2])?.[1] ?? null;

            current = { language: title, code, entries: [] };
            sections.push(current);

            continue;
        }

        if (!current) {
            continue;
        }

        const blockStart = heading.index + heading[0].length;
        const blockEnd = index + 1 < headings.length ? headings[index + 1].index : html.length;
        const list = firstDefinitionList(html.slice(blockStart, blockEnd));

        if (!list) {
            continue;
        }

        const senses = splitListItems(list).map(parseSense).filter(isMeaningful);

        if (senses.length > 0) {
            current.entries.push({ partOfSpeech: title, senses });
        }
    }

    return sections.filter(section => section.entries.length > 0);
}

export const Wiktionary = {
    /**
     * Page titles the Wiktionary search suggests for a partial word, used to feed slash autocompletion.
     *
     * @param {string} edition Wiktionary edition code, e.g. `fr`.
     * @param {string} query Partial word typed by the user.
     * @returns {Promise<string[]>} Suggested page titles, at most 25 of them.
     */
    async suggest(edition: string, query: string): Promise<string[]> {
        const url = `https://${editionHost(edition)}/w/api.php?action=opensearch`
            + `&search=${encodeURIComponent(query)}&limit=${SUGGESTION_LIMIT}&namespace=0&format=json`;
        const payload = await requestJson(url, SUGGEST_TIMEOUT);

        if (!Array.isArray(payload) || !Array.isArray(payload[1])) {
            return [];
        }

        return payload[1].filter((title: unknown): title is string => typeof title === 'string');
    },

    /**
     * Definitions of a word in the edition's own language, grouped by part of speech. A page carries a
     * section per language that spells the word this way, and only the one being taught is kept.
     *
     * @param {string} edition Wiktionary edition code, e.g. `fr`.
     * @param {string} title Page title to look up; redirects are followed.
     * @returns {Promise<WiktionaryLookup>} The parsed page, or why nothing could be read from it.
     */
    async lookup(edition: string, title: string): Promise<WiktionaryLookup> {
        const endpoint = `https://${editionHost(edition)}/w/api.php?action=parse`
            + `&page=${encodeURIComponent(title)}&prop=text&format=json&formatversion=2`
            + '&redirects=1&disablelimitreport=1&disableeditsection=1&disabletoc=1';
        const payload = await requestJson(endpoint, LOOKUP_TIMEOUT);

        if (!payload) {
            return { status: 'error' };
        }

        if (payload.error) {
            return payload.error.code === 'missingtitle' ? { status: 'missing' } : { status: 'error' };
        }

        const resolvedTitle: string = payload.parse?.title ?? title;
        const html: string = payload.parse?.text ?? '';
        const sections = parseSections(html);
        const url = pageUrl(edition, resolvedTitle);

        if (sections.length === 0) {
            return { status: 'empty', title: resolvedTitle, url };
        }

        const matching = sections.filter(section => matchesEdition(section, edition));

        if (matching.length === 0) {
            return {
                status: 'otherLanguages',
                title: resolvedTitle,
                url,
                languages: sections.map(section => section.language),
            };
        }

        return {
            status: 'ok',
            page: {
                title: resolvedTitle,
                url,
                language: matching[0].language,
                entries: matching.flatMap(section => section.entries),
            },
        };
    },
};
