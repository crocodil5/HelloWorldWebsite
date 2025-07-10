# Port Conflict Solution - EADDRINUSE Error

## Problem Description

When transferring the project to a new server, you may encounter this error:

```
Error: listen EADDRINUSE: address already in use 0.0.0.0:5000
```

This means port 5000 is already occupied by another process on the server.

## Quick Solutions

### Solution 1: Kill Process Using Port 5000
```bash
# Find process using port 5000
lsof -i :5000
# or
netstat -tlnp | grep :5000
# or
ss -tlnp | grep :5000

# Kill the process (replace PID with actual process ID)
kill -9 PID

# Then restart the application
npm run dev
```

### Solution 2: Use Different Port
```bash
# Set PORT environment variable
export PORT=3000
npm run dev

# Or run with inline environment variable
PORT=3000 npm run dev
```

### Solution 3: Modify Server Configuration
Edit `server/index.ts` to use dynamic port:

```typescript
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
```

## Detailed Troubleshooting Steps

### Step 1: Check What's Using Port 5000
```bash
# Linux/macOS
lsof -i :5000

# Windows
netstat -ano | findstr :5000
```

### Step 2: Common Port Conflicts
- **Another instance of this app**: Check if you accidentally started the app twice
- **Other development servers**: React dev server, other Express apps
- **System services**: Some Linux distributions use port 5000 for system services
- **Docker containers**: Check if any containers are using port 5000

### Step 3: Find Alternative Ports
```bash
# Check available ports
netstat -tlnp | grep -E ':(3000|3001|4000|4001|5000|5001|8000|8001)'

# Common alternative ports for development:
# 3000, 3001, 4000, 4001, 5001, 8000, 8001, 8080
```

### Step 4: Environment-Specific Solutions

#### For Replit
```bash
# Replit automatically assigns ports, usually works without issues
# But if you see this error, try:
pkill -f "node.*server"
npm run dev
```

#### For Local Development
```bash
# Kill all Node.js processes
pkill -f node

# Or more specifically for this project
pkill -f "tsx server/index.ts"

# Then restart
npm run dev
```

#### For Linux Servers
```bash
# Check if port 5000 is reserved by system
cat /etc/services | grep 5000

# If it's a system service, use different port
export PORT=4000
npm run dev
```

#### For Docker/Container Environments
```bash
# Check Docker containers using port 5000
docker ps | grep 5000

# Stop conflicting container
docker stop CONTAINER_ID

# Or use different port mapping
docker run -p 4000:5000 your-app
```

## Permanent Solutions

### Option 1: Configure Dynamic Port in Code
Update `server/index.ts`:

```typescript
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

const httpServer = await registerRoutes(app);
httpServer.listen(PORT, HOST, () => {
  log(`serving on port ${PORT}`);
});
```

### Option 2: Use Environment File
Create `.env` file:
```env
PORT=4000
HOST=0.0.0.0
```

### Option 3: Package.json Scripts
Update `package.json`:
```json
{
  "scripts": {
    "dev": "NODE_ENV=development PORT=4000 tsx server/index.ts",
    "start": "NODE_ENV=production PORT=4000 tsx server/index.ts"
  }
}
```

## Prevention Tips

### 1. Always Check Port Availability
```bash
# Before starting the app
lsof -i :5000 || echo "Port 5000 is free"
```

### 2. Use Process Managers
```bash
# Install PM2 for production
npm install -g pm2

# Start with PM2
pm2 start "npm run dev" --name "paypal-app"

# Stop
pm2 stop paypal-app
```

### 3. Configure systemd Service (Linux)
Create `/etc/systemd/system/paypal-app.service`:
```ini
[Unit]
Description=PayPal App
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/project
Environment=NODE_ENV=production
Environment=PORT=4000
ExecStart=/usr/bin/npm run start
Restart=always

[Install]
WantedBy=multi-user.target
```

## Platform-Specific Notes

### Replit
- Replit usually handles port allocation automatically
- If you see this error, it's likely a temporary issue
- Try restarting the Repl or killing existing processes

### Railway/Heroku
- These platforms assign ports automatically via `process.env.PORT`
- Make sure your code uses `process.env.PORT` instead of hardcoded port

### VPS/Dedicated Servers
- Check firewall settings
- Ensure port is not blocked by iptables
- Consider using reverse proxy (nginx) for production

## Testing Port Configuration

After making changes, test with:

```bash
# Test if app starts successfully
npm run dev

# Test if port is accessible
curl http://localhost:4000
# or
curl http://0.0.0.0:4000

# Test from external network (if applicable)
curl http://your-server-ip:4000
```

## Additional Commands Reference

```bash
# Kill all Node.js processes
pkill -f node

# Kill specific process by PID
kill -9 PID

# Kill process using specific port
kill -9 $(lsof -t -i:5000)

# Check if process is still running
ps aux | grep node

# Monitor port usage
watch -n 1 'lsof -i :5000'

# Find which process is using port 5000
sudo netstat -tlnp | grep :5000
```

## When Nothing Works

If all above solutions fail:

1. **Reboot the server** - This will clear all processes
2. **Check system logs** - Look for any system services using port 5000
3. **Try completely different port** - Use port 8080 or 3000
4. **Check if SELinux/AppArmor** is blocking the port
5. **Verify user permissions** - Make sure your user can bind to the port

## Update Project Configuration

After resolving the port conflict, update the project documentation:

1. Update `QUICK_START.md` with the new port
2. Update `PROJECT_SETUP_GUIDE.md` with port configuration
3. Update any hardcoded URLs in the codebase
4. Test all functionality with the new port

Remember: The Telegram bot and email system should work regardless of the port change, as they don't depend on the web server port.