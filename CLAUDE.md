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

Schema in `prisma/schema.prisma`. Models include `Settings` (per-guild key/value config), `UserPreference` (per-user locale), `Language` + `LanguageAlias`, `Country` + `CountryAlias`, `Topic`. The `Settings` table is the canonical place for per-guild configuration — V5 deliberately avoided V3's hardcoded `config.json` of role/channel IDs.

**Every model must have `@@map(...)` with a lowercase / snake_case table name** — single-word lowercase (e.g. `@@map("settings")`), multi-word snake_case (e.g. `@@map("user_preference")`). This is non-negotiable: dev runs on Windows MySQL where `lower_case_table_names=1` folds table identifiers to lowercase, while prod runs on Linux MySQL where the original case is preserved. Without `@@map` the table ends up named differently on each host and Prisma reports drift. Adding `@@map` from the start avoids needing a follow-up rename migration; corresponding indexes and foreign keys auto-derive their names from the `@@map` value, so they stay consistent too. Same rule applies for any future column-level renames via `@map`.

**Never use `ALTER TABLE ... RENAME INDEX ...` in migrations against the prod MariaDB.** Prod runs MariaDB 10.6.23 (case-preserving identifiers), and `RENAME INDEX` there has a known bug where the rename updates the `.frm` (MariaDB layer) but does **not** propagate to InnoDB's `SYS_INDEXES`. The desync is invisible on Windows dev (`lower_case_table_names=1` folds index names, so PascalCase and lowercase are the same identifier) and only surfaces in prod, where any read of the affected table fails with `ERROR 1030 (HY000): Got error 1 "Operation not permitted" from storage engine InnoDB` and the journal logs `InnoDB could not find key no 1 with name <new_name> from dict cache for table <db>/<table>`. The fix once it bites is `OPTIMIZE TABLE <affected_tables>` (does an in-place recreate + analyze, re-syncs the dict cache). The prevention is to write `DROP INDEX <old_name> ON <table>; CREATE [UNIQUE] INDEX <new_name> ON <table>(<cols>);` instead — explicit drop + recreate avoids `RENAME INDEX`'s codepath entirely. `prisma/migrations/20260504095500_rename_indexes_and_fks` is the migration that triggered this in prod; if you ever need to write a similar one, do not follow its pattern.

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

**Discord caps every description at 100 characters** — command, subcommand, subcommand group, *and* option descriptions, in every locale individually. The cap is enforced by `@sapphire/shapeshift` when discord.js's builders validate the description (via `setDescription` / `setDescriptionLocalization`), so an over-cap French translation throws `ExpectedConstraintError > s.string().lengthLessThanOrEqual()` at command-registration time. Sapphire surfaces this as `Encountered error while handling the command application command registry for command "<name>"` and then **aborts registration for the entire command** — meaning the new option you were adding *plus* any other recent changes to that command silently fail to push to Discord, and the slash command in the UI keeps showing the previous definition. Keep every description ≤ 100 chars; when porting French text, watch for parenthetical clarifications that bloat the count.

### Localized command pattern

Two base classes in `src/lib/`:

- `Command` — extends `SapphireCommand`, adds a `logFooter` field used by the channel logger.
- `LocalizedCommand` — extends `Command` and prepends the `Localized` precondition.

The `Localized` precondition (`src/preconditions/Localized.ts`) checks for a `UserPreference` row; if absent, it sends a `StringSelectMenuBuilder` asking the user to pick a locale, persists the choice, and only then resolves `ok()`. As a result, **any command that uses `fetchT(interaction)` should extend `LocalizedCommand`**, not the bare `Command`, so the user is guaranteed to have a saved locale by the time the command body runs.

The `fetchLanguage` callback in `Bootstrap.ts` is the read side of this — it returns the saved `UserPreference.locale`, defaulting to `en-US`. In every command, get a translator with `await fetchT(interaction)` (from `@sapphire/plugin-i18next`) — that is the per-user-localized `t` function.

