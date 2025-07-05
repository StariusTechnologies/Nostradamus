export default class StringUtil {
    public static capitalize(string: string): string {
        return string.slice(0, 1).toUpperCase() + string.slice(1);
    }

    public static kebabSnakeToCamel(string: string): string {
        return string.toLowerCase().replace(/([_-][a-z])/gu, group =>
            group.toUpperCase().replace('-', '').replace('_', '')
        );
    }
}

export const {
    capitalize,
    kebabSnakeToCamel,
} = StringUtil;
