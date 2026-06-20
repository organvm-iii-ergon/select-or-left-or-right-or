require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');
const multer = require('multer');
const sharp = require('sharp');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { body, validationResult } = require('express-validator');
const compression = require('compression');
const crypto = require('crypto');
const fs = require('fs').promises;
const { AFFILIATIONS, NOTIFICATION_TYPES, extractHashtags, extractMentions } = require('./lib/utils');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-key';

// ============ LOGGING CONFIGURATION ============
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// ============ MIDDLEWARE ============
app.use(helmet({
  contentSecurityPolicy: false // Disable for development
}));
app.use(compression());
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('.'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many authentication attempts, please try again later.'
});

app.use('/api/', limiter);
app.use('/api/login', authLimiter);
app.use('/api/register', authLimiter);

// ============ FILE UPLOAD CONFIGURATION ============
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  }
});

// ============ EMAIL CONFIGURATION ============
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
});

// ============ DATABASE CONNECTION ============
const db = new sqlite3.Database('./social.db', (err) => {
  if (err) {
    logger.error('Database connection error:', err);
  } else {
    logger.info('Connected to SQLite database');
  }
});

// ============ CONSTANTS ============
// AFFILIATIONS, NOTIFICATION_TYPES imported from ./lib/utils

// ============ UTILITY FUNCTIONS ============
function logActivity(userId, action, entityType = null, entityId = null, req = null) {
  const ip = req ? req.ip : null;
  const userAgent = req ? req.get('user-agent') : null;

  db.run(
    `INSERT INTO activity_log (user_id, action, entity_type, entity_id, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, action, entityType, entityId, ip, userAgent],
    (err) => {
      if (err) logger.error('Failed to log activity:', err);
    }
  );
}

function createNotification(userId, type, actorId, postId = null, commentId = null, message = null) {
  db.run(
    `INSERT INTO notifications (user_id, type, actor_id, post_id, comment_id, message)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, type, actorId, postId, commentId, message],
    function(err) {
      if (err) {
        logger.error('Failed to create notification:', err);
        return;
      }

      // Emit real-time notification via WebSocket
      io.to(`user_${userId}`).emit('notification', {
        id: this.lastID,
        type,
        actorId,
        postId,
        commentId,
        message,
        created_at: new Date().toISOString()
      });
    }
  );
}

// extractHashtags, extractMentions imported from ./lib/utils

async function sendEmail(to, subject, html) {
  if (!process.env.SMTP_USER) {
    logger.warn('Email not configured. Skipping email send.');
    return;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject,
      html
    });
    logger.info(`Email sent to ${to}`);
  } catch (error) {
    logger.error('Failed to send email:', error);
  }
}

// ============ AUTHENTICATION MIDDLEWARE ============
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

const requireAdmin = (req, res, next) => {
  db.get('SELECT is_admin FROM users WHERE id = ?', [req.user.id], (err, row) => {
    if (err || !row || !row.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
};

// ============ WEBSOCKET HANDLERS ============
io.on('connection', (socket) => {
  logger.info('Client connected:', socket.id);

  socket.on('authenticate', (token) => {
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        socket.emit('auth_error', 'Invalid token');
        return;
      }
      socket.join(`user_${user.id}`);
      socket.userId = user.id;
      logger.info(`User ${user.id} authenticated on socket ${socket.id}`);
    });
  });

  socket.on('disconnect', () => {
    logger.info('Client disconnected:', socket.id);
  });
});

// ============ API ROUTES ============

// ========== AUTHENTICATION ROUTES ==========

// Register
app.post('/api/register', [
  body('username').isLength({ min: 3, max: 30 }).trim().escape(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('affiliation').isIn(AFFILIATIONS)
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, email, password, affiliation } = req.body;

  try {
    db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email], async (err, row) => {
      if (err) {
        logger.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (row) {
        return res.status(400).json({ error: 'Username or email already exists' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const verificationToken = uuidv4();

      db.run(
        `INSERT INTO users (username, email, password_hash, affiliation, verification_token)
         VALUES (?, ?, ?, ?, ?)`,
        [username, email, passwordHash, affiliation, verificationToken],
        function(err) {
          if (err) {
            logger.error('Failed to create user:', err);
            return res.status(500).json({ error: 'Failed to create user' });
          }

          const userId = this.lastID;
          logActivity(userId, 'register', 'user', userId, req);

          // Send verification email
          const verificationUrl = `${req.protocol}://${req.get('host')}/api/verify-email/${verificationToken}`;
          sendEmail(
            email,
            'Verify your email',
            `<h1>Welcome to Pepe Social Network!</h1>
             <p>Click <a href="${verificationUrl}">here</a> to verify your email.</p>`
          );

          const token = jwt.sign(
            { id: userId, username, affiliation },
            JWT_SECRET,
            { expiresIn: '7d' }
          );

          res.status(201).json({
            message: 'User created successfully',
            token,
            user: {
              id: userId,
              username,
              email,
              affiliation,
              email_verified: false
            }
          });
        }
      );
    });
  } catch (error) {
    logger.error('Server error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/api/login', [
  body('username').trim().escape(),
  body('password').exists()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password } = req.body;

  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) {
      logger.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    logActivity(user.id, 'login', 'user', user.id, req);

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
        affiliation: user.affiliation,
        bio: user.bio,
        avatar_url: user.avatar_url,
        is_admin: user.is_admin,
        email_verified: user.email_verified,
        two_factor_enabled: user.two_factor_enabled
      }
    });
  });
});

// Verify email
app.get('/api/verify-email/:token', (req, res) => {
  const { token } = req.params;

  db.run(
    'UPDATE users SET email_verified = 1, verification_token = NULL WHERE verification_token = ?',
    [token],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(400).json({ error: 'Invalid verification token' });
      }
      res.json({ message: 'Email verified successfully' });
    }
  );
});

// Request password reset
app.post('/api/forgot-password', [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  const { email } = req.body;
  const resetToken = uuidv4();
  const expires = new Date(Date.now() + 3600000); // 1 hour

  db.run(
    'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE email = ?',
    [resetToken, expires.toISOString(), email],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      const resetUrl = `${req.protocol}://${req.get('host')}/reset-password.html?token=${resetToken}`;
      sendEmail(
        email,
        'Password Reset Request',
        `<h1>Reset Your Password</h1>
         <p>Click <a href="${resetUrl}">here</a> to reset your password.</p>
         <p>This link expires in 1 hour.</p>`
      );

      res.json({ message: 'Password reset email sent' });
    }
  );
});

