"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { promisify } = require("node:util");
const { DatabaseSync } = require("node:sqlite");
const express = require("express");

const envFile = path.join(__dirname, ".env");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const scrypt = promisify(crypto.scrypt);
const databasePath = path.resolve(__dirname, process.env.DB_PATH || "hospital_portal.sqlite");
const database = new DatabaseSync(databasePath);
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const rateLimits = new Map();
const dummySalt = crypto.randomBytes(16);
let dummyHash;

const modules = {
  patients: [["name", "text"], ["age", "integer"], ["gender", "text"], ["phone", "text"], ["address", "text"]],
  doctors: [["name", "text"], ["specialization", "text"], ["phone", "text"]],
  appointments: [["patientId", "integer"], ["doctorId", "integer"], ["date", "date"], ["time", "time"], ["status", "enum", ["Scheduled", "Completed", "Cancelled"]], ["amount", "decimal"], ["paymentStatus", "enum", ["Unpaid", "Partially paid", "Paid"]], ["paymentMethod", "enum", ["Not selected", "Cash", "UPI", "Card", "Insurance"]]],
  beds: [["ward", "text"], ["bedNumber", "text"], ["status", "enum", ["Available", "Occupied"]]],
  bills: [["patientId", "integer"], ["amount", "decimal"], ["description", "text"], ["status", "enum", ["Pending", "Paid"]], ["paymentMethod", "enum", ["Not selected", "Cash", "UPI", "Card", "Insurance"]]],
  medicines: [["name", "text"], ["category", "text"], ["quantity", "integer"], ["unitPrice", "decimal"]],
  records: [["patientId", "integer"], ["doctorId", "integer"], ["diagnosis", "text"], ["prescription", "text"], ["date", "date"]],
  staff: [["name", "text"], ["role", "text"], ["department", "text"], ["phone", "text"]]
};

database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash BLOB NOT NULL,
    salt BLOB NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
    status TEXT NOT NULL CHECK(status IN ('active', 'pending')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module TEXT NOT NULL,
    data TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS records_module_idx ON records(module);
  CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
`);

if (!database.prepare("PRAGMA table_info(users)").all().some(column => column.name === "full_name")) {
  database.exec("ALTER TABLE users ADD COLUMN full_name TEXT NOT NULL DEFAULT ''");
}
database.prepare("UPDATE users SET full_name = username WHERE full_name = ''").run();
database.prepare("UPDATE users SET status = 'active' WHERE status = 'pending'").run();

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
}

function sendJson(res, status, value, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(JSON.stringify(value));
}

function fail(res, status, message) {
  sendJson(res, status, { error: message });
}

function parseCookies(header = "") {
  const cookies = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    try {
      cookies[name] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      continue;
    }
  }
  return cookies;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 64 * 1024) {
        reject(Object.assign(new Error("Request too large"), { status: 413 }));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(Object.assign(new Error("Invalid JSON body"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function checkRateLimit(req, res, scope) {
  const key = `${scope}:${req.socket.remoteAddress || "unknown"}`;
  const now = Date.now();
  const attempts = (rateLimits.get(key) || []).filter(time => now - time < RATE_WINDOW_MS);
  if (attempts.length >= 8) {
    sendJson(res, 429, { error: "Too many attempts. Please wait 15 minutes and try again." }, { "Retry-After": "900" });
    return false;
  }
  attempts.push(now);
  rateLimits.set(key, attempts);
  return true;
}

function validateCredentials(body, requireFullName = false) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Invalid request." };
  }
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
    return { error: "Username must be 3–32 characters: letters, numbers, dot, underscore or hyphen." };
  }
  if (password.length < 12 || password.length > 128) {
    return { error: "Password must be 12–128 characters." };
  }
  if (requireFullName && (!fullName || fullName.length > 80 || /[\u0000-\u001f\u007f]/.test(fullName))) {
    return { error: "Enter a name of up to 80 characters." };
  }
  return { username, password, fullName };
}

function createSession(user, res) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiry = Date.now() + SESSION_TTL_MS;
  database.prepare("INSERT INTO sessions(token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .run(hashToken(token), user.id, expiry);
  const secure = process.env.COOKIE_SECURE === "true" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `sid=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure}`);
  return expiry;
}

function clearSessionCookie(res) {
  const secure = process.env.COOKIE_SECURE === "true" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `sid=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    fullName: user.full_name || user.fullName || user.username,
    role: user.role
  };
}

function currentUser(req) {
  const token = parseCookies(req.headers.cookie).sid;
  if (!token || token.length > 100) return null;
  const tokenHash = hashToken(token);
  const session = database.prepare(`
    SELECT users.id, users.username, users.full_name, users.role
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `).get(tokenHash, Date.now());
  if (!session) return null;
  return session;
}

function requireSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function canManage(user, module) {
  return user.role === "admin" || (user.role === "user" && ["patients", "appointments"].includes(module));
}

function sanitizeRecord(module, input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "Invalid record." };
  }
  const output = {};
  for (const [field, type, options] of modules[module]) {
    const value = input[field];
    if (type === "text" || type === "date" || type === "time") {
      if (typeof value !== "string" || !value.trim() || value.length > 500) {
        return { error: `${field} is required and must be 500 characters or fewer.` };
      }
      output[field] = value.trim();
    } else if (type === "integer") {
      const number = Number(value);
      if (!Number.isSafeInteger(number) || number < 0 || (["patientId", "doctorId"].includes(field) && number < 1)) {
        return { error: `${field} must be a valid whole number.` };
      }
      output[field] = number;
    } else if (type === "decimal") {
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0 || number > 1000000000) {
        return { error: `${field} must be a valid non-negative amount.` };
      }
      output[field] = number;
    } else if (type === "enum") {
      if (!options.includes(value)) return { error: `Invalid ${field}.` };
      output[field] = value;
    }
  }
  return { value: output };
}

function referencesExist(module, record) {
  const exists = (kind, id) => Boolean(database.prepare("SELECT 1 FROM records WHERE module = ? AND id = ?").get(kind, id));
  if (["appointments", "records"].includes(module) && (!exists("patients", record.patientId) || !exists("doctors", record.doctorId))) {
    return "Select an existing patient and doctor.";
  }
  if (module === "bills" && !exists("patients", record.patientId)) return "Select an existing patient.";
  return null;
}

function toRecord(row) {
  return { ...JSON.parse(row.data), id: row.id };
}

