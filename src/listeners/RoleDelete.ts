import type { Role } from 'discord.js';
import { Events } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { Listener, type ListenerOptions } from '@sapphire/framework';

@ApplyOptions<ListenerOptions>({
    event: Events.GuildRoleDelete,
})
export default class extends Listener {
    public async run(role: Role): Promise<void> {
        await this.container.prisma.country.deleteMany({
            where: { idGuild: role.guild.id, idRole: role.id },
        });
        await this.container.prisma.language.deleteMany({
            where: { idGuild: role.guild.id, idRole: role.id },
        });
    }
}
