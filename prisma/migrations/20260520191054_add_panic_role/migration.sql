-- CreateTable
CREATE TABLE `panic_role` (
    `idGuild` VARCHAR(191) NOT NULL,
    `idRole` VARCHAR(191) NOT NULL,

    INDEX `panic_role_idGuild_idx`(`idGuild`),
    PRIMARY KEY (`idGuild`, `idRole`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