async function handle(req, res) {
  setSecurityHeaders(res);
  const route = req.path;
  const method = req.method;

  if (method === "GET" && route === "/healthz") {
    return sendJson(res, 200, { status: "ok" });
  }
  if (method === "GET" && route === "/api/health") {
    return sendJson(res, 200, { status: "ok" });
  }

  if (process.env.NODE_ENV === "production" && req.headers["x-forwarded-proto"] !== "https") {
    return fail(res, 400, "HTTPS is required.");
  }

  if (method === "GET" && route === "/api/setup/status") {
    const count = database.prepare("SELECT COUNT(*) AS count FROM users").get().count;
    return sendJson(res, 200, { setupRequired: count === 0 });
  }

  if (method === "POST" && ["/api/signup", "/api/login"].includes(route)) {
    if (!checkRateLimit(req, res, route)) return;
    if (!requireSameOrigin(req)) return fail(res, 403, "Request origin was not accepted.");
    if (!String(req.headers["content-type"] || "").startsWith("application/json")) {
      return fail(res, 415, "JSON content type is required.");
    }
    const body = await readBody(req);
    const credentials = validateCredentials(body, route !== "/api/login");
    if (credentials.error) return fail(res, 400, credentials.error);
    const { username, password, fullName } = credentials;

    if (route === "/api/signup") {
      if (database.prepare("SELECT COUNT(*) AS count FROM users").get().count === 0) {
        return fail(res, 409, "Administrator setup must be completed first.");
      }
      const salt = crypto.randomBytes(16);
      const passwordHash = await scrypt(password, salt, 64);
      try {
        database.prepare("INSERT INTO users(username, password_hash, salt, role, status, full_name) VALUES (?, ?, ?, 'user', 'active', ?)")
          .run(username, passwordHash, salt, fullName);
      } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return fail(res, 409, "That username is already in use.");
        throw error;
      }
      return sendJson(res, 201, { message: "Account created. You can now sign in." });
    }

    const user = database.prepare("SELECT id, username, full_name, role, status, password_hash, salt FROM users WHERE username = ?").get(username);
    const expectedHash = user ? Buffer.from(user.password_hash) : dummyHash;
    const salt = user ? Buffer.from(user.salt) : dummySalt;
    const candidateHash = await scrypt(password, salt, expectedHash.length);
    const passwordMatches = crypto.timingSafeEqual(candidateHash, expectedHash);
    if (!user || !passwordMatches) {
      return fail(res, 401, "Username or password is incorrect.");
    }
    createSession(user, res);
    return sendJson(res, 200, { user: publicUser(user) });
  }

  if (method === "POST" && route === "/api/logout") {
    if (!requireSameOrigin(req)) return fail(res, 403, "Request origin was not accepted.");
    const token = parseCookies(req.headers.cookie).sid;
    if (token) database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
    clearSessionCookie(res);
    return sendJson(res, 200, { ok: true });
  }

  const user = currentUser(req);
  if (route.startsWith("/api/") && !user) return fail(res, 401, "Please sign in.");
  if (method === "GET" && route === "/api/me") return sendJson(res, 200, { user: publicUser(user) });

  if (method === "PUT" && route === "/api/profile") {
    if (!requireSameOrigin(req)) return fail(res, 403, "Request origin was not accepted.");
    if (!String(req.headers["content-type"] || "").startsWith("application/json")) {
      return fail(res, 415, "JSON content type is required.");
    }
    const body = await readBody(req);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return fail(res, 400, "Invalid profile.");
    }
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    if (!fullName || fullName.length > 80 || /[\u0000-\u001f\u007f]/.test(fullName)) {
      return fail(res, 400, "Enter a name of up to 80 characters.");
    }
    database.prepare("UPDATE users SET full_name = ? WHERE id = ?").run(fullName, user.id);
    return sendJson(res, 200, { user: publicUser({ ...user, full_name: fullName }) });
  }

  if (route === "/api/admin/users") {
    if (user.role !== "admin") return fail(res, 403, "Administrator access is required.");
    if (method === "GET") {
      const users = database.prepare("SELECT id, username, full_name AS fullName, role, created_at AS createdAt FROM users ORDER BY id").all();
      return sendJson(res, 200, { users });
    }
  }

  const recordRoute = route.match(/^\/api\/([a-z]+)(?:\/(\d+))?$/);
  if (recordRoute && Object.hasOwn(modules, recordRoute[1])) {
    const module = recordRoute[1];
    const id = recordRoute[2] ? Number(recordRoute[2]) : null;
    if (method === "GET" && id === null) {
      const rows = database.prepare("SELECT id, data FROM records WHERE module = ? ORDER BY id DESC").all(module);
      return sendJson(res, 200, { records: rows.map(toRecord) });
    }
    if (["POST", "PUT", "DELETE"].includes(method)) {
      if (!requireSameOrigin(req)) return fail(res, 403, "Request origin was not accepted.");
      if (!canManage(user, module)) return fail(res, 403, "Your account cannot change this section.");
      if (method === "DELETE") {
        if (id === null) return fail(res, 404, "Record not found.");
        const result = database.prepare("DELETE FROM records WHERE module = ? AND id = ?").run(module, id);
        return result.changes ? sendJson(res, 200, { ok: true }) : fail(res, 404, "Record not found.");
      }
      if (!String(req.headers["content-type"] || "").startsWith("application/json")) {
        return fail(res, 415, "JSON content type is required.");
      }
      const body = await readBody(req);
      const clean = sanitizeRecord(module, body);
      if (clean.error) return fail(res, 400, clean.error);
      const invalidReference = referencesExist(module, clean.value);
      if (invalidReference) return fail(res, 400, invalidReference);
      if (method === "POST" && id === null) {
        const result = database.prepare("INSERT INTO records(module, data) VALUES (?, ?)").run(module, JSON.stringify(clean.value));
        return sendJson(res, 201, { record: { ...clean.value, id: Number(result.lastInsertRowid) } });
      }
      if (method === "PUT" && id !== null) {
        const result = database.prepare("UPDATE records SET data = ? WHERE module = ? AND id = ?")
          .run(JSON.stringify(clean.value), module, id);
        return result.changes
          ? sendJson(res, 200, { record: { ...clean.value, id } })
          : fail(res, 404, "Record not found.");
      }
    }
  }

  if (route.startsWith("/api/")) return fail(res, 404, "API route not found.");
  if (method !== "GET") return fail(res, 405, "Method not allowed.");
  return fail(res, 404, "Page not found.");
}

function seedDemoRecord(module, record) {
  const existing = database.prepare("SELECT 1 FROM records WHERE module = ? LIMIT 1").get(module);
  if (existing) return;
  database.prepare("INSERT INTO records(module, data) VALUES (?, ?)").run(module, JSON.stringify(record));
}

function seedDemoRecords(module, records) {
  const existing = database.prepare("SELECT 1 FROM records WHERE module = ? LIMIT 1").get(module);
  if (existing) return;
  const insert = database.prepare("INSERT INTO records(module, data) VALUES (?, ?)");
  for (const record of records) insert.run(module, JSON.stringify(record));
}

