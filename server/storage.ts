import { profiles, deposits, withdrawals, kycDocuments, otps, webauthnCredentials, notifications, supportConversations, supportMessages, supportQuickReplies, virtualCards, blacklistedUsers, kycArchives, p2pTransfers, loginLogs, fraudRejections, cardTransactions, topUpTransactions, securityEvents, balanceLogs, userReports, referralEarnings, referralPayoutRequests, nfcCards, nfcCardTransactions, type Profile, type Deposit, type InsertDeposit, type Withdrawal, type InsertWithdrawal, type KycDocument, type WebAuthnCredential, type Notification, type SupportConversation, type SupportMessage, type SupportQuickReply, type InsertSupportQuickReply, type VirtualCard, type BlacklistedUser, type KycArchive, type P2PTransfer, type LoginLog, type FraudRejection, type CardTransaction, type TopUpTransaction, type SecurityEvent, type BalanceLog, type UserReport, type ReferralEarning, type ReferralPayoutRequest, type NfcCard, type NfcCardTransaction, merchants, merchantTransactions, merchantPayoutMethods, merchantLedgerEntries, type Merchant, type MerchantTransaction, payoutRequests, type PayoutRequest, type InsertPayoutRequest, type MerchantPayoutMethod, type MerchantLedgerEntry } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, ne, lt, sql, or, ilike, inArray, isNull } from "drizzle-orm";
import crypto from "crypto";
import { sendPushToProfile } from "./fcm";

export interface IStorage {
  getProfile(id: number): Promise<Profile | undefined>;
  getProfilesByPhone(phone: string): Promise<Profile[]>;
  getProfileByEmail(email: string): Promise<Profile | undefined>;
  getProfileByPhone(phone: string): Promise<Profile | undefined>;
  createProfile(fullName: string, email: string, passwordHash: string, phone?: string): Promise<Profile>;
  updateProfileBalance(id: number, balance: number): Promise<Profile>;
  updateProfilePassword(id: number, passwordHash: string): Promise<void>;
  markEmailVerified(id: number): Promise<void>;

  createOtp(profileId: number, code: string, purpose?: string): Promise<void>;
  getValidOtp(profileId: number, code: string): Promise<typeof otps.$inferSelect | undefined>;
  getValidOtpByPurpose(profileId: number, code: string, purpose: string): Promise<typeof otps.$inferSelect | undefined>;
  markOtpVerified(id: number): Promise<void>;

  createDeposit(deposit: InsertDeposit & { profileId: number; depositMethod?: "usdt" | "moncash" | "nowpayments" | "paypal"; amountHtg?: string; moncashTransactionId?: string | null; nowpaymentsPaymentId?: string | null; paypalOrderId?: string | null; payAddress?: string | null; payCurrency?: string | null; expiresAt?: Date | null; ipAddress?: string | null }): Promise<Deposit>;
  getDeposits(profileId?: number): Promise<Deposit[]>;
  getDepositById(id: number): Promise<Deposit | undefined>;
  updateDepositStatus(id: number, status: "approved" | "rejected" | "expired"): Promise<Deposit>;
  rejectDepositWithReason(id: number, reason: string): Promise<Deposit>;
  autoExpirePendingDeposits(): Promise<number>;
  getDepositByMoncashTransactionId(transactionId: string): Promise<Deposit | undefined>;
  getDepositByNowpaymentsPaymentId(paymentId: string): Promise<Deposit | undefined>;
  setDepositReceipt(id: number, receiptId: string): Promise<Deposit>;
  getDepositByReceiptId(receiptId: string): Promise<Deposit | undefined>;
  updateDepositTxHash(id: number, txHash: string): Promise<Deposit>;

  createWithdrawal(withdrawal: InsertWithdrawal & { profileId: number; ipAddress?: string | null }): Promise<Withdrawal>;
  getWithdrawals(profileId?: number): Promise<Withdrawal[]>;
  getWithdrawalById(id: number): Promise<Withdrawal | undefined>;
  updateWithdrawalStatus(id: number, status: "approved" | "rejected"): Promise<Withdrawal>;
  setWithdrawalReceipt(id: number, receiptId: string): Promise<Withdrawal>;
  getWithdrawalByReceiptId(receiptId: string): Promise<Withdrawal | undefined>;

  createKyc(kyc: { profileId: number; idDocumentUrl: string; idDocumentBackUrl: string; selfieUrl: string; idType?: string; idNumber?: string; addressLine1?: string }): Promise<KycDocument>;
  getKyc(profileId: number): Promise<KycDocument | undefined>;
  getAllKyc(): Promise<(KycDocument & { profile: Profile })[]>;
  requestKycResubmit(profileId: number): Promise<void>;
  archiveUserKyc(profileId: number, reason: "account_deleted" | "banned" | "kyc_resubmit" | "kyc_rejected", archivedByAdminId?: number): Promise<void>;
  getKycArchives(): Promise<KycArchive[]>;
  updateKycStatus(profileId: number, status: "verified" | "rejected"): Promise<void>;
  updateProfile(id: number, data: Partial<Profile>): Promise<Profile>;
  setUserBanStatus(id: number, isBanned: boolean): Promise<Profile>;
  setOtpBlocked(id: number, otpBlocked: boolean): Promise<Profile>;
  freezeUser(id: number, frozenUntil: Date): Promise<Profile>;
  getAllProfiles(): Promise<Profile[]>;

  recordFraudRejection(profileId: number, depositId: number, adminId: number): Promise<FraudRejection>;
  getRecentFraudRejections(profileId: number, since: Date): Promise<FraudRejection[]>;

  setTwoFactorSecret(profileId: number, secret: string): Promise<void>;
  enableTwoFactor(profileId: number): Promise<void>;
  disableTwoFactor(profileId: number): Promise<void>;

  createWebAuthnCredential(cred: { profileId: number; credentialId: string; publicKey: string; counter: number; deviceName: string }): Promise<WebAuthnCredential>;
  getWebAuthnCredentials(profileId: number): Promise<WebAuthnCredential[]>;
  getWebAuthnCredentialById(credentialId: string): Promise<WebAuthnCredential | undefined>;
  updateWebAuthnCounter(credentialId: string, counter: number): Promise<void>;
  deleteWebAuthnCredential(id: number, profileId: number): Promise<void>;

  createNotification(data: { profileId: number; type: Notification["type"]; title: string; message: string }): Promise<Notification>;
  getNotifications(profileId: number): Promise<Notification[]>;
  getUnreadNotificationCount(profileId: number): Promise<number>;
  markNotificationRead(id: number, profileId: number): Promise<void>;
  markAllNotificationsRead(profileId: number): Promise<void>;

  getOrCreateConversation(profileId: number): Promise<SupportConversation>;
  getConversation(id: number): Promise<SupportConversation | undefined>;
  getConversationMessages(conversationId: number): Promise<SupportMessage[]>;
  addMessage(data: { conversationId: number; sender: SupportMessage["sender"]; senderProfileId?: number; message: string; fileUrl?: string; fileName?: string }): Promise<SupportMessage>;
  updateConversationStatus(id: number, status: SupportConversation["status"]): Promise<SupportConversation>;
  closeConversationWithRating(id: number, rating: number, closedBy: string): Promise<SupportConversation>;
  getAllConversations(): Promise<(SupportConversation & { profile: Profile; lastMessage?: string; unreadCount: number })[]>;
  getUnreadSupportCount(profileId: number): Promise<number>;
  getInactiveConversations(minutesInactive: number): Promise<SupportConversation[]>;
  getQuickReplies(): Promise<SupportQuickReply[]>;
  getQuickReplyByShortcut(shortcut: string): Promise<SupportQuickReply | undefined>;
  getQuickReplyById(id: number): Promise<SupportQuickReply | undefined>;
  createQuickReply(data: InsertSupportQuickReply): Promise<SupportQuickReply>;
  updateQuickReply(id: number, data: Partial<InsertSupportQuickReply>): Promise<SupportQuickReply | undefined>;
  deleteQuickReply(id: number): Promise<void>;

  createVirtualCard(data: { profileId: number; cardId: string; cardType: string; nameOnCard: string; last4?: string; brand?: string; status?: VirtualCard["status"]; balance?: string; currency?: string; cardDetail?: any }): Promise<VirtualCard>;
  getVirtualCards(profileId: number): Promise<VirtualCard[]>;
  getVirtualCard(id: number, profileId: number): Promise<VirtualCard | undefined>;
  getVirtualCardById(id: number): Promise<VirtualCard | undefined>;
  getVirtualCardByCardId(cardId: string): Promise<VirtualCard | undefined>;
  updateVirtualCard(id: number, data: Partial<VirtualCard>): Promise<VirtualCard>;
  deleteVirtualCard(id: number, profileId: number): Promise<VirtualCard | undefined>;
  getAllPendingVirtualCards(): Promise<any[]>;
  createCardTransaction(data: { cardId: number; profileId: number; type: string; amount: string; currency?: string; description?: string }): Promise<CardTransaction>;
  getCardTransactions(cardId: number, profileId: number): Promise<CardTransaction[]>;

