// Regional-indicator spellings of the name (people spelling it out with letter emojis).
const EMOJI_SPELLING: string = '🇱🇮🇱🇾';
const EMOJI_SPELLING_SPACED: string = '🇱 🇮 🇱 🇾';

// Substrings that look like a name match but are known false positives, so they cancel a detection.
export const CANCEL_WORDS: readonly string[] = [
    'lildami',
    'wolfy',
    'wolfieboy',
    'lille',
    'hamdoulilah',
    'hamdoulillah',
    'alhamdulillah',
    'alhamdulilah',
    'alhamdolilah',
    'hamdulilah',
    'wolfcheer',
    'eventualyl',
    '9lila',
    'hamdolilah',
];

// Static name variations that signal someone is talking about the owner.
export const BASE_SEARCH_WORDS: readonly string[] = [
    'ansy',
    'wonhalf',
    'leel',
    'lil',
    'lyl',
    'liily',
    'lielie',
    'l¡ly',
    'wolf',
    EMOJI_SPELLING,
    EMOJI_SPELLING_SPACED,
];
