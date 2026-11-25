"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { promisify } = require("node:util");
const { DatabaseSync } = require("node:sqlite");

const envFile = path.join(__dirname, ".env");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const scrypt = promisify(crypto.scrypt);
const databasePath = path.resolve(process.env.PORTAL_DB_PATH || path.join(__dirname, "hospital_portal.sqlite"));
const fullName = String(process.env.ADMIN_FULL_NAME || "").trim();
const username = String(process.env.ADMIN_USERNAME || "").trim();
const password = String(process.env.ADMIN_PASSWORD || "");

if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
  throw new Error("ADMIN_USERNAME must be 3-32 characters: letters, numbers, dot, underscore or hyphen.");
}
if (!fullName || fullName.length > 80) {
  throw new Error("ADMIN_FULL_NAME is required and must be 80 characters or fewer.");
}
if (password.length < 12 || password.length > 128) {
  throw new Error("ADMIN_PASSWORD must be 12-128 characters.");
}

async function seedAdmin() {
  const database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_hash BLOB NOT NULL,
      salt BLOB NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
      status TEXT NOT NULL CHECK(status IN ('active', 'pending')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      full_name TEXT NOT NULL DEFAULT ''
    );
  `);

  const existing = database.prepare("SELECT id, role, status FROM users WHERE username = ?").get(username);
  if (existing) {
    if (existing.role !== "admin") {
      throw new Error("ADMIN_USERNAME already belongs to a non-administrator account.");
    }
    database.prepare("UPDATE users SET status = 'active', full_name = ? WHERE id = ?").run(fullName, existing.id);
    console.log(`Existing administrator '${username}' is active.`);
    return;
  }

  if (database.prepare("SELECT COUNT(*) AS count FROM users").get().count !== 0) {
    throw new Error("An administrator can only be seeded when the users table is empty.");
  }

  const salt = crypto.randomBytes(16);
  const passwordHash = await scrypt(password, salt, 64);
  database.prepare("INSERT INTO users(username, password_hash, salt, role, status, full_name) VALUES (?, ?, ?, 'admin', 'active', ?)")
    .run(username, passwordHash, salt, fullName);
  console.log(`Administrator '${username}' created successfully.`);
}

seedAdmin().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
