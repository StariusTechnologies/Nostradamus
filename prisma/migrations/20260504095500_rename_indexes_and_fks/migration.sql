-- Rename indexes and foreign-keys from the original PascalCase model-name prefix
-- to the snake_case @@map prefix that Prisma now auto-generates.
-- Index and constraint names in MySQL are case-preserved on both Windows and Linux,
-- so plain SQL works without OS-specific tricks.
--
-- WARNING: the `ALTER TABLE ... RENAME INDEX` statements below desync MariaDB 10.6's
-- .frm metadata from InnoDB's SYS_INDEXES on case-preserving Linux, breaking every
-- read of the affected tables until OPTIMIZE TABLE is run to rebuild them. See the
-- "Database (Prisma + MySQL)" section of CLAUDE.md. Do NOT follow this pattern in
-- future migrations — use DROP INDEX + CREATE INDEX instead.

-- country indexes
ALTER TABLE `country` RENAME INDEX `Country_enName_idx` TO `country_enName_idx`;
ALTER TABLE `country` RENAME INDEX `Country_frName_idx` TO `country_frName_idx`;
ALTER TABLE `country` RENAME INDEX `Country_idGuild_idx` TO `country_idGuild_idx`;
ALTER TABLE `country` RENAME INDEX `Country_idRole_idx` TO `country_idRole_idx`;
ALTER TABLE `country` RENAME INDEX `Country_idRole_key` TO `country_idRole_key`;

-- language indexes
ALTER TABLE `language` RENAME INDEX `Language_enName_idx` TO `language_enName_idx`;
ALTER TABLE `language` RENAME INDEX `Language_frName_idx` TO `language_frName_idx`;
ALTER TABLE `language` RENAME INDEX `Language_idGuild_idx` TO `language_idGuild_idx`;
ALTER TABLE `language` RENAME INDEX `Language_idRole_idx` TO `language_idRole_idx`;
ALTER TABLE `language` RENAME INDEX `Language_idRole_key` TO `language_idRole_key`;

-- language_alias indexes
ALTER TABLE `language_alias` RENAME INDEX `LanguageAlias_alias_idx` TO `language_alias_alias_idx`;

-- country_alias indexes
ALTER TABLE `country_alias` RENAME INDEX `CountryAlias_alias_idx` TO `country_alias_alias_idx`;

-- Foreign keys cannot be renamed in place; drop, drop the backing index, then re-add
-- under the new name. MySQL auto-creates a new backing index that matches the FK name.
ALTER TABLE `language_alias` DROP FOREIGN KEY `LanguageAlias_idLanguage_fkey`;
ALTER TABLE `language_alias` DROP INDEX `LanguageAlias_idLanguage_fkey`;
ALTER TABLE `language_alias` ADD CONSTRAINT `language_alias_idLanguage_fkey`
    FOREIGN KEY (`idLanguage`) REFERENCES `language`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `country_alias` DROP FOREIGN KEY `CountryAlias_idCountry_fkey`;
ALTER TABLE `country_alias` DROP INDEX `CountryAlias_idCountry_fkey`;
ALTER TABLE `country_alias` ADD CONSTRAINT `country_alias_idCountry_fkey`
    FOREIGN KEY (`idCountry`) REFERENCES `country`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
