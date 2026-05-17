-- CreateTable
CREATE TABLE `self_grantable_role` (
    `idGuild` VARCHAR(191) NOT NULL,
    `idRole` VARCHAR(191) NOT NULL,
    `enDescription` TEXT NOT NULL,
    `frDescription` TEXT NOT NULL,
    `emoji` VARCHAR(100) NULL,

    INDEX `self_grantable_role_idGuild_idx`(`idGuild`),
    PRIMARY KEY (`idGuild`, `idRole`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
