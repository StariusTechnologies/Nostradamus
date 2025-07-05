import { Args, Command as SapphireCommand } from '@sapphire/framework';

export class LocalizedCommand extends SapphireCommand<Args, SapphireCommand.Options>
{
    public constructor(context: SapphireCommand.LoaderContext, options?: SapphireCommand.Options) {
        super(context, {
            preconditions: ['Localized'],
            ...options,
        });
    }
}
