# Migration Troubleshooting Guide

## Common Issues When Moving Project to New Server

This guide addresses the most common problems you'll encounter when transferring the PayPal payment platform to a new server environment.

## Issue 1: Port Already in Use (EADDRINUSE)

### Error Message
```
Error: listen EADDRINUSE: address already in use 0.0.0.0:5000
```

### Immediate Solution
```bash
# Kill process using port 5000
kill -9 $(lsof -t -i:5000) 2>/dev/null || true

# Or use different port
PORT=4000 npm run dev
```

### Detailed Solution
See [PORT_CONFLICT_SOLUTION.md](PORT_CONFLICT_SOLUTION.md) for complete instructions.

## Issue 2: Telegram Bot Polling Conflicts

### Error Message
```
⚠️ Polling error: ETELEGRAM - ETELEGRAM: 409 Conflict: terminated by other getUpdates request
```

### Immediate Solution
```bash
# Stop all Node.js processes
pkill -f node
sleep 5

# Reset bot webhook
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/deleteWebhook"

# Restart application
npm run dev
```

### Detailed Solution
See [TELEGRAM_BOT_CONFLICTS.md](TELEGRAM_BOT_CONFLICTS.md) for complete instructions.

## Issue 3: Database Connection Failed

### Error Message
```
Database connection failed
Error: connect ECONNREFUSED
```

### Solution
```bash
# Check DATABASE_URL environment variable
echo $DATABASE_URL

# If missing, set it:
export DATABASE_URL="postgresql://user:password@host:port/database"

# Push database schema
npm run db:push
```

## Issue 4: Missing Environment Variables

### Error Message
```
❌ TELEGRAM_BOT_TOKEN is not set
```

### Solution
Create `.env` file:
```env
DATABASE_URL=postgresql://...
TELEGRAM_BOT_TOKEN=your_bot_token
RESEND_API_KEY=your_resend_key
SENDGRID_API_KEY=your_sendgrid_key
MAILERSEND_API_KEY=your_mailersend_key
```

## Issue 5: Node Modules or Dependencies Issues

### Error Message
```
Module not found: Error: Can't resolve 'xyz'
```

### Solution
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# If still failing, check Node.js version
node --version  # Should be 18+
```

## Issue 6: Permission Denied

### Error Message
```
Error: EACCES: permission denied
```

### Solution
```bash
# Fix file permissions
chmod -R 755 .
chown -R $USER:$USER .

# For specific files
chmod +x server/index.ts
```

## Issue 7: TypeScript Compilation Errors

### Error Message
```
Error: Cannot find module 'tsx'
```

### Solution
```bash
# Install tsx globally
npm install -g tsx

# Or install project dependencies
npm install
```

## Complete Migration Checklist

### Pre-Migration Preparation
- [ ] Stop all services on old server
- [ ] Export database if needed
- [ ] Note down all environment variables
- [ ] Document current admin configuration

### Server Setup
- [ ] Install Node.js 18+
- [ ] Install npm/yarn
- [ ] Set up PostgreSQL database
- [ ] Configure firewall rules

### Project Setup
```bash
# 1. Copy project files
git clone <repository> # or copy files manually

# 2. Install dependencies
npm install

# 3. Set environment variables
cp .env.example .env
# Edit .env with your values

# 4. Set up database
npm run db:push

# 5. Check admin configuration
cat config/admins.json
# Should contain your Telegram ID

# 6. Test start (may have port conflict)
npm run dev
```

### Conflict Resolution
```bash
# If port conflict
PORT=4000 npm run dev

# If Telegram bot conflict
curl -X POST "https://api.telegram.org/bot<TOKEN>/deleteWebhook"
pkill -f node
npm run dev

# If database issues
npm run db:push
```

### Verification Steps
```bash
# Test web interface
curl http://localhost:4000

# Test API endpoints
curl -X POST http://localhost:4000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# Test Telegram bot
curl -X POST http://localhost:4000/api/test-telegram-notification \
  -H "Content-Type: application/json" -d '{}'
```

## Emergency Recovery Script

Create this script as `recover.sh`:

```bash
#!/bin/bash

echo "🚨 Emergency Recovery Script"

# Kill all node processes
echo "Stopping all Node.js processes..."
pkill -f node
sleep 3

# Reset Telegram bot
echo "Resetting Telegram bot..."
if [ ! -z "$TELEGRAM_BOT_TOKEN" ]; then
    curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/deleteWebhook"
fi

# Clear port conflicts
echo "Clearing port conflicts..."
kill -9 $(lsof -t -i:5000) 2>/dev/null || true
kill -9 $(lsof -t -i:4000) 2>/dev/null || true
kill -9 $(lsof -t -i:3000) 2>/dev/null || true

# Clear cache
echo "Clearing cache..."
rm -rf node_modules/.cache
rm -rf dist/

# Reinstall dependencies
echo "Reinstalling dependencies..."
npm install

# Set up database
echo "Setting up database..."
npm run db:push

# Find available port
for port in 4000 4001 5000 5001 8000 8001; do
    if ! lsof -i :$port >/dev/null 2>&1; then
        echo "Using port $port"
        export PORT=$port
        break
    fi
done

# Start application
echo "Starting application..."
npm run dev
```

Make it executable:
```bash
chmod +x recover.sh
./recover.sh
```

## Platform-Specific Notes

### Replit
- Ports are managed automatically
- Environment variables set in Secrets tab
- Database provided automatically

### VPS/Dedicated Server
- Install Node.js and PostgreSQL manually
- Configure firewall (ufw allow 5000)
- Set up reverse proxy (nginx) for production

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["npm", "run", "dev"]
```

### Heroku/Railway
- Use `process.env.PORT` (automatic)
- Set environment variables in dashboard
- Use PostgreSQL addon

## Success Indicators

After successful migration, you should see:
```
🔑 Using bot token: 8091277468...
✅ Production mode: Starting Telegram bot
Admin system initialized with 1 admin(s): 8146147595
✅ Telegram bot started successfully!
Database connection successful
4:25:09 PM [express] serving on port 5000
```

## Getting Help

If issues persist:

1. Check all documentation files:
   - `README.md`
   - `QUICK_START.md`
   - `PROJECT_SETUP_GUIDE.md`
   - `TECHNICAL_DOCUMENTATION.md`

2. Review specific issue guides:
   - `PORT_CONFLICT_SOLUTION.md`
   - `TELEGRAM_BOT_CONFLICTS.md`

3. Test individual components:
   - Database connection
   - Telegram bot
   - Email system
   - Admin panel

4. Check logs for specific error messages

Remember: Most migration issues are related to environment variables, port conflicts, or multiple process instances. The solutions above should resolve 90% of transfer problems.