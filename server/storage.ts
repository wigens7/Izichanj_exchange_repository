import { profiles, deposits, withdrawals, kycDocuments, otps, webauthnCredentials, notifications, supportConversations, supportMessages, virtualCards, blacklistedUsers, p2pTransfers, type Profile, type Deposit, type InsertDeposit, type Withdrawal, type InsertWithdrawal, type KycDocument, type WebAuthnCredential, type Notification, type SupportConversation, type SupportMessage, type VirtualCard, type BlacklistedUser, type P2PTransfer } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, or, ilike } from "drizzle-orm";
import crypto from "crypto";

export interface IStorage {
  getProfile(id: number): Promise<Profile | undefined>;
  getProfileByEmail(email: string): Promise<Profile | undefined>;
  getProfileByPhone(phone: string): Promise<Profile | undefined>;
  createProfile(fullName: string, email: string, passwordHash: string, phone?: string): Promise<Profile>;
  updateProfileBalance(id: number, balance: number): Promise<Profile>;
  updateProfilePassword(id: number, passwordHash: string): Promise<void>;
  markEmailVerified(id: number): Promise<void>;

  createOtp(profileId: number, code: string): Promise<void>;
  getValidOtp(profileId: number, code: string): Promise<typeof otps.$inferSelect | undefined>;
  markOtpVerified(id: number): Promise<void>;

  createDeposit(deposit: InsertDeposit & { profileId: number; depositMethod?: "usdt" | "moncash" | "nowpayments"; amountHtg?: string; moncashTransactionId?: string | null; nowpaymentsPaymentId?: string | null; payAddress?: string | null; payCurrency?: string | null }): Promise<Deposit>;
  getDeposits(profileId?: number): Promise<Deposit[]>;
  updateDepositStatus(id: number, status: "approved" | "rejected"): Promise<Deposit>;
  getDepositByMoncashTransactionId(transactionId: string): Promise<Deposit | undefined>;
  getDepositByNowpaymentsPaymentId(paymentId: string): Promise<Deposit | undefined>;

  createWithdrawal(withdrawal: InsertWithdrawal & { profileId: number }): Promise<Withdrawal>;
  getWithdrawals(profileId?: number): Promise<Withdrawal[]>;
  updateWithdrawalStatus(id: number, status: "approved" | "rejected"): Promise<Withdrawal>;

  createKyc(kyc: { profileId: number; idDocumentUrl: string; idDocumentBackUrl: string; selfieUrl: string }): Promise<KycDocument>;
  getKyc(profileId: number): Promise<KycDocument | undefined>;
  getAllKyc(): Promise<(KycDocument & { profile: Profile })[]>;
  updateKycStatus(profileId: number, status: "verified" | "rejected"): Promise<void>;
  updateProfile(id: number, data: Partial<Profile>): Promise<Profile>;
  setUserBanStatus(id: number, isBanned: boolean): Promise<Profile>;
  getAllProfiles(): Promise<Profile[]>;

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

  createVirtualCard(data: { profileId: number; cardId: string; cardType: string; nameOnCard: string; last4?: string; brand?: string; status?: VirtualCard["status"]; balance?: string; currency?: string; cardDetail?: any }): Promise<VirtualCard>;
  getVirtualCards(profileId: number): Promise<VirtualCard[]>;
  getVirtualCard(id: number, profileId: number): Promise<VirtualCard | undefined>;
  getVirtualCardByCardId(cardId: string): Promise<VirtualCard | undefined>;
  updateVirtualCard(id: number, data: Partial<VirtualCard>): Promise<VirtualCard>;

  createP2PTransfer(data: { senderProfileId: number; receiverProfileId: number; amount: string; note?: string }): Promise<P2PTransfer>;
  getP2PTransfers(profileId: number): Promise<P2PTransfer[]>;

  getProfileByReferenceId(referenceId: string): Promise<Profile | undefined>;
  searchProfiles(query: string): Promise<Profile[]>;
  softDeleteProfile(id: number): Promise<void>;
  addToBlacklist(data: { email?: string; phone?: string; firstName?: string; lastName?: string; dateOfBirth?: string; idDocumentUrl?: string; idDocumentBackUrl?: string; selfieUrl?: string; reason?: string; originalProfileId?: number; referenceId?: string }): Promise<BlacklistedUser>;
  isBlacklisted(email: string, phone?: string, firstName?: string, lastName?: string, dateOfBirth?: string): Promise<boolean>;
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

