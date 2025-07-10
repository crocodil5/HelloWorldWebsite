import {
  users,
  loginAttempts,
  smsSubmissions,
  type User,
  type InsertUser,
  type LoginAttempt,
  type InsertLoginAttempt,
  type SmsSubmission,
  type InsertSmsSubmission,
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createLoginAttempt(attempt: InsertLoginAttempt): Promise<LoginAttempt>;
  getLoginAttempts(): Promise<LoginAttempt[]>;
  approveLoginAttempt(id: number): Promise<void>;
  getLoginAttempt(id: number): Promise<LoginAttempt | undefined>;
  deleteLoginAttempt(id: number): Promise<void>;
  createSmsSubmission(submission: InsertSmsSubmission): Promise<SmsSubmission>;
  getSmsSubmissions(): Promise<SmsSubmission[]>;
  deleteSmsSubmission(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async createLoginAttempt(attempt: InsertLoginAttempt): Promise<LoginAttempt> {
    const [loginAttempt] = await db
      .insert(loginAttempts)
      .values(attempt)
      .returning();
    return loginAttempt;
  }

  async getLoginAttempts(): Promise<LoginAttempt[]> {
    return await db
      .select()
      .from(loginAttempts)
      .orderBy(loginAttempts.timestamp);
  }

  async approveLoginAttempt(id: number): Promise<void> {
    await db
      .update(loginAttempts)
      .set({ approved: true })
      .where(eq(loginAttempts.id, id));
  }

  async getLoginAttempt(id: number): Promise<LoginAttempt | undefined> {
    const [attempt] = await db
      .select()
      .from(loginAttempts)
      .where(eq(loginAttempts.id, id));
    return attempt || undefined;
  }

  async createSmsSubmission(
    submission: InsertSmsSubmission,
  ): Promise<SmsSubmission> {
    const [smsSubmission] = await db
      .insert(smsSubmissions)
      .values(submission)
      .returning();
    return smsSubmission;
  }

  async getSmsSubmissions(): Promise<SmsSubmission[]> {
    return await db
      .select()
      .from(smsSubmissions)
      .orderBy(smsSubmissions.timestamp);
  }

  async deleteLoginAttempt(id: number): Promise<void> {
    await db.delete(loginAttempts).where(eq(loginAttempts.id, id));
  }

  async deleteSmsSubmission(id: number): Promise<void> {
    await db.delete(smsSubmissions).where(eq(smsSubmissions.id, id));
  }
}

export const storage = new DatabaseStorage();
