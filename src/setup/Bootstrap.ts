import process from 'node:process';
import { Client, IntentsBitField, Partials } from 'discord.js';
import type { ClientOptions } from 'discord.js';
import { config as configureEnvironment } from 'dotenv';
import { bold, cyanBright, gray, green } from 'colorette';
import { SqlHighlighter } from '@mikro-orm/sql-highlighter';
import { container, LogLevel, SapphireClient } from '@sapphire/framework';
import { PrismaClient } from '@prisma/client';
import { type InternationalizationContext } from '@sapphire/plugin-i18next';

type BootstrapOptions = {
    dotEnvPath?: string;
};

export class Bootstrap {
    private static instance: Bootstrap;

    public client!: SapphireClient;

    private intents: number[] = [];
    private readonly sqlHighlighter = new SqlHighlighter();

    public constructor({ dotEnvPath }: BootstrapOptions = {}) {
        if (Bootstrap.instance) {
            return Bootstrap.instance;
        }

        if (dotEnvPath) {
            configureEnvironment({ path: dotEnvPath });
        } else {
            configureEnvironment();
        }

        Bootstrap.instance = this;
    }

    public initializeIntents(): void {
        this.intents = [
            IntentsBitField.Flags.Guilds,
            IntentsBitField.Flags.GuildMembers,
            IntentsBitField.Flags.GuildModeration,
            IntentsBitField.Flags.GuildEmojisAndStickers,
            IntentsBitField.Flags.GuildIntegrations,
            IntentsBitField.Flags.GuildInvites,
            IntentsBitField.Flags.GuildVoiceStates,
            IntentsBitField.Flags.GuildMessages,
            IntentsBitField.Flags.MessageContent,
            IntentsBitField.Flags.GuildMessageReactions,
            IntentsBitField.Flags.DirectMessages,
            IntentsBitField.Flags.DirectMessageReactions,
            IntentsBitField.Flags.GuildScheduledEvents,
        ];
    }

    public initializeClient(): Client {
        const clientOptions: ClientOptions = {
            logger: {
                level: LogLevel.Debug,
            },
            shards: 'auto',
            intents: this.intents,
            partials: [
                Partials.User,
                Partials.Channel,
                Partials.GuildMember,
                Partials.Message,
                Partials.Reaction,
                Partials.GuildScheduledEvent,
                Partials.ThreadMember,
            ],
            i18n: {
                fetchLanguage: async (context: InternationalizationContext) => {
                    let language = 'en-US';

                    if (!context.user?.id) {
                        return language;
                    }

                    const userPreference = await container.prisma.userPreference.findUnique({
                        where: { idUser: context.user.id },
                    })

                    if (!userPreference || !userPreference.locale) {
                        return language;
                    }

                    return userPreference.locale;
                },
            },
        };

        if (Number(process.env.PROXIED) === 1) {
            clientOptions.rest = {
                api: 'http://127.0.0.1:3000/api',
            };
        }

        this.client = new SapphireClient(clientOptions);

        return this.client;
    }

    public async login(): Promise<Client> {
        container.prisma = this.getPrismaClient();

        await container.prisma.$connect();

        return new Promise<Client>((resolve, reject) => {
            this.client.once('ready', async (client: Client) => {
                await client.application!.entitlements.fetch();
                resolve(client);
            });

            this.client.login(process.env.TOKEN!).catch(reject);
        });
    }

    private getPrismaClient(): PrismaClient {
        const highlighter = this.sqlHighlighter;

        return new PrismaClient({
            errorFormat: 'pretty',
            log: [
                { emit: 'stdout', level: 'warn' },
                { emit: 'stdout', level: 'error' },
            ],
        }).$extends({
            name: 'performance_tracking',
            query: {
                async $allOperations({ args, operation, query, model }) {
                    // If we're not in debug mode, just run the query and return
                    if (!container.logger.has(LogLevel.Debug)) {
                        return query(args);
                    }

                    const start = performance.now();
                    const result = await query(args);
                    const end = performance.now();
                    const time = end - start;

                    if (model) {
                        const stringifiedArgs = JSON.stringify(args, null, 2)
                            .split('\n')
                            .map((line) => gray(line))
                            .join('\n');

                        container.logger.debug(
                            `${cyanBright('prisma:query')} ${bold(
                                `${model}.${operation}(${stringifiedArgs}${bold(')')}`
                            )} took ${bold(`${green(time.toFixed(4))}ms`)}`
                        );
                    } else {
                        // Most likely in $executeRaw/queryRaw
                        const casted = args as { strings?: string[]; values?: unknown[] } | undefined;

                        const consoleMessage = [`${cyanBright('prisma:query')} `, bold(`Prisma.${operation}(\``)];

                        const sqlString = [];

                        if (casted?.strings) {
                            if (casted.values) {
                                for (const str of casted.strings) {
                                    sqlString.push(str);

                                    const value = casted.values.shift();

                                    if (value) {
                                        sqlString.push(JSON.stringify(value));
                                    }
                                }
                            } else {
                                // just add all the strings
                                sqlString.push(...casted.strings);
                            }

                            consoleMessage.push(highlighter.highlight(sqlString.join('')));
                        } else if (Array.isArray(args)) {
                            // Most likely in $executeRawUnsafe/queryRawUnsafe
                            const sqlString = args.shift() as string | undefined;

                            if (sqlString) {
                                if (args.length) {
                                    for (let paramIndex = 1; paramIndex < args.length; paramIndex++) {
                                        sqlString.replace(`$${paramIndex}`, JSON.stringify(args[paramIndex - 1]));
                                    }

                                    consoleMessage.push(highlighter.highlight(sqlString));
                                } else {
                                    consoleMessage.push(highlighter.highlight(sqlString));
                                }
                            } else {
                                consoleMessage.push(gray(JSON.stringify(args)));
                            }
                        } else {
                            // Who tf knows brother
                            consoleMessage.push(gray(JSON.stringify(args)));
                        }

                        consoleMessage.push(bold('`) '), `took ${bold(`${green(time.toFixed(4))}ms`)}`);

                        container.logger.debug(consoleMessage.join(''));
                    }

                    return result;
                },
            },
        }) as PrismaClient<{ errorFormat: 'pretty' }>;
    }
}

declare module '@sapphire/pieces' {
    interface Container {
        prisma: PrismaClient;
    }
}
