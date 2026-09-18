/*
  Warnings:

  - A unique constraint covering the columns `[idSnippet,isPrimary]` on the table `snippet_alias` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `snippet_alias` ADD COLUMN `isPrimary` ENUM('PRIMARY') NULL;

-- CreateIndex
CREATE UNIQUE INDEX `snippet_alias_idSnippet_isPrimary_key` ON `snippet_alias`(`idSnippet`, `isPrimary`);
