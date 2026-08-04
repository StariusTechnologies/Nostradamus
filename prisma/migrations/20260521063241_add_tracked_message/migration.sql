-- CreateTable
CREATE TABLE `tracked_message` (
    `idGuild` VARCHAR(191) NOT NULL,
    `idUser` VARCHAR(191) NOT NULL,
    `idChannel` VARCHAR(191) NOT NULL,
    `idMessage` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,

    INDEX `tracked_message_idGuild_idUser_createdAt_idx`(`idGuild`, `idUser`, `createdAt`),
    INDEX `tracked_message_idGuild_createdAt_idx`(`idGuild`, `createdAt`),
    PRIMARY KEY (`idGuild`, `idMessage`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
