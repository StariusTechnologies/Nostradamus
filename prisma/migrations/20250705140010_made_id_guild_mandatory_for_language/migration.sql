/*
  Warnings:

  - Made the column `idGuild` on table `language` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `Language` MODIFY `idGuild` VARCHAR(191) NOT NULL;