// Reset password
app.post('/api/reset-password', [
  body('token').notEmpty(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  const { token, password } = req.body;

  db.get(
    'SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > ?',
    [token, new Date().toISOString()],
    async (err, user) => {
      if (err || !user) {
        return res.status(400).json({ error: 'Invalid or expired token' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      db.run(
        'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
        [passwordHash, user.id],
        (err) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to reset password' });
          }
          logActivity(user.id, 'password_reset', 'user', user.id, req);
          res.json({ message: 'Password reset successful' });
        }
      );
    }
  );
});

// Get current user
app.get('/api/me', authenticateToken, (req, res) => {
  db.get(
    `SELECT id, username, email, affiliation, bio, avatar_url, is_admin,
            email_verified, two_factor_enabled, created_at
     FROM users WHERE id = ?`,
    [req.user.id],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get counts
      db.get(
        `SELECT
          (SELECT COUNT(*) FROM posts WHERE user_id = ? AND deleted = 0) as post_count,
          (SELECT COUNT(*) FROM follows WHERE follower_id = ?) as following_count,
          (SELECT COUNT(*) FROM follows WHERE following_id = ?) as followers_count`,
        [req.user.id, req.user.id, req.user.id],
        (err, counts) => {
          if (err) {
            return res.json(user);
          }
          res.json({ ...user, ...counts });
        }
      );
    }
  );
});

// Update profile
app.put('/api/profile', authenticateToken, [
  body('bio').optional().isLength({ max: 500 }).trim()
], (req, res) => {
  const { bio } = req.body;

  db.run(
    'UPDATE users SET bio = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [bio || '', req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update profile' });
      }
      logActivity(req.user.id, 'update_profile', 'user', req.user.id, req);
      res.json({ message: 'Profile updated successfully' });
    }
  );
});

// Upload avatar
app.post('/api/upload-avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const outputPath = path.join(__dirname, 'uploads', `avatar_${req.user.id}.jpg`);

    await sharp(req.file.path)
      .resize(200, 200, { fit: 'cover' })
      .jpeg({ quality: 90 })
      .toFile(outputPath);

    // Delete original file
    await fs.unlink(req.file.path);

    const avatarUrl = `/uploads/avatar_${req.user.id}.jpg?v=${Date.now()}`;

    db.run(
      'UPDATE users SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [avatarUrl, req.user.id],
      (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to update avatar' });
        }
        logActivity(req.user.id, 'upload_avatar', 'user', req.user.id, req);
        res.json({ message: 'Avatar uploaded successfully', avatar_url: avatarUrl });
      }
    );
  } catch (error) {
    logger.error('Avatar upload error:', error);
    res.status(500).json({ error: 'Failed to process avatar' });
  }
});

// ========== 2FA ROUTES ==========

// Enable 2FA
app.post('/api/2fa/enable', authenticateToken, (req, res) => {
  const secret = speakeasy.generateSecret({ name: 'Pepe Social Network' });

  QRCode.toDataURL(secret.otpauth_url, (err, dataUrl) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to generate QR code' });
    }

    db.run(
      'UPDATE users SET two_factor_secret = ? WHERE id = ?',
      [secret.base32, req.user.id],
      (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to save 2FA secret' });
        }
        res.json({ secret: secret.base32, qrCode: dataUrl });
      }
    );
  });
});

// Verify and activate 2FA
app.post('/api/2fa/verify', authenticateToken, [
  body('token').isLength({ min: 6, max: 6 })
], (req, res) => {
  const { token } = req.body;

  db.get('SELECT two_factor_secret FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user || !user.two_factor_secret) {
      return res.status(400).json({ error: 'No 2FA secret found' });
    }

    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token
    });

    if (!verified) {
      return res.status(400).json({ error: 'Invalid 2FA code' });
    }

    db.run(
      'UPDATE users SET two_factor_enabled = 1 WHERE id = ?',
      [req.user.id],
      (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to enable 2FA' });
        }
        logActivity(req.user.id, 'enable_2fa', 'user', req.user.id, req);
        res.json({ message: '2FA enabled successfully' });
      }
    );
  });
});

// Disable 2FA
app.post('/api/2fa/disable', authenticateToken, [
  body('password').notEmpty()
], async (req, res) => {
  const { password } = req.body;

  db.get('SELECT password_hash FROM users WHERE id = ?', [req.user.id], async (err, user) => {
    if (err || !user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    db.run(
      'UPDATE users SET two_factor_enabled = 0, two_factor_secret = NULL WHERE id = ?',
      [req.user.id],
      (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to disable 2FA' });
        }
        logActivity(req.user.id, 'disable_2fa', 'user', req.user.id, req);
        res.json({ message: '2FA disabled successfully' });
      }
    );
  });
});

// Continue in next part...
// ========== POSTS ROUTES (CONTINUATION) ==========

