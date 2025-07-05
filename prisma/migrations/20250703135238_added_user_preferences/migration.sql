-- CreateTable
CREATE TABLE `UserPreference` (
    `idUser` VARCHAR(191) NOT NULL,
    `locale` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`idUser`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
