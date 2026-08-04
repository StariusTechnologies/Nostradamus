-- CreateTable
CREATE TABLE `audit_ignored_role` (
    `idGuild` VARCHAR(191) NOT NULL,
    `idRole` VARCHAR(191) NOT NULL,

    INDEX `audit_ignored_role_idGuild_idx`(`idGuild`),
    PRIMARY KEY (`idGuild`, `idRole`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
