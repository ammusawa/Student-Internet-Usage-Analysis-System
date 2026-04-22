-- =============================================================================
-- Student Internet Usage Analysis System — Complete MySQL Database Schema
-- =============================================================================
-- Matches SQLAlchemy models in backend/models.py and startup migrations in
-- backend/main.py (ensure_identity_schema).
--
-- Usage (fresh install):
--   mysql -u root -p < schema_full.sql
-- Or set DB name and run from MySQL client.
--
-- Default database name matches backend/.env (DB_NAME=student_usage_db).
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- Database
-- -----------------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS `student_usage_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `student_usage_db`;

-- -----------------------------------------------------------------------------
-- Drop existing objects (optional — comment out if you only want CREATE)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `logs`;
DROP TABLE IF EXISTS `session_ip_assignments`;
DROP TABLE IF EXISTS `sessions`;
DROP TABLE IF EXISTS `flagged_sites`;
DROP TABLE IF EXISTS `categories`;
DROP TABLE IF EXISTS `users`;

SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------------------------------
-- Table: users
-- -----------------------------------------------------------------------------
CREATE TABLE `users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NULL,
  `username` VARCHAR(50) NOT NULL,
  `password_hash` VARCHAR(200) NOT NULL,
  `role` VARCHAR(50) NOT NULL DEFAULT 'student',
  `approval_status` VARCHAR(20) NOT NULL DEFAULT 'approved',
  `approved_by_user_id` INT NULL,
  `approved_at` DATETIME NULL,
  `profile_image_url` VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`),
  KEY `ix_users_approval_status` (`approval_status`),
  KEY `fk_users_approved_by` (`approved_by_user_id`),
  CONSTRAINT `fk_users_approved_by_user_id`
    FOREIGN KEY (`approved_by_user_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Table: categories
-- -----------------------------------------------------------------------------
CREATE TABLE `categories` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `website` VARCHAR(255) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_categories_website` (`website`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Table: sessions
-- -----------------------------------------------------------------------------
CREATE TABLE `sessions` (
  `session_id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `ip_address` VARCHAR(45) NOT NULL,
  `device_identifier` VARCHAR(128) NULL,
  `auth_source` VARCHAR(50) NOT NULL DEFAULT 'wifi_portal',
  `login_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_heartbeat_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `logout_time` DATETIME NULL,
  PRIMARY KEY (`session_id`),
  KEY `ix_sessions_user_id` (`user_id`),
  KEY `ix_sessions_ip_address` (`ip_address`),
  KEY `ix_sessions_device_identifier` (`device_identifier`),
  CONSTRAINT `fk_sessions_user_id`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Table: session_ip_assignments
-- (matches ensure_identity_schema + models.SessionIPAssignment)
-- -----------------------------------------------------------------------------
CREATE TABLE `session_ip_assignments` (
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

-- -----------------------------------------------------------------------------
-- Table: logs
-- -----------------------------------------------------------------------------
CREATE TABLE `logs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `session_id` INT NOT NULL,
  `website` VARCHAR(255) NOT NULL,
  `category_id` INT NULL,
  `data_used_mb` FLOAT NOT NULL,
  `timestamp` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `ix_logs_session_id` (`session_id`),
  KEY `ix_logs_website` (`website`),
  KEY `ix_logs_category_id` (`category_id`),
  CONSTRAINT `fk_logs_session_id`
    FOREIGN KEY (`session_id`) REFERENCES `sessions` (`session_id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_logs_category_id`
    FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Table: flagged_sites
-- (matches ensure_identity_schema + models.FlaggedSite)
-- -----------------------------------------------------------------------------
CREATE TABLE `flagged_sites` (
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

-- =============================================================================
-- End of schema
-- =============================================================================
