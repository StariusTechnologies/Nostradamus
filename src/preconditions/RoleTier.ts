import { type Message } from 'discord.js';
import { Precondition, type PreconditionContext } from '@sapphire/framework';
import { hasRoleAccess, type RoleTier as RoleTierType } from '../lib/RoleAccess.js';

interface RoleTierPreconditionContext extends PreconditionContext {
    tier: RoleTierType;
}

export class RoleTier extends Precondition {
    public override async messageRun(message: Message, _command: unknown, context: RoleTierPreconditionContext) {
        if (!message.inGuild() || !message.member) {
            return this.error({ identifier: 'NotInGuild', message: 'Not in a guild' });
        }

        if (await hasRoleAccess(message.member, context.tier)) {
            return this.ok();
        }

        return this.error({ identifier: 'InsufficientRoleTier', message: 'Insufficient role tier' });
    }

    public override chatInputRun() {
        return this.ok();
    }

    public override contextMenuRun() {
        return this.ok();
    }
}
