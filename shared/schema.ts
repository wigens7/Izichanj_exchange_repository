import { pgTable, text, serial, integer, boolean, timestamp, decimal, pgEnum, varchar, index, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const kycStatusEnum = pgEnum("kyc_status", ["not_submitted", "pending", "verified", "rejected"]);
export const txnStatusEnum = pgEnum("txn_status", ["pending", "approved", "rejected", "expired"]);
export const currencyEnum = pgEnum("currency", ["MonCash", "NatCash"]);
export const withdrawMethodEnum = pgEnum("withdraw_method", ["phone", "qrcode"]);
export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const depositMethodEnum = pgEnum("deposit_method", ["usdt", "moncash", "nowpayments"]);

export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  referenceId: text("reference_id").unique(),
  fullName: text("full_name").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  dateOfBirth: text("date_of_birth"),
  country: text("country"),
  city: text("city"),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  role: userRoleEnum("role").default("user").notNull(),
  kycStatus: kycStatusEnum("kyc_status").default("not_submitted").notNull(),
  balance: decimal("balance", { precision: 10, scale: 2 }).default("0").notNull(),
  twoFactorSecret: text("two_factor_secret"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
  pinHash: text("pin_hash"),
  withdrawalPinHash: text("withdrawal_pin_hash"),
  strowalletCustomerId: text("strowallet_customer_id"),
  isBanned: boolean("is_banned").default(false).notNull(),
  isDeleted: boolean("is_deleted").default(false).notNull(),
  canEditProfile: boolean("can_edit_profile").default(false).notNull(),
  frozenUntil: timestamp("frozen_until"),
  deletedAt: timestamp("deleted_at"),
  lastIp: text("last_ip"),
  registrationIp: text("registration_ip"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const blacklistedUsers = pgTable("blacklisted_users", {
  id: serial("id").primaryKey(),
  email: text("email"),
  phone: text("phone"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  dateOfBirth: text("date_of_birth"),
  idDocumentUrl: text("id_document_url"),
  idDocumentBackUrl: text("id_document_back_url"),
  selfieUrl: text("selfie_url"),
  reason: text("reason").default("Account deleted").notNull(),
  originalProfileId: integer("original_profile_id"),
  referenceId: text("reference_id"),
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
  txHash: text("tx_hash"),
  depositMethod: depositMethodEnum("deposit_method").default("usdt").notNull(),
  amountHtg: decimal("amount_htg", { precision: 12, scale: 2 }),
  moncashTransactionId: text("moncash_transaction_id"),
  nowpaymentsPaymentId: text("nowpayments_payment_id"),
  payAddress: text("pay_address"),
  payCurrency: text("pay_currency"),
  proofImageUrl: text("proof_image_url"), // Manual MonCash/NatCash deposit proof screenshot
  rejectionReason: text("rejection_reason"), // Reason for rejecting a manual deposit
  ipAddress: text("ip_address"), // IP of the user when deposit was created
  status: txnStatusEnum("status").default("pending").notNull(),
  receiptId: text("receipt_id").unique(),
  receiptUrl: text("receipt_url"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const withdrawals = pgTable("withdrawals", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => profiles.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  fee: decimal("fee", { precision: 10, scale: 2 }).default("2.50"),
  trcAddress: text("trc_address"),
  currency: currencyEnum("currency").notNull(),
  withdrawMethod: withdrawMethodEnum("withdraw_method").default("phone").notNull(),
  phoneNumber: text("phone_number"),
  qrCodeUrl: text("qr_code_url"),
  ipAddress: text("ip_address"), // IP of the user when withdrawal was created
  status: txnStatusEnum("status").default("pending").notNull(),
  receiptId: text("receipt_id").unique(),
  receiptUrl: text("receipt_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const kycDocuments = pgTable("kyc_documents", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => profiles.id).notNull(),
  idDocumentUrl: text("id_document_url"),
  idDocumentBackUrl: text("id_document_back_url"),
  selfieUrl: text("selfie_url"),
  idType: text("id_type"),
  idNumber: text("id_number"),
  addressLine1: text("address_line_1"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

export const notificationTypeEnum = pgEnum("notification_type", ["deposit_approved", "deposit_rejected", "withdrawal_approved", "withdrawal_rejected", "kyc_verified", "kyc_rejected", "custom_message", "transfer_received", "transfer_sent"]);

export const p2pTransfers = pgTable("p2p_transfers", {
  id: serial("id").primaryKey(),
  transactionId: varchar("transaction_id", { length: 20 }).unique(),
  senderProfileId: integer("sender_profile_id").references(() => profiles.id).notNull(),
  receiverProfileId: integer("receiver_profile_id").references(() => profiles.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDepositSchema = createInsertSchema(deposits).omit({ id: true, profileId: true, status: true, createdAt: true, depositMethod: true, amountHtg: true, moncashTransactionId: true });
export const insertWithdrawalSchema = createInsertSchema(withdrawals).omit({ id: true, profileId: true, status: true, createdAt: true });
export const insertKycSchema = createInsertSchema(kycDocuments).omit({ id: true, profileId: true, submittedAt: true });

export const registerSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(8, "Phone number must be at least 8 digits").regex(/^\+?[0-9]+$/, "Invalid phone number format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const forgotPasswordSchema = z.object({
  phone: z.string().min(8, "Phone number must be at least 8 digits"),
});

export const resetPasswordSchema = z.object({
  phone: z.string().min(8, "Phone number must be at least 8 digits"),
  code: z.string().length(6, "Code must be 6 digits"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const resetPinSchema = z.object({
  phone: z.string().min(8, "Phone number must be at least 8 digits"),
  code: z.string().length(6, "Code must be 6 digits"),
  newPin: z.string().length(4, "PIN must be exactly 4 digits").regex(/^\d{4}$/, "PIN must be 4 digits"),
  confirmPin: z.string(),
}).refine((data) => data.newPin === data.confirmPin, {
  message: "PINs do not match",
  path: ["confirmPin"],
});

export const loginSchema = z.object({
  identifier: z.string().min(1, "Email or phone is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
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
export type BlacklistedUser = typeof blacklistedUsers.$inferSelect;
export type P2PTransfer = typeof p2pTransfers.$inferSelect;
export const cardStatusEnum = pgEnum("card_status", ["pending", "active", "frozen", "terminated", "cancelled"]);

export const virtualCards = pgTable("virtual_cards", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => profiles.id).notNull(),
  cardId: text("card_id").notNull(),
  cardType: text("card_type").default("visa").notNull(),
  nameOnCard: text("name_on_card").notNull(),
  last4: text("last4"),
  brand: text("brand").default("Visa"),
  status: cardStatusEnum("status").default("pending").notNull(),
  balance: decimal("card_balance", { precision: 10, scale: 2 }).default("0").notNull(),
  currency: text("card_currency").default("USD").notNull(),
  cardDetail: jsonb("card_detail"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVirtualCardSchema = createInsertSchema(virtualCards).omit({ id: true, profileId: true, createdAt: true });
export type VirtualCard = typeof virtualCards.$inferSelect;

export const loginLogs = pgTable("login_logs", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => profiles.id).notNull(),
  method: text("method").default("password").notNull(),
  ipAddress: text("ip_address"),
  loginAt: timestamp("login_at").defaultNow().notNull(),
});
export type LoginLog = typeof loginLogs.$inferSelect;

export const fraudRejections = pgTable("fraud_rejections", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => profiles.id).notNull(),
  depositId: integer("deposit_id").notNull(),
  adminId: integer("admin_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type FraudRejection = typeof fraudRejections.$inferSelect;

// Local log for card funding events (Strowallet API only returns spending txns)
export const cardTransactions = pgTable("card_transactions", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").references(() => virtualCards.id).notNull(),
  profileId: integer("profile_id").references(() => profiles.id).notNull(),
  type: text("type").notNull(), // "fund" | "creation"
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("USD").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CardTransaction = typeof cardTransactions.$inferSelect;

export const topUpTransactions = pgTable("top_up_transactions", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => profiles.id).notNull(),
  operatorId: text("operator_id").notNull(),
  operatorName: text("operator_name").notNull(),
  phone: text("phone").notNull(),
  amountUsd: decimal("amount_usd", { precision: 10, scale: 2 }).notNull(),
  transactionId: text("transaction_id"),
  status: text("status").default("success").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type TopUpTransaction = typeof topUpTransactions.$inferSelect;

export const profileInfoSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  country: z.string().min(1, "Country is required"),
  city: z.string().min(1, "City is required"),
  phone: z.string().min(8, "Phone number is required"),
});

export type ProfileInfoInput = z.infer<typeof profileInfoSchema>;
