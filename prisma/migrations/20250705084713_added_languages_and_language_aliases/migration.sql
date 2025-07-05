-- CreateTable
CREATE TABLE `Language` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `enName` VARCHAR(191) NOT NULL,
    `frName` VARCHAR(191) NOT NULL,

    INDEX `Language_enName_idx`(`enName`),
    INDEX `Language_frName_idx`(`frName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LanguageAlias` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `idLanguage` INTEGER NOT NULL,
    `alias` VARCHAR(191) NOT NULL,

    INDEX `LanguageAlias_alias_idx`(`alias`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LanguageAlias` ADD CONSTRAINT `LanguageAlias_idLanguage_fkey` FOREIGN KEY (`idLanguage`) REFERENCES `Language`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