// Create post
app.post('/api/posts', authenticateToken, upload.single('image'), [
  body('content').isLength({ min: 1, max: 5000 }).trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { content } = req.body;
  let imageUrl = '';

  try {
    // Process image if uploaded
    if (req.file) {
      const outputPath = path.join(__dirname, 'uploads', `post_${uuidv4()}.jpg`);
      await sharp(req.file.path)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toFile(outputPath);

      await fs.unlink(req.file.path);
      imageUrl = `/uploads/${path.basename(outputPath)}`;
    }

    db.run(
      'INSERT INTO posts (user_id, content, image_url) VALUES (?, ?, ?)',
      [req.user.id, content, imageUrl],
      function(err) {
        if (err) {
          logger.error('Failed to create post:', err);
          return res.status(500).json({ error: 'Failed to create post' });
        }

        const postId = this.lastID;
        logActivity(req.user.id, 'create_post', 'post', postId, req);

        // Extract and save hashtags
        const hashtags = extractHashtags(content);
        hashtags.forEach(tag => {
          db.run(
            'INSERT OR IGNORE INTO hashtags (tag) VALUES (?)',
            [tag],
            function(err) {
              if (!err) {
                db.run(
                  'INSERT OR IGNORE INTO post_hashtags (post_id, hashtag_id) VALUES (?, ?)',
                  [postId, this.lastID || 0]
                );
              }
            }
          );
        });

        // Extract and notify mentions
        const mentions = extractMentions(content);
        mentions.forEach(username => {
          db.get('SELECT id FROM users WHERE username = ?', [username], (err, user) => {
            if (!err && user) {
              createNotification(user.id, NOTIFICATION_TYPES.MENTION, req.user.id, postId);
            }
          });
        });

        // Get the created post with user info
        db.get(
          `SELECT posts.*, users.username, users.affiliation, users.avatar_url
           FROM posts
           JOIN users ON posts.user_id = users.id
           WHERE posts.id = ?`,
          [postId],
          (err, post) => {
            if (err) {
              return res.status(500).json({ error: 'Failed to retrieve post' });
            }

            // Emit via WebSocket
            io.emit('new_post', post);
            res.status(201).json(post);
          }
        );
      }
    );
  } catch (error) {
    logger.error('Post creation error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Get feed (with mutes/blocks filtering)
app.get('/api/feed', authenticateToken, (req, res) => {
  const { affiliation } = req.user;
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  db.all(
    `SELECT posts.*, users.username, users.affiliation, users.avatar_url,
            (SELECT COUNT(*) FROM likes WHERE post_id = posts.id) as like_count,
            (SELECT COUNT(*) FROM comments WHERE post_id = posts.id AND deleted = 0) as comment_count,
            (SELECT COUNT(*) > 0 FROM likes WHERE post_id = posts.id AND user_id = ?) as liked_by_me,
            (SELECT COUNT(*) > 0 FROM bookmarks WHERE post_id = posts.id AND user_id = ?) as bookmarked_by_me
     FROM posts
     JOIN users ON posts.user_id = users.id
     WHERE users.affiliation = ?
       AND posts.deleted = 0
       AND posts.user_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?)
       AND posts.user_id NOT IN (SELECT muted_id FROM mutes WHERE muter_id = ?)
     ORDER BY posts.created_at DESC
     LIMIT ? OFFSET ?`,
    [req.user.id, req.user.id, affiliation, req.user.id, req.user.id, limit, offset],
    (err, posts) => {
      if (err) {
        logger.error('Failed to retrieve feed:', err);
        return res.status(500).json({ error: 'Failed to retrieve feed' });
      }
      res.json(posts);
    }
  );
});

// Get single post
app.get('/api/posts/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.get(
    `SELECT posts.*, users.username, users.affiliation, users.avatar_url,
            (SELECT COUNT(*) FROM likes WHERE post_id = posts.id) as like_count,
            (SELECT COUNT(*) FROM comments WHERE post_id = posts.id AND deleted = 0) as comment_count,
            (SELECT COUNT(*) > 0 FROM likes WHERE post_id = posts.id AND user_id = ?) as liked_by_me,
            (SELECT COUNT(*) > 0 FROM bookmarks WHERE post_id = posts.id AND user_id = ?) as bookmarked_by_me
     FROM posts
     JOIN users ON posts.user_id = users.id
     WHERE posts.id = ? AND posts.deleted = 0`,
    [req.user.id, req.user.id, id],
    (err, post) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }
      res.json(post);
    }
  );
});

// Edit post
app.put('/api/posts/:id', authenticateToken, [
  body('content').isLength({ min: 1, max: 5000 }).trim()
], (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  db.get('SELECT user_id FROM posts WHERE id = ?', [id], (err, post) => {
    if (err || !post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    if (post.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to edit this post' });
    }

    db.run(
      'UPDATE posts SET content = ?, edited = 1, edited_at = CURRENT_TIMESTAMP WHERE id = ?',
      [content, id],
      (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to update post' });
        }
        logActivity(req.user.id, 'edit_post', 'post', id, req);
        res.json({ message: 'Post updated successfully' });
      }
    );
  });
});

// Delete post
app.delete('/api/posts/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.get('SELECT user_id FROM posts WHERE id = ?', [id], (err, post) => {
    if (err || !post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    if (post.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this post' });
    }

    db.run(
      'UPDATE posts SET deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id],
      (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to delete post' });
        }
        logActivity(req.user.id, 'delete_post', 'post', id, req);
        res.json({ message: 'Post deleted successfully' });
      }
    );
  });
});

// Repost
app.post('/api/posts/:id/repost', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM posts WHERE id = ? AND deleted = 0', [id], (err, originalPost) => {
    if (err || !originalPost) {
      return res.status(404).json({ error: 'Post not found' });
    }

    db.run(
      'INSERT INTO posts (user_id, content, is_repost, original_post_id) VALUES (?, ?, 1, ?)',
      [req.user.id, originalPost.content, id],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to repost' });
        }

        logActivity(req.user.id, 'repost', 'post', id, req);
        createNotification(originalPost.user_id, NOTIFICATION_TYPES.REPOST, req.user.id, id);

        res.status(201).json({ message: 'Reposted successfully', id: this.lastID });
      }
    );
  });
});

// ========== COMMENTS ROUTES ==========

// Get comments for a post
app.get('/api/posts/:id/comments', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.all(
    `SELECT comments.*, users.username, users.avatar_url,
            (SELECT COUNT(*) FROM likes WHERE comment_id = comments.id) as like_count,
            (SELECT COUNT(*) > 0 FROM likes WHERE comment_id = comments.id AND user_id = ?) as liked_by_me
     FROM comments
     JOIN users ON comments.user_id = users.id
     WHERE comments.post_id = ? AND comments.deleted = 0
     ORDER BY comments.created_at ASC`,
    [req.user.id, id],
    (err, comments) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to retrieve comments' });
      }
      res.json(comments);
    }
  );
});

// Create comment
app.post('/api/posts/:id/comments', authenticateToken, [
  body('content').isLength({ min: 1, max: 1000 }).trim()
], (req, res) => {
  const { id } = req.params;
  const { content, parent_comment_id } = req.body;

  db.run(
    'INSERT INTO comments (post_id, user_id, parent_comment_id, content) VALUES (?, ?, ?, ?)',
    [id, req.user.id, parent_comment_id || null, content],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to create comment' });
      }

      const commentId = this.lastID;
      logActivity(req.user.id, 'create_comment', 'comment', commentId, req);

      // Notify post author
      db.get('SELECT user_id FROM posts WHERE id = ?', [id], (err, post) => {
        if (!err && post && post.user_id !== req.user.id) {
          createNotification(post.user_id, NOTIFICATION_TYPES.COMMENT, req.user.id, id, commentId);
        }
      });

      // Get the created comment with user info
      db.get(
        `SELECT comments.*, users.username, users.avatar_url
         FROM comments
         JOIN users ON comments.user_id = users.id
         WHERE comments.id = ?`,
        [commentId],
        (err, comment) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to retrieve comment' });
          }
          res.status(201).json(comment);
        }
      );
    }
  );
});

// Edit comment
app.put('/api/comments/:id', authenticateToken, [
  body('content').isLength({ min: 1, max: 1000 }).trim()
], (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  db.get('SELECT user_id FROM comments WHERE id = ?', [id], (err, comment) => {
    if (err || !comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    if (comment.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to edit this comment' });
    }

    db.run(
      'UPDATE comments SET content = ?, edited = 1, edited_at = CURRENT_TIMESTAMP WHERE id = ?',
      [content, id],
      (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to update comment' });
        }
        res.json({ message: 'Comment updated successfully' });
      }
    );
  });
});

