# Discord privileged intent application

Answers submitted for the privileged gateway intent application, kept so the
application can be refiled without redoing the research. Discord now gates
privileged intents on **user count (10,000+)** rather than server count, and the
French server alone is far past that threshold.

First filed: August 2026.

## Which intents to request

| Intent | Request it? | Why |
| --- | --- | --- |
| Server Members | **Yes** | Join/leave events, invite tracking, name history, role persistence |
| Message Content | **Yes** | Automod, edit/delete logging, evidence archives, modmail |
| Presence | **No** | Not used by any component. Do not tick it. |

The Presence finding was verified in code, not assumed:

- Nostradamus never lists `GuildPresences` in `src/setup/Bootstrap.ts`.
- VANGUARD has `GatewayIntentBits.GuildPresences` explicitly commented out in
  `backend/src/index.ts`.
- Dragory's modmail does not request it (`privilegedIntents` in `src/bot.js` is
  `messageContent` plus a conditional `guildMembers`).

Remember that one Discord application is shared by three processes: Nostradamus
V5, VANGUARD, and the modmail bot. Privileged intents are toggled per
application, so the answers below cover all three together. That arrangement is
supported: a discord-api-docs maintainer confirmed multiple services may share
one token, each with their own gateway connection and their own intents.

---

## Application details

> What does your application do?

French is a Discord server of 115,295 members, dedicated to language learning and the francophone community. All of its automated functionality runs through this single application, made up of three components sharing one bot account.

1. Community tools. Slash commands for the learning side of the server: dictionary lookups, self-assignable language and country roles so learners and native speakers can find each other, and per-user localisation (English/French).

2. Moderation. Warnings, mutes, kicks, bans and tempbans with persistent case history; moderator notes; automod for spam, raids and prohibited content; anti-raid protection; message edit and delete logging; username and nickname history to catch members renaming to evade enforcement; invite tracking; and a watchlist for members needing closer attention. Staff manage this through a web dashboard.

3. Modmail. Members DM the bot to open a private thread with the moderation team, used to appeal decisions, report users privately, and ask questions they would rather not ask in public.

Privacy policy: https://frenchdiscord.com/privacy

---

## Privacy policy

> Do you have a public Privacy Policy telling your users about their data usage?

**Yes**

> Where is your Privacy Policy available?

It is available in two places: linked in the bot's profile bio, and published in full on our community website at https://frenchdiscord.com/privacy, where it is linked from the footer of every page in both English and French.

> Please share a link to your Privacy Policy.

https://frenchdiscord.com/privacy

---

## Server Members intent

> Why do you need the Guild Members intent?

We use it for four things, all of which are reactions to member events rather than user-initiated commands.

Mute and ban evasion. We persist roles and nicknames when a member leaves and reapply them when they rejoin. Without this intent we receive neither GuildMemberAdd nor GuildMemberRemove, so a muted member could simply leave and rejoin to shed their mute role.

Invite tracking. On each join we compare invite use counts to determine which invite the member used and who created it. This lets us trace coordinated raid joins back to a source and identify alt accounts. It only works if we are notified at the moment of the join.

Username and nickname history. We record name changes via GuildMemberUpdate so moderators can identify members who rename themselves to evade enforcement or impersonate others.

Join and leave logging. Our moderation log records arrivals and departures, which is how staff reconstruct what happened around an incident.

We also maintain a member cache, since with 115,295 members our moderation commands frequently target users who have not posted recently and cannot be resolved from message events alone.

None of this is achievable through interactions, as every case is triggered by the member joining, leaving or renaming rather than by anyone running a command.

> Please provide links to screenshots and/or videos that demonstrate your use case

https://frenchdiscord.com/intent-evidence#server-members

Five captioned screenshots showing join and leave logging, watchlist activity with invite tracking identifying which invite a joining member used and who created it, username and nickname history, and a mute being reapplied after a member left and rejoined. The Discord account shown is a secondary account belonging to the server owner, used for testing.

---

## Message Content intent

> Why do you need the Message Content intent?

We use it for four things, none of which involve messages addressed to the bot.

Automated moderation. Our automod inspects message content to detect spam floods, mass mentions, scam and phishing links, and prohibited content, then removes the messages and applies mutes automatically. It has to read messages nobody sent to the bot, since the entire purpose is catching what is posted in public channels before it reaches members.

