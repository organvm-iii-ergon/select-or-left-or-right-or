# CLAUDE.md — select-or-left-or-right-or

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**Pepe Social Network** — satirical affiliation-based social network. Users join political/cultural "bubbles" (affiliations); content is filtered and colored by affiliation. Full-stack Node.js + SQLite app with real-time Socket.io, JWT auth, 2FA (TOTP), and image processing.

## Commands

```bash
npm install          # Install dependencies
npm run init-db      # Initialize SQLite database (run once)
npm start            # Production server (node server.js)
npm run dev          # Dev server with hot reload (nodemon server.js)
npm run clean-db     # Reset database: rm social.db && npm run init-db
```

## Architecture

**Backend** (`server.js`): Express.js + Socket.io + SQLite3 monolith.
- Auth: JWT + bcryptjs + speakeasy (TOTP 2FA) + QRCode
- Real-time: Socket.io for feed/notifications
- Media: multer (uploads) + sharp (image processing)
- Security: helmet, rate-limit, express-validator, compression
- Logging: winston
- Affiliations: defined in `src/lib/utils.js` (`AFFILIATIONS` enum, `NOTIFICATION_TYPES`)

**Database** (`scripts/init-db.js`): SQLite3. Uploads stored in `uploads/` directory.

**Frontend**: Static HTML pages (no framework). Each file is a different screen/role:
- `index.html` — Landing/login
- `feed.html` — Main affiliation-filtered feed
- `auth.html` — Authentication flow
- Role-specific pages: `president.html`, `vicepresident.html`, `chiefofstaff.html`, etc.
- `buy.html`, `shop.html` — Commerce pages
- `endorsements.html`, `coordination.html` — Political coordination

**No formal test suite**. CNAME present (custom domain configured).

<!-- ORGANVM:AUTO:START -->
<!-- ORGANVM:AUTO:END -->