// Delete comment
app.delete('/api/comments/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.get('SELECT user_id FROM comments WHERE id = ?', [id], (err, comment) => {
    if (err || !comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    if (comment.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    db.run(
      'UPDATE comments SET deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id],
      (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to delete comment' });
        }
        res.json({ message: 'Comment deleted successfully' });
      }
    );
  });
});

// ========== LIKES ROUTES ==========

// Like/unlike post
app.post('/api/posts/:id/like', authenticateToken, (req, res) => {
  const { id } = req.params;

  // Check if already liked
  db.get(
    'SELECT id FROM likes WHERE user_id = ? AND post_id = ?',
    [req.user.id, id],
    (err, existing) => {
      if (existing) {
        // Unlike
        db.run(
          'DELETE FROM likes WHERE user_id = ? AND post_id = ?',
          [req.user.id, id],
          (err) => {
            if (err) {
              return res.status(500).json({ error: 'Failed to unlike' });
            }
            res.json({ message: 'Post unliked', liked: false });
          }
        );
      } else {
        // Like
        db.run(
          'INSERT INTO likes (user_id, post_id) VALUES (?, ?)',
          [req.user.id, id],
          (err) => {
            if (err) {
              return res.status(500).json({ error: 'Failed to like' });
            }

            logActivity(req.user.id, 'like_post', 'post', id, req);

            // Notify post author
            db.get('SELECT user_id FROM posts WHERE id = ?', [id], (err, post) => {
              if (!err && post && post.user_id !== req.user.id) {
                createNotification(post.user_id, NOTIFICATION_TYPES.LIKE, req.user.id, id);
              }
            });

            res.json({ message: 'Post liked', liked: true });
          }
        );
      }
    }
  );
});

// Like/unlike comment
app.post('/api/comments/:id/like', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.get(
    'SELECT id FROM likes WHERE user_id = ? AND comment_id = ?',
    [req.user.id, id],
    (err, existing) => {
      if (existing) {
        db.run(
          'DELETE FROM likes WHERE user_id = ? AND comment_id = ?',
          [req.user.id, id],
          (err) => {
            if (err) {
              return res.status(500).json({ error: 'Failed to unlike' });
            }
            res.json({ message: 'Comment unliked', liked: false });
          }
        );
      } else {
        db.run(
          'INSERT INTO likes (user_id, comment_id) VALUES (?, ?)',
          [req.user.id, id],
          (err) => {
            if (err) {
              return res.status(500).json({ error: 'Failed to like' });
            }
            res.json({ message: 'Comment liked', liked: true });
          }
        );
      }
    }
  );
});

// ========== FOLLOWS ROUTES ==========

// Follow/unfollow user
app.post('/api/users/:id/follow', authenticateToken, (req, res) => {
  const { id } = req.params;
  const targetId = parseInt(id);

  if (targetId === req.user.id) {
    return res.status(400).json({ error: 'Cannot follow yourself' });
  }

  db.get(
    'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
    [req.user.id, targetId],
    (err, existing) => {
      if (existing) {
        // Unfollow
        db.run(
          'DELETE FROM follows WHERE follower_id = ? AND following_id = ?',
          [req.user.id, targetId],
          (err) => {
            if (err) {
              return res.status(500).json({ error: 'Failed to unfollow' });
            }
            res.json({ message: 'Unfollowed successfully', following: false });
          }
        );
      } else {
        // Follow
        db.run(
          'INSERT INTO follows (follower_id, following_id) VALUES (?, ?)',
          [req.user.id, targetId],
          (err) => {
            if (err) {
              return res.status(500).json({ error: 'Failed to follow' });
            }

            logActivity(req.user.id, 'follow_user', 'user', targetId, req);
            createNotification(targetId, NOTIFICATION_TYPES.FOLLOW, req.user.id);

            res.json({ message: 'Followed successfully', following: true });
          }
        );
      }
    }
  );
});

// Get user's followers
app.get('/api/users/:id/followers', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.all(
    `SELECT users.id, users.username, users.avatar_url, users.bio, users.affiliation
     FROM follows
     JOIN users ON follows.follower_id = users.id
     WHERE follows.following_id = ?`,
    [id],
    (err, followers) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to retrieve followers' });
      }
      res.json(followers);
    }
  );
});

// Get user's following
app.get('/api/users/:id/following', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.all(
    `SELECT users.id, users.username, users.avatar_url, users.bio, users.affiliation
     FROM follows
     JOIN users ON follows.following_id = users.id
     WHERE follows.follower_id = ?`,
    [id],
    (err, following) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to retrieve following' });
      }
      res.json(following);
    }
  );
});

// ========== BLOCKS & MUTES ROUTES ==========

// Block user
app.post('/api/users/:id/block', authenticateToken, (req, res) => {
  const { id } = req.params;
  const targetId = parseInt(id);

  if (targetId === req.user.id) {
    return res.status(400).json({ error: 'Cannot block yourself' });
  }

  db.run(
    'INSERT OR IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?, ?)',
    [req.user.id, targetId],
    (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to block user' });
      }

      // Remove follow relationships
      db.run('DELETE FROM follows WHERE (follower_id = ? AND following_id = ?) OR (follower_id = ? AND following_id = ?)',
        [req.user.id, targetId, targetId, req.user.id]);

      logActivity(req.user.id, 'block_user', 'user', targetId, req);
      res.json({ message: 'User blocked successfully' });
    }
  );
});

// Unblock user
app.delete('/api/users/:id/block', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.run(
    'DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?',
    [req.user.id, id],
    (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to unblock user' });
      }
      res.json({ message: 'User unblocked successfully' });
    }
  );
});

// Mute user
app.post('/api/users/:id/mute', authenticateToken, (req, res) => {
  const { id } = req.params;
  const targetId = parseInt(id);

  if (targetId === req.user.id) {
    return res.status(400).json({ error: 'Cannot mute yourself' });
  }

  db.run(
    'INSERT OR IGNORE INTO mutes (muter_id, muted_id) VALUES (?, ?)',
    [req.user.id, targetId],
    (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to mute user' });
      }
      logActivity(req.user.id, 'mute_user', 'user', targetId, req);
      res.json({ message: 'User muted successfully' });
    }
  );
});

// Unmute user
app.delete('/api/users/:id/mute', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.run(
    'DELETE FROM mutes WHERE muter_id = ? AND muted_id = ?',
    [req.user.id, id],
    (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to unmute user' });
      }
      res.json({ message: 'User unmuted successfully' });
    }
  );
});

// Get blocked users
app.get('/api/blocks', authenticateToken, (req, res) => {
  db.all(
    `SELECT users.id, users.username, users.avatar_url
     FROM blocks
     JOIN users ON blocks.blocked_id = users.id
     WHERE blocks.blocker_id = ?`,
    [req.user.id],
    (err, blocks) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to retrieve blocks' });
      }
      res.json(blocks);
    }
  );
});

