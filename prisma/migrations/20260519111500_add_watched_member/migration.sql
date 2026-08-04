-- CreateTable
CREATE TABLE `watched_member` (
    `idGuild` VARCHAR(191) NOT NULL,
    `idUser` VARCHAR(191) NOT NULL,
    `reason` TEXT NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,

    INDEX `watched_member_idGuild_idx`(`idGuild`),
    PRIMARY KEY (`idGuild`, `idUser`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
