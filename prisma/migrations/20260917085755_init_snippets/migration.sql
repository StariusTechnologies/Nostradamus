-- CreateTable
CREATE TABLE `snippet` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `idGuild` VARCHAR(191) NOT NULL,
    `idUser` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `attachmentUrl` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,

    INDEX `snippet_idGuild_idUser_idx`(`idGuild`, `idUser`),
    INDEX `snippet_idGuild_createdAt_idx`(`idGuild`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `snippet_permission` (
    `idSnippet` INTEGER NOT NULL,
    `canRead` JSON NOT NULL,
    `canEdit` JSON NOT NULL,

    PRIMARY KEY (`idSnippet`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `snippet_alias` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `idSnippet` INTEGER NOT NULL,
    `alias` VARCHAR(191) NOT NULL,

    INDEX `snippet_alias_alias_idx`(`alias`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `snippet_permission` ADD CONSTRAINT `snippet_permission_idSnippet_fkey` FOREIGN KEY (`idSnippet`) REFERENCES `snippet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `snippet_alias` ADD CONSTRAINT `snippet_alias_idSnippet_fkey` FOREIGN KEY (`idSnippet`) REFERENCES `snippet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