// Get muted users
app.get('/api/mutes', authenticateToken, (req, res) => {
  db.all(
    `SELECT users.id, users.username, users.avatar_url
     FROM mutes
     JOIN users ON mutes.muted_id = users.id
     WHERE mutes.muter_id = ?`,
    [req.user.id],
    (err, mutes) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to retrieve mutes' });
      }
      res.json(mutes);
    }
  );
});

// ========== DIRECT MESSAGES ROUTES ==========

// Send DM
app.post('/api/messages', authenticateToken, [
  body('recipient_id').isInt(),
  body('content').isLength({ min: 1, max: 2000 }).trim()
], (req, res) => {
  const { recipient_id, content } = req.body;

  // Check if recipient has blocked sender
  db.get(
    'SELECT id FROM blocks WHERE blocker_id = ? AND blocked_id = ?',
    [recipient_id, req.user.id],
    (err, blocked) => {
      if (blocked) {
        return res.status(403).json({ error: 'Cannot send message to this user' });
      }

      db.run(
        'INSERT INTO direct_messages (sender_id, recipient_id, content) VALUES (?, ?, ?)',
        [req.user.id, recipient_id, content],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to send message' });
          }

          const messageId = this.lastID;
          logActivity(req.user.id, 'send_message', 'message', messageId, req);
          createNotification(recipient_id, NOTIFICATION_TYPES.MESSAGE, req.user.id);

          // Emit via WebSocket
          io.to(`user_${recipient_id}`).emit('new_message', {
            id: messageId,
            sender_id: req.user.id,
            content,
            created_at: new Date().toISOString()
          });

          res.status(201).json({ message: 'Message sent successfully', id: messageId });
        }
      );
    }
  );
});

// Get conversations
app.get('/api/messages/conversations', authenticateToken, (req, res) => {
  db.all(
    `SELECT DISTINCT
       CASE
         WHEN sender_id = ? THEN recipient_id
         ELSE sender_id
       END as other_user_id,
       MAX(created_at) as last_message_time
     FROM direct_messages
     WHERE (sender_id = ? OR recipient_id = ?)
       AND (deleted_by_sender = 0 OR sender_id != ?)
       AND (deleted_by_recipient = 0 OR recipient_id != ?)
     GROUP BY other_user_id
     ORDER BY last_message_time DESC`,
    [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id],
    (err, conversations) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to retrieve conversations' });
      }

      // Get user details for each conversation
      const userIds = conversations.map(c => c.other_user_id);
      if (userIds.length === 0) {
        return res.json([]);
      }

      db.all(
        `SELECT id, username, avatar_url FROM users WHERE id IN (${userIds.join(',')})`,
        (err, users) => {
          if (err) {
            return res.json(conversations);
          }

          const result = conversations.map(conv => {
            const user = users.find(u => u.id === conv.other_user_id);
            return { ...conv, ...user };
          });

          res.json(result);
        }
      );
    }
  );
});

