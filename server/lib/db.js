'use strict';
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const config = require('./config');

function open(file = config.dbFile) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('patient','clinician','admin')),
    research_consent INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS clinician_profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    profession TEXT NOT NULL,            -- psychiatrist | clinical_psychologist | psychotherapist | gp | counselor
    bio TEXT NOT NULL DEFAULT '',
    focus TEXT NOT NULL DEFAULT '[]',    -- JSON array of focus areas (anxiety, depression, trauma, ...)
    languages TEXT NOT NULL DEFAULT '["English"]',
    license_no TEXT NOT NULL DEFAULT '',
    timezone TEXT NOT NULL DEFAULT 'Europe/Helsinki',
    session_minutes INTEGER NOT NULL DEFAULT 50,
    price_eur INTEGER,
    verified INTEGER NOT NULL DEFAULT 0,
    accepting INTEGER NOT NULL DEFAULT 1,
    is_demo INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS availability (
    id INTEGER PRIMARY KEY,
    clinician_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0 = Sunday
    start_time TEXT NOT NULL,            -- HH:MM in clinician timezone
    end_time TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    clinician_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_utc TEXT NOT NULL,
    end_utc TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled','completed')),
    reason TEXT NOT NULL DEFAULT '',
    shared_summary TEXT,                 -- only filled if the patient consented to share
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE UNIQUE INDEX IF NOT EXISTS ux_active_slot ON appointments(clinician_id, start_utc) WHERE status != 'cancelled';
  CREATE TABLE IF NOT EXISTS screenings (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    category TEXT,
    severity TEXT NOT NULL,
    matches TEXT NOT NULL DEFAULT '[]',
    source TEXT NOT NULL,                -- 'gemini+rules' | 'rules'
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user','bot')),
    text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY,
    clinician_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (clinician_id, patient_id)
  );
  CREATE TABLE IF NOT EXISTS email_outbox (
    id INTEGER PRIMARY KEY,
    to_addr TEXT NOT NULL,
    intended_to TEXT,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL,                -- 'logged' | 'sent' | 'failed'
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  `);
  return db;
}

// node:sqlite has no built-in transaction helper.
function tx(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

module.exports = { open, tx };
