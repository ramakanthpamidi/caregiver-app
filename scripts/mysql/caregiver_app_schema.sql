-- =============================================================================
-- caregiver-app local MySQL schema
-- Derived from client API contracts in api.text + src/** (bpscaregiver.com)
-- MySQL 8.0+ / MariaDB 10.3+
-- =============================================================================
-- Create / recreate:
--   mysql -u root -p"root@1234" < scripts/mysql/caregiver_app_schema.sql
-- =============================================================================

CREATE DATABASE IF NOT EXISTS caregiver_app
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE caregiver_app;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- AUTH / USERS
-- POST /users  { user_label, email, password }
-- POST /auth/login  { email, password }
-- POST /auth/google|facebook|line
-- POST /auth/verify-email  { email, code }
-- DELETE /users/me
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS email_verification_codes;
DROP TABLE IF EXISTS oauth_identities;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_label            VARCHAR(120)    NOT NULL DEFAULT '',
  email                 VARCHAR(255)    NULL,
  password_hash         VARCHAR(255)    NULL COMMENT 'bcrypt/argon hash; null for pure OAuth accounts',
  email_verified        TINYINT(1)      NOT NULL DEFAULT 0,
  email_verified_at     DATETIME(3)     NULL,
  status                ENUM('active','pending_verification','disabled','deleted') NOT NULL DEFAULT 'pending_verification',
  last_login_at         DATETIME(3)     NULL,
  created_at            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at            DATETIME(3)     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE oauth_identities (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id               BIGINT UNSIGNED NOT NULL,
  provider              ENUM('google','facebook','line') NOT NULL,
  provider_user_id      VARCHAR(191)    NOT NULL,
  email                 VARCHAR(255)    NULL,
  display_name          VARCHAR(255)    NULL,
  raw_profile           JSON            NULL,
  created_at            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_oauth_provider_user (provider, provider_user_id),
  KEY idx_oauth_user (user_id),
  CONSTRAINT fk_oauth_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE email_verification_codes (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email                 VARCHAR(255)    NOT NULL,
  code                  VARCHAR(16)     NOT NULL,
  user_id               BIGINT UNSIGNED NULL,
  expires_at            DATETIME(3)     NOT NULL,
  consumed_at           DATETIME(3)     NULL,
  created_at            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_evc_email (email),
  KEY idx_evc_code (code),
  CONSTRAINT fk_evc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- PROFILES
-- GET  /profiles/me
-- POST /profiles  { profile_label, access_password? }
-- POST /profiles/with-medical
-- PUT  /profiles/:id
-- DELETE /profiles/:id
-- POST /profiles/:id/verify-password
-- POST /profiles/:id/use  { from_profile_id? }
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS profile_goals;
DROP TABLE IF EXISTS profile_reminders;
DROP TABLE IF EXISTS profile_consents;
DROP TABLE IF EXISTS medical_general_info;
DROP TABLE IF EXISTS profiles;

CREATE TABLE profiles (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profile_label         VARCHAR(120)    NOT NULL,
  owner_user_id         BIGINT UNSIGNED NOT NULL COMMENT 'maps to owner_user_id / created_by_account_id in API',
  access_password_hash  VARCHAR(255)    NULL COMMENT 'optional per-profile gate; has_access_password = NOT NULL',
  last_used_at          DATETIME(3)     NULL,
  created_at            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at            DATETIME(3)     NULL,
  PRIMARY KEY (id),
  KEY idx_profiles_owner (owner_user_id),
  KEY idx_profiles_last_used (last_used_at),
  CONSTRAINT fk_profiles_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE profile_consents (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profile_id            BIGINT UNSIGNED NOT NULL,
  consent_granted       TINYINT(1)      NOT NULL DEFAULT 0,
  source                VARCHAR(64)     NULL COMMENT 'e.g. app onboarding',
  granted_at            DATETIME(3)     NULL,
  created_at            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_profile_consents_profile (profile_id),
  CONSTRAINT fk_consents_profile FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE medical_general_info (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profile_id            BIGINT UNSIGNED NOT NULL,
  date_of_birth         DATE            NULL,
  sex                   VARCHAR(32)     NULL COMMENT 'Male | Female | other',
  organ_donor           TINYINT(1)      NULL,
  blood_type            VARCHAR(16)     NULL,
  height_cm             DECIMAL(6,2)    NULL,
  weight_kg             DECIMAL(6,2)    NULL,
  allergies             JSON            NULL,
  chronic_conditions    JSON            NULL,
  medications           JSON            NULL,
  family_history        JSON            NULL,
  emergency_contact     VARCHAR(255)    NULL,
  insurance_provider    VARCHAR(255)    NULL,
  insurance_number      VARCHAR(128)    NULL,
  created_at            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_medical_general_profile (profile_id),
  CONSTRAINT fk_medical_general_profile FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE profile_reminders (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profile_id            BIGINT UNSIGNED NOT NULL,
  title                 VARCHAR(200)    NOT NULL,
  description           TEXT            NULL,
  enabled               TINYINT(1)      NOT NULL DEFAULT 1,
  time_of_day           TIME            NOT NULL COMMENT 'HH:MM[:SS]',
  timezone              VARCHAR(64)     NULL,
  repeat_type           VARCHAR(32)     NOT NULL DEFAULT 'None' COMMENT 'None|Daily|Weekly|Monthly|Custom',
  repeat_rule           JSON            NULL,
  next_fire_at          DATETIME(3)     NULL,
  created_by            BIGINT UNSIGNED NULL,
  updated_by            BIGINT UNSIGNED NULL,
  created_at            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3)     NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_reminders_profile (profile_id),
  KEY idx_reminders_next_fire (next_fire_at),
  CONSTRAINT fk_reminders_profile FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_reminders_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_reminders_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE profile_goals (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profile_id            BIGINT UNSIGNED NOT NULL,
  title                 VARCHAR(200)    NOT NULL,
  description           TEXT            NULL,
  goal_type             VARCHAR(64)     NOT NULL,
  target                JSON            NULL,
  start_date            DATE            NOT NULL,
  end_date              DATE            NULL,
  status                VARCHAR(32)     NOT NULL DEFAULT 'Active' COMMENT 'Active|Paused|Completed|Archived',
  created_by            BIGINT UNSIGNED NULL,
  updated_by            BIGINT UNSIGNED NULL,
  created_at            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3)     NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_goals_profile (profile_id),
  KEY idx_goals_status (status),
  CONSTRAINT fk_goals_profile FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_goals_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_goals_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- DEVICES
-- POST   /devices  { device_id, device_name, factory_name, device_type, medical_device_type, comm_protocol, platform }
-- PATCH  /devices/:id  { device_name }
-- DELETE /devices/:id?soft=true
-- GET    /users/me/devices
-- GET    /yuwell/models
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS user_devices;
DROP TABLE IF EXISTS devices;
DROP TABLE IF EXISTS yuwell_models;

CREATE TABLE devices (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  device_id             VARCHAR(128)    NOT NULL COMMENT 'BLE MAC / hardware id used by client',
  device_uuid           VARCHAR(64)     NULL,
  endpoint_uuid         VARCHAR(64)     NULL,
  device_name           VARCHAR(200)    NOT NULL DEFAULT '',
  factory_name          VARCHAR(200)    NULL,
  display_name          VARCHAR(200)    NULL,
  device_type           VARCHAR(64)     NOT NULL DEFAULT 'Medical',
  medical_device_type   VARCHAR(128)    NULL COMMENT 'Pressure, Glucose, Thermometer, Oximeter, Scale, ...',
  comm_protocol         VARCHAR(32)     NOT NULL DEFAULT 'BLE',
  platform              VARCHAR(64)     NULL COMMENT 'Yuwell, AILink, ...',
  status                VARCHAR(32)     NOT NULL DEFAULT 'active',
  owner_user_id         BIGINT UNSIGNED NOT NULL,
  deleted_at            DATETIME(3)     NULL COMMENT 'soft delete when DELETE ?soft=true',
  created_at            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_devices_device_id (device_id),
  KEY idx_devices_owner (owner_user_id),
  KEY idx_devices_factory (factory_name),
  CONSTRAINT fk_devices_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional sharing / grant model (supports granted_at, granted_by, can_rename on /users/me/devices)
CREATE TABLE user_devices (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id               BIGINT UNSIGNED NOT NULL,
  device_ref            BIGINT UNSIGNED NOT NULL COMMENT 'FK devices.id',
  granted_by            BIGINT UNSIGNED NULL,
  granted_at            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  can_rename            TINYINT(1)      NOT NULL DEFAULT 1,
  created_at            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_device (user_id, device_ref),
  KEY idx_user_devices_device (device_ref),
  CONSTRAINT fk_user_devices_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_devices_device FOREIGN KEY (device_ref) REFERENCES devices(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_devices_granted_by FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE yuwell_models (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  factory_name          VARCHAR(200)    NOT NULL,
  display_name          VARCHAR(200)    NULL,
  medical_device_type   VARCHAR(128)    NULL,
  meta                  JSON            NULL,
  created_at            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_yuwell_factory_name (factory_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- MEDICAL DATA & EVENTS
-- POST /medical-data  { device_id, profile_id, ts, snapshot, lat?, lng? }
-- GET  /medical-data?profile_id=&mode=all
-- GET  /medical-data/trends?profile_id=&period=
-- POST /medical-events { device_id, profile_id, ts, event_type, payload, lat?, lng? }
-- GET  /profiles/:id/health-report-data  → tables:
--      medical_general_info, medical_data_raw, medical_data_daily,
--      medical_data_archeive (API spelling), medical_events, medical_events_archive
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS medical_events_archive;
DROP TABLE IF EXISTS medical_events;
DROP TABLE IF EXISTS medical_data_archeive;
DROP TABLE IF EXISTS medical_data_daily;
DROP TABLE IF EXISTS medical_data_raw;

CREATE TABLE medical_data_raw (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profile_id            BIGINT UNSIGNED NOT NULL,
  device_ref            BIGINT UNSIGNED NULL COMMENT 'FK devices.id when resolvable',
  device_id             VARCHAR(128)    NULL COMMENT 'hardware id string from client',
  ts                    DATETIME(3)     NOT NULL COMMENT 'observation time',
  snapshot              JSON            NOT NULL,
  latitude              DECIMAL(10,7)   NULL,
  longitude             DECIMAL(10,7)   NULL,
  captured_by_user_id   BIGINT UNSIGNED NULL,
  created_at            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_mdr_profile_ts (profile_id, ts),
  KEY idx_mdr_device_id (device_id),
  KEY idx_mdr_device_ref (device_ref),
  CONSTRAINT fk_mdr_profile FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_mdr_device_ref FOREIGN KEY (device_ref) REFERENCES devices(id) ON DELETE SET NULL,
  CONSTRAINT fk_mdr_user FOREIGN KEY (captured_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE medical_data_daily (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profile_id            BIGINT UNSIGNED NOT NULL,
  day_date              DATE            NOT NULL,
  metric_type           VARCHAR(64)     NOT NULL COMMENT 'bp, glucose, temp, spo2, weight, ...',
  device_ref            BIGINT UNSIGNED NULL,
  device_id             VARCHAR(128)    NULL,
  summary               JSON            NOT NULL COMMENT 'aggregates used by trends (avg/min/max/last)',
  sample_count          INT UNSIGNED    NOT NULL DEFAULT 0,
  created_at            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_mdd_profile_day_metric_device (profile_id, day_date, metric_type, device_id),
  KEY idx_mdd_profile_day (profile_id, day_date),
  CONSTRAINT fk_mdd_profile FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_mdd_device_ref FOREIGN KEY (device_ref) REFERENCES devices(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Keep API spelling "archeive" for parity with health-report-data table_sources
CREATE TABLE medical_data_archeive (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profile_id            BIGINT UNSIGNED NOT NULL,
  device_ref            BIGINT UNSIGNED NULL,
  device_id             VARCHAR(128)    NULL,
  ts                    DATETIME(3)     NOT NULL,
  snapshot              JSON            NOT NULL,
  latitude              DECIMAL(10,7)   NULL,
  longitude             DECIMAL(10,7)   NULL,
  captured_by_user_id   BIGINT UNSIGNED NULL,
  archived_at           DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  original_id           BIGINT UNSIGNED NULL COMMENT 'id from medical_data_raw before archive',
  created_at            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_mda_profile_ts (profile_id, ts),
  KEY idx_mda_original (original_id),
  CONSTRAINT fk_mda_profile FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_mda_device_ref FOREIGN KEY (device_ref) REFERENCES devices(id) ON DELETE SET NULL,
  CONSTRAINT fk_mda_user FOREIGN KEY (captured_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE medical_events (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profile_id            BIGINT UNSIGNED NOT NULL,
  device_ref            BIGINT UNSIGNED NULL,
  device_id             VARCHAR(128)    NULL,
  ts                    DATETIME(3)     NOT NULL,
  event_type            VARCHAR(128)    NOT NULL COMMENT 'alert severity/type from client',
  payload               JSON            NULL,
  latitude              DECIMAL(10,7)   NULL,
  longitude             DECIMAL(10,7)   NULL,
  captured_by_user_id   BIGINT UNSIGNED NULL,
  created_at            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_me_profile_ts (profile_id, ts),
  KEY idx_me_event_type (event_type),
  KEY idx_me_device_id (device_id),
  CONSTRAINT fk_me_profile FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_me_device_ref FOREIGN KEY (device_ref) REFERENCES devices(id) ON DELETE SET NULL,
  CONSTRAINT fk_me_user FOREIGN KEY (captured_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE medical_events_archive (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profile_id            BIGINT UNSIGNED NOT NULL,
  device_ref            BIGINT UNSIGNED NULL,
  device_id             VARCHAR(128)    NULL,
  ts                    DATETIME(3)     NOT NULL,
  event_type            VARCHAR(128)    NOT NULL,
  payload               JSON            NULL,
  latitude              DECIMAL(10,7)   NULL,
  longitude             DECIMAL(10,7)   NULL,
  captured_by_user_id   BIGINT UNSIGNED NULL,
  archived_at           DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  original_id           BIGINT UNSIGNED NULL,
  created_at            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_mea_profile_ts (profile_id, ts),
  KEY idx_mea_original (original_id),
  CONSTRAINT fk_mea_profile FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_mea_device_ref FOREIGN KEY (device_ref) REFERENCES devices(id) ON DELETE SET NULL,
  CONSTRAINT fk_mea_user FOREIGN KEY (captured_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- LINE NOTIFY
-- GET/POST /line-notify
-- PUT/DELETE /line-notify/:id
-- POST /line-notify/link-pin  { profile_id }
-- GET  /line-notify/link-status?pin=
-- POST /line-notify/simulate
-- POST /line-notify/daily-summary
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS line_notify_link_pins;
DROP TABLE IF EXISTS line_notify_targets;

CREATE TABLE line_notify_targets (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profile_id            BIGINT UNSIGNED NOT NULL,
  line_user_id          VARCHAR(128)    NOT NULL,
  line_display_name     VARCHAR(255)    NULL,
  notify_critical       TINYINT(1)      NOT NULL DEFAULT 1,
  notify_warning        TINYINT(1)      NOT NULL DEFAULT 1,
  notify_good           TINYINT(1)      NOT NULL DEFAULT 0,
  notify_excellent      TINYINT(1)      NOT NULL DEFAULT 0,
  enabled               TINYINT(1)      NOT NULL DEFAULT 1,
  created_at            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3)     NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_line_target_profile_user (profile_id, line_user_id),
  KEY idx_line_targets_profile (profile_id),
  CONSTRAINT fk_line_targets_profile FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE line_notify_link_pins (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profile_id            BIGINT UNSIGNED NOT NULL,
  pin                   VARCHAR(16)     NOT NULL,
  expires_at            DATETIME(3)     NOT NULL,
  linked_at             DATETIME(3)     NULL,
  line_user_id          VARCHAR(128)    NULL,
  line_display_name     VARCHAR(255)    NULL,
  created_at            DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_line_pin (pin),
  KEY idx_line_pin_profile (profile_id),
  CONSTRAINT fk_line_pin_profile FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------------------------------
-- Seed: sample Yuwell model names (optional local catalog)
-- -----------------------------------------------------------------------------
INSERT INTO yuwell_models (factory_name, display_name, medical_device_type) VALUES
  ('Yuwell BO-YX110', 'Pulse Oximeter', 'Oximeter'),
  ('Yuwell BO-YX310', 'Pulse Oximeter', 'Oximeter'),
  ('BO-YX310', 'Pulse Oximeter', 'Oximeter'),
  ('Yuwell YE660D', 'Blood Pressure Monitor', 'Pressure'),
  ('Yuwell 582', 'Blood Glucose Meter', 'Glucose'),
  ('Yuwell YT-1', 'Infrared Thermometer', 'Thermometer')
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  medical_device_type = VALUES(medical_device_type);

-- Done
SELECT 'caregiver_app schema applied' AS status;
SHOW TABLES;