// Get messages with user
app.get('/api/messages/:userId', authenticateToken, (req, res) => {
  const { userId } = req.params;
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  db.all(
    `SELECT * FROM direct_messages
     WHERE ((sender_id = ? AND recipient_id = ? AND deleted_by_sender = 0)
        OR (sender_id = ? AND recipient_id = ? AND deleted_by_recipient = 0))
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [req.user.id, userId, userId, req.user.id, limit, offset],
    (err, messages) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to retrieve messages' });
      }

      // Mark as read
      db.run(
        'UPDATE direct_messages SET read = 1, read_at = CURRENT_TIMESTAMP WHERE sender_id = ? AND recipient_id = ? AND read = 0',
        [userId, req.user.id]
      );

      res.json(messages.reverse());
    }
  );
});

// Delete message
app.delete('/api/messages/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.get('SELECT sender_id, recipient_id FROM direct_messages WHERE id = ?', [id], (err, msg) => {
    if (err || !msg) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (msg.sender_id === req.user.id) {
      db.run('UPDATE direct_messages SET deleted_by_sender = 1 WHERE id = ?', [id]);
    } else if (msg.recipient_id === req.user.id) {
      db.run('UPDATE direct_messages SET deleted_by_recipient = 1 WHERE id = ?', [id]);
    } else {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json({ message: 'Message deleted successfully' });
  });
});

// ========== BOOKMARKS ROUTES ==========

// Bookmark/unbookmark post
app.post('/api/posts/:id/bookmark', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.get(
    'SELECT id FROM bookmarks WHERE user_id = ? AND post_id = ?',
    [req.user.id, id],
    (err, existing) => {
      if (existing) {
        db.run(
          'DELETE FROM bookmarks WHERE user_id = ? AND post_id = ?',
          [req.user.id, id],
          (err) => {
            if (err) {
              return res.status(500).json({ error: 'Failed to remove bookmark' });
            }
            res.json({ message: 'Bookmark removed', bookmarked: false });
          }
        );
      } else {
        db.run(
          'INSERT INTO bookmarks (user_id, post_id) VALUES (?, ?)',
          [req.user.id, id],
          (err) => {
            if (err) {
              return res.status(500).json({ error: 'Failed to bookmark' });
            }
            logActivity(req.user.id, 'bookmark_post', 'post', id, req);
            res.json({ message: 'Post bookmarked', bookmarked: true });
          }
        );
      }
    }
  );
});

// Get bookmarked posts
app.get('/api/bookmarks', authenticateToken, (req, res) => {
  db.all(
    `SELECT posts.*, users.username, users.affiliation, users.avatar_url,
            (SELECT COUNT(*) FROM likes WHERE post_id = posts.id) as like_count,
            (SELECT COUNT(*) FROM comments WHERE post_id = posts.id AND deleted = 0) as comment_count
     FROM bookmarks
     JOIN posts ON bookmarks.post_id = posts.id
     JOIN users ON posts.user_id = users.id
     WHERE bookmarks.user_id = ? AND posts.deleted = 0
     ORDER BY bookmarks.created_at DESC`,
    [req.user.id],
    (err, bookmarks) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to retrieve bookmarks' });
      }
      res.json(bookmarks);
    }
  );
});

// Continue with more routes...
// ========== NOTIFICATIONS ROUTES ==========

// Get notifications
app.get('/api/notifications', authenticateToken, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  db.all(
    `SELECT notifications.*, users.username as actor_username, users.avatar_url as actor_avatar
     FROM notifications
     LEFT JOIN users ON notifications.actor_id = users.id
     WHERE notifications.user_id = ?
     ORDER BY notifications.created_at DESC
     LIMIT ? OFFSET ?`,
    [req.user.id, limit, offset],
    (err, notifications) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to retrieve notifications' });
      }
      res.json(notifications);
    }
  );
});

// Mark notification as read
app.put('/api/notifications/:id/read', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.run(
    'UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?',
    [id, req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to mark as read' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Notification not found' });
      }
      res.json({ message: 'Notification marked as read' });
    }
  );
});

// Mark all notifications as read
app.put('/api/notifications/read-all', authenticateToken, (req, res) => {
  db.run(
    'UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0',
    [req.user.id],
    (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to mark all as read' });
      }
      res.json({ message: 'All notifications marked as read' });
    }
  );
});

// Get unread notification count
app.get('/api/notifications/unread-count', authenticateToken, (req, res) => {
  db.get(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0',
    [req.user.id],
    (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to get count' });
      }
      res.json({ count: result.count });
    }
  );
});

// ========== HASHTAGS & TRENDING ROUTES ==========

// Get trending hashtags
app.get('/api/hashtags/trending', authenticateToken, (req, res) => {
  const hours = parseInt(req.query.hours) || 24;
  const limit = parseInt(req.query.limit) || 20;

  db.all(
    `SELECT hashtags.tag, COUNT(*) as count
     FROM post_hashtags
     JOIN hashtags ON post_hashtags.hashtag_id = hashtags.id
     JOIN posts ON post_hashtags.post_id = posts.id
     WHERE posts.created_at > datetime('now', '-${hours} hours')
       AND posts.deleted = 0
     GROUP BY hashtags.tag
     ORDER BY count DESC
     LIMIT ?`,
    [limit],
    (err, trending) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to retrieve trending hashtags' });
      }
      res.json(trending);
    }
  );
});

// Get posts by hashtag
app.get('/api/hashtags/:tag/posts', authenticateToken, (req, res) => {
  const { tag } = req.params;
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  db.all(
    `SELECT posts.*, users.username, users.affiliation, users.avatar_url,
            (SELECT COUNT(*) FROM likes WHERE post_id = posts.id) as like_count,
            (SELECT COUNT(*) FROM comments WHERE post_id = posts.id AND deleted = 0) as comment_count
     FROM posts
     JOIN users ON posts.user_id = users.id
     JOIN post_hashtags ON posts.id = post_hashtags.post_id
     JOIN hashtags ON post_hashtags.hashtag_id = hashtags.id
     WHERE hashtags.tag = ? AND posts.deleted = 0
     ORDER BY posts.created_at DESC
     LIMIT ? OFFSET ?`,
    [tag.toLowerCase(), limit, offset],
    (err, posts) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to retrieve posts' });
      }
      res.json(posts);
    }
  );
});

// ========== SEARCH ROUTES ==========

// Search users
app.get('/api/search/users', authenticateToken, (req, res) => {
  const { q } = req.query;
  const limit = parseInt(req.query.limit) || 20;

  if (!q || q.length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }

  db.all(
    `SELECT id, username, bio, avatar_url, affiliation
     FROM users
     WHERE username LIKE ? OR bio LIKE ?
     LIMIT ?`,
    [`%${q}%`, `%${q}%`, limit],
    (err, users) => {
      if (err) {
        return res.status(500).json({ error: 'Search failed' });
      }
      res.json(users);
    }
  );
});

// Search posts
app.get('/api/search/posts', authenticateToken, (req, res) => {
  const { q } = req.query;
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  if (!q || q.length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }

  db.all(
    `SELECT posts.*, users.username, users.affiliation, users.avatar_url,
            (SELECT COUNT(*) FROM likes WHERE post_id = posts.id) as like_count,
            (SELECT COUNT(*) FROM comments WHERE post_id = posts.id AND deleted = 0) as comment_count
     FROM posts
     JOIN users ON posts.user_id = users.id
     WHERE posts.content LIKE ? AND posts.deleted = 0
     ORDER BY posts.created_at DESC
     LIMIT ? OFFSET ?`,
    [`%${q}%`, limit, offset],
    (err, posts) => {
      if (err) {
        return res.status(500).json({ error: 'Search failed' });
      }
      res.json(posts);
    }
  );
});

// ========== REPORTS ROUTES ==========

// Report content
app.post('/api/reports', authenticateToken, [
  body('reason').isIn(['illegal', 'spam', 'harassment', 'other']),
  body('details').optional().isLength({ max: 1000 }).trim()
], (req, res) => {
  const { reported_user_id, post_id, comment_id, reason, details } = req.body;

  if (!reported_user_id && !post_id && !comment_id) {
    return res.status(400).json({ error: 'Must specify user, post, or comment to report' });
  }

  db.run(
    `INSERT INTO reports (reporter_id, reported_user_id, post_id, comment_id, reason, details)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [req.user.id, reported_user_id || null, post_id || null, comment_id || null, reason, details || ''],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to submit report' });
      }
      logActivity(req.user.id, 'report_content', 'report', this.lastID, req);
      res.status(201).json({ message: 'Report submitted successfully', id: this.lastID });
    }
  );
});

// Get user's reports
app.get('/api/reports/my', authenticateToken, (req, res) => {
  db.all(
    `SELECT reports.*, users.username as reported_username
     FROM reports
     LEFT JOIN users ON reports.reported_user_id = users.id
     WHERE reports.reporter_id = ?
     ORDER BY reports.created_at DESC`,
    [req.user.id],
    (err, reports) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to retrieve reports' });
      }
      res.json(reports);
    }
  );
});

// ========== ADMIN ROUTES ==========

// Get all reports (admin only)
app.get('/api/admin/reports', authenticateToken, requireAdmin, (req, res) => {
  const status = req.query.status || 'pending';
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  db.all(
    `SELECT reports.*,
            reporter.username as reporter_username,
            reported.username as reported_username
     FROM reports
     LEFT JOIN users as reporter ON reports.reporter_id = reporter.id
     LEFT JOIN users as reported ON reports.reported_user_id = reported.id
     WHERE reports.status = ?
     ORDER BY reports.created_at DESC
     LIMIT ? OFFSET ?`,
    [status, limit, offset],
    (err, reports) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to retrieve reports' });
      }
      res.json(reports);
    }
  );
});

// Review report (admin only)
app.put('/api/admin/reports/:id', authenticateToken, requireAdmin, [
  body('status').isIn(['pending', 'reviewed', 'actioned', 'dismissed']),
  body('action_taken').optional().trim()
], (req, res) => {
  const { id } = req.params;
  const { status, action_taken } = req.body;

  db.run(
    `UPDATE reports
     SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, action_taken = ?
     WHERE id = ?`,
    [status, req.user.id, action_taken || '', id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update report' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Report not found' });
      }
      logActivity(req.user.id, 'review_report', 'report', id, req);
      res.json({ message: 'Report updated successfully' });
    }
  );
});

