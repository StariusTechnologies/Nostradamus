-- CreateTable
CREATE TABLE `topic` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `locale` VARCHAR(10) NOT NULL,
    `text` TEXT NOT NULL,
    `postCount` INTEGER NOT NULL DEFAULT 0,

    INDEX `topic_locale_postCount_idx`(`locale`, `postCount`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
