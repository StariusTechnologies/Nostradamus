/*
  Warnings:

  - A unique constraint covering the columns `[idRole]` on the table `Country` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[idRole]` on the table `Language` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `Country_idRole_key` ON `Country`(`idRole`);

-- CreateIndex
CREATE UNIQUE INDEX `Language_idRole_key` ON `Language`(`idRole`);