// Delete content (admin only)
app.delete('/api/admin/posts/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;

  db.run(
    'UPDATE posts SET deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
    [id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete post' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }
      logActivity(req.user.id, 'admin_delete_post', 'post', id, req);
      res.json({ message: 'Post deleted successfully' });
    }
  );
});

// Ban user (admin only)
app.post('/api/admin/users/:id/ban', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;

  // In a real implementation, you'd add a 'banned' field to users table
  // For now, we'll just log the action
  logActivity(req.user.id, 'admin_ban_user', 'user', id, req);
  res.json({ message: 'User banned (implementation pending)' });
});

// Get platform statistics (admin only)
app.get('/api/admin/stats', authenticateToken, requireAdmin, (req, res) => {
  db.get(
    `SELECT
      (SELECT COUNT(*) FROM users) as total_users,
      (SELECT COUNT(*) FROM users WHERE created_at > datetime('now', '-7 days')) as new_users_week,
      (SELECT COUNT(*) FROM posts WHERE deleted = 0) as total_posts,
      (SELECT COUNT(*) FROM posts WHERE created_at > datetime('now', '-7 days') AND deleted = 0) as new_posts_week,
      (SELECT COUNT(*) FROM comments WHERE deleted = 0) as total_comments,
      (SELECT COUNT(*) FROM reports WHERE status = 'pending') as pending_reports`,
    (err, stats) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to retrieve stats' });
      }
      res.json(stats);
    }
  );
});

// ========== USER PROFILE ROUTES ==========

// Get user profile
app.get('/api/users/:username', authenticateToken, (req, res) => {
  const { username } = req.params;

  db.get(
    `SELECT id, username, bio, avatar_url, affiliation, is_verified, created_at
     FROM users WHERE username = ?`,
    [username],
    (err, user) => {
      if (err || !user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get stats
      db.get(
        `SELECT
          (SELECT COUNT(*) FROM posts WHERE user_id = ? AND deleted = 0) as post_count,
          (SELECT COUNT(*) FROM follows WHERE follower_id = ?) as following_count,
          (SELECT COUNT(*) FROM follows WHERE following_id = ?) as followers_count,
          (SELECT COUNT(*) > 0 FROM follows WHERE follower_id = ? AND following_id = ?) as is_following,
          (SELECT COUNT(*) > 0 FROM blocks WHERE blocker_id = ? AND blocked_id = ?) as is_blocked,
          (SELECT COUNT(*) > 0 FROM mutes WHERE muter_id = ? AND muted_id = ?) as is_muted`,
        [user.id, user.id, user.id, req.user.id, user.id, req.user.id, user.id, req.user.id, user.id],
        (err, stats) => {
          if (err) {
            return res.json(user);
          }
          res.json({ ...user, ...stats });
        }
      );
    }
  );
});

// Get user's posts
app.get('/api/users/:username/posts', authenticateToken, (req, res) => {
  const { username } = req.params;
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  db.get('SELECT id FROM users WHERE username = ?', [username], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    db.all(
      `SELECT posts.*, users.username, users.affiliation, users.avatar_url,
              (SELECT COUNT(*) FROM likes WHERE post_id = posts.id) as like_count,
              (SELECT COUNT(*) FROM comments WHERE post_id = posts.id AND deleted = 0) as comment_count,
              (SELECT COUNT(*) > 0 FROM likes WHERE post_id = posts.id AND user_id = ?) as liked_by_me
       FROM posts
       JOIN users ON posts.user_id = users.id
       WHERE posts.user_id = ? AND posts.deleted = 0
       ORDER BY posts.created_at DESC
       LIMIT ? OFFSET ?`,
      [req.user.id, user.id, limit, offset],
      (err, posts) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to retrieve posts' });
        }
        res.json(posts);
      }
    );
  });
});

// ========== ANALYTICS ROUTES ==========

// Get user analytics
app.get('/api/analytics/me', authenticateToken, (req, res) => {
  const userId = req.user.id;

  db.get(
    `SELECT
      (SELECT COUNT(*) FROM posts WHERE user_id = ? AND deleted = 0) as total_posts,
      (SELECT COUNT(*) FROM likes WHERE post_id IN (SELECT id FROM posts WHERE user_id = ?)) as total_likes_received,
      (SELECT COUNT(*) FROM comments WHERE post_id IN (SELECT id FROM posts WHERE user_id = ?) AND deleted = 0) as total_comments_received,
      (SELECT COUNT(*) FROM follows WHERE following_id = ?) as total_followers,
      (SELECT COUNT(*) FROM follows WHERE follower_id = ?) as total_following,
      (SELECT COUNT(*) FROM posts WHERE user_id = ? AND created_at > datetime('now', '-7 days') AND deleted = 0) as posts_last_week,
      (SELECT COUNT(*) FROM posts WHERE user_id = ? AND created_at > datetime('now', '-30 days') AND deleted = 0) as posts_last_month`,
    [userId, userId, userId, userId, userId, userId, userId],
    (err, analytics) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to retrieve analytics' });
      }

      // Get post performance over time
      db.all(
        `SELECT DATE(created_at) as date, COUNT(*) as count
         FROM posts
         WHERE user_id = ? AND created_at > datetime('now', '-30 days') AND deleted = 0
         GROUP BY DATE(created_at)
         ORDER BY date ASC`,
        [userId],
        (err, timeline) => {
          if (err) {
            return res.json(analytics);
          }
          res.json({ ...analytics, post_timeline: timeline });
        }
      );
    }
  );
});

// ========== GDPR / DATA EXPORT ROUTES ==========

