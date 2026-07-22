-- MIRACLE · MySQL schema
--
-- Creates one table per IndexedDB store (faithfully mirrored) plus auth tables.
-- All entry tables FK to users(id) for ownership.
--
-- USAGE:
--   · The server auto-applies this file on boot (see server/db.js → ensureSchema).
--     Every CREATE uses IF NOT EXISTS, so re-running is safe.
--   · For manual import (MySQL Workbench, mysql CLI), first connect to the target
--     database, then run this file. The server-side bootstrap intentionally does
--     NOT issue CREATE DATABASE / USE — it operates against whatever DB the
--     connection pool was opened on (e.g. Railway's `railway` DB).
--
-- For local dev only, if you want a fresh `miracle` DB, run this in a MySQL client first:
--   CREATE DATABASE IF NOT EXISTS miracle CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--   USE miracle;

-- ═══════════════════════════════════════════════════════════
-- AUTH
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users (
  id            CHAR(26)      PRIMARY KEY,                                  -- ULID
  email         VARCHAR(254)  NOT NULL UNIQUE,
  password_hash VARCHAR(255)  NOT NULL,                                     -- bcrypt
  name          VARCHAR(120)  NOT NULL DEFAULT '',
  calling       TEXT          NULL,
  anchor_verse  VARCHAR(80)   NULL,
  day_start     CHAR(5)       NULL DEFAULT '06:00',
  timezone      VARCHAR(64)   NULL DEFAULT 'Africa/Accra',
  tier          ENUM('free', 'premium', 'kingdom') NOT NULL DEFAULT 'free',
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP     NULL,
  INDEX idx_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
  token        CHAR(64)   PRIMARY KEY,                                       -- random sha256-hex
  user_id      CHAR(26)   NOT NULL,
  created_at   TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at   TIMESTAMP  NOT NULL,
  user_agent   VARCHAR(255) NULL,
  ip           VARCHAR(45)  NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_exp  (expires_at)
) ENGINE=InnoDB;

-- Add email verification columns to users table (idempotent on any MySQL 5.7+)
-- Uses information_schema to avoid the 8.0.29+ "ADD COLUMN IF NOT EXISTS" syntax.
SELECT COUNT(*) INTO @ev_col_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'users'
  AND COLUMN_NAME = 'email_verified';

SET @ev_stmt := IF(@ev_col_exists = 0,
  'ALTER TABLE users ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 0, ADD COLUMN email_verified_at TIMESTAMP NULL',
  'SELECT 1'
);
PREPARE ev_p FROM @ev_stmt;
EXECUTE ev_p;
DEALLOCATE PREPARE ev_p;

-- Email-verification tokens. Single-use, 24h TTL.
CREATE TABLE IF NOT EXISTS email_verifications (
  token       CHAR(64)  PRIMARY KEY,                                          -- random hex
  user_id     CHAR(26)  NOT NULL,
  expires_at  TIMESTAMP NOT NULL,
  used_at     TIMESTAMP NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_exp  (expires_at)
) ENGINE=InnoDB;

-- Password reset tokens. Single-use, 1h TTL.
CREATE TABLE IF NOT EXISTS password_resets (
  token       CHAR(64)  PRIMARY KEY,
  user_id     CHAR(26)  NOT NULL,
  expires_at  TIMESTAMP NOT NULL,
  used_at     TIMESTAMP NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip          VARCHAR(45) NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_exp  (expires_at)
) ENGINE=InnoDB;

-- PIN reset OTPs. 6-digit numeric, single-use, 15m TTL.
CREATE TABLE IF NOT EXISTS pin_resets (
  id          CHAR(26)  PRIMARY KEY,
  user_id     CHAR(26)  NOT NULL,
  otp_hash    CHAR(64)  NOT NULL,                                            -- sha256(otp) hex
  expires_at  TIMESTAMP NOT NULL,
  used_at     TIMESTAMP NULL,
  attempts    TINYINT   NOT NULL DEFAULT 0,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip          VARCHAR(45) NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_exp  (expires_at)
) ENGINE=InnoDB;

-- ═══════════════════════════════════════════════════════════
-- ENTRY STORES (one table per IndexedDB store)
-- All hold their canonical payload in `data` JSON to stay
-- schema-agnostic, plus indexed columns for filter/sort.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS daily (
  user_id     CHAR(26)   NOT NULL,
  date        CHAR(10)   NOT NULL,
  data        JSON       NOT NULL,
  updated_at  TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS dreams (
  id           CHAR(26)   PRIMARY KEY,
  user_id      CHAR(26)   NOT NULL,
  status       VARCHAR(20) NULL,
  dream_date   CHAR(10)   NULL,
  fulfilled_on CHAR(10)   NULL,
  data         JSON       NOT NULL,
  updated_at   TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_status (user_id, status),
  INDEX idx_user_updated (user_id, updated_at DESC)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ideas (
  id          CHAR(26)   PRIMARY KEY,
  user_id     CHAR(26)   NOT NULL,
  status      VARCHAR(20) NULL,
  data        JSON       NOT NULL,
  updated_at  TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_status (user_id, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bible (
  id              CHAR(26)   PRIMARY KEY,
  user_id         CHAR(26)   NOT NULL,
  passage_book    VARCHAR(80) NULL,
  passage_chapter SMALLINT   NULL,
  passage         VARCHAR(120) NULL,
  data            JSON       NOT NULL,
  updated_at      TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_book (user_id, passage_book),
  INDEX idx_user_updated (user_id, updated_at DESC)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS prayers (
  id           CHAR(26)   PRIMARY KEY,
  user_id      CHAR(26)   NOT NULL,
  status       VARCHAR(20) NULL,
  answer       VARCHAR(20) NULL,
  answered_on  CHAR(10)   NULL,
  started_on   CHAR(10)   NULL,
  data         JSON       NOT NULL,
  updated_at   TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_status (user_id, status, answer)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS prophecies (
  id            CHAR(26)   PRIMARY KEY,
  user_id       CHAR(26)   NOT NULL,
  status        VARCHAR(20) NULL,                                           -- active / fulfilled / cancelled
  date_received CHAR(10)   NULL,
  fulfilled_on  CHAR(10)   NULL,
  speaker       VARCHAR(120) NULL,
  platform      VARCHAR(40) NULL,                                           -- church / dream / vision / DM / sermon / prayer-line / other
  data          JSON       NOT NULL,
  updated_at    TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_status (user_id, status),
  INDEX idx_user_date (user_id, date_received DESC)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS fasts (
  id          CHAR(26)   PRIMARY KEY,
  user_id     CHAR(26)   NOT NULL,
  started_at  CHAR(25)   NULL,
  ended_at    CHAR(25)   NULL,
  data        JSON       NOT NULL,
  updated_at  TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_started (user_id, started_at DESC)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS plans (
  id         CHAR(26)   PRIMARY KEY,
  user_id    CHAR(26)   NOT NULL,
  venture    VARCHAR(80) NULL,
  phase      VARCHAR(20) NULL,
  status     VARCHAR(20) NULL,
  data       JSON       NOT NULL,
  updated_at TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_venture (user_id, venture)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS projects (
  id           CHAR(26)   PRIMARY KEY,
  user_id      CHAR(26)   NOT NULL,
  parent_plan  CHAR(26)   NULL,
  phase        VARCHAR(20) NULL,
  status       VARCHAR(20) NULL,
  data         JSON       NOT NULL,
  updated_at   TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_phase (user_id, phase),
  INDEX idx_parent (parent_plan)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tasks (
  id            CHAR(26)   PRIMARY KEY,
  user_id       CHAR(26)   NOT NULL,
  priority      CHAR(2)    NULL,
  scheduled_for CHAR(10)   NULL,
  completed_at  CHAR(25)   NULL,
  data          JSON       NOT NULL,
  updated_at    TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_sched (user_id, scheduled_for),
  INDEX idx_user_done  (user_id, completed_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS events (
  id           CHAR(26)   PRIMARY KEY,
  user_id      CHAR(26)   NOT NULL,
  start_at     CHAR(25)   NULL,
  end_at       CHAR(25)   NULL,
  completed_at CHAR(25)   NULL,
  data         JSON       NOT NULL,
  updated_at   TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_start (user_id, start_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS meals (
  id           CHAR(26)   PRIMARY KEY,
  user_id      CHAR(26)   NOT NULL,
  date         CHAR(10)   NULL,
  slot         VARCHAR(20) NULL,
  completed_at CHAR(25)   NULL,
  data         JSON       NOT NULL,
  updated_at   TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_date (user_id, date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transactions (
  id           CHAR(26)   PRIMARY KEY,
  user_id      CHAR(26)   NOT NULL,
  date         CHAR(10)   NULL,
  direction    ENUM('in', 'out') NULL,
  amount_ghs   DECIMAL(14, 2) NULL,
  category     VARCHAR(80) NULL,
  venture      VARCHAR(80) NULL,
  tithe        TINYINT(1) NULL DEFAULT 0,
  data         JSON       NOT NULL,
  updated_at   TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_date    (user_id, date),
  INDEX idx_user_venture (user_id, venture),
  INDEX idx_user_tithe   (user_id, tithe)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS budgets (
  id         CHAR(26)   PRIMARY KEY,
  user_id    CHAR(26)   NOT NULL,
  period     CHAR(7)    NULL,
  category   VARCHAR(80) NULL,
  limit_ghs  DECIMAL(14, 2) NULL,
  data       JSON       NOT NULL,
  updated_at TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_period (user_id, period)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS blogs (
  id         CHAR(26)   PRIMARY KEY,
  user_id    CHAR(26)   NOT NULL,
  status     VARCHAR(20) NULL,
  data       JSON       NOT NULL,
  updated_at TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_status (user_id, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS testimonies (
  id         CHAR(26)   PRIMARY KEY,
  user_id    CHAR(26)   NOT NULL,
  date       CHAR(10)   NULL,
  status     VARCHAR(20) NULL,
  data       JSON       NOT NULL,
  updated_at TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_date (user_id, date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS music (
  id         CHAR(26)   PRIMARY KEY,
  user_id    CHAR(26)   NOT NULL,
  date       CHAR(10)   NULL,
  data       JSON       NOT NULL,
  updated_at TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_date (user_id, date DESC)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS people (
  id              CHAR(26)   PRIMARY KEY,
  user_id         CHAR(26)   NOT NULL,
  name            VARCHAR(120) NULL,
  last_touched_at CHAR(10)   NULL,
  data            JSON       NOT NULL,
  updated_at      TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_name (user_id, name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS books (
  id          CHAR(26)   PRIMARY KEY,
  user_id     CHAR(26)   NOT NULL,
  status      VARCHAR(20) NULL,
  title       VARCHAR(200) NULL,
  data        JSON       NOT NULL,
  updated_at  TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_status (user_id, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS quizzes (
  id            CHAR(26)   PRIMARY KEY,
  user_id       CHAR(26)   NOT NULL,
  source_store  VARCHAR(40) NULL,
  status        VARCHAR(20) NULL,
  next_due_at   CHAR(25)   NULL,
  data          JSON       NOT NULL,
  updated_at    TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_due (user_id, next_due_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS goals (
  id         CHAR(26)   PRIMARY KEY,
  user_id    CHAR(26)   NOT NULL,
  period     VARCHAR(20) NULL,
  status     VARCHAR(20) NULL,
  domain     VARCHAR(40) NULL,
  data       JSON       NOT NULL,
  updated_at TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_period (user_id, period, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS kpi_targets (
  id         CHAR(26)   PRIMARY KEY,
  user_id    CHAR(26)   NOT NULL,
  metric     VARCHAR(80) NULL,
  domain     VARCHAR(40) NULL,
  period     VARCHAR(20) NULL,
  target_val DECIMAL(14, 2) NULL,
  data       JSON       NOT NULL,
  updated_at TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_metric (user_id, metric)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS feedback (
  id         CHAR(26)   PRIMARY KEY,
  user_id    CHAR(26)   NULL,
  kind       VARCHAR(20) NULL,
  status     VARCHAR(20) NULL DEFAULT 'new',
  message    TEXT       NOT NULL,
  data       JSON       NULL,
  created_at TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_kind_created (kind, created_at DESC)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS focus_sessions (
  id         CHAR(26)   PRIMARY KEY,
  user_id    CHAR(26)   NOT NULL,
  task_id    CHAR(26)   NULL,
  status     VARCHAR(20) NULL,
  mode       VARCHAR(20) NULL,
  started_at CHAR(25)   NULL,
  data       JSON       NOT NULL,
  updated_at TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_started (user_id, started_at DESC)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS meta (
  user_id     CHAR(26)     NOT NULL,
  meta_key    VARCHAR(120) NOT NULL,
  data        JSON         NOT NULL,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, meta_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ═══════════════════════════════════════════════════════════
-- HOUSEKEEPING
-- ═══════════════════════════════════════════════════════════

-- Clear expired sessions (run on a cron or call from app)
-- DELETE FROM sessions WHERE expires_at < NOW();
