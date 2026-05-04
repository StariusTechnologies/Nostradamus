# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Context

Nostradamus V5 is the latest iteration of a Discord bot for a French/language-learning Discord server. V3 (`../NostradamusV3`) is plain JS, hardcoded for that one server, and **still runs in production alongside V5** because V5 has not yet ported every feature. Porting from V3 is opportunistic and bug-driven, not on a fixed roadmap. V5 is multi-guild aware by design (per-guild settings, per-user locales) but in practice only runs on the same one server today.

When porting a V3 feature, treat `../NostradamusV3` as a reference implementation, not as a structural template — V3's patterns (single hardcoded `config.json`, `global.bot`/`global.debug`, subprocess crash-recovery via stdout keyword detection, mixed `model/` directory, prototype extensions) are explicitly **not** wanted in V5.

## Commands

Compile / run / clean (defined in `package.json`):

```
npm run compile          # tsc + copy static JSON language files into dist/
npm run start            # compile then node . (runs dist/index.js)
npm run quickstart       # node . without recompiling
npm run clean-compile    # rm -rf dist, tsc --build --clean, then compile
```

Lint and Prisma do not have npm scripts — use the binaries directly:

```
npx eslint src --ext .ts             # lint TypeScript (.eslintignore excludes all .js)
npx prisma generate                  # regenerate the Prisma client after schema.prisma edits
npx prisma migrate dev --name <slug> # create + apply a new migration in dev
npx prisma migrate deploy            # apply pending migrations (used in prod)
```

There is no test suite (`npm test` prints `no`). Verification is manual: Lily runs the bot herself in her dev environment. Before handing code back, **compile must be clean (zero errors, zero warnings), ESLint must be clean, and the formatter must be clean** — that's the static-quality bar this repo expects.

`npm run copy-static-files` matters because the i18n JSON files live under `src/languages/<locale>/*.json` and the i18next backend at runtime reads them from `dist/`. After editing those JSONs, recompile (or just rerun `copy-static-files`) before testing.

## Architecture

Built on **Sapphire framework** (on top of discord.js v14). Sapphire auto-loads pieces from `src/`:

- `src/commands/**` — slash commands, grouped by category folder (`bot-management`, `info`, `user-profile`). The category folder is purely organizational; Sapphire registers them by file.
- `src/listeners/**` — Discord event handlers. Use `@ApplyOptions<ListenerOptions>({ event: Events.X })` and a default-export class.
- `src/preconditions/**` — gating logic that runs before commands. Currently only `Localized.ts`.

Entry point is `src/index.ts`, which instantiates the `Bootstrap` singleton (`src/setup/Bootstrap.ts`). `Bootstrap` configures intents/partials, the Sapphire client, the i18n `fetchLanguage` callback (per-user, falling back to `en-US`), the optional REST proxy (only if `PROXIED=1`, currently unused — points at `127.0.0.1:3000/api`), and the Prisma client. Prisma is wrapped in a `$extends` that logs every query with timing in debug mode using `@mikro-orm/sql-highlighter`.

`container.prisma` is added via module augmentation in `Bootstrap.ts` — use `container.prisma` (or `this.container.prisma` inside Sapphire pieces) everywhere; do not instantiate `PrismaClient` elsewhere.

### Database (Prisma + MySQL)

Schema in `prisma/schema.prisma`. Five models today: `Settings` (per-guild key/value config), `UserPreference` (per-user locale), `Language` + `LanguageAlias`, `Country` + `CountryAlias`. The `Settings` table is the canonical place for per-guild configuration — V5 deliberately avoided V3's hardcoded `config.json` of role/channel IDs.

Settings access goes through `src/lib/Settings.ts`:

- `SettingKey` enum (currently `BotLogChannel`, `NativeLanguageRole`) — extend this when adding any new per-guild setting; the `Setup` command iterates this enum to decide which slash-command options to expose.
- `getSetting(guildId, key)` / `saveSetting(guildId, key, value)` — always go through these helpers, never raw `prisma.settings.*`.
- A `formatters` map exists for typed coercion (e.g. boolean) but is currently unused. Sample for future typed settings is commented in the file.

### i18n architecture

Sapphire's i18next plugin loads from `src/languages/<locale>/<namespace>.json`. Locales: `en-US`, `fr`. Namespaces: `commands`, `preconditions`, `pagination`.

The translation key convention for slash commands is **strict** because `LanguageManager.ts` derives keys from command/option/subcommand names:

- Command description → `commands:<commandName>.definition.description`
- Option description → `commands:<commandName>.definition.options.<optionName>.description`
- Subcommand description → `commands:<commandName>.definition.subcommand.<subcommandName>.description`

Helpers in `src/lib/i18n/LanguageManager.ts`:

