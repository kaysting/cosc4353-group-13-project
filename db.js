const sqlite3 = require('better-sqlite3');

const db = sqlite3('data.db');

db.prepare(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_email_verified INTEGER DEFAULT 0,
    is_admin INTEGER DEFAULT 0
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS user_profiles (
    user_id TEXT PRIMARY KEY,
    full_name TEXT,
    address_1 TEXT,
    address_2 TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    preferences TEXT,
    availability_start TEXT,
    availability_end TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS user_skills (
    user_id TEXT,
    skill TEXT,
    PRIMARY KEY(user_id, skill),
    FOREIGN KEY(user_id) REFERENCES users(id)
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    location TEXT,
    urgency TEXT,
    date TEXT,
    created_by TEXT,
    FOREIGN KEY(created_by) REFERENCES users(id)
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS event_skills (
    event_id TEXT,
    skill TEXT,
    PRIMARY KEY(event_id, skill),
    FOREIGN KEY(event_id) REFERENCES events(id)
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    header TEXT,
    description TEXT,
    time INTEGER,
    is_unread INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS volunteer_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    event_id TEXT,
    status TEXT,
    assigned_at TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(event_id) REFERENCES events(id)
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS event_assignments (
    event_id TEXT,
    user_id TEXT,
    PRIMARY KEY(event_id, user_id),
    FOREIGN KEY(event_id) REFERENCES events(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS email_verification_codes (
    code TEXT PRIMARY KEY,
    email TEXT NOT NULL
)`).run();

const bcrypt = require('bcrypt');
const adminPassword = bcrypt.hashSync('adminpassword', 10); // same password you use to log in

db.prepare(`
    INSERT OR IGNORE INTO users (id, email, password_hash, is_email_verified, is_admin)
    VALUES ('admin-id', 'admin@example.com', ?, 1, 1)
`).run(adminPassword);

module.exports = db;

process.on('exit', () => {
    db.close();
});
process.on('SIGINT', () => {
    db.close();
    process.exit(0); //added this so that the connection would close properly with ctrl+c, feel free to remove.
});