  async createOtp(profileId: number, code: string): Promise<void> {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await db.insert(otps).values({ profileId, code, expiresAt });
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

  async markOtpVerified(id: number): Promise<void> {
    await db.update(otps).set({ verified: true }).where(eq(otps.id, id));
  }

  async createDeposit(deposit: InsertDeposit & { profileId: number; depositMethod?: "usdt" | "moncash" | "nowpayments"; amountHtg?: string; moncashTransactionId?: string | null; nowpaymentsPaymentId?: string | null; payAddress?: string | null; payCurrency?: string | null }): Promise<Deposit> {
    const [newDeposit] = await db.insert(deposits).values(deposit).returning();
    return newDeposit;
  }

  async getDeposits(profileId?: number): Promise<Deposit[]> {
    if (profileId) {
      return db.select().from(deposits).where(eq(deposits.profileId, profileId)).orderBy(desc(deposits.createdAt));
    }
    return db.select().from(deposits).orderBy(desc(deposits.createdAt));
  }

  async updateDepositStatus(id: number, status: "approved" | "rejected"): Promise<Deposit> {
    const [deposit] = await db.update(deposits).set({ status }).where(eq(deposits.id, id)).returning();
    return deposit;
  }

  async getDepositByMoncashTransactionId(transactionId: string): Promise<Deposit | undefined> {
    const [deposit] = await db.select().from(deposits).where(eq(deposits.moncashTransactionId, transactionId));
    return deposit;
  }

  async getDepositByNowpaymentsPaymentId(paymentId: string): Promise<Deposit | undefined> {
    const [deposit] = await db.select().from(deposits).where(eq(deposits.nowpaymentsPaymentId, paymentId));
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

  async updateWithdrawalStatus(id: number, status: "approved" | "rejected"): Promise<Withdrawal> {
    const [withdrawal] = await db.update(withdrawals).set({ status }).where(eq(withdrawals.id, id)).returning();
    return withdrawal;
  }

  async createKyc(kyc: { profileId: number; idDocumentUrl: string; idDocumentBackUrl: string; selfieUrl: string }): Promise<KycDocument> {
    const existing = await this.getKyc(kyc.profileId);
    if (existing) {
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

  async getAllKyc(): Promise<(KycDocument & { profile: Profile })[]> {
    const results = await db.select().from(kycDocuments).innerJoin(profiles, eq(kycDocuments.profileId, profiles.id));
    return results.map(r => ({ ...r.kyc_documents, profile: r.profiles }));
  }

  async updateKycStatus(profileId: number, status: "verified" | "rejected"): Promise<void> {
    await db.update(profiles).set({ kycStatus: status }).where(eq(profiles.id, profileId));
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

  async getAllProfiles(): Promise<Profile[]> {
    return db.select().from(profiles).orderBy(desc(profiles.createdAt));
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
    return db.select().from(virtualCards).where(eq(virtualCards.profileId, profileId)).orderBy(desc(virtualCards.createdAt));
  }

  async getVirtualCard(id: number, profileId: number): Promise<VirtualCard | undefined> {
    const [card] = await db.select().from(virtualCards).where(and(eq(virtualCards.id, id), eq(virtualCards.profileId, profileId)));
    return card;
  }

  async getVirtualCardByCardId(cardId: string): Promise<VirtualCard | undefined> {
    const [card] = await db.select().from(virtualCards).where(eq(virtualCards.cardId, cardId));
    return card;
  }

  async updateVirtualCard(id: number, data: Partial<VirtualCard>): Promise<VirtualCard> {
    const [card] = await db.update(virtualCards).set(data).where(eq(virtualCards.id, id)).returning();
    return card;
  }

  async getProfileByReferenceId(referenceId: string): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles).where(eq(profiles.referenceId, referenceId));
    return profile;
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

  async createP2PTransfer(data: { senderProfileId: number; receiverProfileId: number; amount: string; note?: string }): Promise<P2PTransfer> {
    const [transfer] = await db.insert(p2pTransfers).values(data).returning();
    return transfer;
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
}

export const storage = new DatabaseStorage();
