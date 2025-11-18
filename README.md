# Pepe Social Network - Comprehensive Edition v2.0

A full-featured social media platform with affiliation-based content bubbles and zero content moderation. Built with modern web technologies for maximum freedom of expression within legal boundaries.

---

## Table of Contents

- [Philosophy](#philosophy)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Deployment](#deployment)
- [Legal Disclaimer](#legal-disclaimer)
- [Contributing](#contributing)

---

## Philosophy

**No Moderation Policy**: This platform operates on the principle that if content is legal, it is allowed. Users are responsible for their own posts. The only content that will be removed is content that is illegal under applicable law.

**Affiliation-Based Bubbles**: Users self-segregate into ideological communities, creating echo chambers by design. Each bubble operates independently while allowing cross-bubble viewing for those who choose it.

**User Empowerment**: Block, mute, and curate your own experience. The platform provides tools for users to control what they see, not what others can post.

---

## Features

### Core Features

#### Authentication & Security
- ✅ **JWT Authentication** - Secure token-based login (7-day expiration)
- ✅ **Two-Factor Authentication** - TOTP-based 2FA with QR code setup
- ✅ **Email Verification** - Confirm email addresses
- ✅ **Password Reset** - Secure token-based password recovery
- ✅ **bcrypt Hashing** - Industry-standard password security (10 rounds)
- ✅ **Rate Limiting** - Prevent abuse (100 req/15min general, 5 req/15min auth)
- ✅ **Security Headers** - Helmet.js protection

#### User Profiles
- ✅ **Custom Profiles** - Bio, avatar, affiliation display
- ✅ **Avatar Upload** - Image processing with Sharp (auto-resize to 200x200)
- ✅ **Profile Editing** - Update bio and personal information
- ✅ **User Statistics** - Post count, followers, following
- ✅ **Profile Viewing** - Public profile pages with user activity

#### Content Creation
- ✅ **Post Creation** - Up to 5000 characters
- ✅ **Image Uploads** - Support for JPEG, PNG, GIF, WebP (10MB limit)
- ✅ **Post Editing** - Edit your posts (marked as edited)
- ✅ **Post Deletion** - Soft delete with timestamp
- ✅ **Comments** - Threaded comments with nested replies
- ✅ **Comment Editing** - Edit your comments
- ✅ **Reposting** - Share others' content to your bubble

#### Engagement
- ✅ **Likes** - Like posts and comments
- ✅ **Bookmarks** - Save posts for later
- ✅ **Hashtags** - Automatic extraction and tracking
- ✅ **Mentions** - @username mentions with notifications
- ✅ **Trending** - Trending hashtags with customizable time windows
- ✅ **Like Counts** - Real-time engagement metrics
- ✅ **Comment Counts** - Post discussion activity

#### Social Network
- ✅ **Following** - Follow other users
- ✅ **Followers** - See who follows you
- ✅ **Following Feed** - Optional feed from followed users
- ✅ **User Discovery** - Find users by username or bio
- ✅ **Profile Stats** - Follower/following counts

#### Privacy & Control
- ✅ **Block Users** - Block users (removes all follows)
- ✅ **Mute Users** - Hide content from specific users
- ✅ **Private Messages** - Direct messaging system
- ✅ **Message Threads** - Conversation management
- ✅ **Read Receipts** - Message read status
- ✅ **Message Deletion** - Delete messages from your view

#### Discovery
- ✅ **Trending Hashtags** - See what's popular (configurable time window)
- ✅ **Hashtag Browse** - View all posts with a specific hashtag
- ✅ **User Search** - Find users by username or bio
- ✅ **Post Search** - Full-text search of post content
- ✅ **Affiliation Feeds** - Browse by political bubble
- ✅ **Cross-Bubble View** - Optional view of all affiliations

#### Notifications
- ✅ **Real-Time Notifications** - Instant via WebSocket
- ✅ **Notification Types** - Like, comment, follow, mention, repost, message
- ✅ **Unread Count** - Badge with unread notification count
- ✅ **Mark as Read** - Individual or bulk mark as read
- ✅ **Notification History** - View all past notifications

#### Reporting & Moderation
- ✅ **Content Reporting** - Report illegal content
- ✅ **Report Categories** - Illegal, spam, harassment, other
- ✅ **Report Tracking** - Status: pending, reviewed, actioned, dismissed
- ✅ **Admin Review** - Admin panel for reviewing reports
- ✅ **User Banning** - Admin user ban functionality (logged)
- ✅ **Content Removal** - Admin delete posts/comments

#### Admin Panel
- ✅ **Report Management** - View and review all reports
- ✅ **Content Moderation** - Delete illegal content
- ✅ **User Management** - Ban users
- ✅ **Platform Statistics** - User counts, post counts, reports
- ✅ **Activity Monitoring** - View system activity logs
- ✅ **Admin Actions** - All admin actions are logged

#### Analytics
- ✅ **User Analytics** - Personal stats dashboard
- ✅ **Engagement Metrics** - Likes received, comments, followers
- ✅ **Post Timeline** - 30-day posting activity chart
- ✅ **Platform Stats** - Total users, posts, growth metrics
- ✅ **Activity Tracking** - All user actions logged

#### GDPR Compliance
- ✅ **Data Export** - Complete JSON export of all user data
- ✅ **Account Deletion** - Soft delete with anonymization
- ✅ **Data Transparency** - Users can see all their data
- ✅ **Right to Be Forgotten** - Full account anonymization

#### Real-Time Features
- ✅ **WebSocket Support** - Socket.IO integration
- ✅ **Live Notifications** - Real-time notification delivery
- ✅ **Live Messages** - Instant message delivery
- ✅ **Live Post Updates** - New posts appear in real-time
- ✅ **Connection Status** - Real-time connection monitoring

#### Developer Features
- ✅ **Comprehensive Logging** - Winston logger (console + file)
- ✅ **Activity Logging** - All user actions with IP/user agent
- ✅ **Error Logging** - Separate error log file
- ✅ **Structured Logs** - JSON format for easy parsing
- ✅ **Request Validation** - express-validator integration
- ✅ **Input Sanitization** - XSS protection

---

## Affiliations

Users select their political/social affiliation at account creation and are placed in their corresponding bubble:

- **Conservative** - Traditional values, limited government
- **Liberal** - Progressive policies, social equality
- **Libertarian** - Maximum individual freedom, minimal government
- **Socialist** - Economic equality, collective ownership
- **Anarchist** - No hierarchical authority
- **Centrist** - Moderate, balanced approach
- **Apolitical** - Non-political, neutral stance

**Important**: Affiliation is **permanent** and cannot be changed after account creation.

---

## Tech Stack

### Backend
- **Node.js v14+** - JavaScript runtime
- **Express.js 4.x** - Web application framework
- **SQLite 3** - Embedded SQL database (upgradeable to PostgreSQL)
- **Socket.IO 4.x** - Real-time bidirectional communication
- **bcryptjs** - Password hashing (10 rounds)
- **jsonwebtoken** - JWT token generation/verification
- **Multer** - Multipart/form-data file upload handling
- **Sharp** - High-performance image processing
- **Nodemailer** - Email sending (SMTP)
- **Winston** - Logging library (file + console)
- **Helmet** - Security headers middleware
- **express-rate-limit** - Rate limiting middleware
- **express-validator** - Input validation and sanitization
- **Speakeasy** - TOTP two-factor authentication
- **QRCode** - QR code generation for 2FA setup
- **UUID** - Unique identifier generation
- **Compression** - Response compression middleware
- **CORS** - Cross-origin resource sharing

### Frontend
- **Vanilla JavaScript (ES6+)** - No frameworks required
- **HTML5** - Semantic markup
- **CSS3** - Modern styling with variables
- **Socket.IO Client** - Real-time updates
- **Fetch API** - HTTP requests
- **Responsive Design** - Mobile-first approach

### Database
- **SQLite 3** - Development and small deployments
- **PostgreSQL Ready** - Easy migration path for production

---

## Installation

### Prerequisites
- Node.js v14 or higher
- npm v6 or higher
- Git

### Quick Start

```bash
# 1. Clone the repository
git clone <repository-url>
cd select-or-left-or-right-or

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env and set JWT_SECRET to a secure random string

# 4. Initialize database
npm run init-db

# 5. Start the server
npm start

# For development with auto-reload
npm run dev

# 6. Open your browser
open http://localhost:3000
```

---

## Configuration

### Environment Variables

Edit `.env` file:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Security (REQUIRED)
JWT_SECRET=your-super-secret-key-change-this-in-production

# Email Configuration (Optional - for verification & password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password

# Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
AUTH_RATE_LIMIT_MAX=5

# File Uploads
MAX_FILE_SIZE=10485760  # 10MB in bytes
UPLOAD_DIR=./uploads

# Database
DATABASE_PATH=./social.db

# Optional
ENABLE_ANALYTICS=true
ADMIN_EMAIL=admin@example.com
```

### Email Setup (Optional)

For email verification and password reset:

1. **Gmail**: Use App Passwords
   - Enable 2FA on your Google account
   - Generate an App Password
   - Use that as `SMTP_PASS`

2. **Other SMTP**: Configure your provider's settings

**Note**: Email features are optional. If not configured, the app will log emails to console instead.

---

## Usage

### For Users

#### 1. Registration
1. Visit `http://localhost:3000/auth.html`
2. Click "Register" tab
3. Choose username, email, password
4. **Select your affiliation** (permanent choice)
5. Accept the no-moderation policy
6. Create account

#### 2. Posting Content
1. Login and navigate to feed
2. Write your post (up to 5000 characters)
3. Optional: Upload an image
4. Click "Post"
5. Post appears in your bubble's feed

#### 3. Interacting
- **Like**: Click heart icon on posts/comments
- **Comment**: Click comment icon, write reply
- **Repost**: Share to your bubble
- **Bookmark**: Save for later
- **Follow**: Visit profile, click follow
- **Message**: Send direct message

#### 4. Managing Your Experience
- **Block**: User menu → Block (removes all follows)
- **Mute**: User menu → Mute (hides their content)
- **Report**: Report button → Select reason

#### 5. Feed Views
- **My Bubble**: Default - only your affiliation
- **My Posts**: Your personal content
- **All Bubbles**: Cross-affiliation view
- **Following**: Feed from users you follow

---

## API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication

All authenticated routes require `Authorization` header:
```
Authorization: Bearer <JWT_TOKEN>
```

### Public Endpoints

#### Register
```http
POST /api/register
Content-Type: application/json

{
  "username": "string (3-30 chars)",
  "email": "valid@email.com",
  "password": "string (min 6 chars)",
  "affiliation": "Conservative|Liberal|Libertarian|Socialist|Anarchist|Centrist|Apolitical"
}

Response: 201
{
  "message": "User created successfully",
  "token": "jwt_token",
  "user": { ...userObject }
}
```

#### Login
```http
POST /api/login
Content-Type: application/json

{
  "username": "string",
  "password": "string"
}

Response: 200
{
  "message": "Login successful",
  "token": "jwt_token",
  "user": { ...userObject }
}
```

### User Endpoints

#### Get Current User
```http
GET /api/me
Authorization: Bearer {token}

Response: 200
{
  "id": 1,
  "username": "user",
  "email": "user@example.com",
  "affiliation": "Conservative",
  "bio": "My bio",
  "avatar_url": "/uploads/avatar_1.jpg",
  "post_count": 42,
  "following_count": 10,
  "followers_count": 15
}
```

#### Update Profile
```http
PUT /api/profile
Authorization: Bearer {token}
Content-Type: application/json

{
  "bio": "New bio (max 500 chars)"
}

Response: 200
{
  "message": "Profile updated successfully"
}
```

#### Upload Avatar
```http
POST /api/upload-avatar
Authorization: Bearer {token}
Content-Type: multipart/form-data

avatar: <image file>

Response: 200
{
  "message": "Avatar uploaded successfully",
  "avatar_url": "/uploads/avatar_1.jpg?v=12345"
}
```

### Post Endpoints

#### Create Post
```http
POST /api/posts
Authorization: Bearer {token}
Content-Type: multipart/form-data

content: "Post content (1-5000 chars)"
image: <optional image file>

Response: 201
{
  "id": 1,
  "user_id": 1,
  "content": "Post content",
  "image_url": "/uploads/post_abc123.jpg",
  "username": "user",
  "affiliation": "Conservative",
  "avatar_url": "/uploads/avatar_1.jpg",
  "created_at": "2025-01-01T12:00:00.000Z"
}
```

#### Get Feed (My Bubble)
```http
GET /api/feed?limit=50&offset=0
Authorization: Bearer {token}

Response: 200
[
  {
    "id": 1,
    "content": "Post content",
    "like_count": 5,
    "comment_count": 3,
    "liked_by_me": true,
    "bookmarked_by_me": false,
    ...
  }
]
```

#### Get All Posts (Cross-Bubble)
```http
GET /api/posts/all?limit=50&offset=0
Authorization: Bearer {token}

Response: 200
[ ...posts from all affiliations ]
```

#### Like/Unlike Post
```http
POST /api/posts/:id/like
Authorization: Bearer {token}

Response: 200
{
  "message": "Post liked",
  "liked": true
}
```

#### Comment on Post
```http
POST /api/posts/:id/comments
Authorization: Bearer {token}
Content-Type: application/json

{
  "content": "Comment text (1-1000 chars)",
  "parent_comment_id": null // or ID for nested reply
}

Response: 201
{
  "id": 1,
  "post_id": 1,
  "content": "Comment text",
  "username": "user",
  ...
}
```

### Social Endpoints

#### Follow/Unfollow User
```http
POST /api/users/:id/follow
Authorization: Bearer {token}

Response: 200
{
  "message": "Followed successfully",
  "following": true
}
```

#### Block User
```http
POST /api/users/:id/block
Authorization: Bearer {token}

Response: 200
{
  "message": "User blocked successfully"
}
```

#### Send Direct Message
```http
POST /api/messages
Authorization: Bearer {token}
Content-Type: application/json

{
  "recipient_id": 2,
  "content": "Message text (1-2000 chars)"
}

Response: 201
{
  "message": "Message sent successfully",
  "id": 1
}
```

### Discovery Endpoints

#### Search Users
```http
GET /api/search/users?q=searchterm&limit=20
Authorization: Bearer {token}

Response: 200
[
  {
    "id": 2,
    "username": "otheruser",
    "bio": "User bio",
    "avatar_url": "/uploads/avatar_2.jpg",
    "affiliation": "Liberal"
  }
]
```

#### Trending Hashtags
```http
GET /api/hashtags/trending?hours=24&limit=20
Authorization: Bearer {token}

Response: 200
[
  { "tag": "politics", "count": 150 },
  { "tag": "news", "count": 98 }
]
```

### Admin Endpoints

#### Get All Reports
```http
GET /api/admin/reports?status=pending&limit=50
Authorization: Bearer {token}
Requires: Admin privileges

Response: 200
[
  {
    "id": 1,
    "reason": "illegal",
    "details": "Description",
    "reporter_username": "user1",
    "reported_username": "user2",
    "status": "pending",
    ...
  }
]
```

### Analytics Endpoints

#### Get User Analytics
```http
GET /api/analytics/me
Authorization: Bearer {token}

Response: 200
{
  "total_posts": 42,
  "total_likes_received": 150,
  "total_comments_received": 65,
  "total_followers": 15,
  "posts_last_week": 5,
  "post_timeline": [
    { "date": "2025-01-01", "count": 3 },
    ...
  ]
}
```

### GDPR Endpoints

#### Export All Data
```http
GET /api/export/my-data
Authorization: Bearer {token}

Response: 200 (application/json)
Downloads: user_data_1_1234567890.json
{
  "user": { ...profile },
  "posts": [ ...all posts ],
  "comments": [ ...all comments ],
  "messages": [ ...all messages ],
  "activity": [ ...activity log ],
  "exported_at": "2025-01-01T12:00:00.000Z"
}
```

---

## Database Schema

### Tables (14 total)

#### users
```sql
id, username, email, password_hash, affiliation, bio, avatar_url,
is_admin, is_verified, email_verified, verification_token, reset_token,
reset_token_expires, two_factor_secret, two_factor_enabled,
created_at, updated_at
```

#### posts
```sql
id, user_id, content, image_url, is_repost, original_post_id,
edited, edited_at, deleted, deleted_at, created_at, updated_at
```

#### comments
```sql
id, post_id, user_id, parent_comment_id, content,
edited, edited_at, deleted, deleted_at, created_at, updated_at
```

#### likes
```sql
id, user_id, post_id, comment_id, created_at
```

#### follows
```sql
id, follower_id, following_id, created_at
```

#### blocks
```sql
id, blocker_id, blocked_id, created_at
```

#### mutes
```sql
id, muter_id, muted_id, created_at
```

#### direct_messages
```sql
id, sender_id, recipient_id, content, read, read_at,
deleted_by_sender, deleted_by_recipient, created_at
```

#### bookmarks
```sql
id, user_id, post_id, created_at
```

#### hashtags
```sql
id, tag, created_at
```

#### post_hashtags
```sql
id, post_id, hashtag_id, created_at
```

#### notifications
```sql
id, user_id, type, actor_id, post_id, comment_id,
message, read, created_at
```

#### reports
```sql
id, reporter_id, reported_user_id, post_id, comment_id,
reason, details, status, reviewed_by, reviewed_at,
action_taken, created_at
```

#### activity_log
```sql
id, user_id, action, entity_type, entity_id,
ip_address, user_agent, created_at
```

### Indexes (18 total)
Optimized indexes on all foreign keys, search columns, and frequently queried fields.

---

## Deployment

### Development
```bash
npm run dev  # Nodemon auto-reload
```

### Production

#### Option 1: VPS (DigitalOcean, Linode, AWS EC2)

```bash
# 1. Clone and setup
git clone <repo>
cd select-or-left-or-right-or
npm install --production

# 2. Configure environment
cp .env.example .env
nano .env  # Set production values

# 3. Initialize database
npm run init-db

# 4. Install PM2
npm install -g pm2

# 5. Start with PM2
pm2 start server.js --name pepe-social
pm2 save
pm2 startup  # Follow instructions

# 6. Setup Nginx reverse proxy
sudo apt install nginx
# Configure nginx to proxy to localhost:3000

# 7. SSL with Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

#### Option 2: Heroku

```bash
# 1. Create Heroku app
heroku create your-app-name

# 2. Set environment variables
heroku config:set JWT_SECRET=your-secret-key
heroku config:set NODE_ENV=production

# 3. Deploy
git push heroku main

# 4. Initialize database
heroku run npm run init-db
```

#### Option 3: Railway / Render / Fly.io

1. Connect GitHub repository
2. Set environment variables in dashboard
3. Deploy automatically on push

### Database Migration (SQLite → PostgreSQL)

For production, PostgreSQL is recommended:

1. Install `pg` package: `npm install pg`
2. Update database connection in `server.js`
3. Adjust SQL syntax (mainly date functions)
4. Migrate data using pgloader or custom script

---

## Legal Disclaimer

### Platform Policy

This platform implements a **"no moderation"** policy where any content that is legal in the applicable jurisdiction is allowed. This means:

### ⚠️ IMPORTANT LEGAL CONSIDERATIONS

1. **No Content Moderation**
   - Platform does not pre-moderate or filter content
   - Users are solely responsible for their own posts
   - Platform operates as a neutral conduit for speech

2. **Legal Obligations**
   - Only content illegal under applicable law will be removed
   - Platform logs all activity for potential legal compliance
   - Report system exists for flagging potentially illegal content
   - Admin panel allows removal of illegal content

3. **Operator Responsibilities**
   - Consult with legal counsel before deploying
   - Understand liability laws in your jurisdiction
   - Implement DMCA compliance procedures
   - Consider terms of service and user agreements
   - Implement age verification if required
   - Understand defamation/libel laws
   - Consider hate speech laws in your jurisdiction

4. **User Privacy**
   - GDPR compliance features included
   - Activity logging for legal compliance
   - Data export functionality
   - Account deletion with anonymization

5. **Section 230 (US) / Similar Protections**
   - May not apply to all content types
   - Does not protect against illegal content
   - Does not protect against IP violations

### Recommended Actions Before Launch

1. **Legal Review**
   - Have a lawyer review your deployment
   - Create comprehensive Terms of Service
   - Create Privacy Policy
   - Create acceptable use policy (legal boundaries)

2. **Technical Measures**
   - Implement content hash matching (CSAM prevention)
   - Add IP logging for legal requests
   - Consider geographic restrictions
   - Implement legal compliance workflows

3. **Operational Procedures**
   - Define illegal content removal process
   - Create legal request response procedures
   - Establish admin team and training
   - Monitor reports actively

### Disclaimer

**THIS SOFTWARE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND.** The authors and contributors are not responsible for:
- Content posted by users
- Legal liabilities arising from platform use
- Compliance with local, state, or federal laws
- Any damages arising from platform operation

**USE AT YOUR OWN RISK**. Deploy only if you understand and accept all legal implications.

---

## Contributing

### Development Setup

```bash
# Fork and clone
git clone <your-fork>
cd select-or-left-or-right-or

# Install dependencies
npm install

# Create feature branch
git checkout -b feature/your-feature

# Make changes and test
npm run dev

# Commit with descriptive message
git add .
git commit -m "Add: your feature description"

# Push and create pull request
git push origin feature/your-feature
```

### Code Style

- Use ES6+ features
- Follow existing code structure
- Add comments for complex logic
- Validate all inputs
- Log important actions
- Handle errors gracefully

### Feature Suggestions

Open an issue with:
- Clear description of feature
- Use case/justification
- Proposed implementation (if technical)

---

## Roadmap

### Planned Features

- [ ] Mobile apps (React Native)
- [ ] Push notifications
- [ ] Video uploads
- [ ] Voice/video calls
- [ ] Group chats
- [ ] Custom bubble creation
- [ ] Federation (ActivityPub)
- [ ] Blockchain integration
- [ ] Cryptocurrency tipping
- [ ] NFT profile pictures
- [ ] Advanced analytics
- [ ] Machine learning recommendations
- [ ] Content translation
- [ ] Accessibility improvements

---

## Credits

Built with modern web technologies and a commitment to free speech within legal boundaries.

### Technologies
- Node.js
- Express.js
- Socket.IO
- SQLite
- Sharp
- Winston
- And many more (see package.json)

---

## License

MIT License - See LICENSE file for details

---

## Support

For issues, questions, or feature requests:
- Open an issue on GitHub
- Check existing documentation
- Review API documentation above

---

## Acknowledgments

This platform prioritizes freedom of expression while respecting legal boundaries. Users are empowered to curate their own experience through blocking, muting, and bubble selection.

Remember: **With great freedom comes great responsibility.**

---

**Built for those who value free speech. Use responsibly.**
