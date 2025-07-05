-- DropForeignKey
ALTER TABLE `CountryAlias` DROP FOREIGN KEY `CountryAlias_idCountry_fkey`;

-- DropForeignKey
ALTER TABLE `LanguageAlias` DROP FOREIGN KEY `LanguageAlias_idLanguage_fkey`;

-- DropIndex
DROP INDEX `CountryAlias_idCountry_fkey` ON `CountryAlias`;

-- DropIndex
DROP INDEX `LanguageAlias_idLanguage_fkey` ON `LanguageAlias`;

-- AddForeignKey
ALTER TABLE `LanguageAlias` ADD CONSTRAINT `LanguageAlias_idLanguage_fkey` FOREIGN KEY (`idLanguage`) REFERENCES `Language`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CountryAlias` ADD CONSTRAINT `CountryAlias_idCountry_fkey` FOREIGN KEY (`idCountry`) REFERENCES `Country`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
