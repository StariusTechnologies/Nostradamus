/*
  Warnings:

  - A unique constraint covering the columns `[id,idGuild]` on the table `snippet` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[idGuild,alias]` on the table `snippet_alias` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `idGuild` to the `snippet_alias` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `snippet_alias` DROP FOREIGN KEY `snippet_alias_idSnippet_fkey`;

-- DropIndex
DROP INDEX `snippet_idGuild_createdAt_idx` ON `snippet`;

-- DropIndex
DROP INDEX `snippet_idGuild_idUser_idx` ON `snippet`;

-- DropIndex
DROP INDEX `snippet_alias_alias_idx` ON `snippet_alias`;

-- DropIndex
DROP INDEX `snippet_alias_idSnippet_fkey` ON `snippet_alias`;

-- AlterTable
ALTER TABLE `snippet_alias` ADD COLUMN `idGuild` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `snippet_id_idGuild_key` ON `snippet`(`id`, `idGuild`);

-- CreateIndex
CREATE UNIQUE INDEX `snippet_alias_idGuild_alias_key` ON `snippet_alias`(`idGuild`, `alias`);

-- AddForeignKey
ALTER TABLE `snippet_alias` ADD CONSTRAINT `snippet_alias_idSnippet_idGuild_fkey` FOREIGN KEY (`idSnippet`, `idGuild`) REFERENCES `snippet`(`id`, `idGuild`) ON DELETE CASCADE ON UPDATE CASCADE;
