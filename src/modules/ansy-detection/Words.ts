// Regional-indicator spellings of the name (people spelling it out with letter emojis).
const EMOJI_SPELLING: string = '🇱🇮🇱🇾';
const EMOJI_SPELLING_SPACED: string = '🇱 🇮 🇱 🇾';

// Substrings that look like a name match but are known false positives, so they cancel a detection.
export const CANCEL_WORDS: readonly string[] = [
    'lildami',
    'wolfy',
    'wolfie',
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
    '4nsy',
    'ansi',
    '4nsi',
    'ans1',
    '4ns1',
    'wonhalf',
    'w0nhalf',
    'w0nh4lf',
    'wonh4lf',
    'leel',
    'lil',
    'l1l',
    'lyl',
    'liily',
    'lielie',
    'l¡ly',
    'wolf',
    EMOJI_SPELLING,
    EMOJI_SPELLING_SPACED,
];
