import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import type { AutocompleteInteraction } from 'discord.js';
import { fetchSnippetAutocompleteResponse, type SNIPPET_PERMISSION } from '../lib/SnippetService.js';

@ApplyOptions<InteractionHandler.Options>({
    interactionHandlerType: InteractionHandlerTypes.Autocomplete,
})
export default class extends InteractionHandler {
    public async run(interaction: AutocompleteInteraction) {
        const gates: Record<string, SNIPPET_PERMISSION> = {
            'snippet.name': 'read',
            'manage-snippets.edit.name': 'edit',
            'manage-snippets.delete.name': 'edit',
            'manage-snippets.restrict.name': 'restrict',
            'manage-snippets.alias.add.snippet': 'edit',
            'manage-snippets.alias.edit.name': 'edit',
            'manage-snippets.alias.delete.name': 'edit',
        };

        const option = interaction.options.getFocused(true);
        const key = [
            interaction.commandName,
            interaction.options.getSubcommandGroup(false),
            interaction.options.getSubcommand(false),
            option.name,
        ].filter(Boolean).join('.');

        if (!(key in gates)) {
            await interaction.respond([]);

            return;
        }

        const member = await interaction.guild!.members.fetch(interaction.user.id);

        if (!member) {
            await interaction.respond([]);

            return;
        }

        await interaction.respond(await fetchSnippetAutocompleteResponse(
            option.value.toLowerCase(),
            interaction.guildId!,
            member,
            gates[key as keyof typeof gates],
        ));
    }
}
