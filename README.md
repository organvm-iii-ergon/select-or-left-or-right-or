# Pepe Social Network

A social media platform with affiliation-based content bubbles and zero content moderation.

## Philosophy

**No Moderation Policy**: This platform operates on the principle that if content is legal, it is allowed. Users are responsible for their own posts. The only content that will be removed is content that is illegal under applicable law.

## Features

- **Affiliation-Based Bubbles**: Users select their political/social affiliation at account creation
- **Isolated Feeds**: By default, users only see posts from others in their bubble
- **Cross-Bubble Viewing**: Optional ability to view posts from all affiliations
- **JWT Authentication**: Secure login system with token-based auth
- **Real-time Feed**: Posts appear instantly in your bubble's feed
- **No Content Moderation**: Community-driven with legal boundaries only

## Affiliations

Users can select from these bubbles:
- Conservative
- Liberal
- Libertarian
- Socialist
- Anarchist
- Centrist
- Apolitical

**Note**: Affiliation cannot be changed after account creation.

## Tech Stack

### Backend
- **Node.js** + **Express** - Server framework
- **SQLite** - Database (easily upgradeable to PostgreSQL)
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT authentication
- **body-parser** - Request parsing
- **cors** - Cross-origin resource sharing

### Frontend
- **Vanilla JavaScript** - No frameworks
- **HTML5 + CSS3** - Modern web standards
- **Responsive Design** - Mobile-friendly

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm (comes with Node.js)

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd select-or-left-or-right-or
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# Copy the example .env file
cp .env.example .env

# Edit .env and change JWT_SECRET to a secure random string
nano .env
```

4. Initialize the database:
```bash
npm run init-db
```

5. Start the server:
```bash
# Production
npm start

# Development (with auto-reload)
npm run dev
```

6. Open your browser:
```
http://localhost:3000
```

## Usage

### For Users

1. **Register**: Visit `http://localhost:3000/auth.html`
   - Choose a username and password
   - Select your affiliation (bubble)
   - **Important**: You cannot change your affiliation later

2. **Login**: Return visitors use the login tab

3. **Post Content**:
   - Navigate to your feed at `http://localhost:3000/feed.html`
   - Share your thoughts (up to 5000 characters)
   - Your posts are visible to everyone in your bubble

4. **View Feeds**:
   - **My Bubble**: See posts only from your affiliation
   - **My Posts**: See your own posts
   - **All Bubbles**: View posts from all affiliations

### API Endpoints

#### Public Endpoints
- `GET /api/health` - Health check
- `GET /api/affiliations` - Get list of available affiliations
- `POST /api/register` - Register new user
- `POST /api/login` - Login and get JWT token

#### Protected Endpoints (Require JWT)
- `GET /api/me` - Get current user info
- `POST /api/posts` - Create a new post
- `GET /api/feed` - Get posts from your bubble
- `GET /api/posts/all` - Get posts from all bubbles
- `GET /api/posts/my` - Get your own posts
- `GET /api/posts/affiliation/:affiliation` - Get posts from specific bubble

## Database Schema

### Users Table
```sql
id              INTEGER PRIMARY KEY
username        TEXT UNIQUE NOT NULL
email           TEXT UNIQUE NOT NULL
password_hash   TEXT NOT NULL
affiliation     TEXT NOT NULL
created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
```

### Posts Table
```sql
id              INTEGER PRIMARY KEY
user_id         INTEGER NOT NULL (FK -> users.id)
content         TEXT NOT NULL
created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
```

## Security

- Passwords are hashed with bcrypt (10 rounds)
- JWT tokens expire after 7 days
- SQL injection protection via parameterized queries
- CORS enabled for cross-origin requests
- XSS protection via HTML escaping in frontend

## Deployment

### GitHub Pages (Frontend Only)
The static pages (index.html, etc.) can be served via GitHub Pages, but you'll need a separate backend server.

### Full Stack Deployment Options

1. **Heroku**:
```bash
# Add Heroku remote
heroku create your-app-name

# Add environment variables
heroku config:set JWT_SECRET=your-secret-key
heroku config:set NODE_ENV=production

# Deploy
git push heroku main
```

2. **DigitalOcean / AWS / VPS**:
- Install Node.js on server
- Clone repository
- Install dependencies
- Set environment variables
- Use PM2 to keep server running
- Configure nginx as reverse proxy

3. **Railway / Render / Fly.io**:
- Connect GitHub repository
- Set environment variables in dashboard
- Deploy automatically on push

### Production Considerations

1. **Database**: Switch from SQLite to PostgreSQL for better concurrency:
```bash
npm install pg
# Update database connection in server.js
```

2. **Environment Variables**: Use strong JWT_SECRET in production

3. **HTTPS**: Always use HTTPS in production (Let's Encrypt)

4. **Rate Limiting**: Add rate limiting to prevent abuse:
```bash
npm install express-rate-limit
```

5. **Logging**: Add proper logging:
```bash
npm install winston
```

## Legal Disclaimer

This platform implements a "no moderation" policy where any legal content is allowed. Platform operators should:

1. **Consult Legal Counsel**: Understand liability in your jurisdiction
2. **Terms of Service**: Create comprehensive ToS
3. **Illegal Content Reporting**: Implement a system to report and remove illegal content
4. **DMCA Compliance**: Handle copyright claims appropriately
5. **User Privacy**: Comply with GDPR, CCPA, and other privacy laws

**This software is provided as-is with no warranties. Use at your own risk.**

## Contributing

This is a demonstration project. For production use, consider:
- Adding comment/reply functionality
- Implementing block/mute features
- Adding image/video upload
- Implementing search functionality
- Adding user profiles
- Adding direct messaging
- Implementing reporting system for illegal content
- Adding email verification
- Implementing password reset
- Adding 2FA authentication

## License

MIT License - See LICENSE file for details

## Support

For issues and questions, please open an issue on GitHub.

---

**Remember**: With great freedom comes great responsibility. This platform enables free speech, but users must respect the law and each other's humanity.
