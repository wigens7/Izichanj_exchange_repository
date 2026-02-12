import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from "@shared/schema";
import { z } from "zod";
import { setupAuth, isAuthenticated } from "./auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { WITHDRAWAL_MIN_USDT, WITHDRAWAL_MAX_USDT, usdtToHtg, formatHtg, WITHDRAWAL_MIN_HTG, WITHDRAWAL_MAX_HTG } from "@shared/constants";
import * as otplibModule from "otplib";
import QRCode from "qrcode";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/types";
import sgMail from "@sendgrid/mail";

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const rpName = "Izichanj";
const rpID = process.env.REPLIT_DEV_DOMAIN?.replace(/^https?:\/\//, "") || "localhost";
const origin = process.env.REPLIT_DEV_DOMAIN ? `https://${rpID}` : "http://localhost:5000";

async function sendWhatsAppOtp(phone: string, code: string) {
  const instanceId = process.env.ULTRAMSG_INSTANCE_ID;
  const token = process.env.ULTRAMSG_TOKEN;
  if (!instanceId || !token) {
    console.log(`[MOCK WHATSAPP] Sending OTP ${code} to ${phone}`);
    return;
  }
  try {
    const body = `*Izichanj*\n\nYour verification code is: *${code}*\n\nThis code expires in 5 minutes.\nDo not share it with anyone.`;
    const res = await fetch(`https://api.ultramsg.com/${instanceId}/messages/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token, to: phone, body }),
    });
    const data = await res.json();
    if (data.sent === "true" || data.sent === true) {
      console.log(`[WHATSAPP] OTP sent to ${phone}`);
    } else {
      console.error(`[WHATSAPP ERROR] Response:`, data);
      console.log(`[FALLBACK] WhatsApp delivery failed. OTP code for ${phone}: ${code}`);
    }
  } catch (error: any) {
    console.error(`[WHATSAPP ERROR] Failed to send OTP to ${phone}:`, error.message);
    console.log(`[FALLBACK] WhatsApp delivery failed. OTP code for ${phone}: ${code}`);
  }
}

async function getProfileFromReq(req: any) {
  const profileId = req.session?.profileId;
  if (!profileId) return null;
  return storage.getProfile(profileId);
}

const isAdmin = async (req: any, res: any, next: any) => {
  const profile = await getProfileFromReq(req);
  if (!profile) return res.status(401).json({ message: "Unauthorized" });
  if (profile.role !== "admin") return res.status(403).json({ message: "Forbidden" });
  next();
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  setupAuth(app);
  registerObjectStorageRoutes(app);

  app.post("/api/auth/register", async (req, res) => {
    try {
      const input = registerSchema.parse(req.body);
      const existing = await storage.getProfileByEmail(input.email);
      if (existing) {
        if (!existing.emailVerified) {
          const code = crypto.randomInt(100000, 999999).toString();
          await storage.createOtp(existing.id, code);
          await sendWhatsAppOtp(existing.phone || input.phone, code);
          req.session.profileId = existing.id;
          const { passwordHash: _, ...safeProfile } = existing;
          return res.status(201).json(safeProfile);
        }
        return res.status(400).json({ message: "An account with this email already exists" });
      }
      const passwordHash = await bcrypt.hash(input.password, 12);
      const profile = await storage.createProfile(input.fullName, input.email, passwordHash, input.phone);
      const code = crypto.randomInt(100000, 999999).toString();
      await storage.createOtp(profile.id, code);
      await sendWhatsAppOtp(input.phone, code);
      req.session.profileId = profile.id;
      const { passwordHash: _, ...safeProfile } = profile;
      res.status(201).json(safeProfile);
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0].message });
      console.error("Registration error:", e);
      const msg = e instanceof Error && e.message.includes("verification email")
        ? e.message
        : "Internal Error";
      res.status(500).json({ message: msg });
    }
  });

  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      const profileId = req.session?.profileId;
      if (!profileId) return res.status(401).json({ message: "Unauthorized" });
      const { code } = req.body;
      if (!code) return res.status(400).json({ message: "Verification code is required" });
      const validOtp = await storage.getValidOtp(profileId, code);
      if (!validOtp) return res.status(400).json({ message: "Invalid or expired code" });
      await storage.markOtpVerified(validOtp.id);
      await storage.markEmailVerified(profileId);
      const profile = await storage.getProfile(profileId);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      const { passwordHash: _, ...safeProfile } = profile;
      res.json(safeProfile);
    } catch (e) {
      console.error("Verify email error:", e);
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.post("/api/auth/resend-otp", async (req, res) => {
    try {
      const profileId = req.session?.profileId;
      if (!profileId) return res.status(401).json({ message: "Unauthorized" });
      const profile = await storage.getProfile(profileId);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      if (profile.emailVerified) return res.json({ message: "Email already verified" });
      const code = crypto.randomInt(100000, 999999).toString();
      await storage.createOtp(profile.id, code);
      await sendWhatsAppOtp(profile.phone || "", code);
      res.json({ message: "OTP sent" });
    } catch (e) {
      console.error("Resend OTP error:", e);
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const input = loginSchema.parse(req.body);
      let profile;
      if (input.identifier.includes("@")) {
        profile = await storage.getProfileByEmail(input.identifier);
      } else {
        profile = await storage.getProfileByPhone(input.identifier);
      }

      console.log(`[LOGIN] Attempt for ${input.identifier}, found: ${!!profile}, hash starts: ${profile?.passwordHash?.substring(0, 10) || 'N/A'}`);
      if (!profile) {
        return res.status(401).json({ message: "Invalid email/phone or password" });
      }
      const valid = await bcrypt.compare(input.password, profile.passwordHash);
      console.log(`[LOGIN] Password compare result for ${input.identifier}: ${valid}`);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email/phone or password" });
      }

      if (!profile.emailVerified) {
        req.session.profileId = profile.id;
        const code = crypto.randomInt(100000, 999999).toString();
        await storage.createOtp(profile.id, code);
        await sendWhatsAppOtp(profile.phone || "", code);
        const { passwordHash: _, twoFactorSecret: _s, ...safeProfile } = profile;
        return res.json({ ...safeProfile, needsVerification: true });
      }

      if (profile.twoFactorEnabled) {
        req.session.pending2faProfileId = profile.id;
        return res.json({ needs2FA: true });
      }

      req.session.profileId = profile.id;
      const { passwordHash: _, twoFactorSecret: _s, ...safeProfile } = profile;
      res.json(safeProfile);
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0].message });
      console.error("Login error:", e);
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const input = forgotPasswordSchema.parse(req.body);
      const profile = await storage.getProfileByPhone(input.phone);
      if (!profile) {
        return res.json({ message: "If an account exists with this number, you will receive a code." });
      }
      const code = crypto.randomInt(100000, 999999).toString();
      await storage.createOtp(profile.id, code);
      await sendWhatsAppOtp(input.phone, code);
      res.json({ message: "If an account exists with this number, you will receive a code." });
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0].message });
      console.error("Forgot password error:", e);
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const input = resetPasswordSchema.parse(req.body);
      const profile = await storage.getProfileByPhone(input.phone);
      if (!profile) {
        return res.status(400).json({ message: "Invalid phone number or code" });
      }
      const validOtp = await storage.getValidOtp(profile.id, input.code);
      if (!validOtp) {
        return res.status(400).json({ message: "Invalid or expired code" });
      }
      await storage.markOtpVerified(validOtp.id);
      const passwordHash = await bcrypt.hash(input.newPassword, 12);
      await storage.updateProfilePassword(profile.id, passwordHash);
      res.json({ message: "Password reset successfully" });
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0].message });
      console.error("Reset password error:", e);
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.post("/api/auth/verify-2fa", async (req: any, res) => {
    try {
      const profileId = req.session?.pending2faProfileId;
      if (!profileId) return res.status(401).json({ message: "No pending 2FA verification" });

      const { code } = req.body;
      if (!code) return res.status(400).json({ message: "Code is required" });

      const profile = await storage.getProfile(profileId);
      if (!profile || !profile.twoFactorSecret) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const result = await otplibModule.verify({ token: code, secret: profile.twoFactorSecret });
      if (!result.valid) return res.status(400).json({ message: "Invalid 2FA code" });

      req.session.profileId = profileId;
      delete req.session.pending2faProfileId;

      const { passwordHash: _, twoFactorSecret: _s, ...safeProfile } = profile;
      res.json(safeProfile);
    } catch (e) {
      console.error("2FA login verify error:", e);
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out" });
    });
  });

  app.get(api.auth.me.path, isAuthenticated, async (req: any, res) => {
    const profile = await getProfileFromReq(req);
    if (!profile) return res.status(401).json({ message: "Unauthorized" });
    const { passwordHash: _, twoFactorSecret: _s, ...safeProfile } = profile;
    res.json(safeProfile);
  });

  app.get(api.deposits.list.path, isAuthenticated, async (req: any, res) => {
    const profile = await getProfileFromReq(req);
    if (!profile) return res.status(401).json({ message: "Unauthorized" });
    const result = await storage.getDeposits(profile.id);
    res.json(result);
  });

  app.post(api.deposits.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      if (profile.kycStatus !== "verified") return res.status(403).json({ message: "KYC verification required before making deposits" });
      const input = api.deposits.create.input.parse(req.body);
      const deposit = await storage.createDeposit({ ...input, profileId: profile.id });
      res.status(201).json(deposit);
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0].message });
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.post(api.withdrawals.requestOtp.path, isAuthenticated, async (req: any, res) => {
    const profile = await getProfileFromReq(req);
    if (!profile) return res.sendStatus(401);
    if (profile.kycStatus !== "verified") return res.status(403).json({ message: "KYC verification required before making withdrawals" });
    const code = crypto.randomInt(100000, 999999).toString();
    await storage.createOtp(profile.id, code);
    await sendWhatsAppOtp(profile.phone || "", code);
    res.json({ message: "OTP sent" });
  });

  app.get(api.withdrawals.list.path, isAuthenticated, async (req: any, res) => {
    const profile = await getProfileFromReq(req);
    if (!profile) return res.status(401).json({ message: "Unauthorized" });
    const result = await storage.getWithdrawals(profile.id);
    res.json(result);
  });

  app.post(api.withdrawals.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      if (profile.kycStatus !== "verified") return res.status(403).json({ message: "KYC verification required before making withdrawals" });
      const parsed = api.withdrawals.create.input.parse(req.body);

      if (parsed.withdrawMethod === "phone" && (!parsed.phoneNumber || parsed.phoneNumber.length < 8)) {
        return res.status(400).json({ message: "Phone number is required for phone withdrawal" });
      }
      if (parsed.withdrawMethod === "qrcode" && !parsed.qrCodeUrl) {
        return res.status(400).json({ message: "QR code image is required for QR code withdrawal" });
      }

      const amountUsdt = parseFloat(parsed.amount);
      if (isNaN(amountUsdt) || amountUsdt <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      const amountHtg = usdtToHtg(amountUsdt);
      if (amountHtg < WITHDRAWAL_MIN_HTG) {
        return res.status(400).json({ message: `Minimum withdrawal is ${formatHtg(WITHDRAWAL_MIN_HTG)} HTG (${WITHDRAWAL_MIN_USDT.toFixed(2)} USDT)` });
      }
      if (amountHtg > WITHDRAWAL_MAX_HTG) {
        return res.status(400).json({ message: `Maximum withdrawal is ${formatHtg(WITHDRAWAL_MAX_HTG)} HTG (${WITHDRAWAL_MAX_USDT.toFixed(2)} USDT)` });
      }

      const currentBalance = parseFloat(profile.balance || "0");
      if (amountUsdt > currentBalance) {
        return res.status(400).json({ message: `Insufficient balance. Your current balance is ${currentBalance.toFixed(2)} USDT` });
      }

      const validOtp = await storage.getValidOtp(profile.id, parsed.otp);
      if (!validOtp) return res.status(401).json({ message: "Invalid OTP" });
      await storage.markOtpVerified(validOtp.id);

      const { otp, ...rest } = parsed;
      const withdrawal = await storage.createWithdrawal({ ...rest, profileId: profile.id });
      res.status(201).json(withdrawal);
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0].message });
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.get(api.kyc.status.path, isAuthenticated, async (req: any, res) => {
    const profile = await getProfileFromReq(req);
    if (!profile) return res.status(401).json({ message: "Unauthorized" });
    const kyc = await storage.getKyc(profile.id);
    res.json(kyc || null);
  });

  app.patch("/api/user/profile", isAuthenticated, async (req: any, res) => {
    const profile = await getProfileFromReq(req);
    if (!profile) return res.status(401).json({ message: "Unauthorized" });
    
    const { firstName, lastName, dateOfBirth, country, city, phone } = req.body;
    
    if (!firstName || !lastName || !dateOfBirth || !country || !city || !phone) {
      return res.status(400).json({ message: "All fields are required" });
    }

    try {
      const updatedUser = await storage.updateProfile(profile.id, {
        firstName,
        lastName,
        dateOfBirth,
        country,
        city,
        phone
      });
      const { passwordHash: _, twoFactorSecret: _s, ...safeProfile } = updatedUser;
      res.json(safeProfile);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post(api.kyc.upload.path, isAuthenticated, async (req: any, res) => {
    const profile = await getProfileFromReq(req);
    if (!profile) return res.status(401).json({ message: "Unauthorized" });
    if (!profile.firstName || !profile.lastName || !profile.dateOfBirth || !profile.country || !profile.city || !profile.phone) {
      return res.status(400).json({ message: "Please complete your personal information first" });
    }
    if (profile.kycStatus === "verified") return res.status(400).json({ message: "KYC already approved" });
    if (profile.kycStatus === "pending") return res.status(400).json({ message: "KYC already submitted and under review" });
    const { idDocumentUrl, idDocumentBackUrl, selfieUrl } = req.body;
    if (!idDocumentUrl || !idDocumentBackUrl || !selfieUrl) return res.status(400).json({ message: "Missing documents" });
    const kyc = await storage.createKyc({ profileId: profile.id, idDocumentUrl, idDocumentBackUrl, selfieUrl });
    res.status(201).json(kyc);
  });

  app.get(api.admin.users.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const allProfiles = await storage.getAllProfiles();
    res.json(allProfiles);
  });

  app.get(api.admin.allKyc.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const allKyc = await storage.getAllKyc();
    res.json(allKyc);
  });

  app.patch(api.admin.updateBalance.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const balance = req.body.balance;
    const profile = await storage.updateProfileBalance(Number(req.params.id), balance);
    res.json(profile);
  });

  app.patch("/api/admin/users/:id/disable-2fa", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const profileId = Number(req.params.id);
      const profile = await storage.getProfile(profileId);
      if (!profile) return res.status(404).json({ message: "User not found" });
      await storage.disableTwoFactor(profileId);
      res.json({ message: "2FA disabled successfully" });
    } catch (e) {
      console.error("Admin disable 2FA error:", e);
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.patch(api.admin.approveDeposit.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const deposit = await storage.updateDepositStatus(Number(req.params.id), "approved");
    const profile = await storage.getProfile(deposit.profileId);
    if (profile) {
      const currentBalance = parseFloat(profile.balance || "0");
      const depositAmount = parseFloat(deposit.amountUsdt);
      const newBalance = currentBalance + depositAmount;
      await storage.updateProfileBalance(deposit.profileId, newBalance);
    }
    const htgAmount = formatHtg(usdtToHtg(Number(deposit.amountUsdt)));
    await storage.createNotification({
      profileId: deposit.profileId,
      type: "deposit_approved",
      title: "Deposit Approved",
      message: `Your deposit of ${Number(deposit.amountUsdt).toFixed(2)} USDT (${htgAmount} HTG) has been approved and added to your balance.`,
    });
    res.json(deposit);
  });

  app.patch(api.admin.rejectDeposit.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const deposit = await storage.updateDepositStatus(Number(req.params.id), "rejected");
    await storage.createNotification({
      profileId: deposit.profileId,
      type: "deposit_rejected",
      title: "Deposit Rejected",
      message: `Your deposit of ${Number(deposit.amountUsdt).toFixed(2)} USDT has been rejected. Please contact support for more information.`,
    });
    res.json(deposit);
  });

  app.patch(api.admin.approveWithdrawal.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const withdrawal = await storage.updateWithdrawalStatus(Number(req.params.id), "approved");
    const profile = await storage.getProfile(withdrawal.profileId);
    if (profile) {
      const currentBalance = parseFloat(profile.balance || "0");
      const withdrawalAmount = parseFloat(withdrawal.amount);
      const newBalance = Math.max(0, currentBalance - withdrawalAmount);
      await storage.updateProfileBalance(withdrawal.profileId, newBalance);
    }
    const htgAmount = formatHtg(usdtToHtg(Number(withdrawal.amount)));
    await storage.createNotification({
      profileId: withdrawal.profileId,
      type: "withdrawal_approved",
      title: "Withdrawal Approved",
      message: `Your withdrawal of ${Number(withdrawal.amount).toFixed(2)} USDT (${htgAmount} HTG) to ${withdrawal.currency} has been approved and is being processed.`,
    });
    res.json(withdrawal);
  });

  app.patch(api.admin.rejectWithdrawal.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const withdrawal = await storage.updateWithdrawalStatus(Number(req.params.id), "rejected");
    await storage.createNotification({
      profileId: withdrawal.profileId,
      type: "withdrawal_rejected",
      title: "Withdrawal Rejected",
      message: `Your withdrawal of ${Number(withdrawal.amount).toFixed(2)} USDT to ${withdrawal.currency} has been rejected. Please contact support.`,
    });
    res.json(withdrawal);
  });

  app.patch(api.admin.verifyKyc.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const profileId = Number(req.params.id);
    await storage.updateKycStatus(profileId, "verified");
    await storage.createNotification({
      profileId,
      type: "kyc_verified",
      title: "KYC Verified",
      message: "Your identity has been verified. You can now make deposits and withdrawals.",
    });
    const kyc = await storage.getKyc(profileId);
    res.json(kyc);
  });

  app.patch(api.admin.rejectKyc.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const profileId = Number(req.params.id);
    await storage.updateKycStatus(profileId, "rejected");
    await storage.createNotification({
      profileId,
      type: "kyc_rejected",
      title: "KYC Rejected",
      message: "Your identity verification was rejected. Please resubmit your documents.",
    });
    const kyc = await storage.getKyc(profileId);
    res.json(kyc);
  });

  app.get(api.admin.allDeposits.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const allDeposits = await storage.getDeposits();
    res.json(allDeposits);
  });

  app.get(api.admin.allWithdrawals.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const allWithdrawals = await storage.getWithdrawals();
    res.json(allWithdrawals);
  });

  app.post(api.admin.sendNotification.path, isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const parsed = api.admin.sendNotification.input.parse(req.body);
      const targetProfile = await storage.getProfile(parsed.profileId);
      if (!targetProfile) return res.status(404).json({ message: "User not found" });
      const notification = await storage.createNotification({
        profileId: parsed.profileId,
        type: "custom_message",
        title: parsed.title,
        message: parsed.message,
      });
      res.status(201).json(notification);
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0].message });
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.get(api.notifications.list.path, isAuthenticated, async (req: any, res) => {
    const profile = await getProfileFromReq(req);
    if (!profile) return res.status(401).json({ message: "Unauthorized" });
    const notifs = await storage.getNotifications(profile.id);
    res.json(notifs);
  });

  app.get(api.notifications.unreadCount.path, isAuthenticated, async (req: any, res) => {
    const profile = await getProfileFromReq(req);
    if (!profile) return res.status(401).json({ message: "Unauthorized" });
    const count = await storage.getUnreadNotificationCount(profile.id);
    res.json({ count });
  });

  app.patch(api.notifications.markRead.path, isAuthenticated, async (req: any, res) => {
    const profile = await getProfileFromReq(req);
    if (!profile) return res.status(401).json({ message: "Unauthorized" });
    await storage.markNotificationRead(Number(req.params.id), profile.id);
    res.json({ message: "Marked as read" });
  });

  app.patch(api.notifications.markAllRead.path, isAuthenticated, async (req: any, res) => {
    const profile = await getProfileFromReq(req);
    if (!profile) return res.status(401).json({ message: "Unauthorized" });
    await storage.markAllNotificationsRead(profile.id);
    res.json({ message: "All marked as read" });
  });

  // ======= Support Chat Routes =======
  const BOT_FAQ: { keywords: string[]; answer: string }[] = [
    { keywords: ["deposit", "how to deposit", "send usdt", "depo"], answer: "To deposit USDT:\n1. Go to the Deposit page\n2. Copy one of our wallet addresses (TRC20 or BEP20)\n3. Send USDT from your crypto wallet\n4. Enter the amount and transaction hash\n5. Submit and wait for admin approval (usually within minutes)" },
    { keywords: ["withdraw", "cash out", "moncash", "natcash", "retire"], answer: "To withdraw funds:\n1. Go to the Withdraw page\n2. Select your wallet type (MonCash or NatCash)\n3. Enter the amount in USDT\n4. Provide your phone number or QR code\n5. Verify with OTP sent to your email\n6. Wait for admin approval (15-20 minutes)" },
    { keywords: ["kyc", "verification", "identity", "id card", "document"], answer: "KYC verification requires:\n1. Go to Profile & KYC page\n2. Upload your national ID card (front and back)\n3. Upload a selfie holding your ID\n4. Submit and wait for admin review\nKYC is required before making deposits or withdrawals." },
    { keywords: ["balance", "money", "funds", "account"], answer: "You can view your current balance on the Dashboard page. Your balance is displayed in HTG (Haitian Gourde). The exchange rate is 1 USDT = 139.50 HTG." },
    { keywords: ["rate", "exchange rate", "conversion", "htg"], answer: "The current exchange rate is 1 USDT = 139.50 HTG. This rate is used for all conversions on the platform." },
    { keywords: ["security", "2fa", "password", "fingerprint"], answer: "To secure your account:\n1. Go to Security Settings\n2. Enable Two-Factor Authentication (2FA)\n3. Register fingerprint/biometric login\nAlways use a strong password and never share your verification codes." },
    { keywords: ["help", "support", "agent", "human", "person", "real person", "talk"], answer: "AGENT_REQUEST" },
  ];

  function getBotResponse(userMessage: string): string | null {
    const lower = userMessage.toLowerCase();
    for (const faq of BOT_FAQ) {
      if (faq.keywords.some(k => lower.includes(k))) {
        return faq.answer;
      }
    }
    return null;
  }

  app.get("/api/support/conversation", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      const conv = await storage.getOrCreateConversation(profile.id);
      res.json(conv);
    } catch (e) {
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.get("/api/support/messages/:conversationId", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      const conv = await storage.getConversation(Number(req.params.conversationId));
      if (!conv) return res.status(404).json({ message: "Conversation not found" });
      if (conv.profileId !== profile.id && profile.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const messages = await storage.getConversationMessages(conv.id);
      res.json(messages);
    } catch (e) {
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.post("/api/support/upload", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      const { name, size, contentType } = req.body;
      if (!name) return res.status(400).json({ message: "File name is required" });
      const maxSize = 10 * 1024 * 1024;
      if (size && size > maxSize) return res.status(400).json({ message: "File too large (max 10MB)" });
      const { ObjectStorageService } = await import("./replit_integrations/object_storage");
      const objectStorage = new ObjectStorageService();
      const uploadURL = await objectStorage.getObjectEntityUploadURL();
      const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);
      res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
    } catch (e) {
      console.error("Support upload error:", e);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  app.post("/api/support/send", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      const { message, fileUrl, fileName } = req.body;
      if ((!message || !message.trim()) && !fileUrl) return res.status(400).json({ message: "Message or file is required" });
      const conv = await storage.getOrCreateConversation(profile.id);
      const userMsg = await storage.addMessage({
        conversationId: conv.id,
        sender: "user",
        senderProfileId: profile.id,
        message: (message || "").trim() || (fileName ? `Sent a file: ${fileName}` : "Sent a file"),
        fileUrl: fileUrl || undefined,
        fileName: fileName || undefined,
      });
      const botAnswer = getBotResponse(message);
      const responseMessages = [userMsg];
      if (botAnswer === "AGENT_REQUEST") {
        await storage.updateConversationStatus(conv.id, "waiting_agent");
        const botMsg = await storage.addMessage({
          conversationId: conv.id,
          sender: "bot",
          message: "I understand you'd like to speak with a support agent. Please be patient, an agent will be with you shortly. In the meantime, feel free to describe your issue and we'll get back to you as soon as possible.",
        });
        responseMessages.push(botMsg);
      } else if (botAnswer && conv.status === "active") {
        const botMsg = await storage.addMessage({
          conversationId: conv.id,
          sender: "bot",
          message: botAnswer,
        });
        responseMessages.push(botMsg);
      }
      res.json(responseMessages);
    } catch (e) {
      console.error("Support send error:", e);
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.post("/api/support/request-agent", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      const conv = await storage.getOrCreateConversation(profile.id);
      await storage.updateConversationStatus(conv.id, "waiting_agent");
      const botMsg = await storage.addMessage({
        conversationId: conv.id,
        sender: "bot",
        message: "You've been connected to our support queue. Please be patient, an agent will talk to you soon. Feel free to describe your issue while you wait.",
      });
      res.json(botMsg);
    } catch (e) {
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.post("/api/support/end-chat", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      const { rating } = req.body;
      const conv = await storage.getOrCreateConversation(profile.id);
      if (conv.status === "closed") return res.status(400).json({ message: "Conversation already closed" });
      const ratingValue = rating && Number(rating) >= 1 && Number(rating) <= 5 ? Number(rating) : null;
      await storage.addMessage({
        conversationId: conv.id,
        sender: "bot",
        message: "Thank you for contacting us! Your chat has been ended. You can start a new conversation anytime. Have a great day!",
      });
      const updated = await storage.closeConversationWithRating(conv.id, ratingValue!, "user");
      res.json(updated);
    } catch (e) {
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.get("/api/admin/support/conversations", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const convos = await storage.getAllConversations();
      res.json(convos);
    } catch (e) {
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.post("/api/admin/support/upload", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { name, size, contentType } = req.body;
      if (!name) return res.status(400).json({ message: "File name is required" });
      const maxSize = 10 * 1024 * 1024;
      if (size && size > maxSize) return res.status(400).json({ message: "File too large (max 10MB)" });
      const { ObjectStorageService } = await import("./replit_integrations/object_storage");
      const objectStorage = new ObjectStorageService();
      const uploadURL = await objectStorage.getObjectEntityUploadURL();
      const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);
      res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
    } catch (e) {
      console.error("Admin support upload error:", e);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  app.post("/api/admin/support/reply", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      const { conversationId, message, fileUrl, fileName } = req.body;
      if (!conversationId || (!message?.trim() && !fileUrl)) return res.status(400).json({ message: "Missing fields" });
      const conv = await storage.getConversation(conversationId);
      if (!conv) return res.status(404).json({ message: "Conversation not found" });
      const msg = await storage.addMessage({
        conversationId,
        sender: "admin",
        senderProfileId: profile.id,
        message: (message || "").trim() || (fileName ? `Sent a file: ${fileName}` : "Sent a file"),
        fileUrl: fileUrl || undefined,
        fileName: fileName || undefined,
      });
      if (conv.status === "waiting_agent") {
        await storage.updateConversationStatus(conv.id, "active");
      }
      res.json(msg);
    } catch (e) {
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.patch("/api/admin/support/close/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const convId = Number(req.params.id);
      const conv = await storage.getConversation(convId);
      if (!conv) return res.status(404).json({ message: "Conversation not found" });
      await storage.addMessage({
        conversationId: convId,
        sender: "bot",
        message: "Thank you for contacting us! This conversation has been closed by our support team. Feel free to reach out anytime you need help. Goodbye!",
      });
      const updated = await storage.updateConversationStatus(convId, "closed");
      res.json(updated);
    } catch (e) {
      res.status(500).json({ message: "Internal Error" });
    }
  });

  setInterval(async () => {
    try {
      const inactive = await storage.getInactiveConversations(5);
      for (const conv of inactive) {
        await storage.addMessage({
          conversationId: conv.id,
          sender: "bot",
          message: "This conversation has been automatically closed due to inactivity. Thank you for contacting us! Feel free to chat back anytime you need help.",
        });
        await storage.updateConversationStatus(conv.id, "closed");
      }
    } catch (e) {
      console.error("Auto-close inactive chats error:", e);
    }
  }, 60 * 1000);

  // ======= 2FA TOTP Routes =======
  app.post("/api/security/2fa/setup", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      if (profile.twoFactorEnabled) return res.status(400).json({ message: "2FA is already enabled" });

      const secret = otplibModule.generateSecret();
      await storage.setTwoFactorSecret(profile.id, secret);

      const otpauth = otplibModule.generateURI({ secret, issuer: rpName, label: profile.email });
      const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

      res.json({ secret, qrCode: qrCodeDataUrl });
    } catch (e) {
      console.error("2FA setup error:", e);
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.post("/api/security/2fa/verify", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      if (profile.twoFactorEnabled) return res.status(400).json({ message: "2FA is already enabled" });
      if (!profile.twoFactorSecret) return res.status(400).json({ message: "Please set up 2FA first" });

      const { code } = req.body;
      if (!code) return res.status(400).json({ message: "Code is required" });

      const result = await otplibModule.verify({ token: code, secret: profile.twoFactorSecret });
      if (!result.valid) return res.status(400).json({ message: "Invalid code. Please try again." });

      await storage.enableTwoFactor(profile.id);
      res.json({ message: "2FA enabled successfully" });
    } catch (e) {
      console.error("2FA verify error:", e);
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.post("/api/security/2fa/disable", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      if (!profile.twoFactorEnabled) return res.status(400).json({ message: "2FA is not enabled" });

      const { code } = req.body;
      if (!code) return res.status(400).json({ message: "Code is required" });

      const result = await otplibModule.verify({ token: code, secret: profile.twoFactorSecret! });
      if (!result.valid) return res.status(400).json({ message: "Invalid code" });

      await storage.disableTwoFactor(profile.id);
      res.json({ message: "2FA disabled successfully" });
    } catch (e) {
      console.error("2FA disable error:", e);
      res.status(500).json({ message: "Internal Error" });
    }
  });

  // ======= WebAuthn (Fingerprint) Routes =======
  app.get("/api/security/webauthn/credentials", isAuthenticated, async (req: any, res) => {
    const profile = await getProfileFromReq(req);
    if (!profile) return res.status(401).json({ message: "Unauthorized" });
    const creds = await storage.getWebAuthnCredentials(profile.id);
    res.json(creds.map(c => ({ id: c.id, deviceName: c.deviceName, createdAt: c.createdAt })));
  });

  app.post("/api/security/webauthn/register-options", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });

      const existingCreds = await storage.getWebAuthnCredentials(profile.id);

      const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userName: profile.email,
        attestationType: "none",
        excludeCredentials: existingCreds.map(c => ({
          id: c.credentialId,
          transports: ["internal" as AuthenticatorTransportFuture],
        })),
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
      });

      req.session.currentChallenge = options.challenge;
      res.json(options);
    } catch (e) {
      console.error("WebAuthn register options error:", e);
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.post("/api/security/webauthn/register-verify", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });

      const expectedChallenge = req.session.currentChallenge;
      if (!expectedChallenge) return res.status(400).json({ message: "No challenge found. Please try again." });

      const verification = await verifyRegistrationResponse({
        response: req.body.credential,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });

      if (!verification.verified || !verification.registrationInfo) {
        return res.status(400).json({ message: "Verification failed" });
      }

      const { credential } = verification.registrationInfo;

      await storage.createWebAuthnCredential({
        profileId: profile.id,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString("base64"),
        counter: credential.counter,
        deviceName: req.body.deviceName || "Fingerprint",
      });

      delete req.session.currentChallenge;
      res.json({ message: "Fingerprint registered successfully" });
    } catch (e) {
      console.error("WebAuthn register verify error:", e);
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.post("/api/security/webauthn/auth-options", async (req: any, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: "Email is required" });

      const profile = await storage.getProfileByEmail(email);
      if (!profile) return res.status(400).json({ message: "No account found" });

      const creds = await storage.getWebAuthnCredentials(profile.id);
      if (creds.length === 0) return res.status(400).json({ message: "No fingerprints registered" });

      const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: creds.map(c => ({
          id: c.credentialId,
          transports: ["internal" as AuthenticatorTransportFuture],
        })),
        userVerification: "required",
      });

      req.session.currentChallenge = options.challenge;
      req.session.webauthnProfileId = profile.id;
      res.json(options);
    } catch (e) {
      console.error("WebAuthn auth options error:", e);
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.post("/api/security/webauthn/auth-verify", async (req: any, res) => {
    try {
      const expectedChallenge = req.session.currentChallenge;
      const profileId = req.session.webauthnProfileId;
      if (!expectedChallenge || !profileId) {
        return res.status(400).json({ message: "No challenge found. Please try again." });
      }

      const credential = await storage.getWebAuthnCredentialById(req.body.id);
      if (!credential || credential.profileId !== profileId) {
        return res.status(400).json({ message: "Unknown credential" });
      }

      const verification = await verifyAuthenticationResponse({
        response: req.body,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: credential.credentialId,
          publicKey: Buffer.from(credential.publicKey, "base64"),
          counter: credential.counter,
          transports: ["internal" as AuthenticatorTransportFuture],
        },
      });

      if (!verification.verified) {
        return res.status(400).json({ message: "Authentication failed" });
      }

      await storage.updateWebAuthnCounter(credential.credentialId, verification.authenticationInfo.newCounter);

      req.session.profileId = profileId;
      delete req.session.currentChallenge;
      delete req.session.webauthnProfileId;

      const profile = await storage.getProfile(profileId);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      const { passwordHash: _, twoFactorSecret: _s, ...safeProfile } = profile;
      res.json(safeProfile);
    } catch (e) {
      console.error("WebAuthn auth verify error:", e);
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.delete("/api/security/webauthn/credentials/:id", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      await storage.deleteWebAuthnCredential(Number(req.params.id), profile.id);
      res.json({ message: "Credential removed" });
    } catch (e) {
      console.error("WebAuthn delete error:", e);
      res.status(500).json({ message: "Internal Error" });
    }
  });

  return httpServer;
}
