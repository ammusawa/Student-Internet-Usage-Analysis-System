-- =============================================================================
-- Upgrade-only script (no DROP). For databases created before newer columns.
-- Requires MySQL 8.0.12+ for ADD COLUMN IF NOT EXISTS.
-- Run: mysql -u root -p student_usage_db < schema_upgrade_only.sql
-- =============================================================================

USE `student_usage_db`;

ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `approval_status` VARCHAR(20) NOT NULL DEFAULT 'approved';
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `approved_by_user_id` INT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `approved_at` DATETIME NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `profile_image_url` VARCHAR(255) NULL;

ALTER TABLE `sessions` ADD COLUMN IF NOT EXISTS `device_identifier` VARCHAR(128) NULL;
ALTER TABLE `sessions` ADD COLUMN IF NOT EXISTS `auth_source` VARCHAR(50) NOT NULL DEFAULT 'wifi_portal';
ALTER TABLE `sessions` ADD COLUMN IF NOT EXISTS `last_heartbeat_at` DATETIME NULL;

CREATE TABLE IF NOT EXISTS `session_ip_assignments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `session_id` INT NOT NULL,
  `ip_address` VARCHAR(45) NOT NULL,
  `assigned_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `released_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `idx_session_ip_assignments_session_id` (`session_id`),
  KEY `idx_session_ip_assignments_ip_address` (`ip_address`),
  CONSTRAINT `fk_session_ip_assignments_session_id`
    FOREIGN KEY (`session_id`) REFERENCES `sessions` (`session_id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `flagged_sites` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `website` VARCHAR(255) NOT NULL,
  `is_active` TINYINT NOT NULL DEFAULT 1,
  `created_by_user_id` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_flagged_sites_website` (`website`),
  KEY `idx_flagged_sites_active` (`is_active`),
  CONSTRAINT `fk_flagged_sites_created_by_user_id`
    FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
