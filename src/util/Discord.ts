const SNOWFLAKE_REGEX = /^\d{16,20}$/u;
const USER_MENTION_REGEX = /^<@!?(\d{16,20})>$/u;

export function parseUserToken(token: string): string | null {
    const trimmed = token.trim();

    if (SNOWFLAKE_REGEX.test(trimmed)) {
        return trimmed;
    }

    const mentionMatch = trimmed.match(USER_MENTION_REGEX);

    if (mentionMatch) {
        return mentionMatch[1];
    }

    return null;
}
