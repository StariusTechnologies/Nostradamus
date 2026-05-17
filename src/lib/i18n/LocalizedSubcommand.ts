import { Subcommand } from '@sapphire/plugin-subcommands';

export class LocalizedSubcommand extends Subcommand
{
    protected logFooter: string;

    public constructor(context: Subcommand.LoaderContext, options: Subcommand.Options) {
        super(context, {
            ...options,
            preconditions: ['Localized', ...options.preconditions ?? []],
        });

        this.logFooter = `Command ${this.name}`;
    }
}
