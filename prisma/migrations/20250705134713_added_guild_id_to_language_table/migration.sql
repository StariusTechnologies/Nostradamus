-- AlterTable
ALTER TABLE `Language` ADD COLUMN `idGuild` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Language_idGuild_idx` ON `Language`(`idGuild`);

-- CreateIndex
CREATE INDEX `Language_idRole_idx` ON `Language`(`idRole`);