  // ── NFC virtual cards (BitVCard NFC) ──
  createNfcCard(data: { profileId: number; cardId: string; nameOnCard: string; last4?: string; brand?: string; status?: NfcCard["status"]; balance?: string; currency?: string; cardDetail?: any }): Promise<NfcCard>;
  getNfcCards(profileId: number): Promise<NfcCard[]>;
  getNfcCard(id: number, profileId: number): Promise<NfcCard | undefined>;
  getNfcCardById(id: number): Promise<NfcCard | undefined>;
  updateNfcCard(id: number, data: Partial<NfcCard>): Promise<NfcCard>;
  getAllPendingNfcCards(): Promise<any[]>;
  createNfcCardTransaction(data: { cardId: number; profileId: number; type: string; amount: string; currency?: string; description?: string; providerTxId?: string | null }): Promise<NfcCardTransaction>;
  getAllActiveNfcCards(): Promise<NfcCard[]>;
  getNfcCardTransactions(cardId: number, profileId: number): Promise<NfcCardTransaction[]>;
  createTopUpTransaction(data: { profileId: number; operatorId: string; operatorName: string; phone: string; amountUsd: string; transactionId?: string; status?: string }): Promise<TopUpTransaction>;
  getTopUpTransactions(profileId: number): Promise<TopUpTransaction[]>;

  createP2PTransfer(data: { senderProfileId: number; receiverProfileId: number; amount: string; note?: string; transactionId?: string; receiptId?: string }): Promise<P2PTransfer>;
  getP2PTransferById(id: number): Promise<P2PTransfer | undefined>;
  getP2PTransferByReceiptId(receiptId: string): Promise<P2PTransfer | undefined>;
  setP2PTransferReceipt(id: number, receiptId: string): Promise<P2PTransfer>;
  getP2PTransfers(profileId: number): Promise<P2PTransfer[]>;

  getProfileByReferenceId(referenceId: string): Promise<Profile | undefined>;
  getProfileByDepositAddress(address: string): Promise<Profile | undefined>;
  updateDepositAddresses(profileId: number, trc20?: string | null, bep20?: string | null): Promise<void>;
  searchProfiles(query: string): Promise<Profile[]>;
  softDeleteProfile(id: number): Promise<void>;
  addToBlacklist(data: { email?: string; phone?: string; firstName?: string; lastName?: string; dateOfBirth?: string; idDocumentUrl?: string; idDocumentBackUrl?: string; selfieUrl?: string; reason?: string; originalProfileId?: number; referenceId?: string }): Promise<BlacklistedUser>;
  isBlacklisted(email: string, phone?: string, firstName?: string, lastName?: string, dateOfBirth?: string): Promise<boolean>;

  createLoginLog(profileId: number, method: string, ipAddress?: string, deviceInfo?: string): Promise<void>;
  getLoginActivity(limit?: number): Promise<(LoginLog & { profile: Pick<Profile, "id" | "fullName" | "email"> })[]>;
  getLoginCount(profileId: number): Promise<number>;
  updateProfileIp(id: number, ip: string, loginAt?: Date): Promise<void>;

  // Security events (failed logins, password resets, etc.)
  createSecurityEvent(data: { profileId?: number; eventType: string; ipAddress?: string; deviceInfo?: string; details?: string; status?: string }): Promise<void>;
  getSecurityEvents(profileId?: number, limit?: number): Promise<SecurityEvent[]>;

  // Balance logs (financial integrity)
  createBalanceLog(data: { profileId: number; previousBalance: number; newBalance: number; change: number; action: string; referenceId?: string; adminId?: number }): Promise<void>;
  getBalanceLogs(profileId?: number, limit?: number): Promise<BalanceLog[]>;

  // User 360 activity
  getUserActivity(profileId: number): Promise<any>;

  // Global audit log
  getGlobalAuditLog(limit?: number, filterType?: string): Promise<any[]>;

  // Multi-account detection (users sharing same IP)
  getMultiAccountAlerts(): Promise<any[]>;

  // Risk check for a specific withdrawal
  getWithdrawalRiskInfo(withdrawalId: number): Promise<any>;

  // Referral / Affiliate system
  getProfileByReferralCode(code: string): Promise<Profile | undefined>;
  generateReferralCode(profileId: number): Promise<string>;
  createReferralEarning(data: { referrerId: number; refereeId: number; type: "registration" | "kyc" | "deposit"; amount: number; description?: string }): Promise<ReferralEarning>;
  creditReferralBalance(profileId: number, amount: number): Promise<void>;
  getReferralStats(profileId: number): Promise<{ referrals: any[]; totalEarned: number; pendingPayout: number }>;
  createReferralPayoutRequest(profileId: number, amount: number): Promise<ReferralPayoutRequest>;
  getReferralPayoutRequests(profileId?: number): Promise<any[]>;
  updateReferralPayoutRequest(id: number, status: "approved" | "rejected", adminNote?: string): Promise<ReferralPayoutRequest | null>;
  hasPendingReferralPayout(profileId: number): Promise<boolean>;

  // Merchant API
  getMerchantByProfile(profileId: number): Promise<Merchant | undefined>;
  getMerchantBySecretKey(key: string): Promise<Merchant | undefined>;
  getMerchantByPublicKey(key: string): Promise<Merchant | undefined>;
  getMerchantById(id: number): Promise<Merchant | undefined>;
  createMerchant(profileId: number, businessName: string): Promise<Merchant>;
  updateMerchant(profileId: number, data: { businessName?: string; webhookUrl?: string | null }): Promise<Merchant | undefined>;
  rotateMerchantKeys(profileId: number): Promise<Merchant | undefined>;
  createMerchantTransaction(data: Omit<MerchantTransaction, "id" | "createdAt" | "paidAt" | "webhookDelivered" | "webhookAttempts" | "status" | "payerProfileId">): Promise<MerchantTransaction>;
  getMerchantTransactionByPaymentId(paymentId: string): Promise<MerchantTransaction | undefined>;
  getMerchantTransactions(merchantId: number, limit?: number): Promise<MerchantTransaction[]>;
  getMerchantPaymentsAsBuyer(profileId: number, limit?: number): Promise<MerchantTransaction[]>;
  createPayoutRequest(data: InsertPayoutRequest): Promise<PayoutRequest>;
  getPayoutRequestsByUser(userId: number): Promise<PayoutRequest[]>;
  getAllPayoutRequests(): Promise<PayoutRequest[]>;
  getPayoutRequestById(id: number): Promise<PayoutRequest | undefined>;
  updatePayoutRequestStatus(id: number, status: "approved" | "rejected", adminId: number, adminNote?: string): Promise<PayoutRequest | undefined>;
  markMerchantTransactionPaid(paymentId: string, payerProfileId: number): Promise<MerchantTransaction | undefined>;
  markMerchantTransactionExpired(paymentId: string): Promise<void>;
  incrementWebhookAttempt(paymentId: string, delivered: boolean): Promise<void>;
  getMerchantPayoutMethods(merchantId: number): Promise<MerchantPayoutMethod[]>;
  createMerchantPayoutMethod(data: { merchantId: number; method: MerchantPayoutMethod["method"]; label?: string; encryptedDetails: string; maskedDetails: string; isDefault?: boolean }): Promise<MerchantPayoutMethod>;
  deleteMerchantPayoutMethod(id: number, merchantId: number): Promise<boolean>;
  getMerchantLedger(merchantId: number, limit?: number): Promise<MerchantLedgerEntry[]>;
}

