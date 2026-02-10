import { pgTable, text, serial, integer, boolean, timestamp, decimal, pgEnum, varchar, index, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const kycStatusEnum = pgEnum("kyc_status", ["not_submitted", "pending", "verified", "rejected"]);
export const txnStatusEnum = pgEnum("txn_status", ["pending", "approved", "rejected"]);
export const currencyEnum = pgEnum("currency", ["MonCash", "NatCash"]);
export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);

export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  authUserId: varchar("auth_user_id").notNull().unique(),
  fullName: text("full_name").notNull().default(""),
  email: text("email").default(""),
  role: userRoleEnum("role").default("user").notNull(),
  kycStatus: kycStatusEnum("kyc_status").default("not_submitted").notNull(),
  balance: decimal("balance", { precision: 10, scale: 2 }).default("0").notNull(),
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
  phoneNumber: text("phone_number").notNull(),
  status: txnStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const kycDocuments = pgTable("kyc_documents", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => profiles.id).notNull(),
  idDocumentUrl: text("id_document_url"),
  selfieUrl: text("selfie_url"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

export const insertDepositSchema = createInsertSchema(deposits).omit({ id: true, profileId: true, status: true, createdAt: true });
export const insertWithdrawalSchema = createInsertSchema(withdrawals).omit({ id: true, profileId: true, status: true, createdAt: true });
export const insertKycSchema = createInsertSchema(kycDocuments).omit({ id: true, profileId: true, submittedAt: true });

export type Profile = typeof profiles.$inferSelect;
export type Deposit = typeof deposits.$inferSelect;
export type InsertDeposit = z.infer<typeof insertDepositSchema>;
export type Withdrawal = typeof withdrawals.$inferSelect;
export type InsertWithdrawal = z.infer<typeof insertWithdrawalSchema>;
export type KycDocument = typeof kycDocuments.$inferSelect;
