const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'journal.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    telegramId  TEXT    NOT NULL UNIQUE,
    name        TEXT    NOT NULL DEFAULT '',
    role        TEXT    NOT NULL DEFAULT 'client' CHECK(role IN ('client','therapist')),
    createdAt   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS journal_entries (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    userId             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text               TEXT    NOT NULL DEFAULT '',
    entryDate          TEXT    NOT NULL,
    createdAt          TEXT    NOT NULL DEFAULT (datetime('now')),
    updatedAt          TEXT    NOT NULL DEFAULT (datetime('now')),
    therapistComments  TEXT    DEFAULT NULL,
    isHighlighted      INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS day_ratings (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    userId           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date             TEXT    NOT NULL,
    clientRating     INTEGER DEFAULT NULL CHECK(clientRating BETWEEN 1 AND 5),
    therapistRating  INTEGER DEFAULT NULL CHECK(therapistRating BETWEEN 1 AND 5),
    UNIQUE(userId, date)
  );

  CREATE TABLE IF NOT EXISTS relationships (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    clientId     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    therapistId  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    connectedAt  TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(clientId, therapistId)
  );

  CREATE TABLE IF NOT EXISTS invite_tokens (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    token       TEXT    NOT NULL UNIQUE,
    inviterId   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    inviteType  TEXT    NOT NULL CHECK(inviteType IN ('invite_therapist','invite_client')),
    expiresAt   TEXT    NOT NULL,
    usedAt      TEXT    DEFAULT NULL
  );

  CREATE TABLE IF NOT EXISTS notification_settings (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    userId           INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    enabled          INTEGER NOT NULL DEFAULT 1,
    reminderTime     TEXT    NOT NULL DEFAULT '20:00',
    therapistMode    TEXT    NOT NULL DEFAULT 'per_client' CHECK(therapistMode IN ('per_client','batch_digest')),
    batchTime        TEXT    NOT NULL DEFAULT '18:00'
  );

  CREATE INDEX IF NOT EXISTS idx_entries_userId_date ON journal_entries(userId, entryDate);
  CREATE INDEX IF NOT EXISTS idx_ratings_userId_date ON day_ratings(userId, date);
  CREATE INDEX IF NOT EXISTS idx_relationships_client ON relationships(clientId);
  CREATE INDEX IF NOT EXISTS idx_relationships_therapist ON relationships(therapistId);
`);

// ── Helper: upsert user from Telegram data ────────────────────────────────────

function upsertUser(telegramId, name) {
  const existing = db.prepare('SELECT * FROM users WHERE telegramId = ?').get(String(telegramId));
  if (existing) {
    if (existing.name !== name && name) {
      db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, existing.id);
      existing.name = name;
    }
    return existing;
  }
  const result = db.prepare(
    'INSERT INTO users (telegramId, name) VALUES (?, ?)'
  ).run(String(telegramId), name || '');
  return db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
}

// ── Helper: ensure notification settings exist ────────────────────────────────

function ensureNotificationSettings(userId) {
  const existing = db.prepare('SELECT * FROM notification_settings WHERE userId = ?').get(userId);
  if (!existing) {
    db.prepare('INSERT OR IGNORE INTO notification_settings (userId) VALUES (?)').run(userId);
    return db.prepare('SELECT * FROM notification_settings WHERE userId = ?').get(userId);
  }
  return existing;
}

module.exports = { db, upsertUser, ensureNotificationSettings };
