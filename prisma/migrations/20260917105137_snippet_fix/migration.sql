/*
  Warnings:

  - You are about to drop the `snippet_permission` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `canEdit` to the `snippet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `canRead` to the `snippet` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `snippet_permission` DROP FOREIGN KEY `snippet_permission_idSnippet_fkey`;

-- AlterTable
ALTER TABLE `snippet` ADD COLUMN `canEdit` JSON NOT NULL,
    ADD COLUMN `canRead` JSON NOT NULL;

-- DropTable
DROP TABLE `snippet_permission`;
