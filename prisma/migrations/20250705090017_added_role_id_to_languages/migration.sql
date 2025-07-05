/*
  Warnings:

  - Added the required column `idRole` to the `Language` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Language` ADD COLUMN `idRole` VARCHAR(191) NOT NULL;
