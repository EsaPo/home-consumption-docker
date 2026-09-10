// db/users.js
const db = require('./dbconfig');

// Create users table on startup
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME,
  failed_attempts INTEGER DEFAULT 0,
  locked_until DATETIME,
  reset_token TEXT,
  reset_token_expires DATETIME,
  is_admin INTEGER DEFAULT 0
)`, (err) => {
  if (err) {
    console.error('Error creating users table:', err.message);
  } else {
    console.log('Users table ready.');
  }
});

module.exports = db;
