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
  trc20DepositAddress: text("trc20_deposit_address"),
  bep20DepositAddress: text("bep20_deposit_address"),
  // Affiliate / Referral fields
  affiliateEnabled: boolean("affiliate_enabled").default(false).notNull(),
  referralCode: text("referral_code").unique(),
  referralBalance: decimal("referral_balance", { precision: 10, scale: 2 }).default("0").notNull(),
  referredById: integer("referred_by_id"),
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
  referralCode: z.string().optional(),
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

// ────────── NFC Virtual Cards (BitVCard NFC) ──────────
// Separate table so the NFC service runs alongside the standard virtual card system.
// NFC cards support contactless payments via Apple Pay & Google Pay.
export const nfcCards = pgTable("nfc_cards", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => profiles.id).notNull(),
  cardId: text("card_id").notNull(),                   // Strowallet NFC card_id
  nameOnCard: text("name_on_card").notNull(),
  last4: text("last4"),
  brand: text("brand").default("Visa"),
  status: cardStatusEnum("status").default("pending").notNull(),
  balance: decimal("nfc_balance", { precision: 10, scale: 2 }).default("0").notNull(),
  currency: text("nfc_currency").default("USD").notNull(),
  cardDetail: jsonb("card_detail"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNfcCardSchema = createInsertSchema(nfcCards).omit({ id: true, profileId: true, createdAt: true });
export type NfcCard = typeof nfcCards.$inferSelect;

// Local log for NFC card fund/withdraw events (Strowallet API only returns spending txns)
export const nfcCardTransactions = pgTable("nfc_card_transactions", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").references(() => nfcCards.id).notNull(),
  profileId: integer("profile_id").references(() => profiles.id).notNull(),
  type: text("type").notNull(), // "fund" | "withdraw" | "creation"
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("USD").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type NfcCardTransaction = typeof nfcCardTransactions.$inferSelect;

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

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type AppSetting = typeof appSettings.$inferSelect;

export const securityEvents = pgTable("security_events", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => profiles.id),
  eventType: text("event_type").notNull(),
  ipAddress: text("ip_address"),
  deviceInfo: text("device_info"),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type SecurityEvent = typeof securityEvents.$inferSelect;

export const userReports = pgTable("user_reports", {
  id: serial("id").primaryKey(),
  reporterProfileId: integer("reporter_profile_id").references(() => profiles.id).notNull(),
  reportedIdentifier: text("reported_identifier").notNull(),
  reportedProfileId: integer("reported_profile_id").references(() => profiles.id),
  reason: text("reason").notNull(),
  description: text("description").notNull(),
  proofImageUrl: text("proof_image_url"),
  status: text("status").default("pending").notNull(),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
});
export type UserReport = typeof userReports.$inferSelect;

export const balanceLogs = pgTable("balance_logs", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => profiles.id).notNull(),
  previousBalance: decimal("previous_balance", { precision: 10, scale: 2 }).notNull(),
  newBalance: decimal("new_balance", { precision: 10, scale: 2 }).notNull(),
  change: decimal("change", { precision: 10, scale: 2 }).notNull(),
  action: text("action").notNull(),
  referenceId: text("reference_id"),
  adminId: integer("admin_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type BalanceLog = typeof balanceLogs.$inferSelect;

// Referral System Tables
export const referralEarningTypeEnum = pgEnum("referral_earning_type", ["registration", "kyc", "deposit"]);
export const referralPayoutStatusEnum = pgEnum("referral_payout_status", ["pending", "approved", "rejected"]);

export const referralEarnings = pgTable("referral_earnings", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id").references(() => profiles.id).notNull(),
  refereeId: integer("referee_id").references(() => profiles.id).notNull(),
  type: referralEarningTypeEnum("type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ReferralEarning = typeof referralEarnings.$inferSelect;

export const referralPayoutRequests = pgTable("referral_payout_requests", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => profiles.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: referralPayoutStatusEnum("status").default("pending").notNull(),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
});
export type ReferralPayoutRequest = typeof referralPayoutRequests.$inferSelect;

export const profileInfoSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  country: z.string().min(1, "Country is required"),
  city: z.string().min(1, "City is required"),
  phone: z.string().min(8, "Phone number is required"),
});

export type ProfileInfoInput = z.infer<typeof profileInfoSchema>;

// ── P2P Market ──────────────────────────────────────────────────────────────
export const p2pAds = pgTable("p2p_ads", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").references(() => profiles.id).notNull(),
  amountUsdt: decimal("amount_usdt", { precision: 10, scale: 2 }).notNull(),
  availableUsdt: decimal("available_usdt", { precision: 10, scale: 2 }).notNull(),
  rateHtg: decimal("rate_htg", { precision: 10, scale: 4 }),
  marginPct: decimal("margin_pct", { precision: 5, scale: 2 }),
  currency: text("currency").default("HTG").notNull(),
  country: text("country").default("HT").notNull(),
  paymentMethods: text("payment_methods").array().notNull(),
  minOrderUsdt: decimal("min_order_usdt", { precision: 10, scale: 2 }).default("10").notNull(),
  maxOrderUsdt: decimal("max_order_usdt", { precision: 10, scale: 2 }),
  status: text("status").default("active").notNull(), // active | paused | completed | cancelled
  termsNote: text("terms_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type P2PAd = typeof p2pAds.$inferSelect;

export const p2pOrders = pgTable("p2p_orders", {
  id: serial("id").primaryKey(),
  orderId: varchar("order_id", { length: 20 }).unique(),
  adId: integer("ad_id").references(() => p2pAds.id).notNull(),
  buyerId: integer("buyer_id").references(() => profiles.id).notNull(),
  sellerId: integer("seller_id").references(() => profiles.id).notNull(),
  amountUsdt: decimal("amount_usdt", { precision: 10, scale: 2 }).notNull(),
  amountLocal: decimal("amount_local", { precision: 12, scale: 2 }).notNull(),
  rate: decimal("rate", { precision: 10, scale: 4 }).notNull(),
  currency: text("currency").default("HTG").notNull(),
  paymentMethod: text("payment_method").notNull(),
  status: text("status").default("pending").notNull(), // pending | paid | released | cancelled | disputed
  cancelledBy: text("cancelled_by"),
  cancellationReason: text("cancellation_reason"),
  disputeReason: text("dispute_reason"),
  sellerConfirmedReceipt: boolean("seller_confirmed_receipt").default(false).notNull(),
  paidAt: timestamp("paid_at"),
  releasedAt: timestamp("released_at"),
  cancelledAt: timestamp("cancelled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type P2POrder = typeof p2pOrders.$inferSelect;

export const p2pChatMessages = pgTable("p2p_chat_messages", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => p2pOrders.id).notNull(),
  senderId: integer("sender_id").references(() => profiles.id).notNull(),
  message: text("message"),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type P2PChatMessage = typeof p2pChatMessages.$inferSelect;

export const p2pCancellations = pgTable("p2p_cancellations", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => profiles.id).notNull(),
  orderId: integer("order_id").references(() => p2pOrders.id).notNull(),
  role: text("role").notNull(), // "buyer" | "seller"
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type P2PCancellation = typeof p2pCancellations.$inferSelect;

export const p2pBans = pgTable("p2p_bans", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => profiles.id).notNull(),
  bannedUntil: timestamp("banned_until").notNull(),
  reason: text("reason").default("3 cancellations within 24 hours").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type P2PBan = typeof p2pBans.$inferSelect;

export const appDownloads = pgTable("app_downloads", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => profiles.id),
  deviceType: text("device_type"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type AppDownload = typeof appDownloads.$inferSelect;

export const canalplusSubscriptions = pgTable("canalplus_subscriptions", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => profiles.id).notNull(),
  planName: text("plan_name").notNull(),
  planPriceHtg: decimal("plan_price_htg", { precision: 10, scale: 2 }).notNull(),
  planPriceUsdt: decimal("plan_price_usdt", { precision: 10, scale: 4 }).notNull(),
  cardNumber: varchar("card_number", { length: 14 }).notNull(),
  autoRenew: boolean("auto_renew").default(false).notNull(),
  status: text("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CanalplusSubscription = typeof canalplusSubscriptions.$inferSelect;

// =====================================================================
// Izichanj Pay — Merchant API
// =====================================================================
export const merchantTxnStatusEnum = pgEnum("merchant_txn_status", [
  "pending",
  "completed",
  "expired",
  "failed",
]);

export const merchants = pgTable("merchants", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => profiles.id).notNull().unique(),
  businessName: text("business_name").notNull(),
  webhookUrl: text("webhook_url"),
  apiPublicKey: text("api_public_key").notNull().unique(),
  apiSecretKey: text("api_secret_key").notNull().unique(),
  isVerified: boolean("is_verified").default(false).notNull(),
  balance: decimal("balance", { precision: 14, scale: 4 }).default("0").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type Merchant = typeof merchants.$inferSelect;

export const merchantTransactions = pgTable("merchant_transactions", {
  id: serial("id").primaryKey(),
  paymentId: text("payment_id").notNull().unique(),
  merchantId: integer("merchant_id").references(() => merchants.id).notNull(),
  orderId: text("order_id").notNull(),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  amountUsdt: decimal("amount_usdt", { precision: 14, scale: 4 }).notNull(),
  amountHtg: decimal("amount_htg", { precision: 14, scale: 2 }).notNull(),
  feeUsdt: decimal("fee_usdt", { precision: 14, scale: 4 }).notNull(),
  netUsdt: decimal("net_usdt", { precision: 14, scale: 4 }).notNull(),
  exchangeRate: decimal("exchange_rate", { precision: 10, scale: 4 }).notNull(),
  status: merchantTxnStatusEnum("status").default("pending").notNull(),
  payerProfileId: integer("payer_profile_id").references(() => profiles.id),
  successUrl: text("success_url"),
  cancelUrl: text("cancel_url"),
  description: text("description"),
  webhookDelivered: boolean("webhook_delivered").default(false).notNull(),
  webhookAttempts: integer("webhook_attempts").default(0).notNull(),
  paidAt: timestamp("paid_at"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type MerchantTransaction = typeof merchantTransactions.$inferSelect;

// Merchant payout requests
export const payoutMethodEnum = pgEnum("payout_method", ["moncash", "natcash", "zelle", "cashapp"]);
export const payoutStatusEnum = pgEnum("payout_status", ["pending", "approved", "rejected"]);

export const payoutRequests = pgTable("payout_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => profiles.id).notNull(),
  merchantId: integer("merchant_id").references(() => merchants.id),
  amount: decimal("amount", { precision: 14, scale: 4 }).notNull(),
  method: payoutMethodEnum("method").notNull(),
  details: jsonb("details").notNull(),
  status: payoutStatusEnum("status").default("pending").notNull(),
  adminNote: text("admin_note"),
  processedAt: timestamp("processed_at"),
  processedBy: integer("processed_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type PayoutRequest = typeof payoutRequests.$inferSelect;
export type InsertPayoutRequest = typeof payoutRequests.$inferInsert;

export const payoutRequestSchema = z.object({
  amount: z.coerce.number().positive().min(5, "Minimum payout is 5 USDT"),
  method: z.enum(["moncash", "natcash", "zelle", "cashapp"]),
  phoneNumber: z.string().optional(),
  email: z.string().optional(),
  cashtag: z.string().optional(),
  acknowledged: z.literal(true, { errorMap: () => ({ message: "You must acknowledge the 24-48h processing time" }) }),
}).superRefine((v, ctx) => {
  if ((v.method === "moncash" || v.method === "natcash")) {
    if (!v.phoneNumber || !/^[0-9+\s-]{6,20}$/.test(v.phoneNumber.trim())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["phoneNumber"], message: "Valid phone number required" });
    }
  } else if (v.method === "zelle") {
    if (!v.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email.trim())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["email"], message: "Valid Zelle email required" });
    }
  } else if (v.method === "cashapp") {
    if (!v.cashtag || !/^\$?[A-Za-z0-9_]{1,20}$/.test(v.cashtag.trim())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cashtag"], message: "Valid $cashtag required" });
    }
  }
});

export const PAYOUT_METHOD_META: Record<string, { label: string; colorName: string; hex: string }> = {
  moncash: { label: "MonCash", colorName: "Red", hex: "#EF4444" },
  natcash: { label: "NatCash", colorName: "Lemon Yellow (Citron)", hex: "#E3FF00" },
  zelle: { label: "Zelle", colorName: "Navy Blue", hex: "#1A237E" },
  cashapp: { label: "CashApp", colorName: "Green", hex: "#22C55E" },
};

export const updateMerchantSchema = z.object({
  businessName: z.string().min(2).max(100).optional(),
  webhookUrl: z.string().url().or(z.literal("")).nullish(),
});

export const checkoutApiSchema = z.object({
  amount: z.coerce.number().positive(),
  currency: z.enum(["HTG", "USDT"]),
  order_id: z.string().min(1).max(120),
  description: z.string().max(255).optional(),
  success_url: z.string().url().optional(),
  cancel_url: z.string().url().optional(),
});
