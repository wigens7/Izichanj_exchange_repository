import { pgTable, text, serial, integer, boolean, timestamp, decimal, pgEnum, varchar, index, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const kycStatusEnum = pgEnum("kyc_status", ["not_submitted", "pending", "verified", "rejected"]);
export const txnStatusEnum = pgEnum("txn_status", ["pending", "approved", "rejected"]);
export const currencyEnum = pgEnum("currency", ["MonCash", "NatCash"]);
export const withdrawMethodEnum = pgEnum("withdraw_method", ["phone", "qrcode"]);
export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);

export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  role: userRoleEnum("role").default("user").notNull(),
  kycStatus: kycStatusEnum("kyc_status").default("not_submitted").notNull(),
  balance: decimal("balance", { precision: 10, scale: 2 }).default("0").notNull(),
  twoFactorSecret: text("two_factor_secret"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const webauthnCredentials = pgTable("webauthn_credentials", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => profiles.id).notNull(),
  credentialId: text("credential_id").notNull().unique(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").default(0).notNull(),
  deviceName: text("device_name").default("Fingerprint").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const otps = pgTable("otps", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => profiles.id).notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  verified: boolean("verified").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const deposits = pgTable("deposits", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => profiles.id).notNull(),
  amountUsdt: decimal("amount_usdt", { precision: 10, scale: 2 }).notNull(),
  txHash: text("tx_hash").notNull(),
  status: txnStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const withdrawals = pgTable("withdrawals", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => profiles.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: currencyEnum("currency").notNull(),
  withdrawMethod: withdrawMethodEnum("withdraw_method").default("phone").notNull(),
  phoneNumber: text("phone_number"),
  qrCodeUrl: text("qr_code_url"),
  status: txnStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const kycDocuments = pgTable("kyc_documents", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => profiles.id).notNull(),
  idDocumentUrl: text("id_document_url"),
  idDocumentBackUrl: text("id_document_back_url"),
  selfieUrl: text("selfie_url"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

export const notificationTypeEnum = pgEnum("notification_type", ["deposit_approved", "deposit_rejected", "withdrawal_approved", "withdrawal_rejected", "kyc_verified", "kyc_rejected", "custom_message"]);

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => profiles.id).notNull(),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chatStatusEnum = pgEnum("chat_status", ["active", "waiting_agent", "closed"]);
export const chatSenderEnum = pgEnum("chat_sender", ["user", "bot", "admin"]);

export const supportConversations = pgTable("support_conversations", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => profiles.id).notNull(),
  status: chatStatusEnum("status").default("active").notNull(),
  rating: integer("rating"),
  closedBy: text("closed_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const supportMessages = pgTable("support_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => supportConversations.id).notNull(),
  sender: chatSenderEnum("sender").notNull(),
  senderProfileId: integer("sender_profile_id").references(() => profiles.id),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDepositSchema = createInsertSchema(deposits).omit({ id: true, profileId: true, status: true, createdAt: true });
export const insertWithdrawalSchema = createInsertSchema(withdrawals).omit({ id: true, profileId: true, status: true, createdAt: true });
export const insertKycSchema = createInsertSchema(kycDocuments).omit({ id: true, profileId: true, submittedAt: true });

export const registerSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type Profile = typeof profiles.$inferSelect;
export type Deposit = typeof deposits.$inferSelect;
export type InsertDeposit = z.infer<typeof insertDepositSchema>;
export type Withdrawal = typeof withdrawals.$inferSelect;
export type InsertWithdrawal = z.infer<typeof insertWithdrawalSchema>;
export type KycDocument = typeof kycDocuments.$inferSelect;
export type WebAuthnCredential = typeof webauthnCredentials.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type SupportConversation = typeof supportConversations.$inferSelect;
export type SupportMessage = typeof supportMessages.$inferSelect;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