### Logger module (`src/lib/Logger.ts`)

Distinct from `container.logger` (Sapphire's stdout logger). The functions in `Logger.ts` (`log`, `warn`, `error`, `success`, `notice`) write to the configured guild log channel (`SettingKey.BotLogChannel`) as colored Components V2 containers AND log to stdout. Pass `(guildId, message, footer?)`. Commands typically pass `this.logFooter` as the footer. If no log channel is configured for the guild, only the stdout side runs — there is no error. The level-based accent colors (info/warn/error/success/notice) carry meaning, so they stay even though the rest of the bot defaults to no color for trivial responses.

### Components V2 — no embeds

**Embeds are banned.** Discord embeds have known accessibility problems and the bot was migrated entirely to Components V2. There is no `EmbedBuilder` in the codebase and no helper for one — don't reintroduce embeds. Use V2 components (`ContainerBuilder`, `TextDisplayBuilder`, `SectionBuilder`, `SeparatorBuilder`, etc.) instead.

`src/lib/Components.ts` exports three colored helpers that wrap a single text in a `ContainerBuilder` with an accent color. Each returns `{ components: [container] }` ready to spread into `interactionManager.edit()` / `reply()`:

- `Components.error(text)` — red, for failures (rough convention: `❌` emoji in the message).
- `Components.confirm(text)` — green, for completed actions (rough convention: rainbow-sheep emoji).
- `Components.info(text)` — blue, for informational rich content.

**Color is contextual, not default.** A bare string passed to `interactionManager.edit/reply/followUp` is auto-wrapped as a single `TextDisplayBuilder` with no container, no color — that is the right shape for trivial confirmations or status text. Only reach for `Components.error/confirm/info` (or build a custom `ContainerBuilder`) when a color is actually meaningful (errors, success, structured info).

**Critical gotcha:** the `IsComponentsV2` flag (`MessageFlags.IsComponentsV2`, bit 1 << 15) must appear in the request body of *every* message operation that uses V2 components — defer, reply, follow-up, edit, and any direct `channel.send`. Setting it on defer alone is **not** enough; Discord's edit-payload validator inspects the request body itself, and a V2 components array without the flag in that same payload is rejected with `Value of field "type" must be one of (1,)`. `InteractionManager` handles this for you — but if you call `channel.send`, `webhook.send`, or any other Discord.js sender directly with V2 components, you must pass `flags: MessageFlags.IsComponentsV2` (OR'd with whatever else you need) yourself. See `Logger.ts` for an example.

### InteractionManager (`src/lib/InteractionManager.ts`)

Wraps `CommandInteraction` to make defer/reply/edit/followUp idempotent and Components V2-correct. Pattern: instantiate at the top of `chatInputRun`, `await interactionManager.deferReply()` (optionally with `{ flags: MessageFlags.Ephemeral }`), then `interactionManager.edit(...)` for the final response. Use this rather than calling `interaction.reply` / `interaction.editReply` / `interaction.followUp` directly so the V2 flag is applied consistently.

What InteractionManager does for you:

- `IsComponentsV2` is OR'd into the flags of every defer, reply, edit, and follow-up. You can pass `Ephemeral` (or any other flag) freely — they combine with the V2 flag, they don't replace it.
- A bare string passed to `reply` / `edit` / `followUp` is auto-wrapped as `[new TextDisplayBuilder().setContent(text)]`. Existing call sites doing `interactionManager.edit(t('commands:foo.confirm'))` keep working without changes; they just render as an uncolored text block.
- An options object passed in is shallow-cloned, the V2 flag merged into its `flags`, and forwarded to discord.js. Don't pass `content` or `embeds` — both are forbidden by the V2 flag and Discord will reject the request.
- `deferReply` is idempotent — if the interaction is already deferred or replied, it short-circuits.
- After an initial reply, subsequent `reply` calls automatically become `followUp`s and `edit` targets the follow-up message.