export class DatabaseStorage implements IStorage {
  async getProfile(id: number): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, id));
    return profile;
  }

  async getProfileByEmail(email: string): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles).where(eq(profiles.email, email));
    return profile;
  }

  async getProfileByPhone(phone: string): Promise<Profile | undefined> {
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const withPlus = "+" + cleanPhone;
    const [profile] = await db.select().from(profiles).where(
      or(eq(profiles.phone, phone), eq(profiles.phone, cleanPhone), eq(profiles.phone, withPlus))
    );
    return profile;
  }
  async getProfilesByPhone(phone: string): Promise<Profile[]> {
    // Returns ALL profiles matching the given phone (across number-format
    // variants). Used to detect ambiguous phone→user mappings before
    // mirroring notifications to email.
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const withPlus = "+" + cleanPhone;
    return db.select().from(profiles).where(
      or(eq(profiles.phone, phone), eq(profiles.phone, cleanPhone), eq(profiles.phone, withPlus))
    );
  }

  private generateReferenceId(): string {
    return crypto.randomInt(1000000000, 9999999999).toString();
  }

  async createProfile(fullName: string, email: string, passwordHash: string, phone?: string): Promise<Profile> {
    const referenceId = this.generateReferenceId();
    const [profile] = await db.insert(profiles).values({ fullName, email, passwordHash, phone: phone || null, referenceId }).returning();
    return profile;
  }

  async updateProfileBalance(id: number, balance: number): Promise<Profile> {
    const [profile] = await db.update(profiles).set({ balance: balance.toString() }).where(eq(profiles.id, id)).returning();
    return profile;
  }

  async updateProfilePassword(id: number, passwordHash: string): Promise<void> {
    await db.update(profiles).set({ passwordHash }).where(eq(profiles.id, id));
  }

  async markEmailVerified(id: number): Promise<void> {
    await db.update(profiles).set({ emailVerified: true }).where(eq(profiles.id, id));
  }

  async createOtp(profileId: number, code: string, purpose?: string): Promise<void> {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await db.insert(otps).values({ profileId, code, expiresAt, purpose: purpose ?? null });
  }

  async getValidOtp(profileId: number, code: string): Promise<typeof otps.$inferSelect | undefined> {
    const [otp] = await db.select().from(otps)
      .where(eq(otps.profileId, profileId))
      .orderBy(desc(otps.createdAt))
      .limit(1);
    if (otp && otp.code === code && !otp.verified && otp.expiresAt > new Date()) {
      return otp;
    }
    return undefined;
  }

  async getValidOtpByPurpose(profileId: number, code: string, purpose: string): Promise<typeof otps.$inferSelect | undefined> {
    const [otp] = await db.select().from(otps)
      .where(and(eq(otps.profileId, profileId), eq(otps.purpose, purpose)))
      .orderBy(desc(otps.createdAt))
      .limit(1);
    if (otp && otp.code === code && !otp.verified && otp.expiresAt > new Date()) {
      return otp;
    }
    return undefined;
  }

  async markOtpVerified(id: number): Promise<void> {
    await db.update(otps).set({ verified: true }).where(eq(otps.id, id));
  }

  async createDeposit(deposit: InsertDeposit & { profileId: number; depositMethod?: "usdt" | "moncash" | "nowpayments" | "paypal"; amountHtg?: string; moncashTransactionId?: string | null; nowpaymentsPaymentId?: string | null; paypalOrderId?: string | null; payAddress?: string | null; payCurrency?: string | null; expiresAt?: Date | null }): Promise<Deposit> {
    const [newDeposit] = await db.insert(deposits).values(deposit).returning();
    return newDeposit;
  }

  async getDeposits(profileId?: number): Promise<Deposit[]> {
    if (profileId) {
      return db.select().from(deposits).where(eq(deposits.profileId, profileId)).orderBy(desc(deposits.createdAt));
    }
    return db.select().from(deposits).orderBy(desc(deposits.createdAt));
  }

  async getDepositById(id: number): Promise<Deposit | undefined> {
    const [deposit] = await db.select().from(deposits).where(eq(deposits.id, id));
    return deposit;
  }

  async updateDepositStatus(id: number, status: "approved" | "rejected" | "expired"): Promise<Deposit> {
    const [deposit] = await db.update(deposits).set({ status }).where(eq(deposits.id, id)).returning();
    return deposit;
  }

  async rejectDepositWithReason(id: number, reason: string): Promise<Deposit> {
    const [deposit] = await db.update(deposits).set({ status: "rejected", rejectionReason: reason }).where(eq(deposits.id, id)).returning();
    return deposit;
  }

  async updateDepositTxHash(id: number, txHash: string): Promise<Deposit> {
    const [deposit] = await db.update(deposits).set({ txHash }).where(eq(deposits.id, id)).returning();
    return deposit;
  }

  async autoExpirePendingDeposits(): Promise<number> {
    const now = new Date();
    const expired = await db
      .update(deposits)
      .set({ status: "expired" })
      .where(
        and(
          eq(deposits.status, "pending"),
          lt(deposits.expiresAt, now),
        )
      )
      .returning();
    return expired.length;
  }

  async getDepositByMoncashTransactionId(transactionId: string): Promise<Deposit | undefined> {
    const [deposit] = await db.select().from(deposits).where(eq(deposits.moncashTransactionId, transactionId));
    return deposit;
  }

  async getDepositByNowpaymentsPaymentId(paymentId: string): Promise<Deposit | undefined> {
    const [deposit] = await db.select().from(deposits).where(eq(deposits.nowpaymentsPaymentId, paymentId));
    return deposit;
  }

  async setDepositReceipt(id: number, receiptId: string): Promise<Deposit> {
    const [deposit] = await db.update(deposits).set({ receiptId }).where(eq(deposits.id, id)).returning();
    return deposit;
  }

  async getDepositByReceiptId(receiptId: string): Promise<Deposit | undefined> {
    const [deposit] = await db.select().from(deposits).where(eq(deposits.receiptId, receiptId));
    return deposit;
  }

  async createWithdrawal(withdrawal: InsertWithdrawal & { profileId: number }): Promise<Withdrawal> {
    const [newWithdrawal] = await db.insert(withdrawals).values(withdrawal).returning();
    return newWithdrawal;
  }

  async getWithdrawals(profileId?: number): Promise<Withdrawal[]> {
    if (profileId) {
      return db.select().from(withdrawals).where(eq(withdrawals.profileId, profileId)).orderBy(desc(withdrawals.createdAt));
    }
    return db.select().from(withdrawals).orderBy(desc(withdrawals.createdAt));
  }

  async getWithdrawalById(id: number): Promise<Withdrawal | undefined> {
    const [w] = await db.select().from(withdrawals).where(eq(withdrawals.id, id));
    return w;
  }

  async updateWithdrawalStatus(id: number, status: "approved" | "rejected"): Promise<Withdrawal> {
    const [withdrawal] = await db.update(withdrawals).set({ status }).where(eq(withdrawals.id, id)).returning();
    return withdrawal;
  }

  async setWithdrawalReceipt(id: number, receiptId: string): Promise<Withdrawal> {
    const [w] = await db.update(withdrawals).set({ receiptId }).where(eq(withdrawals.id, id)).returning();
    return w;
  }

  async getWithdrawalByReceiptId(receiptId: string): Promise<Withdrawal | undefined> {
    const [w] = await db.select().from(withdrawals).where(eq(withdrawals.receiptId, receiptId));
    return w;
  }

  async createKyc(kyc: { profileId: number; idDocumentUrl: string; idDocumentBackUrl: string; selfieUrl: string; idType?: string; idNumber?: string; addressLine1?: string }): Promise<KycDocument> {
    const existing = await this.getKyc(kyc.profileId);
    if (existing) {
      // Preserve the previous documents before they are overwritten by the resubmission.
      if (existing.idDocumentUrl || existing.idDocumentBackUrl || existing.selfieUrl) {
        await this.archiveUserKyc(kyc.profileId, "kyc_resubmit");
      }
      const [updated] = await db.update(kycDocuments).set(kyc).where(eq(kycDocuments.profileId, kyc.profileId)).returning();
      await db.update(profiles).set({ kycStatus: "pending" }).where(eq(profiles.id, kyc.profileId));
      return updated;
    }
    const [newKyc] = await db.insert(kycDocuments).values(kyc).returning();
    await db.update(profiles).set({ kycStatus: "pending" }).where(eq(profiles.id, kyc.profileId));
    return newKyc;
  }

  async getKyc(profileId: number): Promise<KycDocument | undefined> {
    const [kyc] = await db.select().from(kycDocuments).where(eq(kycDocuments.profileId, profileId));
    return kyc;
  }

  // Snapshot a user's profile + KYC documents into the permanent kyc_archives
  // table so the information survives bans, deletions and KYC re-submissions.
  async archiveUserKyc(profileId: number, reason: "account_deleted" | "banned" | "kyc_resubmit" | "kyc_rejected", archivedByAdminId?: number): Promise<void> {
    const profile = await this.getProfile(profileId);
    if (!profile) return;
    const kyc = await this.getKyc(profileId);
    await db.insert(kycArchives).values({
      originalProfileId: profile.id,
      referenceId: profile.referenceId ?? null,
      fullName: profile.fullName ?? null,
      email: profile.email ?? null,
      phone: profile.phone ?? null,
      dateOfBirth: profile.dateOfBirth ?? null,
      country: (profile as any).country ?? null,
      city: (profile as any).city ?? null,
      idType: kyc?.idType ?? null,
      idNumber: kyc?.idNumber ?? null,
      addressLine1: kyc?.addressLine1 ?? null,
      idDocumentUrl: kyc?.idDocumentUrl ?? null,
      idDocumentBackUrl: kyc?.idDocumentBackUrl ?? null,
      selfieUrl: kyc?.selfieUrl ?? null,
      kycStatusAtArchive: profile.kycStatus ?? null,
      reason,
      archivedByAdminId: archivedByAdminId ?? null,
    });
  }

  async getKycArchives(): Promise<KycArchive[]> {
    return db.select().from(kycArchives).orderBy(desc(kycArchives.createdAt));
  }

  async getAllKyc(): Promise<(KycDocument & { profile: Profile })[]> {
    const results = await db.select().from(kycDocuments).innerJoin(profiles, eq(kycDocuments.profileId, profiles.id));
    return results.map(r => ({ ...r.kyc_documents, profile: r.profiles }));
  }

  async updateKycStatus(profileId: number, status: "verified" | "rejected"): Promise<void> {
    await db.update(profiles).set({ kycStatus: status }).where(eq(profiles.id, profileId));
  }

  async requestKycResubmit(profileId: number): Promise<void> {
    // Preserve the existing documents before deleting them so they are never lost.
    const kyc = await this.getKyc(profileId);
    if (kyc && (kyc.idDocumentUrl || kyc.idDocumentBackUrl || kyc.selfieUrl)) {
      await this.archiveUserKyc(profileId, "kyc_resubmit");
    }
    await db.delete(kycDocuments).where(eq(kycDocuments.profileId, profileId));
    await db.update(profiles).set({ kycStatus: "not_submitted", strowalletCustomerId: null }).where(eq(profiles.id, profileId));
  }

  async updateProfile(id: number, data: Partial<Profile>): Promise<Profile> {
    const [profile] = await db.update(profiles).set(data).where(eq(profiles.id, id)).returning();
    if (!profile) throw new Error("Profile not found");
    return profile;
  }

  async setUserBanStatus(id: number, isBanned: boolean): Promise<Profile> {
    const [profile] = await db.update(profiles).set({ isBanned }).where(eq(profiles.id, id)).returning();
    if (!profile) throw new Error("Profile not found");
    return profile;
  }

  async setOtpBlocked(id: number, otpBlocked: boolean): Promise<Profile> {
    const [profile] = await db.update(profiles).set({ otpBlocked }).where(eq(profiles.id, id)).returning();
    if (!profile) throw new Error("Profile not found");
    return profile;
  }

  async freezeUser(id: number, frozenUntil: Date): Promise<Profile> {
    const [profile] = await db.update(profiles).set({ frozenUntil } as any).where(eq(profiles.id, id)).returning();
    if (!profile) throw new Error("Profile not found");
    return profile;
  }

  async unfreezeUser(id: number): Promise<Profile> {
    const [profile] = await db.update(profiles).set({ frozenUntil: null } as any).where(eq(profiles.id, id)).returning();
    if (!profile) throw new Error("Profile not found");
    return profile;
  }

  async getAllProfiles(): Promise<Profile[]> {
    return db.select().from(profiles).orderBy(desc(profiles.createdAt));
  }

  async recordFraudRejection(profileId: number, depositId: number, adminId: number): Promise<FraudRejection> {
    const [record] = await db.insert(fraudRejections).values({ profileId, depositId, adminId }).returning();
    return record;
  }

  async getRecentFraudRejections(profileId: number, since: Date): Promise<FraudRejection[]> {
    return db.select().from(fraudRejections)
      .where(and(eq(fraudRejections.profileId, profileId), sql`created_at >= ${since.toISOString()}`))
      .orderBy(desc(fraudRejections.createdAt));
  }

  async setTwoFactorSecret(profileId: number, secret: string): Promise<void> {
    await db.update(profiles).set({ twoFactorSecret: secret }).where(eq(profiles.id, profileId));
  }

  async enableTwoFactor(profileId: number): Promise<void> {
    await db.update(profiles).set({ twoFactorEnabled: true }).where(eq(profiles.id, profileId));
  }

  async disableTwoFactor(profileId: number): Promise<void> {
    await db.update(profiles).set({ twoFactorEnabled: false, twoFactorSecret: null }).where(eq(profiles.id, profileId));
  }

  async createWebAuthnCredential(cred: { profileId: number; credentialId: string; publicKey: string; counter: number; deviceName: string }): Promise<WebAuthnCredential> {
    const [credential] = await db.insert(webauthnCredentials).values(cred).returning();
    return credential;
  }

  async getWebAuthnCredentials(profileId: number): Promise<WebAuthnCredential[]> {
    return db.select().from(webauthnCredentials).where(eq(webauthnCredentials.profileId, profileId));
  }

  async getWebAuthnCredentialById(credentialId: string): Promise<WebAuthnCredential | undefined> {
    const [credential] = await db.select().from(webauthnCredentials).where(eq(webauthnCredentials.credentialId, credentialId));
    return credential;
  }

  async updateWebAuthnCounter(credentialId: string, counter: number): Promise<void> {
    await db.update(webauthnCredentials).set({ counter }).where(eq(webauthnCredentials.credentialId, credentialId));
  }

  async deleteWebAuthnCredential(id: number, profileId: number): Promise<void> {
    await db.delete(webauthnCredentials).where(and(eq(webauthnCredentials.id, id), eq(webauthnCredentials.profileId, profileId)));
  }

  async createNotification(data: { profileId: number; type: Notification["type"]; title: string; message: string }): Promise<Notification> {
    const [notification] = await db.insert(notifications).values(data).returning();
    // Fire-and-forget push notification (non-blocking)
    sendPushToProfile(data.profileId, data.title, data.message, {
      type: data.type,
      notificationId: String(notification.id),
      url: "/",
    }).catch(() => {});
    return notification;
  }

  async getNotifications(profileId: number): Promise<Notification[]> {
    return db.select().from(notifications).where(eq(notifications.profileId, profileId)).orderBy(desc(notifications.createdAt)).limit(50);
  }

  async getUnreadNotificationCount(profileId: number): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.profileId, profileId), eq(notifications.isRead, false)));
    return result?.count || 0;
  }

  async markNotificationRead(id: number, profileId: number): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.id, id), eq(notifications.profileId, profileId)));
  }

  async markAllNotificationsRead(profileId: number): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.profileId, profileId));
  }

  async getOrCreateConversation(profileId: number): Promise<SupportConversation> {
    const [existing] = await db.select().from(supportConversations)
      .where(and(eq(supportConversations.profileId, profileId), sql`${supportConversations.status} != 'closed'`))
      .orderBy(desc(supportConversations.createdAt))
      .limit(1);
    if (existing) return existing;
    const [conv] = await db.insert(supportConversations).values({ profileId }).returning();
    return conv;
  }

  async getConversation(id: number): Promise<SupportConversation | undefined> {
    const [conv] = await db.select().from(supportConversations).where(eq(supportConversations.id, id));
    return conv;
  }

  async getConversationMessages(conversationId: number): Promise<SupportMessage[]> {
    return db.select().from(supportMessages).where(eq(supportMessages.conversationId, conversationId)).orderBy(supportMessages.createdAt);
  }

  async addMessage(data: { conversationId: number; sender: SupportMessage["sender"]; senderProfileId?: number; message: string; fileUrl?: string; fileName?: string }): Promise<SupportMessage> {
    const [msg] = await db.insert(supportMessages).values(data).returning();
    await db.update(supportConversations).set({ updatedAt: new Date() }).where(eq(supportConversations.id, data.conversationId));
    return msg;
  }

  async updateConversationStatus(id: number, status: SupportConversation["status"]): Promise<SupportConversation> {
    const [conv] = await db.update(supportConversations).set({ status, updatedAt: new Date() }).where(eq(supportConversations.id, id)).returning();
    return conv;
  }

  async closeConversationWithRating(id: number, rating: number, closedBy: string): Promise<SupportConversation> {
    const [conv] = await db.update(supportConversations)
      .set({ status: "closed", rating, closedBy, updatedAt: new Date() })
      .where(eq(supportConversations.id, id))
      .returning();
    return conv;
  }

  async getInactiveConversations(minutesInactive: number): Promise<SupportConversation[]> {
    const cutoff = new Date(Date.now() - minutesInactive * 60 * 1000);
    return db.select().from(supportConversations)
      .where(and(
        sql`${supportConversations.status} != 'closed'`,
        sql`${supportConversations.updatedAt} < ${cutoff}`
      ));
  }

  async getQuickReplies(): Promise<SupportQuickReply[]> {
    return db.select().from(supportQuickReplies)
      .orderBy(supportQuickReplies.sortOrder, supportQuickReplies.shortcut);
  }

  async getQuickReplyByShortcut(shortcut: string): Promise<SupportQuickReply | undefined> {
    const [qr] = await db.select().from(supportQuickReplies)
      .where(sql`lower(${supportQuickReplies.shortcut}) = lower(${shortcut})`);
    return qr;
  }

  async getQuickReplyById(id: number): Promise<SupportQuickReply | undefined> {
    const [qr] = await db.select().from(supportQuickReplies)
      .where(eq(supportQuickReplies.id, id));
    return qr;
  }

  async createQuickReply(data: InsertSupportQuickReply): Promise<SupportQuickReply> {
    const [qr] = await db.insert(supportQuickReplies).values({
      shortcut: data.shortcut,
      label: data.label,
      message: data.message,
      sortOrder: data.sortOrder ?? 0,
    }).returning();
    return qr;
  }

  async updateQuickReply(id: number, data: Partial<InsertSupportQuickReply>): Promise<SupportQuickReply | undefined> {
    const updates: Record<string, any> = {};
    if (data.shortcut !== undefined) updates.shortcut = data.shortcut;
    if (data.label !== undefined) updates.label = data.label;
    if (data.message !== undefined) updates.message = data.message;
    if (data.sortOrder !== undefined) updates.sortOrder = data.sortOrder;
    if (Object.keys(updates).length === 0) {
      const [existing] = await db.select().from(supportQuickReplies).where(eq(supportQuickReplies.id, id));
      return existing;
    }
    const [qr] = await db.update(supportQuickReplies).set(updates).where(eq(supportQuickReplies.id, id)).returning();
    return qr;
  }

  async deleteQuickReply(id: number): Promise<void> {
    await db.delete(supportQuickReplies).where(eq(supportQuickReplies.id, id));
  }

  async getAllConversations(): Promise<(SupportConversation & { profile: Profile; lastMessage?: string; unreadCount: number })[]> {
    const results = await db.select().from(supportConversations)
      .innerJoin(profiles, eq(supportConversations.profileId, profiles.id))
      .orderBy(desc(supportConversations.updatedAt));
    const convos = [];
    for (const r of results) {
      const [lastMsg] = await db.select().from(supportMessages)
        .where(eq(supportMessages.conversationId, r.support_conversations.id))
        .orderBy(desc(supportMessages.createdAt))
        .limit(1);
      const [unreadResult] = await db.select({ count: sql<number>`count(*)::int` })
        .from(supportMessages)
        .where(and(
          eq(supportMessages.conversationId, r.support_conversations.id),
          eq(supportMessages.sender, "user")
        ));
      convos.push({
        ...r.support_conversations,
        profile: r.profiles,
        lastMessage: lastMsg?.message,
        unreadCount: unreadResult?.count || 0,
      });
    }
    return convos;
  }

  async getUnreadSupportCount(profileId: number): Promise<number> {
    const [conv] = await db.select().from(supportConversations)
      .where(and(eq(supportConversations.profileId, profileId), sql`${supportConversations.status} != 'closed'`))
      .limit(1);
    if (!conv) return 0;
    const [result] = await db.select({ count: sql<number>`count(*)::int` })
      .from(supportMessages)
      .where(and(
        eq(supportMessages.conversationId, conv.id),
        sql`${supportMessages.sender} IN ('bot', 'admin')`,
        sql`${supportMessages.createdAt} > (SELECT COALESCE(MAX(created_at), '1970-01-01') FROM support_messages WHERE conversation_id = ${conv.id} AND sender = 'user')`
      ));
    return result?.count || 0;
  }

  async createVirtualCard(data: { profileId: number; cardId: string; cardType: string; nameOnCard: string; last4?: string; brand?: string; status?: VirtualCard["status"]; balance?: string; currency?: string; cardDetail?: any }): Promise<VirtualCard> {
    const [card] = await db.insert(virtualCards).values(data).returning();
    return card;
  }

  async getVirtualCards(profileId: number): Promise<VirtualCard[]> {
    return db.select().from(virtualCards)
      .where(and(eq(virtualCards.profileId, profileId), ne(virtualCards.status, "cancelled")))
      .orderBy(desc(virtualCards.createdAt));
  }

  async getVirtualCard(id: number, profileId: number): Promise<VirtualCard | undefined> {
    const [card] = await db.select().from(virtualCards).where(and(eq(virtualCards.id, id), eq(virtualCards.profileId, profileId)));
    return card;
  }

  async getVirtualCardById(id: number): Promise<VirtualCard | undefined> {
    const [card] = await db.select().from(virtualCards).where(eq(virtualCards.id, id));
    return card;
  }

  async getAllPendingVirtualCards(): Promise<any[]> {
    return db
      .select({
        id: virtualCards.id,
        cardId: virtualCards.cardId,
        profileId: virtualCards.profileId,
        nameOnCard: virtualCards.nameOnCard,
        balance: virtualCards.balance,
        status: virtualCards.status,
        cardDetail: virtualCards.cardDetail,
        createdAt: virtualCards.createdAt,
        profileName: profiles.fullName,
        profileEmail: profiles.email,
        profilePhone: profiles.phone,
        strowalletCustomerId: profiles.strowalletCustomerId,
      })
      .from(virtualCards)
      .innerJoin(profiles, eq(virtualCards.profileId, profiles.id))
      .where(
        // Catch both: explicitly pending status OR wrongly-active cards with a pending_ ID
        sql`(${virtualCards.status} = 'pending' OR ${virtualCards.cardId} LIKE 'pending_%')`
      )
      .orderBy(desc(virtualCards.createdAt));
  }

  async getVirtualCardByCardId(cardId: string): Promise<VirtualCard | undefined> {
    const [card] = await db.select().from(virtualCards).where(eq(virtualCards.cardId, cardId));
    return card;
  }

  async updateVirtualCard(id: number, data: Partial<VirtualCard>): Promise<VirtualCard> {
    const [card] = await db.update(virtualCards).set(data).where(eq(virtualCards.id, id)).returning();
    return card;
  }

  async deleteVirtualCard(id: number, profileId: number): Promise<VirtualCard | undefined> {
    const [card] = await db.delete(virtualCards)
      .where(and(eq(virtualCards.id, id), eq(virtualCards.profileId, profileId)))
      .returning();
    return card;
  }

  async createCardTransaction(data: { cardId: number; profileId: number; type: string; amount: string; currency?: string; description?: string }): Promise<CardTransaction> {
    const [tx] = await db.insert(cardTransactions).values({
      cardId: data.cardId,
      profileId: data.profileId,
      type: data.type,
      amount: data.amount,
      currency: data.currency ?? "USD",
      description: data.description ?? null,
    }).returning();
    return tx;
  }

  async getCardTransactions(cardId: number, profileId: number): Promise<CardTransaction[]> {
    return db.select().from(cardTransactions)
      .where(and(eq(cardTransactions.cardId, cardId), eq(cardTransactions.profileId, profileId)))
      .orderBy(desc(cardTransactions.createdAt));
  }

  // ── NFC Virtual Cards ─────────────────────────────────────────
  async createNfcCard(data: { profileId: number; cardId: string; nameOnCard: string; last4?: string; brand?: string; status?: NfcCard["status"]; balance?: string; currency?: string; cardDetail?: any }): Promise<NfcCard> {
    const [card] = await db.insert(nfcCards).values(data).returning();
    return card;
  }
  async getNfcCards(profileId: number): Promise<NfcCard[]> {
    return db.select().from(nfcCards)
      .where(and(eq(nfcCards.profileId, profileId), ne(nfcCards.status, "cancelled")))
      .orderBy(desc(nfcCards.createdAt));
  }
  async getNfcCard(id: number, profileId: number): Promise<NfcCard | undefined> {
    const [card] = await db.select().from(nfcCards).where(and(eq(nfcCards.id, id), eq(nfcCards.profileId, profileId)));
    return card;
  }
  async getNfcCardById(id: number): Promise<NfcCard | undefined> {
    const [card] = await db.select().from(nfcCards).where(eq(nfcCards.id, id));
    return card;
  }
  async updateNfcCard(id: number, data: Partial<NfcCard>): Promise<NfcCard> {
    const [card] = await db.update(nfcCards).set(data).where(eq(nfcCards.id, id)).returning();
    return card;
  }
  async getAllPendingNfcCards(): Promise<any[]> {
    // Status is the source of truth — once set to 'cancelled' or 'active' the card must
    // disappear from the pending list even though its placeholder cardId still starts with 'pending_'.
    return db
      .select({
        id: nfcCards.id,
        cardId: nfcCards.cardId,
        profileId: nfcCards.profileId,
        nameOnCard: nfcCards.nameOnCard,
        balance: nfcCards.balance,
        status: nfcCards.status,
        cardDetail: nfcCards.cardDetail,
        createdAt: nfcCards.createdAt,
        profileName: profiles.fullName,
        profileEmail: profiles.email,
        profilePhone: profiles.phone,
      })
      .from(nfcCards)
      .innerJoin(profiles, eq(nfcCards.profileId, profiles.id))
      .where(eq(nfcCards.status, "pending"))
      .orderBy(desc(nfcCards.createdAt));
  }
  async createNfcCardTransaction(data: { cardId: number; profileId: number; type: string; amount: string; currency?: string; description?: string; providerTxId?: string | null }): Promise<NfcCardTransaction> {
    const [tx] = await db.insert(nfcCardTransactions).values({
      cardId: data.cardId,
      profileId: data.profileId,
      type: data.type,
      amount: data.amount,
      currency: data.currency ?? "USD",
      description: data.description ?? null,
      providerTxId: data.providerTxId ?? null,
    }).returning();
    return tx;
  }
  async getAllActiveNfcCards(): Promise<NfcCard[]> {
    // Active cards that have not hit the auto-hide threshold. Used by the
    // spend-transaction poller.
    return db.select().from(nfcCards)
      .where(and(eq(nfcCards.status, "active"), sql`${nfcCards.failedAttempts} < 5`));
  }
  async getNfcCardTransactions(cardId: number, profileId: number): Promise<NfcCardTransaction[]> {
    return db.select().from(nfcCardTransactions)
      .where(and(eq(nfcCardTransactions.cardId, cardId), eq(nfcCardTransactions.profileId, profileId)))
      .orderBy(desc(nfcCardTransactions.createdAt));
  }

  async createTopUpTransaction(data: { profileId: number; operatorId: string; operatorName: string; phone: string; amountUsd: string; transactionId?: string; status?: string }): Promise<TopUpTransaction> {
    const [tx] = await db.insert(topUpTransactions).values({
      profileId: data.profileId,
      operatorId: data.operatorId,
      operatorName: data.operatorName,
      phone: data.phone,
      amountUsd: data.amountUsd,
      transactionId: data.transactionId ?? null,
      status: data.status ?? "success",
    }).returning();
    return tx;
  }

  async getTopUpTransactions(profileId: number): Promise<TopUpTransaction[]> {
    return db.select().from(topUpTransactions)
      .where(eq(topUpTransactions.profileId, profileId))
      .orderBy(desc(topUpTransactions.createdAt))
      .limit(20);
  }

  async getProfileByReferenceId(referenceId: string): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles).where(eq(profiles.referenceId, referenceId));
    return profile;
  }

  async getProfileByDepositAddress(address: string): Promise<Profile | undefined> {
    const normalized = address.trim();
    const [profile] = await db.select().from(profiles).where(
      or(
        eq(profiles.trc20DepositAddress, normalized),
        eq(profiles.bep20DepositAddress, normalized),
      )
    );
    return profile;
  }

  async updateDepositAddresses(profileId: number, trc20?: string | null, bep20?: string | null): Promise<void> {
    const data: Partial<typeof profiles.$inferSelect> = {};
    if (trc20 !== undefined) data.trc20DepositAddress = trc20;
    if (bep20 !== undefined) data.bep20DepositAddress = bep20;
    if (Object.keys(data).length > 0) {
      await db.update(profiles).set(data).where(eq(profiles.id, profileId));
    }
  }

  async searchProfiles(query: string): Promise<Profile[]> {
    return db.select().from(profiles).where(
      or(
        ilike(profiles.referenceId, `%${query}%`),
        ilike(profiles.fullName, `%${query}%`),
        ilike(profiles.email, `%${query}%`),
        ilike(profiles.phone, `%${query}%`),
        ilike(profiles.firstName, `%${query}%`),
        ilike(profiles.lastName, `%${query}%`)
      )
    ).orderBy(desc(profiles.createdAt));
  }

  async softDeleteProfile(id: number): Promise<void> {
    await db.update(profiles).set({ isDeleted: true, deletedAt: new Date() }).where(eq(profiles.id, id));
  }

  async addToBlacklist(data: { email?: string; phone?: string; firstName?: string; lastName?: string; dateOfBirth?: string; idDocumentUrl?: string; idDocumentBackUrl?: string; selfieUrl?: string; reason?: string; originalProfileId?: number; referenceId?: string }): Promise<BlacklistedUser> {
    const [entry] = await db.insert(blacklistedUsers).values(data).returning();
    return entry;
  }

  async createP2PTransfer(data: { senderProfileId: number; receiverProfileId: number; amount: string; note?: string; transactionId?: string; receiptId?: string }): Promise<P2PTransfer> {
    const [transfer] = await db.insert(p2pTransfers).values(data).returning();
    return transfer;
  }

  async getP2PTransferById(id: number): Promise<P2PTransfer | undefined> {
    const [transfer] = await db.select().from(p2pTransfers).where(eq(p2pTransfers.id, id));
    return transfer;
  }

  async getP2PTransferByReceiptId(receiptId: string): Promise<P2PTransfer | undefined> {
    const [transfer] = await db.select().from(p2pTransfers).where(eq(p2pTransfers.receiptId, receiptId));
    return transfer;
  }

  async setP2PTransferReceipt(id: number, receiptId: string): Promise<P2PTransfer> {
    const [updated] = await db.update(p2pTransfers)
      .set({ receiptId })
      .where(and(eq(p2pTransfers.id, id), isNull(p2pTransfers.receiptId)))
      .returning();
    if (updated) return updated;
    const [existing] = await db.select().from(p2pTransfers).where(eq(p2pTransfers.id, id));
    return existing;
  }

  async getP2PTransfers(profileId: number): Promise<P2PTransfer[]> {
    return db.select().from(p2pTransfers).where(
      or(
        eq(p2pTransfers.senderProfileId, profileId),
        eq(p2pTransfers.receiverProfileId, profileId)
      )
    ).orderBy(desc(p2pTransfers.createdAt));
  }

  async isBlacklisted(email: string, phone?: string, firstName?: string, lastName?: string, dateOfBirth?: string): Promise<boolean> {
    const conditions = [eq(blacklistedUsers.email, email)];
    if (phone) conditions.push(eq(blacklistedUsers.phone, phone));
    const [result] = await db.select({ count: sql<number>`count(*)::int` }).from(blacklistedUsers).where(or(...conditions));
    if (result?.count > 0) return true;

    if (firstName && lastName && dateOfBirth) {
      const [nameMatch] = await db.select({ count: sql<number>`count(*)::int` }).from(blacklistedUsers).where(
        and(
          ilike(blacklistedUsers.firstName, firstName),
          ilike(blacklistedUsers.lastName, lastName),
          eq(blacklistedUsers.dateOfBirth, dateOfBirth)
        )
      );
      if (nameMatch?.count > 0) return true;
    }

    return false;
  }

  async createLoginLog(profileId: number, method: string, ipAddress?: string, deviceInfo?: string): Promise<void> {
    await db.insert(loginLogs).values({ profileId, method, ipAddress, deviceInfo } as any);
  }

  async getLoginActivity(limit = 200): Promise<(LoginLog & { profile: Pick<Profile, "id" | "fullName" | "email"> })[]> {
    const rows = await db
      .select({
        id: loginLogs.id,
        profileId: loginLogs.profileId,
        method: loginLogs.method,
        ipAddress: loginLogs.ipAddress,
        loginAt: loginLogs.loginAt,
        profile: {
          id: profiles.id,
          fullName: profiles.fullName,
          email: profiles.email,
        },
      })
      .from(loginLogs)
      .leftJoin(profiles, eq(loginLogs.profileId, profiles.id))
      .orderBy(desc(loginLogs.loginAt))
      .limit(limit);
    return rows as any;
  }

  async getLoginCount(profileId: number): Promise<number> {
    const [row] = await db.select({ count: sql<number>`count(*)` }).from(loginLogs).where(eq(loginLogs.profileId, profileId));
    return Number(row?.count ?? 0);
  }

  async updateProfileIp(id: number, ip: string, loginAt?: Date): Promise<void> {
    const updates: Record<string, any> = { lastIp: ip };
    if (loginAt) updates.lastLoginAt = loginAt;
    await db.update(profiles).set(updates).where(eq(profiles.id, id));
  }

  async createSecurityEvent(data: { profileId?: number; eventType: string; ipAddress?: string; deviceInfo?: string; details?: string; status?: string }): Promise<void> {
    await db.execute(sql`
      INSERT INTO security_events (profile_id, event_type, ip_address, device_info, details, status)
      VALUES (${data.profileId ?? null}, ${data.eventType}, ${data.ipAddress ?? null}, ${data.deviceInfo ?? null}, ${data.details ?? null}, ${data.status ?? 'info'})
    `);
  }

  async getSecurityEvents(profileId?: number, limit = 200): Promise<SecurityEvent[]> {
    if (profileId) {
      const rows = await db.execute(sql`SELECT * FROM security_events WHERE profile_id = ${profileId} ORDER BY created_at DESC LIMIT ${limit}`);
      return rows.rows as SecurityEvent[];
    }
    const rows = await db.execute(sql`SELECT * FROM security_events ORDER BY created_at DESC LIMIT ${limit}`);
    return rows.rows as SecurityEvent[];
  }

  async createBalanceLog(data: { profileId: number; previousBalance: number; newBalance: number; change: number; action: string; referenceId?: string; adminId?: number }): Promise<void> {
    await db.execute(sql`
      INSERT INTO balance_logs (profile_id, previous_balance, new_balance, change, action, reference_id, admin_id)
      VALUES (${data.profileId}, ${data.previousBalance}, ${data.newBalance}, ${data.change}, ${data.action}, ${data.referenceId ?? null}, ${data.adminId ?? null})
    `);
  }

  async getBalanceLogs(profileId?: number, limit = 200): Promise<BalanceLog[]> {
    if (profileId) {
      const rows = await db.execute(sql`SELECT * FROM balance_logs WHERE profile_id = ${profileId} ORDER BY created_at DESC LIMIT ${limit}`);
      return rows.rows as BalanceLog[];
    }
    const rows = await db.execute(sql`SELECT * FROM balance_logs ORDER BY created_at DESC LIMIT ${limit}`);
    return rows.rows as BalanceLog[];
  }

  async getUserActivity(profileId: number): Promise<any> {
    const [user] = await db.select().from(profiles).where(eq(profiles.id, profileId));
    if (!user) return null;

    const [deps, withs, p2pSent, p2pRec, loginActivity, secEvts, balLogs, cards, topups] = await Promise.all([
      db.execute(sql`SELECT id, amount_usdt, amount_htg, deposit_method, status, created_at, ip_address, moncash_transaction_id, nowpayments_payment_id, rejection_reason FROM deposits WHERE profile_id = ${profileId} ORDER BY created_at DESC LIMIT 50`),
      db.execute(sql`SELECT id, amount, currency, status, created_at, ip_address, trc_address, fee FROM withdrawals WHERE profile_id = ${profileId} ORDER BY created_at DESC LIMIT 50`),
      db.execute(sql`SELECT pt.*, p.full_name as receiver_name, p.email as receiver_email FROM p2p_transfers pt LEFT JOIN profiles p ON p.id = pt.receiver_profile_id WHERE pt.sender_profile_id = ${profileId} ORDER BY pt.created_at DESC LIMIT 30`),
      db.execute(sql`SELECT pt.*, p.full_name as sender_name, p.email as sender_email FROM p2p_transfers pt LEFT JOIN profiles p ON p.id = pt.sender_profile_id WHERE pt.receiver_profile_id = ${profileId} ORDER BY pt.created_at DESC LIMIT 30`),
      db.execute(sql`SELECT * FROM login_logs WHERE profile_id = ${profileId} ORDER BY login_at DESC LIMIT 50`),
      db.execute(sql`SELECT * FROM security_events WHERE profile_id = ${profileId} ORDER BY created_at DESC LIMIT 50`),
      db.execute(sql`SELECT * FROM balance_logs WHERE profile_id = ${profileId} ORDER BY created_at DESC LIMIT 50`),
      db.execute(sql`SELECT * FROM virtual_cards WHERE profile_id = ${profileId} ORDER BY created_at DESC`),
      db.execute(sql`SELECT * FROM top_up_transactions WHERE profile_id = ${profileId} ORDER BY created_at DESC LIMIT 30`),
    ]);

    return {
      profile: user,
      deposits: deps.rows,
      withdrawals: withs.rows,
      p2pSent: p2pSent.rows,
      p2pReceived: p2pRec.rows,
      loginLogs: loginActivity.rows,
      securityEvents: secEvts.rows,
      balanceLogs: balLogs.rows,
      cards: cards.rows,
      topUps: topups.rows,
    };
  }

  async getGlobalAuditLog(limit = 200, filterType?: string): Promise<any[]> {
    const entries: any[] = [];

    if (!filterType || filterType === "all" || filterType === "deposit") {
      const deps = await db.execute(sql`
        SELECT d.id, d.profile_id, p.full_name, p.email, d.amount_usdt, d.deposit_method, d.status, d.ip_address, d.created_at, 'deposit' as entry_type
        FROM deposits d LEFT JOIN profiles p ON p.id = d.profile_id
        ORDER BY d.created_at DESC LIMIT 100
      `);
      entries.push(...(deps.rows as any[]).map(r => ({ ...r, entryType: "deposit" })));
    }

    if (!filterType || filterType === "all" || filterType === "withdrawal") {
      const withs = await db.execute(sql`
        SELECT w.id, w.profile_id, p.full_name, p.email, w.amount, w.currency, w.status, w.ip_address, w.created_at, 'withdrawal' as entry_type
        FROM withdrawals w LEFT JOIN profiles p ON p.id = w.profile_id
        ORDER BY w.created_at DESC LIMIT 100
      `);
      entries.push(...(withs.rows as any[]).map(r => ({ ...r, entryType: "withdrawal" })));
    }

    if (!filterType || filterType === "all" || filterType === "security") {
      const sec = await db.execute(sql`
        SELECT se.*, p.full_name, p.email
        FROM security_events se LEFT JOIN profiles p ON p.id = se.profile_id
        ORDER BY se.created_at DESC LIMIT 100
      `);
      entries.push(...(sec.rows as any[]).map(r => ({ ...r, entryType: "security" })));
    }

    if (!filterType || filterType === "all" || filterType === "login") {
      const logins = await db.execute(sql`
        SELECT ll.*, p.full_name, p.email
        FROM login_logs ll LEFT JOIN profiles p ON p.id = ll.profile_id
        ORDER BY ll.login_at DESC LIMIT 100
      `);
      entries.push(...(logins.rows as any[]).map(r => ({ ...r, entryType: "login", created_at: r.login_at })));
    }

    if (!filterType || filterType === "all" || filterType === "p2p") {
      const p2p = await db.execute(sql`
        SELECT pt.*, s.full_name as sender_name, s.email as sender_email, r.full_name as receiver_name, r.email as receiver_email
        FROM p2p_transfers pt
        LEFT JOIN profiles s ON s.id = pt.sender_profile_id
        LEFT JOIN profiles r ON r.id = pt.receiver_profile_id
        ORDER BY pt.created_at DESC LIMIT 50
      `);
      entries.push(...(p2p.rows as any[]).map(r => ({ ...r, entryType: "p2p" })));
    }

    if (!filterType || filterType === "all" || filterType === "balance") {
      const bals = await db.execute(sql`
        SELECT bl.*, p.full_name, p.email
        FROM balance_logs bl LEFT JOIN profiles p ON p.id = bl.profile_id
        ORDER BY bl.created_at DESC LIMIT 100
      `);
      entries.push(...(bals.rows as any[]).map(r => ({ ...r, entryType: "balance" })));
    }

    entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return entries.slice(0, limit);
  }

  async getMultiAccountAlerts(): Promise<any[]> {
    const rows = await db.execute(sql`
      SELECT
        ip_address,
        array_agg(DISTINCT profile_id ORDER BY profile_id) as profile_ids,
        array_agg(DISTINCT full_name ORDER BY full_name) as user_names,
        array_agg(DISTINCT email ORDER BY email) as emails,
        COUNT(DISTINCT profile_id) as user_count,
        MAX(login_at) as last_seen
      FROM login_logs ll
      LEFT JOIN profiles p ON p.id = ll.profile_id
      WHERE ip_address IS NOT NULL AND ip_address != '::1' AND ip_address != '127.0.0.1'
      GROUP BY ip_address
      HAVING COUNT(DISTINCT profile_id) > 1
      ORDER BY user_count DESC, last_seen DESC
      LIMIT 50
    `);
    return rows.rows as any[];
  }

  async getWithdrawalRiskInfo(withdrawalId: number): Promise<any> {
    const result = await db.execute(sql`
      SELECT w.*, p.full_name, p.email, p.last_ip, p.id as uid
      FROM withdrawals w LEFT JOIN profiles p ON p.id = w.profile_id
      WHERE w.id = ${withdrawalId}
    `);
    const [w] = result.rows as any[];
    if (!w) return null;
    const withdrawal = (w as any);
    const profileId = withdrawal.profile_id;
    const withdrawalIp = withdrawal.ip_address;

    const recentLogins = await db.execute(sql`
      SELECT DISTINCT ip_address FROM login_logs
      WHERE profile_id = ${profileId}
      ORDER BY login_at DESC LIMIT 5
    `);
    const loginIps = (recentLogins.rows as any[]).map(r => r.ip_address).filter(Boolean);

    const ipChanged = withdrawalIp && loginIps.length > 0 && !loginIps.includes(withdrawalIp);

    const sharedIpUsers = withdrawalIp ? await db.execute(sql`
      SELECT DISTINCT ll.profile_id, p.full_name, p.email
      FROM login_logs ll LEFT JOIN profiles p ON p.id = ll.profile_id
      WHERE ll.ip_address = ${withdrawalIp} AND ll.profile_id != ${profileId}
      LIMIT 10
    `) : { rows: [] };

    const failedLogins = await db.execute(sql`
      SELECT COUNT(*) as count FROM security_events
      WHERE profile_id = ${profileId} AND event_type = 'failed_login'
        AND created_at > NOW() - INTERVAL '24 hours'
    `);

    return {
      withdrawal,
      riskFlags: {
        ipChanged: ipChanged,
        withdrawalIp,
        recentLoginIps: loginIps,
        sharedIpUsers: sharedIpUsers.rows,
        failedLoginsLast24h: Number((failedLogins.rows[0] as any)?.count ?? 0),
        multiAccountAlert: (sharedIpUsers.rows as any[]).length > 0,
      },
    };
  }

  async createUserReport(data: {
    reporterProfileId: number;
    reportedIdentifier: string;
    reportedProfileId?: number | null;
    reason: string;
    description: string;
    proofImageUrl?: string | null;
  }): Promise<UserReport> {
    const [row] = await db.insert(userReports).values({
      reporterProfileId: data.reporterProfileId,
      reportedIdentifier: data.reportedIdentifier,
      reportedProfileId: data.reportedProfileId ?? null,
      reason: data.reason,
      description: data.description,
      proofImageUrl: data.proofImageUrl ?? null,
      status: "pending",
    }).returning();
    return row;
  }

  async getUserReports(limit = 200): Promise<any[]> {
    const rows = await db.execute(sql`
      SELECT ur.*,
        rp.full_name as reporter_name, rp.email as reporter_email,
        tp.full_name as reported_name, tp.email as reported_email
      FROM user_reports ur
      LEFT JOIN profiles rp ON rp.id = ur.reporter_profile_id
      LEFT JOIN profiles tp ON tp.id = ur.reported_profile_id
      ORDER BY ur.created_at DESC LIMIT ${limit}
    `);
    return rows.rows as any[];
  }

  async updateUserReportStatus(id: number, status: string, adminNote?: string): Promise<UserReport | null> {
    const [row] = await db.update(userReports)
      .set({ status, adminNote: adminNote ?? null, reviewedAt: new Date() })
      .where(eq(userReports.id, id))
      .returning();
    return row ?? null;
  }

  // ── Referral / Affiliate system ──────────────────────────────────

  async getProfileByReferralCode(code: string): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles).where(eq(profiles.referralCode, code));
    return profile;
  }

  async generateReferralCode(profileId: number): Promise<string> {
    const code = `IZI${profileId}${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    await db.update(profiles).set({ referralCode: code }).where(eq(profiles.id, profileId));
    return code;
  }

  async createReferralEarning(data: { referrerId: number; refereeId: number; type: "registration" | "kyc" | "deposit"; amount: number; description?: string }): Promise<ReferralEarning> {
    const [row] = await db.insert(referralEarnings).values({
      referrerId: data.referrerId,
      refereeId: data.refereeId,
      type: data.type,
      amount: data.amount.toFixed(2),
      description: data.description ?? null,
    }).returning();
    return row;
  }

  async creditReferralBalance(profileId: number, amount: number): Promise<void> {
    await db.execute(sql`
      UPDATE profiles SET referral_balance = COALESCE(referral_balance, 0) + ${amount} WHERE id = ${profileId}
    `);
  }

  async getReferralStats(profileId: number): Promise<{ referrals: any[]; totalEarned: number; pendingPayout: number }> {
    const referrals = await db.execute(sql`
      SELECT p.id, p.full_name, p.email, p.kyc_status, p.created_at,
        COALESCE(re.total_earned, 0) as earned_from_this
      FROM profiles p
      LEFT JOIN (
        SELECT referee_id, SUM(amount::numeric) as total_earned
        FROM referral_earnings WHERE referrer_id = ${profileId}
        GROUP BY referee_id
      ) re ON re.referee_id = p.id
      WHERE p.referred_by_id = ${profileId}
      ORDER BY p.created_at DESC
    `);

    const totals = await db.execute(sql`
      SELECT COALESCE(SUM(amount::numeric), 0) as total
      FROM referral_earnings WHERE referrer_id = ${profileId}
    `);

    const pending = await db.execute(sql`
      SELECT COALESCE(SUM(amount::numeric), 0) as total
      FROM referral_payout_requests
      WHERE profile_id = ${profileId} AND status = 'pending'
    `);

    return {
      referrals: referrals.rows as any[],
      totalEarned: Number((totals.rows[0] as any)?.total ?? 0),
      pendingPayout: Number((pending.rows[0] as any)?.total ?? 0),
    };
  }

  async createReferralPayoutRequest(profileId: number, amount: number): Promise<ReferralPayoutRequest> {
    const [row] = await db.insert(referralPayoutRequests).values({
      profileId,
      amount: amount.toFixed(2),
      status: "pending",
    }).returning();
    return row;
  }

  async getReferralPayoutRequests(profileId?: number): Promise<any[]> {
    const rows = await db.execute(sql`
      SELECT rpr.*, p.full_name, p.email, p.referral_balance
      FROM referral_payout_requests rpr
      LEFT JOIN profiles p ON p.id = rpr.profile_id
      ${profileId ? sql`WHERE rpr.profile_id = ${profileId}` : sql``}
      ORDER BY rpr.created_at DESC
    `);
    return rows.rows as any[];
  }

  async updateReferralPayoutRequest(id: number, status: "approved" | "rejected", adminNote?: string): Promise<ReferralPayoutRequest | null> {
    const [row] = await db.update(referralPayoutRequests)
      .set({ status, adminNote: adminNote ?? null, reviewedAt: new Date() })
      .where(eq(referralPayoutRequests.id, id))
      .returning();
    return row ?? null;
  }

  async hasPendingReferralPayout(profileId: number): Promise<boolean> {
    const rows = await db.execute(sql`
      SELECT 1 FROM referral_payout_requests WHERE profile_id = ${profileId} AND status = 'pending' LIMIT 1
    `);
    return (rows.rows as any[]).length > 0;
  }

  // ===== Merchant API =====
  async getMerchantByProfile(profileId: number): Promise<Merchant | undefined> {
    const [m] = await db.select().from(merchants).where(eq(merchants.profileId, profileId));
    return m;
  }
  async getMerchantBySecretKey(key: string): Promise<Merchant | undefined> {
    const [m] = await db.select().from(merchants).where(eq(merchants.apiSecretKey, key));
    return m;
  }
  async getMerchantByPublicKey(key: string): Promise<Merchant | undefined> {
    const [m] = await db.select().from(merchants).where(eq(merchants.apiPublicKey, key));
    return m;
  }
  async getMerchantById(id: number): Promise<Merchant | undefined> {
    const [m] = await db.select().from(merchants).where(eq(merchants.id, id));
    return m;
  }
  async createMerchant(profileId: number, businessName: string): Promise<Merchant> {
    const apiPublicKey = "izi_pk_" + crypto.randomBytes(18).toString("hex");
    const apiSecretKey = "izi_sk_" + crypto.randomBytes(28).toString("hex");
    const profile = await this.getProfile(profileId);
    const [m] = await db.insert(merchants).values({
      profileId,
      merchantId: `mch_${crypto.randomBytes(6).toString("hex")}`,
      businessName,
      email: profile?.email,
      phone: profile?.phone,
      country: profile?.country,
      accountStatus: profile?.kycStatus === "verified" ? "active" : "pending",
      kycStatus: profile?.kycStatus === "verified" ? "verified" : "not_started",
      paymentEnabled: profile?.kycStatus === "verified",
      payoutEnabled: profile?.kycStatus === "verified",
      apiPublicKey,
      apiSecretKey,
    }).returning();
    return m;
  }
  async updateMerchant(profileId: number, data: { businessName?: string; webhookUrl?: string | null }): Promise<Merchant | undefined> {
    const update: any = {};
    if (data.businessName !== undefined) update.businessName = data.businessName;
    if (data.webhookUrl !== undefined) update.webhookUrl = data.webhookUrl || null;
    if (Object.keys(update).length === 0) return this.getMerchantByProfile(profileId);
    update.updatedAt = new Date();
    const [m] = await db.update(merchants).set(update).where(eq(merchants.profileId, profileId)).returning();
    return m;
  }
  async rotateMerchantKeys(profileId: number): Promise<Merchant | undefined> {
    const apiPublicKey = "izi_pk_" + crypto.randomBytes(18).toString("hex");
    const apiSecretKey = "izi_sk_" + crypto.randomBytes(28).toString("hex");
    const [m] = await db.update(merchants).set({ apiPublicKey, apiSecretKey }).where(eq(merchants.profileId, profileId)).returning();
    return m;
  }
  async createMerchantTransaction(data: any): Promise<MerchantTransaction> {
    const [t] = await db.insert(merchantTransactions).values(data).returning();
    return t;
  }
  async getMerchantTransactionByPaymentId(paymentId: string): Promise<MerchantTransaction | undefined> {
    const [t] = await db.select().from(merchantTransactions).where(eq(merchantTransactions.paymentId, paymentId));
    return t;
  }
  async createPayoutRequest(data: InsertPayoutRequest): Promise<PayoutRequest> {
    const [r] = await db.insert(payoutRequests).values(data).returning();
    return r;
  }
  async getPayoutRequestsByUser(userId: number): Promise<PayoutRequest[]> {
    return db.select().from(payoutRequests).where(eq(payoutRequests.userId, userId)).orderBy(desc(payoutRequests.createdAt));
  }
  async getAllPayoutRequests(): Promise<PayoutRequest[]> {
    return db.select().from(payoutRequests).orderBy(desc(payoutRequests.createdAt));
  }
  async getPayoutRequestById(id: number): Promise<PayoutRequest | undefined> {
    const [r] = await db.select().from(payoutRequests).where(eq(payoutRequests.id, id));
    return r;
  }
  async updatePayoutRequestStatus(id: number, status: "approved" | "rejected", adminId: number, adminNote?: string): Promise<PayoutRequest | undefined> {
    const [r] = await db.update(payoutRequests)
      .set({ status, adminNote: adminNote ?? null, processedAt: new Date(), processedBy: adminId })
      .where(and(eq(payoutRequests.id, id), eq(payoutRequests.status, "pending")))
      .returning();
    return r;
  }

  async getMerchantPaymentsAsBuyer(profileId: number, limit = 100): Promise<MerchantTransaction[]> {
    return db.select().from(merchantTransactions)
      .where(eq(merchantTransactions.payerProfileId, profileId))
      .orderBy(desc(merchantTransactions.createdAt))
      .limit(limit);
  }

  async getMerchantTransactions(merchantId: number, limit = 100): Promise<MerchantTransaction[]> {
    return db.select().from(merchantTransactions)
      .where(eq(merchantTransactions.merchantId, merchantId))
      .orderBy(desc(merchantTransactions.createdAt))
      .limit(limit);
  }
  async markMerchantTransactionPaid(paymentId: string, payerProfileId: number): Promise<MerchantTransaction | undefined> {
    const [t] = await db.update(merchantTransactions)
      .set({ status: "completed", paidAt: new Date(), payerProfileId })
      .where(and(eq(merchantTransactions.paymentId, paymentId), eq(merchantTransactions.status, "pending")))
      .returning();
    return t;
  }
  async markMerchantTransactionExpired(paymentId: string): Promise<void> {
    await db.update(merchantTransactions)
      .set({ status: "expired" })
      .where(and(eq(merchantTransactions.paymentId, paymentId), eq(merchantTransactions.status, "pending")));
  }
  async incrementWebhookAttempt(paymentId: string, delivered: boolean): Promise<void> {
    await db.update(merchantTransactions)
      .set({ webhookDelivered: delivered, webhookAttempts: sql`${merchantTransactions.webhookAttempts} + 1` })
      .where(eq(merchantTransactions.paymentId, paymentId));
  }
  async getMerchantPayoutMethods(merchantId: number): Promise<MerchantPayoutMethod[]> {
    return db.select().from(merchantPayoutMethods).where(eq(merchantPayoutMethods.merchantId, merchantId)).orderBy(desc(merchantPayoutMethods.createdAt));
  }
  async createMerchantPayoutMethod(data: { merchantId: number; method: MerchantPayoutMethod["method"]; label?: string; encryptedDetails: string; maskedDetails: string; isDefault?: boolean }): Promise<MerchantPayoutMethod> {
    return db.transaction(async (tx) => {
      if (data.isDefault) await tx.update(merchantPayoutMethods).set({ isDefault: false }).where(eq(merchantPayoutMethods.merchantId, data.merchantId));
      const [row] = await tx.insert(merchantPayoutMethods).values(data).returning();
      return row;
    });
  }
  async deleteMerchantPayoutMethod(id: number, merchantId: number): Promise<boolean> {
    const result = await db.delete(merchantPayoutMethods).where(and(eq(merchantPayoutMethods.id, id), eq(merchantPayoutMethods.merchantId, merchantId)));
    return (result.rowCount || 0) > 0;
  }
  async getMerchantLedger(merchantId: number, limit = 100): Promise<MerchantLedgerEntry[]> {
    return db.select().from(merchantLedgerEntries).where(eq(merchantLedgerEntries.merchantId, merchantId)).orderBy(desc(merchantLedgerEntries.createdAt)).limit(limit);
  }
}

export const storage = new DatabaseStorage();
