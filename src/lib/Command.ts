import { Args, Command as SapphireCommand } from '@sapphire/framework';

export class Command extends SapphireCommand<Args, SapphireCommand.Options>
{
    protected logFooter: string;

    public constructor(context: SapphireCommand.LoaderContext, options?: SapphireCommand.Options) {
        super(context, options);

        this.logFooter = `Command ${this.name}`;
    }
}
