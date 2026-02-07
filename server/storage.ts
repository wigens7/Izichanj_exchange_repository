
import { users, deposits, withdrawals, kycDocuments, otps, type User, type InsertUser, type Deposit, type InsertDeposit, type Withdrawal, type InsertWithdrawal, type KycDocument, type InsertKyc } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // User
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserBalance(id: number, balance: number): Promise<User>;

  // OTP
  createOtp(userId: number, code: string): Promise<void>;
  getValidOtp(userId: number, code: string): Promise<typeof otps.$inferSelect | undefined>;
  markOtpVerified(id: number): Promise<void>;

  // Deposits
  createDeposit(deposit: InsertDeposit & { userId: number }): Promise<Deposit>;
  getDeposits(userId?: number): Promise<Deposit[]>;
  updateDepositStatus(id: number, status: "approved" | "rejected"): Promise<Deposit>;

  // Withdrawals
  createWithdrawal(withdrawal: InsertWithdrawal & { userId: number }): Promise<Withdrawal>;
  getWithdrawals(userId?: number): Promise<Withdrawal[]>;
  updateWithdrawalStatus(id: number, status: "approved" | "rejected"): Promise<Withdrawal>;

  // KYC
  createKyc(kyc: InsertKyc & { userId: number }): Promise<KycDocument>;
  getKyc(userId: number): Promise<KycDocument | undefined>;
  getAllKyc(): Promise<(KycDocument & { user: User })[]>;
  updateKycStatus(userId: number, status: "verified" | "rejected"): Promise<void>;
  getAllUsers(): Promise<User[]>; // For admin
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  
  async updateUserBalance(id: number, balance: number): Promise<User> {
      const [user] = await db.update(users).set({ balance: balance.toString() }).where(eq(users.id, id)).returning();
      return user;
  }

  async createOtp(userId: number, code: string): Promise<void> {
    // Expire in 5 minutes
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await db.insert(otps).values({ userId, code, expiresAt });
  }

  async getValidOtp(userId: number, code: string): Promise<typeof otps.$inferSelect | undefined> {
    const [otp] = await db.select().from(otps)
      .where(eq(otps.userId, userId))
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

  async createDeposit(deposit: InsertDeposit & { userId: number }): Promise<Deposit> {
    const [newDeposit] = await db.insert(deposits).values(deposit).returning();
    return newDeposit;
  }

  async getDeposits(userId?: number): Promise<Deposit[]> {
    if (userId) {
      return db.select().from(deposits).where(eq(deposits.userId, userId)).orderBy(desc(deposits.createdAt));
    }
    return db.select().from(deposits).orderBy(desc(deposits.createdAt));
  }

  async updateDepositStatus(id: number, status: "approved" | "rejected"): Promise<Deposit> {
    const [deposit] = await db.update(deposits).set({ status }).where(eq(deposits.id, id)).returning();
    return deposit;
  }

  async createWithdrawal(withdrawal: InsertWithdrawal & { userId: number }): Promise<Withdrawal> {
    const [newWithdrawal] = await db.insert(withdrawals).values(withdrawal).returning();
    return newWithdrawal;
  }

  async getWithdrawals(userId?: number): Promise<Withdrawal[]> {
    if (userId) {
      return db.select().from(withdrawals).where(eq(withdrawals.userId, userId)).orderBy(desc(withdrawals.createdAt));
    }
    return db.select().from(withdrawals).orderBy(desc(withdrawals.createdAt));
  }

  async updateWithdrawalStatus(id: number, status: "approved" | "rejected"): Promise<Withdrawal> {
    const [withdrawal] = await db.update(withdrawals).set({ status }).where(eq(withdrawals.id, id)).returning();
    return withdrawal;
  }

  async createKyc(kyc: InsertKyc & { userId: number }): Promise<KycDocument> {
      // Check if exists
    const existing = await this.getKyc(kyc.userId);
    if (existing) {
        const [updated] = await db.update(kycDocuments).set(kyc).where(eq(kycDocuments.userId, kyc.userId)).returning();
        await db.update(users).set({ kycStatus: "pending" }).where(eq(users.id, kyc.userId));
        return updated;
    }
    const [newKyc] = await db.insert(kycDocuments).values(kyc).returning();
    await db.update(users).set({ kycStatus: "pending" }).where(eq(users.id, kyc.userId));
    return newKyc;
  }

  async getKyc(userId: number): Promise<KycDocument | undefined> {
    const [kyc] = await db.select().from(kycDocuments).where(eq(kycDocuments.userId, userId));
    return kyc;
  }
  
  async getAllKyc(): Promise<(KycDocument & { user: User })[]> {
      const results = await db.select().from(kycDocuments).innerJoin(users, eq(kycDocuments.userId, users.id));
      return results.map(r => ({ ...r.kyc_documents, user: r.users }));
  }

  async updateKycStatus(userId: number, status: "verified" | "rejected"): Promise<void> {
    await db.update(users).set({ kycStatus: status }).where(eq(users.id, userId));
  }
  
  async getAllUsers(): Promise<User[]> {
      return db.select().from(users).orderBy(desc(users.createdAt));
  }
}

export const storage = new DatabaseStorage();
