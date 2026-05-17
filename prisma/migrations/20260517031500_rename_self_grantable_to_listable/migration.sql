-- RenameTable
RENAME TABLE `self_grantable_role` TO `listable_role`;

-- RenameIndex
ALTER TABLE `listable_role` RENAME INDEX `self_grantable_role_idGuild_idx` TO `listable_role_idGuild_idx`;
