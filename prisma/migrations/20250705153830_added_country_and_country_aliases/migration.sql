-- CreateTable
CREATE TABLE `Country` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `enName` VARCHAR(191) NOT NULL,
    `frName` VARCHAR(191) NOT NULL,
    `idGuild` VARCHAR(191) NOT NULL,
    `idRole` VARCHAR(191) NOT NULL,

    INDEX `Country_enName_idx`(`enName`),
    INDEX `Country_frName_idx`(`frName`),
    INDEX `Country_idGuild_idx`(`idGuild`),
    INDEX `Country_idRole_idx`(`idRole`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CountryAlias` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `idCountry` INTEGER NOT NULL,
    `alias` VARCHAR(191) NOT NULL,

    INDEX `CountryAlias_alias_idx`(`alias`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CountryAlias` ADD CONSTRAINT `CountryAlias_idCountry_fkey` FOREIGN KEY (`idCountry`) REFERENCES `Country`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
