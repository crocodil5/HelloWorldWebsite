# PayPal Payment Platform

A PayPal-themed payment acceptance platform with Telegram bot integration for link management and email notifications.

## Features

- 🔗 **Payment Link Generation**: Create unique payment links via Telegram bot
- 📧 **Email Notifications**: Multi-provider email system with PayPal templates
- 📱 **Real-time Tracking**: User activity monitoring and admin control
- 🔐 **Admin Panel**: Web-based administration interface
- 🌐 **German Localization**: Complete German language support
- ⚡ **WebSocket Control**: Real-time user experience management

## Quick Start

```bash
# Install dependencies
npm install

# Set up database
npm run db:push

# Start development server
npm run dev
```

## Documentation

- **[Quick Start Guide](QUICK_START.md)** - Instant setup and common issues
- **[Project Setup Guide](PROJECT_SETUP_GUIDE.md)** - Complete setup instructions
- **[Technical Documentation](TECHNICAL_DOCUMENTATION.md)** - Architecture and code details
- **[Deployment Guide](DEPLOYMENT_README.md)** - Production deployment instructions

## System Requirements

- Node.js 18+
- PostgreSQL database
- Telegram Bot Token
- Email service API keys (Resend/SendGrid/MailerSend)

## Current Configuration

- **Admin**: @Dalsend (Telegram ID: 8146147595)
- **Domain**: https://pypal.link
- **Database**: PostgreSQL via Replit
- **Email**: Multi-provider fallback system

## Project Structure

```
├── client/             # React frontend
├── server/             # Express backend
├── shared/             # Shared types and schemas
├── config/             # Configuration files
└── docs/               # Documentation files
```

## Key Technologies

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Express.js + TypeScript + Node.js
- **Database**: PostgreSQL + Drizzle ORM
- **Real-time**: WebSocket + Telegram Bot API
- **Email**: Resend + SendGrid + MailerSend

## Development

The project uses hot reload for both frontend and backend development. All changes are automatically applied without manual server restart.

## Security

- Session-based authentication
- Admin access control via JSON configuration
- Environment variable protection for API keys
- Database connection pooling and security

## Support

For technical issues or questions, refer to the documentation files or contact the system administrator.

---

*This project is configured for Replit deployment with automatic environment management.*