async function seedEmptyDatabase() {
  const adminFullName = String(process.env.ADMIN_FULL_NAME || "").trim();
  const adminUsername = String(process.env.ADMIN_USERNAME || "").trim();
  const adminPassword = String(process.env.ADMIN_PASSWORD || "");
  const configured = Boolean(adminFullName || adminUsername || adminPassword.trim());
  const userCount = database.prepare("SELECT COUNT(*) AS count FROM users").get().count;

  if (configured && (!adminFullName || !adminUsername || !adminPassword)) {
    throw new Error("Set all of ADMIN_FULL_NAME, ADMIN_USERNAME, and ADMIN_PASSWORD, or leave all three empty.");
  }

  if (configured) {
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(adminUsername) ||
        adminFullName.length > 80 ||
        adminPassword.length < 12 || adminPassword.length > 128) {
      throw new Error("Set valid ADMIN_FULL_NAME, ADMIN_USERNAME, and ADMIN_PASSWORD values.");
    }

    const usernameMatch = database.prepare("SELECT id, username, role, status, full_name, password_hash, salt FROM users WHERE username = ?").get(adminUsername);
    if (usernameMatch && usernameMatch.role !== "admin") {
      throw new Error("ADMIN_USERNAME already belongs to a non-administrator account.");
    }
    const admin = usernameMatch || database.prepare("SELECT id, username, role, status, full_name, password_hash, salt FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").get();
    if (admin) {
      const currentHash = Buffer.from(admin.password_hash);
      const candidateHash = await scrypt(adminPassword, Buffer.from(admin.salt), currentHash.length);
      const passwordMatches = crypto.timingSafeEqual(candidateHash, currentHash);
      const unchanged = admin.username.toLowerCase() === adminUsername.toLowerCase() &&
        admin.full_name === adminFullName && admin.status === "active" && passwordMatches;
      if (!unchanged) {
        const salt = crypto.randomBytes(16);
        const passwordHash = await scrypt(adminPassword, salt, 64);
        database.prepare("UPDATE users SET username = ?, password_hash = ?, salt = ?, status = 'active', full_name = ? WHERE id = ?")
          .run(adminUsername, passwordHash, salt, adminFullName, admin.id);
        database.prepare("DELETE FROM sessions WHERE user_id = ?").run(admin.id);
        console.log(`Administrator '${adminUsername}' synchronized from environment variables.`);
      }
    } else {
      const salt = crypto.randomBytes(16);
      const passwordHash = await scrypt(adminPassword, salt, 64);
      database.prepare("INSERT INTO users(username, password_hash, salt, role, status, full_name) VALUES (?, ?, ?, 'admin', 'active', ?)")
        .run(adminUsername, passwordHash, salt, adminFullName);
      console.log(`Administrator '${adminUsername}' created from environment variables.`);
    }
  } else if (userCount === 0) {
    const demoPassword = crypto.randomBytes(18).toString("base64url");
    const salt = crypto.randomBytes(16);
    const passwordHash = await scrypt(demoPassword, salt, 64);
    database.prepare("INSERT INTO users(username, password_hash, salt, role, status, full_name) VALUES (?, ?, ?, 'admin', 'active', ?)")
      .run("demo_admin", passwordHash, salt, "Demo Administrator");
    console.warn(`Generated demo administrator credentials. Username: demo_admin; Password: ${demoPassword}`);
  }

  seedDemoRecord("patients", {
    name: "Demo Patient",
    age: 35,
    gender: "Other",
    phone: "000-000-0000",
    address: "Demo Address"
  });
  seedDemoRecord("doctors", {
    name: "Demo Doctor",
    specialization: "General Medicine",
    phone: "000-000-0000"
  });
  seedDemoRecords("medicines", [
    { name: "Paracetamol tablets", category: "Demo OTC", quantity: 50, unitPrice: 2.5 },
    { name: "Cetirizine tablets", category: "Demo OTC", quantity: 25, unitPrice: 3 },
    { name: "ORS sachets", category: "Demo hydration", quantity: 30, unitPrice: 18 },
    { name: "Antiseptic solution", category: "Demo first aid", quantity: 8, unitPrice: 55 }
  ]);
}

async function start() {
  dummyHash = await scrypt(crypto.randomBytes(32), dummySalt, 64);
  await seedEmptyDatabase();
  if (process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "true") {
    throw new Error("COOKIE_SECURE=true is required in production. Serve the app behind HTTPS.");
  }
  database.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());

  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    setSecurityHeaders(res);
    next();
  });
  app.use(express.static(path.join(__dirname, "client"), {
    dotfiles: "deny",
    index: "index.html"
  }));
  app.use((req, res) => {
    handle(req, res).catch(error => {
      console.error("Request failed:", error);
      if (!res.headersSent) fail(res, error.status || 500, error.status ? error.message : "The request could not be completed.");
      else res.destroy();
    });
  });

  app.listen(PORT, HOST, () => {
    console.log(`AA.MITS HOSPITAL portal listening at http://${HOST}:${PORT}`);
  });
}

start().catch(error => {
  console.error("Server startup failed:", error.message);
  process.exitCode = 1;
});
