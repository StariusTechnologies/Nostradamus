-- Cross-platform table renames for @@map mappings.
-- On Windows MySQL (lower_case_table_names=1), tables are stored lowercase already;
-- on Linux MySQL (case-preserved), they keep their original case.
-- Each block looks up the actual stored name (case-insensitive), then renames it
-- to the target only if the BINARY (case-sensitive) comparison shows a difference.
-- 'DO 0' is the no-op fallback when nothing needs to change.

-- Settings -> settings
SET @actual = (SELECT table_name FROM information_schema.tables
               WHERE table_schema = DATABASE() AND LOWER(table_name) = 'settings'
               LIMIT 1);
SET @sql = IF(@actual IS NOT NULL AND BINARY @actual != 'settings',
    CONCAT('RENAME TABLE `', @actual, '` TO `settings`'),
    'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- UserPreference -> user_preference
SET @actual = (SELECT table_name FROM information_schema.tables
               WHERE table_schema = DATABASE() AND LOWER(table_name) = 'userpreference'
               LIMIT 1);
SET @sql = IF(@actual IS NOT NULL AND BINARY @actual != 'user_preference',
    CONCAT('RENAME TABLE `', @actual, '` TO `user_preference`'),
    'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Language -> language
SET @actual = (SELECT table_name FROM information_schema.tables
               WHERE table_schema = DATABASE() AND LOWER(table_name) = 'language'
               LIMIT 1);
SET @sql = IF(@actual IS NOT NULL AND BINARY @actual != 'language',
    CONCAT('RENAME TABLE `', @actual, '` TO `language`'),
    'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- LanguageAlias -> language_alias
SET @actual = (SELECT table_name FROM information_schema.tables
               WHERE table_schema = DATABASE() AND LOWER(table_name) = 'languagealias'
               LIMIT 1);
SET @sql = IF(@actual IS NOT NULL AND BINARY @actual != 'language_alias',
    CONCAT('RENAME TABLE `', @actual, '` TO `language_alias`'),
    'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Country -> country
SET @actual = (SELECT table_name FROM information_schema.tables
               WHERE table_schema = DATABASE() AND LOWER(table_name) = 'country'
               LIMIT 1);
SET @sql = IF(@actual IS NOT NULL AND BINARY @actual != 'country',
    CONCAT('RENAME TABLE `', @actual, '` TO `country`'),
    'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- CountryAlias -> country_alias
SET @actual = (SELECT table_name FROM information_schema.tables
               WHERE table_schema = DATABASE() AND LOWER(table_name) = 'countryalias'
               LIMIT 1);
SET @sql = IF(@actual IS NOT NULL AND BINARY @actual != 'country_alias',
    CONCAT('RENAME TABLE `', @actual, '` TO `country_alias`'),
    'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
