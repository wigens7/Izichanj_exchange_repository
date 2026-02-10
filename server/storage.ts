import { profiles, deposits, withdrawals, kycDocuments, otps, webauthnCredentials, type Profile, type Deposit, type InsertDeposit, type Withdrawal, type InsertWithdrawal, type KycDocument, type WebAuthnCredential } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  getProfile(id: number): Promise<Profile | undefined>;
  getProfileByEmail(email: string): Promise<Profile | undefined>;
  createProfile(fullName: string, email: string, passwordHash: string): Promise<Profile>;
  updateProfileBalance(id: number, balance: number): Promise<Profile>;
  markEmailVerified(id: number): Promise<void>;

  createOtp(profileId: number, code: string): Promise<void>;
  getValidOtp(profileId: number, code: string): Promise<typeof otps.$inferSelect | undefined>;
  markOtpVerified(id: number): Promise<void>;

  createDeposit(deposit: InsertDeposit & { profileId: number }): Promise<Deposit>;
  getDeposits(profileId?: number): Promise<Deposit[]>;
  updateDepositStatus(id: number, status: "approved" | "rejected"): Promise<Deposit>;

  createWithdrawal(withdrawal: InsertWithdrawal & { profileId: number }): Promise<Withdrawal>;
  getWithdrawals(profileId?: number): Promise<Withdrawal[]>;
  updateWithdrawalStatus(id: number, status: "approved" | "rejected"): Promise<Withdrawal>;

  createKyc(kyc: { profileId: number; idDocumentUrl: string; idDocumentBackUrl: string; selfieUrl: string }): Promise<KycDocument>;
  getKyc(profileId: number): Promise<KycDocument | undefined>;
  getAllKyc(): Promise<(KycDocument & { profile: Profile })[]>;
  updateKycStatus(profileId: number, status: "verified" | "rejected"): Promise<void>;
  getAllProfiles(): Promise<Profile[]>;

  setTwoFactorSecret(profileId: number, secret: string): Promise<void>;
  enableTwoFactor(profileId: number): Promise<void>;
  disableTwoFactor(profileId: number): Promise<void>;

  createWebAuthnCredential(cred: { profileId: number; credentialId: string; publicKey: string; counter: number; deviceName: string }): Promise<WebAuthnCredential>;
  getWebAuthnCredentials(profileId: number): Promise<WebAuthnCredential[]>;
  getWebAuthnCredentialById(credentialId: string): Promise<WebAuthnCredential | undefined>;
  updateWebAuthnCounter(credentialId: string, counter: number): Promise<void>;
  deleteWebAuthnCredential(id: number, profileId: number): Promise<void>;
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

  async createProfile(fullName: string, email: string, passwordHash: string): Promise<Profile> {
    const [profile] = await db.insert(profiles).values({ fullName, email, passwordHash }).returning();
    return profile;
  }

  async updateProfileBalance(id: number, balance: number): Promise<Profile> {
    const [profile] = await db.update(profiles).set({ balance: balance.toString() }).where(eq(profiles.id, id)).returning();
    return profile;
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

  async createDeposit(deposit: InsertDeposit & { profileId: number }): Promise<Deposit> {
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
}

export const storage = new DatabaseStorage();