Message edit and delete logging. We record the before and after text of edited messages and retain the content of deleted ones. This is how staff establish what was actually said when someone edits or deletes to cover their tracks.

Evidence archives. When automod or a moderator takes action, the relevant messages are archived and linked from the moderation case, so decisions can be reviewed and appealed against a record of what was actually posted.

Modmail. Members open private support threads by direct-messaging the bot. Relaying those messages to our staff channel, and relaying staff replies back, requires reading the content of every message in both directions. This is our appeals and private reporting channel.

None of this is achievable through interactions. Automod must evaluate messages that were never directed at the bot, edit and delete logging must capture content the member is actively removing, and modmail is a direct message conversation rather than a command.

> Please provide links to screenshots and/or videos that demonstrate your use case

https://frenchdiscord.com/intent-evidence#message-content

Five captioned screenshots showing automod detecting a spam flood and opening a moderation case with the offending messages archived, the automod alert listing the rule and actions taken, message edit logging with before and after text, message delete logging retaining the content, and a modmail conversation from both the member's and the staff's side. The Discord account shown is a secondary account belonging to the server owner, used for testing.

---

## Data handling

Asked once per intent. Same answers both times.

> Are you storing any API Data off-platform (outside of Discord)?

**Yes**

> Are you storing API Data for 30 days or less?

**No**

Do not answer Yes here. Some data does expire inside 30 days (VANGUARD's message
cache and name history at 30 days, Nostradamus tracked-message metadata at 14),
but moderation cases and modmail transcripts are kept indefinitely and the
published privacy policy says exactly that. Answering Yes would contradict the
policy linked in the same submission.

> How do users contact you to request deletion of their activity data?

Members can request deletion of their data by opening a modmail thread with the moderation team, which they do by direct-messaging the bot, or by using the contact published in our privacy policy at https://frenchdiscord.com/privacy. We respond within one month, in line with the GDPR.

Data that is not needed for moderation or safety, such as a stored language preference, is deleted on request. Moderation records (infractions, warnings, mutes, bans, moderator notes, and the message evidence attached to them) are retained under Article 17(3) GDPR, for the establishment, exercise or defence of legal claims and our overriding legitimate interest in the safety of the community. This exception is set out in our published privacy policy.

> Can users opt-out of having their message content data tracked?

**No**

No follow-up box appeared in 2026, but the reasoning is kept here in case one
appears in a later year:

No. Inspecting message content is what makes moderation possible, so it cannot be made optional without rendering the server unmoderatable: any member intending to post prohibited content would simply opt out first. Automod inspection and the logging of edited and deleted messages therefore apply uniformly to everyone in the server.

The processing is disclosed rather than optional. Our privacy policy sets out exactly what is stored and for how long, message content captured for moderation is automatically deleted after 30 days unless it is attached to a specific moderation case, and members are told in advance which staff roles are able to read their modmail conversation before they send anything.

---

## Before refiling, check these

The answers above are not evergreen. Verify each of these before pasting them in
again:

1. **Member count.** 115,295 is a snapshot from 2026-08-10 and appears in two
   separate answers.
2. **Retention periods.** Everything quoted was read out of the code, so a change
   to any of these makes both this file and the privacy policy wrong:
   - Nostradamus tracked-message TTL: `TRACKED_MESSAGE_TTL` in
     `src/listeners/Ready.ts` (14 days, swept every 6 hours)
   - VANGUARD message cache: `backend/src/data/cleanup/messages.ts` (30 days,
     30 minutes for bot messages)
   - VANGUARD username and nickname history:
     `backend/src/data/cleanup/usernames.ts` and `nicknames.ts` (30 days each)
   - Modmail thread logs: no automatic deletion
3. **The evidence page is still up** at https://frenchdiscord.com/intent-evidence
   with both `#server-members` and `#message-content` anchors intact, images
   loading, and `noindex` still set.
4. **The privacy policy is still up** at https://frenchdiscord.com/privacy and
   still matches what the code actually does.
5. **The bot bio still links the privacy policy.** One of the answers claims it
   does.
6. **Feature drift.** If a component gained or lost a feature, the justification
   text should reflect it. In particular, if anything ever starts using presence,
   this whole file needs revisiting.

## Style notes

The answer text is written without em dashes and is meant to be pasted verbatim
into the form. Keep paragraphs separated by blank lines.