- `registerCommandDescriptions(builder)` — sets the English description and adds Discord localization map for every locale where the key exists.
- `registerOptionDescriptions(commandName, optionBuilder)` — same for slash command options. Overloaded for every option type.
- `registerSubcommandDescriptions(commandName, subcommandBuilder)` — same for subcommands.
- `multipleT(locales, key, glue, prependEmojis)` — render the same key in multiple locales joined together (used in the Localized precondition prompt).
- `Languages` and `LanguageEmoji` const maps define the supported locales (currently English/French). Adding a new locale = update both maps + create the `src/languages/<locale>/` folder.

Always wrap the slash-command builder in these helpers — do not call `setDescription` manually unless there is a specific reason.

### Localized command pattern

Two base classes in `src/lib/`:

- `Command` — extends `SapphireCommand`, adds a `logFooter` field used by the channel logger.
- `LocalizedCommand` — extends `Command` and prepends the `Localized` precondition.

The `Localized` precondition (`src/preconditions/Localized.ts`) checks for a `UserPreference` row; if absent, it sends a `StringSelectMenuBuilder` asking the user to pick a locale, persists the choice, and only then resolves `ok()`. As a result, **any command that uses `fetchT(interaction)` should extend `LocalizedCommand`**, not the bare `Command`, so the user is guaranteed to have a saved locale by the time the command body runs.

The `fetchLanguage` callback in `Bootstrap.ts` is the read side of this — it returns the saved `UserPreference.locale`, defaulting to `en-US`. In every command, get a translator with `await fetchT(interaction)` (from `@sapphire/plugin-i18next`) — that is the per-user-localized `t` function.

### Logger module (`src/lib/Logger.ts`)

Distinct from `container.logger` (Sapphire's stdout logger). The functions in `Logger.ts` (`log`, `warn`, `error`, `success`, `notice`) write to the configured guild log channel (`SettingKey.BotLogChannel`) as colored embeds AND log to stdout. Pass `(guildId, message, footer?)`. Commands typically pass `this.logFooter` as the footer. If no log channel is configured for the guild, only the stdout side runs — there is no error.

### InteractionManager (`src/lib/InteractionManager.ts`)

Wraps `CommandInteraction` to make defer/reply/edit idempotent and to follow up automatically once a reply has already been sent. Used pervasively in commands. Pattern: instantiate at the top of `chatInputRun`, `await interactionManager.deferReply({ flags: MessageFlags.Ephemeral })`, then `interactionManager.edit(...)` for the final response. Use this rather than calling `interaction.reply` / `interaction.editReply` / `interaction.followUp` directly.

### Bot emojis (`src/util/Emojis.ts`)

`Emojis` is a const object with hardcoded emoji strings. On `ClientReady` (`src/listeners/Ready.ts`), `loadEmojis(client)` overwrites these with the actual application-emoji mentions fetched from Discord. **Reading `Emojis.X` before `ready` will give stale values** — only use them inside command handlers / post-ready code.

### Co-existence with V3

Both bots run on the same Discord server. They have distinct bot accounts (different tokens). When porting a V3 feature, the two will overlap briefly — be aware that both will respond if both have the same command or both react to the same event. Coordinate the cutover with Lily.

## Style and conventions

- TypeScript with `module: NodeNext`, ES2022, `verbatim` Sapphire ts-config — **import paths must include the `.js` extension** even though source is `.ts` (e.g. `import { x } from './Foo.js'`). The `tsconfig` extends `@sapphire/ts-config/extra-strict` and `@sapphire/ts-config/decorators`.
- ESLint: 4-space indent, single quotes, `max-len: 120`, padding lines required between var decls / blocks / returns / cases (see `.eslintrc.json` for the full rule set). `.eslintignore` excludes all `.js` files; lint TypeScript only.
- `.editorconfig` enforces 4-space indent, UTF-8, trailing-newline, no trailing whitespace.
- Always use types — class fields, constants, function returns and parameters all annotated explicitly (per Lily's global preference).
- Never put HTML/CSS/JS inside class strings. (Inherited preference; less likely to come up here than in the PHP projects, but keep templates separate if it ever does.)

## Environment

`.sample.env` shows the shape. Required env vars (typed in `src/index.ts` via `declare global { namespace NodeJS { interface ProcessEnv {...} } }`):

- `TOKEN` — Discord bot token
- `OWNER` — Discord user ID for the eval/post-protected commands
- `DBNAME`, `DBUSER`, `DBHOST`, `DBPASSWORD`, `DBPORT`
- `DATABASE_URL` — built from the above for Prisma (`mysql://...`)

Optional:

- `PROXIED=1` — route discord.js REST through `127.0.0.1:3000/api` (Discord API proxy; not currently running in prod).
