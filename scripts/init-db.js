const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'social.db');
const db = new sqlite3.Database(dbPath);

console.log('Initializing comprehensive database schema...');

db.serialize(() => {
  // ========== USERS TABLE (Enhanced) ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      affiliation TEXT NOT NULL,
      bio TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      is_admin BOOLEAN DEFAULT 0,
      is_verified BOOLEAN DEFAULT 0,
      email_verified BOOLEAN DEFAULT 0,
      verification_token TEXT,
      reset_token TEXT,
      reset_token_expires DATETIME,
      two_factor_secret TEXT,
      two_factor_enabled BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Error creating users table:', err);
    else console.log('✓ Users table created');
  });

  // ========== POSTS TABLE (Enhanced) ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT DEFAULT '',
      is_repost BOOLEAN DEFAULT 0,
      original_post_id INTEGER,
      edited BOOLEAN DEFAULT 0,
      edited_at DATETIME,
      deleted BOOLEAN DEFAULT 0,
      deleted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (original_post_id) REFERENCES posts (id) ON DELETE SET NULL
    )
  `, (err) => {
    if (err) console.error('Error creating posts table:', err);
    else console.log('✓ Posts table created');
  });

  // ========== COMMENTS TABLE ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      parent_comment_id INTEGER,
      content TEXT NOT NULL,
      edited BOOLEAN DEFAULT 0,
      edited_at DATETIME,
      deleted BOOLEAN DEFAULT 0,
      deleted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (parent_comment_id) REFERENCES comments (id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) console.error('Error creating comments table:', err);
    else console.log('✓ Comments table created');
  });

  // ========== LIKES TABLE ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      post_id INTEGER,
      comment_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
      FOREIGN KEY (comment_id) REFERENCES comments (id) ON DELETE CASCADE,
      UNIQUE(user_id, post_id),
      UNIQUE(user_id, comment_id)
    )
  `, (err) => {
    if (err) console.error('Error creating likes table:', err);
    else console.log('✓ Likes table created');
  });

  // ========== FOLLOWS TABLE ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS follows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      follower_id INTEGER NOT NULL,
      following_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (follower_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (following_id) REFERENCES users (id) ON DELETE CASCADE,
      UNIQUE(follower_id, following_id)
    )
  `, (err) => {
    if (err) console.error('Error creating follows table:', err);
    else console.log('✓ Follows table created');
  });

  // ========== BLOCKS TABLE ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      blocker_id INTEGER NOT NULL,
      blocked_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (blocker_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (blocked_id) REFERENCES users (id) ON DELETE CASCADE,
      UNIQUE(blocker_id, blocked_id)
    )
  `, (err) => {
    if (err) console.error('Error creating blocks table:', err);
    else console.log('✓ Blocks table created');
  });

  // ========== MUTES TABLE ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS mutes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      muter_id INTEGER NOT NULL,
      muted_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (muter_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (muted_id) REFERENCES users (id) ON DELETE CASCADE,
      UNIQUE(muter_id, muted_id)
    )
  `, (err) => {
    if (err) console.error('Error creating mutes table:', err);
    else console.log('✓ Mutes table created');
  });

  // ========== DIRECT MESSAGES TABLE ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS direct_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      recipient_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      read BOOLEAN DEFAULT 0,
      read_at DATETIME,
      deleted_by_sender BOOLEAN DEFAULT 0,
      deleted_by_recipient BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (recipient_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) console.error('Error creating direct_messages table:', err);
    else console.log('✓ Direct messages table created');
  });

  // ========== BOOKMARKS TABLE ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      post_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
      UNIQUE(user_id, post_id)
    )
  `, (err) => {
    if (err) console.error('Error creating bookmarks table:', err);
    else console.log('✓ Bookmarks table created');
  });

  // ========== HASHTAGS TABLE ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS hashtags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Error creating hashtags table:', err);
    else console.log('✓ Hashtags table created');
  });

  // ========== POST_HASHTAGS TABLE ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS post_hashtags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      hashtag_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
      FOREIGN KEY (hashtag_id) REFERENCES hashtags (id) ON DELETE CASCADE,
      UNIQUE(post_id, hashtag_id)
    )
  `, (err) => {
    if (err) console.error('Error creating post_hashtags table:', err);
    else console.log('✓ Post hashtags table created');
  });

  // ========== NOTIFICATIONS TABLE ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      actor_id INTEGER,
      post_id INTEGER,
      comment_id INTEGER,
      message TEXT,
      read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
      FOREIGN KEY (comment_id) REFERENCES comments (id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) console.error('Error creating notifications table:', err);
    else console.log('✓ Notifications table created');
  });

  // ========== REPORTS TABLE ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_id INTEGER NOT NULL,
      reported_user_id INTEGER,
      post_id INTEGER,
      comment_id INTEGER,
      reason TEXT NOT NULL,
      details TEXT,
      status TEXT DEFAULT 'pending',
      reviewed_by INTEGER,
      reviewed_at DATETIME,
      action_taken TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reporter_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (reported_user_id) REFERENCES users (id) ON DELETE SET NULL,
      FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE SET NULL,
      FOREIGN KEY (comment_id) REFERENCES comments (id) ON DELETE SET NULL,
      FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE SET NULL
    )
  `, (err) => {
    if (err) console.error('Error creating reports table:', err);
    else console.log('✓ Reports table created');
  });

  // ========== ACTIVITY LOG TABLE ==========
  db.run(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
    )
  `, (err) => {
    if (err) console.error('Error creating activity_log table:', err);
    else console.log('✓ Activity log table created');
  });

  // ========== INDEXES ==========
  const indexes = [
    { name: 'idx_users_affiliation', sql: 'CREATE INDEX IF NOT EXISTS idx_users_affiliation ON users(affiliation)' },
    { name: 'idx_users_email', sql: 'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)' },
    { name: 'idx_posts_user_id', sql: 'CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id)' },
    { name: 'idx_posts_created_at', sql: 'CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC)' },
    { name: 'idx_posts_deleted', sql: 'CREATE INDEX IF NOT EXISTS idx_posts_deleted ON posts(deleted)' },
    { name: 'idx_comments_post_id', sql: 'CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id)' },
    { name: 'idx_comments_user_id', sql: 'CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id)' },
    { name: 'idx_likes_post_id', sql: 'CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id)' },
    { name: 'idx_likes_user_id', sql: 'CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id)' },
    { name: 'idx_follows_follower', sql: 'CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id)' },
    { name: 'idx_follows_following', sql: 'CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id)' },
    { name: 'idx_dm_sender', sql: 'CREATE INDEX IF NOT EXISTS idx_dm_sender ON direct_messages(sender_id)' },
    { name: 'idx_dm_recipient', sql: 'CREATE INDEX IF NOT EXISTS idx_dm_recipient ON direct_messages(recipient_id)' },
    { name: 'idx_notifications_user', sql: 'CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read)' },
    { name: 'idx_hashtags_tag', sql: 'CREATE INDEX IF NOT EXISTS idx_hashtags_tag ON hashtags(tag)' },
    { name: 'idx_reports_status', sql: 'CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status)' },
    { name: 'idx_activity_user', sql: 'CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id)' },
    { name: 'idx_activity_created', sql: 'CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at DESC)' }
  ];

  indexes.forEach(index => {
    db.run(index.sql, (err) => {
      if (err) console.error(`Error creating ${index.name}:`, err);
      else console.log(`✓ ${index.name} created`);
    });
  });
});

db.close((err) => {
  if (err) {
    console.error('Error closing database:', err);
  } else {
    console.log('\n✓ Comprehensive database initialization complete!');
    console.log('Database location:', dbPath);
  }
});
