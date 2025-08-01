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

// Create states table
db.prepare(`CREATE TABLE IF NOT EXISTS states (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL
)`).run();

// Populate states table
const states = [
    { code: 'AL', name: 'Alabama' },
    { code: 'AK', name: 'Alaska' },
    { code: 'AZ', name: 'Arizona' },
    { code: 'AR', name: 'Arkansas' },
    { code: 'CA', name: 'California' },
    { code: 'CO', name: 'Colorado' },
    { code: 'CT', name: 'Connecticut' },
    { code: 'DE', name: 'Delaware' },
    { code: 'FL', name: 'Florida' },
    { code: 'GA', name: 'Georgia' },
    { code: 'HI', name: 'Hawaii' },
    { code: 'ID', name: 'Idaho' },
    { code: 'IL', name: 'Illinois' },
    { code: 'IN', name: 'Indiana' },
    { code: 'IA', name: 'Iowa' },
    { code: 'KS', name: 'Kansas' },
    { code: 'KY', name: 'Kentucky' },
    { code: 'LA', name: 'Louisiana' },
    { code: 'ME', name: 'Maine' },
    { code: 'MD', name: 'Maryland' },
    { code: 'MA', name: 'Massachusetts' },
    { code: 'MI', name: 'Michigan' },
    { code: 'MN', name: 'Minnesota' },
    { code: 'MS', name: 'Mississippi' },
    { code: 'MO', name: 'Missouri' },
    { code: 'MT', name: 'Montana' },
    { code: 'NE', name: 'Nebraska' },
    { code: 'NV', name: 'Nevada' },
    { code: 'NH', name: 'New Hampshire' },
    { code: 'NJ', name: 'New Jersey' },
    { code: 'NM', name: 'New Mexico' },
    { code: 'NY', name: 'New York' },
    { code: 'NC', name: 'North Carolina' },
    { code: 'ND', name: 'North Dakota' },
    { code: 'OH', name: 'Ohio' },
    { code: 'OK', name: 'Oklahoma' },
    { code: 'OR', name: 'Oregon' },
    { code: 'PA', name: 'Pennsylvania' },
    { code: 'RI', name: 'Rhode Island' },
    { code: 'SC', name: 'South Carolina' },
    { code: 'SD', name: 'South Dakota' },
    { code: 'TN', name: 'Tennessee' },
    { code: 'TX', name: 'Texas' },
    { code: 'UT', name: 'Utah' },
    { code: 'VT', name: 'Vermont' },
    { code: 'VA', name: 'Virginia' },
    { code: 'WA', name: 'Washington' },
    { code: 'WV', name: 'West Virginia' },
    { code: 'WI', name: 'Wisconsin' },
    { code: 'WY', name: 'Wyoming' }
];

// Insert states if not already present
const insertState = db.prepare(`
    INSERT OR IGNORE INTO states (code, name) VALUES (?, ?)
`);

for (const state of states) {
    insertState.run(state.code, state.name);
}

db.prepare(`CREATE TABLE IF NOT EXISTS email_verification_codes (
    code TEXT PRIMARY KEY,
    email TEXT NOT NULL
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
)`).run();

// Create admin user if it doesn't exist
const databaseHasAdmin = db.prepare(`SELECT COUNT(*) FROM users WHERE is_admin = 1`).get().count > 0;
if (!databaseHasAdmin) {
    const bcrypt = require('bcrypt');
    const adminPassword = bcrypt.hashSync('adminpassword', 10);
    db.prepare(`
        INSERT OR IGNORE INTO users (id, email, password_hash, is_email_verified, is_admin)
        VALUES ('admin-id', 'admin@example.com', ?, 1, 1)
    `).run(adminPassword);
}

module.exports = db;

process.on('exit', () => {
    db.close();
});
process.on('SIGINT', () => {
    db.close();
    process.exit(0);
});