### Accent colors (`src/util/Colors.ts`)

`Colors` is the single source of truth for every accent color in the bot. **Never inline hex values** in `setAccentColor(...)` calls or duplicate the constants locally — import from `../util/Colors.js` and reuse `Colors.Error`, `Colors.Confirm`, `Colors.Info`, `Colors.LogDefault`, `Colors.LogWarn`, `Colors.LogNotice`. `Components.error/confirm/info` and `Logger.error/warn/success/notice` already pull from here; new commands should too. If a new semantic color is needed, add it to `Colors.ts` first.

### WatchService (`src/lib/WatchService.ts`)

In-memory mod watchlist, backed by the `WatchedMember` table. **Always read through `WatchService.isWatched/get/getByGuild`, never query `prisma.watchedMember` directly from listeners** — the service maintains a cache keyed by `${guildId}:${userId}` so the hot path (every `messageCreate`, every `voiceStateUpdate`) is O(1) instead of round-tripping to MySQL on every guild message. The cache is loaded once in `Ready.ts` via `WatchService.init()`; CRUD methods (`add`, `edit`, `remove`) update DB and cache atomically.

Two pieces of state are deliberately not persisted: the per-user activity-throttle timestamp (`shouldLogActivity`, 1-hour rate limit on the "active" event) and the lazy-expiry check (`checkAndExpire`). The throttle resets on every bot restart — that's fine; over-logging right after a deploy is harmless. Temp-watch expiry happens **lazily**: a watched member's row only gets evaluated for expiration when they next send a message or change voice state. There's no scheduled job sweeping for expired watches, by design (V3 parity, keeps the bot stateless w.r.t. timers).

Watchlist events go to `SettingKey.WatchlistChannel` (separate from `BotLogChannel`) via `WatchService.logEvent(member, payload, watchRow?)`. The optional `watchRow` parameter is for the expiry case where the row has already been removed from cache before logging — pass the row returned by `checkAndExpire` so the event renders with the original reason/timestamps. Tone is `'active'` (green) or `'ending'` (red), mapping to `Colors.Confirm` / `Colors.Error`.

### InviteCache (`src/lib/InviteCache.ts`)

Companion to `WatchService` for the watched-invite feature. Maintains an in-memory per-guild `Map<inviteCode, uses>` so we can detect *which* invite was used by a new joiner — Discord's `GuildMemberAdd` event doesn't tell you that directly; you have to diff invite uses before and after the join. `InviteCache.detectUsedInvite(guildId)` is the workhorse: it compares cached uses against the current `guild.invites.fetch()`, returns the matching `{ code, inviterId }` (or `null` if no diff, vanity URL, or fetch failed), and refreshes the cache atomically before returning. Always call `detectUsedInvite` (not `refresh` + manual diff) so the cache stays in sync.

Cache lifecycle:

- `Ready.ts` calls `InviteCache.init()` after `WatchService.init()` — both must finish before the bot starts serving traffic.
- `WatchedInviteCreate` listener calls `setInvite` so newly-created invites are tracked from minute zero (otherwise the first use of a brand-new invite would look like the cache had `undefined → 1`).
- `WatchedInviteDelete` listener calls `removeInvite` to keep the cache bounded.

When a watched member's invite is used by a not-yet-watched joiner, `WatchedInviteMemberAdd` posts a watchlist-channel message with three buttons (`watch-invite-perm:…`, `watch-invite-1w:…`, `watch-invite-dismiss`). The button payload encodes joiner/inviter/code via `:`-separated values in the customId — fits in Discord's 100-char limit and survives bot restarts because `src/interaction-handlers/WatchInviteButton.ts` is a Sapphire `InteractionHandler` (stateless, matched on customId prefix, no in-memory tracking of the message). The handler is permission-gated to `ManageGuild`.

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
