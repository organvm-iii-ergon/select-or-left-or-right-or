const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'social.db');
const db = new sqlite3.Database(dbPath);

console.log('Initializing database...');

db.serialize(() => {
  // Create users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      affiliation TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating users table:', err);
    } else {
      console.log('✓ Users table created');
    }
  });

  // Create posts table
  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) {
      console.error('Error creating posts table:', err);
    } else {
      console.log('✓ Posts table created');
    }
  });

  // Create index on affiliation for faster bubble queries
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_users_affiliation
    ON users(affiliation)
  `, (err) => {
    if (err) {
      console.error('Error creating affiliation index:', err);
    } else {
      console.log('✓ Affiliation index created');
    }
  });

  // Create index on posts by user_id
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_posts_user_id
    ON posts(user_id)
  `, (err) => {
    if (err) {
      console.error('Error creating posts user_id index:', err);
    } else {
      console.log('✓ Posts user_id index created');
    }
  });

  // Create index on posts by created_at for feed sorting
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_posts_created_at
    ON posts(created_at DESC)
  `, (err) => {
    if (err) {
      console.error('Error creating posts created_at index:', err);
    } else {
      console.log('✓ Posts created_at index created');
    }
  });
});

db.close((err) => {
  if (err) {
    console.error('Error closing database:', err);
  } else {
    console.log('\n✓ Database initialization complete!');
    console.log('Database location:', dbPath);
  }
});
