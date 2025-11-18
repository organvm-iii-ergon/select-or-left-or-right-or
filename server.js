require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-key';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('.'));

// Database connection
const db = new sqlite3.Database('./social.db', (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Available affiliations
const AFFILIATIONS = [
  'Conservative',
  'Liberal',
  'Libertarian',
  'Socialist',
  'Anarchist',
  'Centrist',
  'Apolitical'
];

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// ============ API ROUTES ============

// Register new user
app.post('/api/register', async (req, res) => {
  const { username, email, password, affiliation } = req.body;

  // Validation
  if (!username || !email || !password || !affiliation) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (!AFFILIATIONS.includes(affiliation)) {
    return res.status(400).json({ error: 'Invalid affiliation' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    // Check if user exists
    db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email], async (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (row) {
        return res.status(400).json({ error: 'Username or email already exists' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Insert user
      db.run(
        'INSERT INTO users (username, email, password_hash, affiliation) VALUES (?, ?, ?, ?)',
        [username, email, passwordHash, affiliation],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to create user' });
          }

          const token = jwt.sign(
            { id: this.lastID, username, affiliation },
            JWT_SECRET,
            { expiresIn: '7d' }
          );

          res.status(201).json({
            message: 'User created successfully',
            token,
            user: {
              id: this.lastID,
              username,
              email,
              affiliation
            }
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, affiliation: user.affiliation },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        affiliation: user.affiliation
      }
    });
  });
});

// Get current user
app.get('/api/me', authenticateToken, (req, res) => {
  db.get('SELECT id, username, email, affiliation, created_at FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  });
});

// Create post
app.post('/api/posts', authenticateToken, (req, res) => {
  const { content } = req.body;

  if (!content || content.trim().length === 0) {
    return res.status(400).json({ error: 'Post content is required' });
  }

  if (content.length > 5000) {
    return res.status(400).json({ error: 'Post content too long (max 5000 characters)' });
  }

  db.run(
    'INSERT INTO posts (user_id, content) VALUES (?, ?)',
    [req.user.id, content],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to create post' });
      }

      // Get the created post with user info
      db.get(
        `SELECT posts.*, users.username, users.affiliation
         FROM posts
         JOIN users ON posts.user_id = users.id
         WHERE posts.id = ?`,
        [this.lastID],
        (err, post) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to retrieve post' });
          }
          res.status(201).json(post);
        }
      );
    }
  );
});

// Get feed (filtered by user's affiliation bubble)
app.get('/api/feed', authenticateToken, (req, res) => {
  const { affiliation } = req.user;
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  db.all(
    `SELECT posts.*, users.username, users.affiliation
     FROM posts
     JOIN users ON posts.user_id = users.id
     WHERE users.affiliation = ?
     ORDER BY posts.created_at DESC
     LIMIT ? OFFSET ?`,
    [affiliation, limit, offset],
    (err, posts) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to retrieve feed' });
      }
      res.json(posts);
    }
  );
});

// Get all posts (cross-bubble view - optional feature)
app.get('/api/posts/all', authenticateToken, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  db.all(
    `SELECT posts.*, users.username, users.affiliation
     FROM posts
     JOIN users ON posts.user_id = users.id
     ORDER BY posts.created_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset],
    (err, posts) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to retrieve posts' });
      }
      res.json(posts);
    }
  );
});

// Get posts by specific affiliation
app.get('/api/posts/affiliation/:affiliation', authenticateToken, (req, res) => {
  const { affiliation } = req.params;
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  if (!AFFILIATIONS.includes(affiliation)) {
    return res.status(400).json({ error: 'Invalid affiliation' });
  }

  db.all(
    `SELECT posts.*, users.username, users.affiliation
     FROM posts
     JOIN users ON posts.user_id = users.id
     WHERE users.affiliation = ?
     ORDER BY posts.created_at DESC
     LIMIT ? OFFSET ?`,
    [affiliation, limit, offset],
    (err, posts) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to retrieve posts' });
      }
      res.json(posts);
    }
  );
});

// Get user's own posts
app.get('/api/posts/my', authenticateToken, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  db.all(
    `SELECT posts.*, users.username, users.affiliation
     FROM posts
     JOIN users ON posts.user_id = users.id
     WHERE posts.user_id = ?
     ORDER BY posts.created_at DESC
     LIMIT ? OFFSET ?`,
    [req.user.id, limit, offset],
    (err, posts) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to retrieve posts' });
      }
      res.json(posts);
    }
  );
});

// Get available affiliations
app.get('/api/affiliations', (req, res) => {
  res.json(AFFILIATIONS);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('No moderation policy: If it\'s legal, it\'s allowed');
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});
