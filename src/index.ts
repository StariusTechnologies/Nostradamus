import { ApplicationCommandRegistries, container, RegisterBehavior } from '@sapphire/framework';
import '@sapphire/plugin-i18next/register';
import { Bootstrap } from './setup/Bootstrap.js';

ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(RegisterBehavior.BulkOverwrite);

const bootstrap = new Bootstrap();

bootstrap.initializeIntents();
bootstrap.initializeClient();

container.logger.info('Application initialized');
container.logger.info('Logging in...');

bootstrap.login().then(() => {
    container.logger.info('Logged in ☺ !');
});

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace NodeJS {
        interface ProcessEnv {
            TOKEN: string;
            OWNER: string;
            DBNAME: string;
            DBUSER: string;
            DBHOST: string;
            DBPASSWORD: string;
            DBPORT: string;
            DATABASE_URL: string;
        }
    }
}

declare module '@sapphire/framework' {
    interface Preconditions {
        Localized: never;
    }
}
