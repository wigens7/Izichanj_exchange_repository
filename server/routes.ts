import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import crypto from "crypto";

async function sendEmailOtp(email: string, code: string) {
  console.log(`[MOCK EMAIL] Sending OTP ${code} to ${email}`);
}

async function getProfileFromReq(req: any) {
  const authUserId = req.user?.claims?.sub;
  if (!authUserId) return null;
  let profile = await storage.getProfileByAuthUserId(authUserId);
  if (!profile) {
    const claims = req.user.claims;
    const fullName = [claims.first_name, claims.last_name].filter(Boolean).join(" ") || "User";
    const email = claims.email || "";
    profile = await storage.createProfile(authUserId, fullName, email);
  }
  return profile;
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

  await setupAuth(app);
  registerAuthRoutes(app);
  registerObjectStorageRoutes(app);

  app.get(api.auth.me.path, isAuthenticated, async (req: any, res) => {
    const profile = await getProfileFromReq(req);
    if (!profile) return res.status(401).json({ message: "Unauthorized" });
    res.json(profile);
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
    const code = crypto.randomInt(100000, 999999).toString();
    await storage.createOtp(profile.id, code);
    await sendEmailOtp(profile.email || "", code);
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
      const { otp, ...rest } = req.body;
      api.withdrawals.create.input.parse(req.body);

      const validOtp = await storage.getValidOtp(profile.id, otp);
      if (!validOtp) return res.status(401).json({ message: "Invalid OTP" });
      await storage.markOtpVerified(validOtp.id);

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

  app.post(api.kyc.upload.path, isAuthenticated, async (req: any, res) => {
    const profile = await getProfileFromReq(req);
    if (!profile) return res.status(401).json({ message: "Unauthorized" });
    const { idDocumentUrl, selfieUrl } = req.body;
    if (!idDocumentUrl || !selfieUrl) return res.status(400).json({ message: "Missing documents" });
    const kyc = await storage.createKyc({ profileId: profile.id, idDocumentUrl, selfieUrl });
    res.status(201).json(kyc);
  });

  app.get(api.admin.users.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const allProfiles = await storage.getAllProfiles();
    res.json(allProfiles);
  });

  app.patch(api.admin.updateBalance.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const balance = req.body.balance;
    const profile = await storage.updateProfileBalance(Number(req.params.id), balance);
    res.json(profile);
  });

  app.patch(api.admin.approveDeposit.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const deposit = await storage.updateDepositStatus(Number(req.params.id), "approved");
    res.json(deposit);
  });

  app.patch(api.admin.rejectDeposit.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const deposit = await storage.updateDepositStatus(Number(req.params.id), "rejected");
    res.json(deposit);
  });

  app.patch(api.admin.approveWithdrawal.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const withdrawal = await storage.updateWithdrawalStatus(Number(req.params.id), "approved");
    res.json(withdrawal);
  });

  app.patch(api.admin.rejectWithdrawal.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const withdrawal = await storage.updateWithdrawalStatus(Number(req.params.id), "rejected");
    res.json(withdrawal);
  });

  app.patch(api.admin.verifyKyc.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const profileId = Number(req.params.id);
    await storage.updateKycStatus(profileId, "verified");
    const kyc = await storage.getKyc(profileId);
    res.json(kyc);
  });

  app.patch(api.admin.rejectKyc.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const profileId = Number(req.params.id);
    await storage.updateKycStatus(profileId, "rejected");
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

  return httpServer;
}
