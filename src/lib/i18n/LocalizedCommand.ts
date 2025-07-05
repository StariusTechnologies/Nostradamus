import { Command as SapphireCommand } from '@sapphire/framework';
import { Command } from '../Command.js';

export class LocalizedCommand extends Command
{
    public constructor(context: SapphireCommand.LoaderContext, options?: SapphireCommand.Options) {
        super(context, {
            preconditions: ['Localized', ...options?.preconditions ?? []],
            ...options,
        });
    }
}