// Export user data
app.get('/api/export/my-data', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    // Get user data
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    // Get posts
    const posts = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM posts WHERE user_id = ?', [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Get comments
    const comments = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM comments WHERE user_id = ?', [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Get messages
    const messages = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM direct_messages WHERE sender_id = ? OR recipient_id = ?', [userId, userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Get activity log
    const activity = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM activity_log WHERE user_id = ?', [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Remove sensitive data
    delete user.password_hash;
    delete user.two_factor_secret;
    delete user.verification_token;
    delete user.reset_token;

    const exportData = {
      user,
      posts,
      comments,
      messages,
      activity,
      exported_at: new Date().toISOString()
    };

    logActivity(userId, 'export_data', 'user', userId, req);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="user_data_${userId}_${Date.now()}.json"`);
    res.json(exportData);
  } catch (error) {
    logger.error('Data export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// Delete account
app.delete('/api/account', authenticateToken, [
  body('password').notEmpty(),
  body('confirmation').equals('DELETE MY ACCOUNT')
], async (req, res) => {
  const { password } = req.body;

  db.get('SELECT password_hash FROM users WHERE id = ?', [req.user.id], async (err, user) => {
    if (err || !user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Soft delete: anonymize user data
    db.run(
      `UPDATE users SET
        username = ?,
        email = ?,
        password_hash = '',
        bio = '',
        avatar_url = '',
        verification_token = NULL,
        reset_token = NULL,
        two_factor_secret = NULL,
        two_factor_enabled = 0
       WHERE id = ?`,
      [`deleted_user_${req.user.id}`, `deleted_${req.user.id}@deleted.com`, req.user.id],
      (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to delete account' });
        }

        // Soft delete posts and comments
        db.run('UPDATE posts SET deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE user_id = ?', [req.user.id]);
        db.run('UPDATE comments SET deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE user_id = ?', [req.user.id]);

        logActivity(req.user.id, 'delete_account', 'user', req.user.id, req);
        res.json({ message: 'Account deleted successfully' });
      }
    );
  });
});

// ========== UTILITY ROUTES ==========

// Get affiliations
app.get('/api/affiliations', (req, res) => {
  res.json(AFFILIATIONS);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running', timestamp: new Date().toISOString() });
});

// Get all posts (cross-bubble view)
app.get('/api/posts/all', authenticateToken, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  db.all(
    `SELECT posts.*, users.username, users.affiliation, users.avatar_url,
            (SELECT COUNT(*) FROM likes WHERE post_id = posts.id) as like_count,
            (SELECT COUNT(*) FROM comments WHERE post_id = posts.id AND deleted = 0) as comment_count,
            (SELECT COUNT(*) > 0 FROM likes WHERE post_id = posts.id AND user_id = ?) as liked_by_me
     FROM posts
     JOIN users ON posts.user_id = users.id
     WHERE posts.deleted = 0
       AND posts.user_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?)
       AND posts.user_id NOT IN (SELECT muted_id FROM mutes WHERE muter_id = ?)
     ORDER BY posts.created_at DESC
     LIMIT ? OFFSET ?`,
    [req.user.id, req.user.id, req.user.id, limit, offset],
    (err, posts) => {
      if (err) {
        logger.error('Failed to retrieve posts:', err);
        return res.status(500).json({ error: 'Failed to retrieve posts' });
      }
      res.json(posts);
    }
  );
});

// Get posts by affiliation
app.get('/api/posts/affiliation/:affiliation', authenticateToken, (req, res) => {
  const { affiliation } = req.params;
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  if (!AFFILIATIONS.includes(affiliation)) {
    return res.status(400).json({ error: 'Invalid affiliation' });
  }

  db.all(
    `SELECT posts.*, users.username, users.affiliation, users.avatar_url,
            (SELECT COUNT(*) FROM likes WHERE post_id = posts.id) as like_count,
            (SELECT COUNT(*) FROM comments WHERE post_id = posts.id AND deleted = 0) as comment_count
     FROM posts
     JOIN users ON posts.user_id = users.id
     WHERE users.affiliation = ? AND posts.deleted = 0
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

// Get my posts
app.get('/api/posts/my', authenticateToken, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  db.all(
    `SELECT posts.*, users.username, users.affiliation, users.avatar_url,
            (SELECT COUNT(*) FROM likes WHERE post_id = posts.id) as like_count,
            (SELECT COUNT(*) FROM comments WHERE post_id = posts.id AND deleted = 0) as comment_count
     FROM posts
     JOIN users ON posts.user_id = users.id
     WHERE posts.user_id = ? AND posts.deleted = 0
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

// ========== START SERVER ==========

function startServer() {
  server.listen(PORT, () => {
    logger.info(`╔════════════════════════════════════════════════════════════════╗`);
    logger.info(`║  Pepe Social Network - Comprehensive Edition                   ║`);
    logger.info(`╠════════════════════════════════════════════════════════════════╣`);
    logger.info(`║  Server running on: http://localhost:${PORT.toString().padEnd(29)}║`);
    logger.info(`║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(45)}║`);
    logger.info(`║  WebSocket: Enabled ${' '.repeat(39)}║`);
    logger.info(`║  Rate Limiting: Enabled ${' '.repeat(35)}║`);
    logger.info(`║  Logging: Winston (combined.log & error.log) ${' '.repeat(16)}║`);
    logger.info(`╠════════════════════════════════════════════════════════════════╣`);
    logger.info(`║  Features:                                                     ║`);
    logger.info(`║  ✓ User Authentication (JWT + 2FA)                             ║`);
    logger.info(`║  ✓ Affiliation-based Bubbles                                   ║`);
    logger.info(`║  ✓ Posts, Comments, Likes                                      ║`);
    logger.info(`║  ✓ Image Uploads                                               ║`);
    logger.info(`║  ✓ Direct Messaging                                            ║`);
    logger.info(`║  ✓ Follow/Block/Mute                                           ║`);
    logger.info(`║  ✓ Hashtags & Trending                                         ║`);
    logger.info(`║  ✓ Search & Discovery                                          ║`);
    logger.info(`║  ✓ Notifications (Real-time)                                   ║`);
    logger.info(`║  ✓ Bookmarks                                                   ║`);
    logger.info(`║  ✓ Content Reporting                                           ║`);
    logger.info(`║  ✓ Admin Panel                                                 ║`);
    logger.info(`║  ✓ Analytics Dashboard                                         ║`);
    logger.info(`║  ✓ GDPR Data Export                                            ║`);
    logger.info(`║  ✓ Email Verification & Password Reset                         ║`);
    logger.info(`╠════════════════════════════════════════════════════════════════╣`);
    logger.info(`║  Policy: No Moderation - Legal Content Only                    ║`);
    logger.info(`╚════════════════════════════════════════════════════════════════╝`);
    logger.info('');
    logger.info('Server ready. Press Ctrl+C to stop.');
  });
}

function closeServerAndDatabase(callback = () => {}) {
  server.close(() => {
    logger.info('HTTP server closed');
    db.close((err) => {
      if (err) {
        logger.error('Error closing database:', err);
      } else {
        logger.info('Database connection closed');
      }
      callback(err);
    });
  });
}

if (require.main === module) {
  startServer();

  // Graceful shutdown
  process.on('SIGINT', () => {
    logger.info('\nShutting down gracefully...');
    closeServerAndDatabase(() => process.exit(0));
  });

  process.on('SIGTERM', () => {
    logger.info('\nSIGTERM received. Shutting down gracefully...');
    closeServerAndDatabase(() => process.exit(0));
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });
}

module.exports = {
  app,
  server,
  io,
  db,
  logger,
  authenticateToken,
  requireAdmin,
  logActivity,
  createNotification,
  sendEmail,
  startServer,
  closeServerAndDatabase,
};
