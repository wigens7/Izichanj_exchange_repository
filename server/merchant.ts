import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { db } from "./db";
import { profiles, merchants, merchantPayoutMethods, merchantLedgerEntries, payoutRequests, type Merchant } from "@shared/schema";
import { eq, sql, and } from "drizzle-orm";
import { isAuthenticated } from "./auth";
import { getDepositRate } from "./rates";
import { checkoutApiSchema, updateMerchantSchema, payoutRequestSchema, PAYOUT_METHOD_META } from "@shared/schema";
import { MERCHANT_API_FEE_PCT } from "@shared/constants";
import { PUBLIC_APP_URL } from "./public-url";
import crypto from "crypto";
import { z } from "zod";

const FEE_PCT = MERCHANT_API_FEE_PCT; // 0% — Izichanj Pay is FREE for merchants
const CHECKOUT_TTL_MS = 30 * 60 * 1000; // 30 minutes
const PUBLIC_BASE_URL = PUBLIC_APP_URL;
const PAYOUT_FEE_USDT = 0;

function encryptionKey(): Buffer {
  return crypto.createHash("sha256").update(process.env.SESSION_SECRET || "izichanj-payout-key").digest();
}

function encryptPayoutDetails(details: Record<string, string>): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(details), "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

function maskPayoutDetails(method: string, details: Record<string, string>): string {
  const mask = (value: string) => value.length <= 4 ? "••••" : `${value.slice(0, 3)}••••${value.slice(-4)}`;
  if (method === "usdt") return `${details.network || "USDT"} · ${mask(details.walletAddress || "")}`;
  if (method === "zelle") return mask(details.email || "");
  if (method === "cashapp") return details.cashtag ? `$${mask(details.cashtag.replace(/^\$/, ""))}` : "Cash App";
  return mask(details.phoneNumber || "");
}

function publicPayoutMethod(method: any) {
  return {
    id: method.id,
    method: method.method,
    label: method.label,
    maskedDetails: method.maskedDetails,
    isDefault: method.isDefault,
    createdAt: method.createdAt,
  };
}

/** Send a HTML-formatted message to the admin Telegram channel. Fire-and-forget. */
async function sendAdminTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
  } catch (e) {
    console.error("[MerchantTelegram] Failed:", e);
  }
}

declare global {
  namespace Express {
    interface Request { merchant?: Merchant }
  }
}

/** API auth middleware: verifies api_secret_key from Authorization header. */
async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = req.headers.authorization || "";
    const headerKey = (req.headers["x-api-key"] as string) || "";
    let key = "";
    if (auth.toLowerCase().startsWith("bearer ")) key = auth.slice(7).trim();
    else if (headerKey) key = headerKey.trim();

    if (!key || !key.startsWith("izi_sk_")) {
      return res.status(401).json({ error: "Missing or invalid API key. Send Authorization: Bearer izi_sk_..." });
    }
    const merchant = await storage.getMerchantBySecretKey(key);
    if (!merchant) return res.status(401).json({ error: "Invalid API key" });
    req.merchant = merchant;
    next();
  } catch (e: any) {
    res.status(500).json({ error: "Auth error: " + (e.message || e) });
  }
}

/** Sign a webhook payload using HMAC-SHA256 with the merchant's secret. */
function signWebhook(secret: string, payloadJson: string): string {
  return crypto.createHmac("sha256", secret).update(payloadJson).digest("hex");
}

/** Fire-and-forget webhook delivery with HMAC signature. */
async function deliverWebhook(merchant: Merchant, paymentId: string, payload: any) {
  if (!merchant.webhookUrl) return;
  try {
    const body = JSON.stringify(payload);
    const sig = signWebhook(merchant.apiSecretKey, body);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const r = await fetch(merchant.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Izichanj-Signature": sig,
        "X-Izichanj-Event": payload.event || "payment.completed",
        "User-Agent": "Izichanj-Pay-Webhook/1.0",
      },
      body,
      signal: ctrl.signal,
    });
    clearTimeout(t);
    await storage.incrementWebhookAttempt(paymentId, r.ok);
    console.log(`[MerchantWebhook] ${paymentId} → ${merchant.webhookUrl} → ${r.status}`);
  } catch (e: any) {
    await storage.incrementWebhookAttempt(paymentId, false);
    console.warn(`[MerchantWebhook] ${paymentId} delivery failed:`, e.message || e);
  }
}

export function registerMerchantRoutes(app: Express) {
  // ============ CORS for public API (/api/v1/*) ============
  app.use("/api/v1", (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-API-Key");
    res.setHeader("Access-Control-Max-Age", "86400");
    if (req.method === "OPTIONS") return res.status(204).end();
    next();
  });

  // ============ MERCHANT DASHBOARD (session-auth) ============

  app.get("/api/merchant/me", isAuthenticated, async (req: any, res) => {
    const merchant = await storage.getMerchantByProfile(req.session.profileId);
    res.json({ merchant: merchant || null });
  });

  // Merchant account and balance views are session-scoped; ownership is always
  // resolved from the authenticated profile rather than a client-supplied id.
  app.get("/api/merchant/account", isAuthenticated, async (req: any, res) => {
    const profile = await storage.getProfile(req.session.profileId);
    const merchant = profile ? await storage.getMerchantByProfile(profile.id) : undefined;
    if (!merchant) return res.status(404).json({ message: "Merchant account not found" });
    res.json({
      merchant: {
        id: merchant.id,
        merchantId: merchant.merchantId || `mch_${String(merchant.id).padStart(8, "0")}`,
        userId: merchant.profileId,
        businessName: merchant.businessName,
        email: merchant.email || profile?.email,
        phone: merchant.phone || profile?.phone,
        country: merchant.country || profile?.country,
        accountStatus: merchant.accountStatus,
        kycStatus: profile?.kycStatus === "verified" ? "verified" : merchant.kycStatus,
        paymentEnabled: merchant.paymentEnabled,
        payoutEnabled: merchant.payoutEnabled,
        createdAt: merchant.createdAt,
        updatedAt: merchant.updatedAt,
      },
    });
  });

  app.get("/api/merchant/balance", isAuthenticated, async (req: any, res) => {
    const merchant = await storage.getMerchantByProfile(req.session.profileId);
    if (!merchant) return res.status(404).json({ message: "Merchant account not found" });
    const result = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN status = 'completed' THEN net_usdt ELSE 0 END), 0)::numeric AS total_received,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN fee_usdt ELSE 0 END), 0)::numeric AS total_fees,
        COALESCE(SUM(CASE WHEN status IN ('pending') THEN net_usdt ELSE 0 END), 0)::numeric AS pending_balance,
        COALESCE((SELECT SUM(amount) FROM payout_requests WHERE merchant_id = ${merchant.id} AND status IN ('pending','processing','approved')), 0)::numeric AS total_payouts
      FROM merchant_transactions WHERE merchant_id = ${merchant.id}
    `);
    const row = (result.rows[0] || {}) as any;
    res.json({
      availableBalance: Number(merchant.balance),
      pendingBalance: Number(row.pending_balance || 0),
      totalReceived: Number(row.total_received || 0),
      totalFees: Number(row.total_fees || 0),
      totalPayouts: Number(row.total_payouts || 0),
      currency: "USDT",
    });
  });

  app.get("/api/merchant/payout-methods", isAuthenticated, async (req: any, res) => {
    const merchant = await storage.getMerchantByProfile(req.session.profileId);
    if (!merchant) return res.status(404).json({ message: "Merchant account not found" });
    const methods = await storage.getMerchantPayoutMethods(merchant.id);
    res.json({ methods: methods.map(publicPayoutMethod) });
  });

  app.post("/api/merchant/payout-methods", isAuthenticated, async (req: any, res) => {
    try {
      const merchant = await storage.getMerchantByProfile(req.session.profileId);
      if (!merchant) return res.status(404).json({ message: "Merchant account not found" });
      const method = z.enum(["moncash", "natcash", "usdt", "zelle", "cashapp"]).parse(req.body?.method);
      const details = Object.fromEntries(Object.entries(req.body?.details || {}).map(([key, value]) => [key, String(value).trim()]).filter(([, value]) => value));
      if (method === "usdt" && (!details.walletAddress || !details.network)) throw new Error("Wallet address and network are required");
      if ((method === "moncash" || method === "natcash") && !details.phoneNumber) throw new Error("Phone number is required");
      if (method === "zelle" && !details.email) throw new Error("Email or phone is required");
      if (method === "cashapp" && !details.cashtag) throw new Error("Cash App cashtag is required");
      const created = await storage.createMerchantPayoutMethod({
        merchantId: merchant.id,
        method,
        label: typeof req.body?.label === "string" ? req.body.label.trim().slice(0, 80) : undefined,
        encryptedDetails: encryptPayoutDetails(details),
        maskedDetails: maskPayoutDetails(method, details),
        isDefault: Boolean(req.body?.isDefault),
      });
      res.status(201).json({ method: publicPayoutMethod(created) });
    } catch (e: any) {
      res.status(400).json({ message: e?.message || "Invalid payout method" });
    }
  });

  app.delete("/api/merchant/payout-methods/:id", isAuthenticated, async (req: any, res) => {
    const merchant = await storage.getMerchantByProfile(req.session.profileId);
    if (!merchant) return res.status(404).json({ message: "Merchant account not found" });
    const deleted = await storage.deleteMerchantPayoutMethod(Number(req.params.id), merchant.id);
    if (!deleted) return res.status(404).json({ message: "Payout method not found" });
    res.json({ ok: true });
  });

  app.patch("/api/merchant/payout-methods/:id/default", isAuthenticated, async (req: any, res) => {
    const merchant = await storage.getMerchantByProfile(req.session.profileId);
    if (!merchant) return res.status(404).json({ message: "Merchant account not found" });
    const id = Number(req.params.id);
    const updated = await db.transaction(async (tx) => {
      await tx.update(merchantPayoutMethods).set({ isDefault: false, updatedAt: new Date() }).where(eq(merchantPayoutMethods.merchantId, merchant.id));
      const [row] = await tx.update(merchantPayoutMethods).set({ isDefault: true, updatedAt: new Date() }).where(and(eq(merchantPayoutMethods.id, id), eq(merchantPayoutMethods.merchantId, merchant.id))).returning();
      return row;
    });
    if (!updated) return res.status(404).json({ message: "Payout method not found" });
    res.json({ method: publicPayoutMethod(updated) });
  });

  app.post("/api/merchant/enroll", isAuthenticated, async (req: any, res) => {
    try {
      const existing = await storage.getMerchantByProfile(req.session.profileId);
      if (existing) return res.json({ merchant: existing });
      const businessName = String(req.body?.businessName || "").trim();
      if (businessName.length < 2) return res.status(400).json({ message: "Business name required (min 2 chars)" });
      const profile = await storage.getProfile(req.session.profileId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });
      if (profile.kycStatus !== "verified") {
        return res.status(403).json({ message: "KYC verification is required to enroll as a merchant" });
      }
      const merchant = await storage.createMerchant(req.session.profileId, businessName);
      res.json({ merchant });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/merchant/me", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = updateMerchantSchema.parse(req.body);
      const m = await storage.updateMerchant(req.session.profileId, {
        businessName: parsed.businessName,
        webhookUrl: parsed.webhookUrl ?? undefined,
      });
      if (!m) return res.status(404).json({ message: "Merchant account not found" });
      res.json({ merchant: m });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/merchant/rotate-keys", isAuthenticated, async (req: any, res) => {
    const m = await storage.rotateMerchantKeys(req.session.profileId);
    if (!m) return res.status(404).json({ message: "Merchant account not found" });
    res.json({ merchant: m });
  });

  // Returns ALL API/merchant payments touching this user — both as a buyer ("API Purchase") and as a merchant ("Merchant Payment")
  app.get("/api/profile/api-payments", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = req.session.profileId;
      const asBuyer = await storage.getMerchantPaymentsAsBuyer(profileId, 100);
      const myMerchant = await storage.getMerchantByProfile(profileId);
      const asMerchant = myMerchant ? await storage.getMerchantTransactions(myMerchant.id, 100) : [];
      const merchantIds = new Set<number>([
        ...asBuyer.map(t => t.merchantId),
        ...asMerchant.map(t => t.merchantId),
      ]);
      const merchantsList = await Promise.all(
        Array.from(merchantIds).map(id => storage.getMerchantById(id))
      );
      const nameById = new Map<number, string>();
      merchantsList.forEach(m => { if (m) nameById.set(m.id, m.businessName); });

      const enrich = (t: any, kind: "api_purchase" | "merchant_payment") => ({
        ...t,
        kind,
        merchantBusinessName: nameById.get(t.merchantId) || "Merchant",
      });
      const combined = [
        ...asBuyer.map(t => enrich(t, "api_purchase")),
        ...asMerchant.filter(t => t.payerProfileId !== profileId).map(t => enrich(t, "merchant_payment")),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json({ payments: combined });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ============ MERCHANT PAYOUTS ============

  app.get("/api/merchant/payouts", isAuthenticated, async (req: any, res) => {
    try {
      const list = await storage.getPayoutRequestsByUser(req.session.profileId);
      res.json({ payouts: list });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/merchant/payouts", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = payoutRequestSchema.parse(req.body);
      const profile = await storage.getProfile(req.session.profileId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });
      const merchant = await storage.getMerchantByProfile(profile.id);
      if (!merchant) return res.status(403).json({ message: "Merchant account required to request a payout" });
      if (merchant.accountStatus !== "active") return res.status(403).json({ message: "Merchant account must be active before requesting a payout" });
      if (profile.kycStatus !== "verified" || merchant.kycStatus !== "verified") return res.status(403).json({ message: "Verified KYC is required before requesting a payout" });
      if (!merchant.payoutEnabled) return res.status(403).json({ message: "Payouts are not enabled for this merchant account" });

      if (parsed.idempotencyKey) {
        const [existing] = await db.select().from(payoutRequests).where(and(
          eq(payoutRequests.userId, profile.id),
          eq(payoutRequests.idempotencyKey, parsed.idempotencyKey),
        ));
        if (existing) return res.json({ ok: true, payout: existing, idempotent: true });
      }

      let selectedMethod: any = null;
      if (parsed.payoutMethodId) {
        [selectedMethod] = await db.select().from(merchantPayoutMethods).where(and(
          eq(merchantPayoutMethods.id, parsed.payoutMethodId),
          eq(merchantPayoutMethods.merchantId, merchant.id),
        ));
        if (!selectedMethod) return res.status(400).json({ message: "Invalid payout method" });
        if (selectedMethod.method !== parsed.method) return res.status(400).json({ message: "Payout method mismatch" });
      }

      const merchantBalance = Number(merchant.balance);
      if (merchantBalance < parsed.amount) {
        return res.status(400).json({ message: `Insufficient merchant balance. You have ${merchantBalance.toFixed(2)} USDT in your merchant account.` });
      }

      // Build details object based on method
      const details: Record<string, string> = { method: parsed.method };
      if (selectedMethod) {
        details.masked = selectedMethod.maskedDetails;
        details.payoutMethodId = String(selectedMethod.id);
      } else if (parsed.method === "moncash" || parsed.method === "natcash") {
        details.phoneNumber = maskPayoutDetails(parsed.method, { phoneNumber: parsed.phoneNumber!.trim() });
      } else if (parsed.method === "usdt") {
        details.walletAddress = maskPayoutDetails(parsed.method, { walletAddress: parsed.walletAddress!.trim(), network: parsed.network! });
        details.network = parsed.network!.trim();
      } else if (parsed.method === "zelle") {
        details.email = maskPayoutDetails(parsed.method, { email: parsed.email!.trim() });
      } else if (parsed.method === "cashapp") {
        details.cashtag = maskPayoutDetails(parsed.method, { cashtag: parsed.cashtag!.trim() });
      }

      // Atomic: deduct MERCHANT balance + create payout request in one transaction
      let request: any;
      try {
        request = await db.transaction(async (tx) => {
          const [updated] = await tx.update(merchants)
            .set({ balance: sql`${merchants.balance} - ${parsed.amount}` })
            .where(and(eq(merchants.id, merchant.id), sql`${merchants.balance} >= ${parsed.amount}`))
            .returning();
          if (!updated) throw new Error("INSUFFICIENT_BALANCE");
          const [r] = await tx.insert((await import("@shared/schema")).payoutRequests).values({
            userId: profile.id,
            merchantId: merchant.id,
            amount: String(parsed.amount.toFixed(4)) as any,
            method: parsed.method,
            details: details as any,
            idempotencyKey: parsed.idempotencyKey,
            currency: "USDT",
            fee: String(PAYOUT_FEE_USDT.toFixed(4)) as any,
            netAmount: String((parsed.amount - PAYOUT_FEE_USDT).toFixed(4)) as any,
          }).returning();
          await tx.insert(merchantLedgerEntries).values({
            merchantId: merchant.id,
            payoutId: r.id,
            entryType: "payout_reservation",
            balanceType: "available",
            amount: String(-parsed.amount.toFixed(4)) as any,
            currency: "USDT",
            idempotencyKey: parsed.idempotencyKey ? `payout_reservation:${parsed.idempotencyKey}` : `payout_reservation:${r.id}`,
            description: "Funds reserved for merchant payout",
          });
          return r;
        });
      } catch (txErr: any) {
        if (txErr?.message === "INSUFFICIENT_BALANCE") {
          return res.status(400).json({ message: "Merchant balance changed; please retry." });
        }
        throw txErr;
      }

      const meta = PAYOUT_METHOD_META[parsed.method];
      const detailLine = parsed.method === "zelle" ? `📧 ${details.email}` :
                          parsed.method === "cashapp" ? `💵 ${details.cashtag}` :
                          `📱 ${details.phoneNumber}`;
      sendAdminTelegram(
        `💸 <b>New Merchant Payout Request</b>\n\n` +
        `🏪 <b>Merchant:</b> ${merchant.businessName}\n` +
        `👤 <b>User:</b> ${profile.fullName} (${profile.email})\n` +
        `💰 <b>Amount:</b> ${parsed.amount.toFixed(4)} USDT\n` +
        `🎨 <b>Method:</b> ${meta.label} (${meta.colorName})\n` +
        `${detailLine}\n` +
        `🆔 <b>Request ID:</b> #${request.id}\n` +
        `🕒 ${new Date().toLocaleString("en-US", { timeZone: "America/Port-au-Prince" })}\n\n` +
        `⏳ Awaiting admin processing (24-48h SLA).`
      ).catch(() => {});

      storage.createNotification({
        profileId: profile.id,
        type: "custom_message" as any,
        title: "💸 Payout Request Submitted",
        message: `Your ${meta.label} payout request for ${parsed.amount.toFixed(2)} USDT is being processed (24-48h).`,
      }).catch(() => {});

      res.json({ ok: true, payout: request });
    } catch (e: any) {
      const msg = e?.errors?.[0]?.message || e?.message || String(e);
      res.status(400).json({ message: msg });
    }
  });

  // ============ ADMIN PAYOUTS ============

  app.get("/api/admin/payouts", isAuthenticated, async (req: any, res) => {
    try {
      const me = await storage.getProfile(req.session.profileId);
      if (me?.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const list = await storage.getAllPayoutRequests();
      // Enrich with user + merchant info
      const enriched = await Promise.all(list.map(async (p) => {
        const user = await storage.getProfile(p.userId);
        const merchant = p.merchantId ? await storage.getMerchantById(p.merchantId) : null;
        return {
          ...p,
          user: user ? { id: user.id, fullName: user.fullName, email: user.email } : null,
          merchant: merchant ? { id: merchant.id, businessName: merchant.businessName } : null,
        };
      }));
      res.json({ payouts: enriched });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/payouts/:id/approve", isAuthenticated, async (req: any, res) => {
    try {
      const me = await storage.getProfile(req.session.profileId);
      if (me?.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const id = Number(req.params.id);
      const payout = await storage.getPayoutRequestById(id);
      if (!payout) return res.status(404).json({ message: "Payout not found" });
      if (payout.status !== "pending") return res.status(400).json({ message: `Already ${payout.status}` });

      const updated = await storage.updatePayoutRequestStatus(id, "approved", me.id, req.body?.adminNote);
      if (!updated) return res.status(409).json({ message: "Concurrently processed" });

      const meta = PAYOUT_METHOD_META[payout.method];
      storage.createNotification({
        profileId: payout.userId,
        type: "withdrawal_approved" as any,
        title: "✅ Payout Approved",
        message: `Your ${meta.label} payout of ${Number(payout.amount).toFixed(2)} USDT has been processed.`,
      }).catch(() => {});

      sendAdminTelegram(
        `✅ <b>Payout #${payout.id} Approved</b>\n` +
        `${meta.label} (${meta.colorName}) — ${Number(payout.amount).toFixed(2)} USDT`
      ).catch(() => {});

      res.json({ ok: true, payout: updated });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/payouts/:id/reject", isAuthenticated, async (req: any, res) => {
    try {
      const me = await storage.getProfile(req.session.profileId);
      if (me?.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const id = Number(req.params.id);
      const payout = await storage.getPayoutRequestById(id);
      if (!payout) return res.status(404).json({ message: "Payout not found" });
      if (payout.status !== "pending") return res.status(400).json({ message: `Already ${payout.status}` });

      // Atomic refund to MERCHANT balance + state transition
      const amount = Number(payout.amount);
      const adminNote = req.body?.adminNote || "Rejected by admin";
      const { payoutRequests: payoutsTable } = await import("@shared/schema");
      let updated: any;
      try {
        updated = await db.transaction(async (tx) => {
          // CAS: only transition pending → rejected
          const [u] = await tx.update(payoutsTable)
            .set({ status: "rejected", adminNote, processedAt: new Date(), processedBy: me.id })
            .where(and(eq(payoutsTable.id, id), eq(payoutsTable.status, "pending")))
            .returning();
          if (!u) throw new Error("RACE");
          if (payout.merchantId) {
            await tx.update(merchants)
              .set({ balance: sql`${merchants.balance} + ${amount}` })
              .where(eq(merchants.id, payout.merchantId));
          } else {
            await tx.update(profiles)
              .set({ balance: sql`${profiles.balance} + ${amount}` })
              .where(eq(profiles.id, payout.userId));
          }
          return u;
        });
      } catch (txErr: any) {
        if (txErr?.message === "RACE") {
          return res.status(409).json({ message: "Concurrently processed" });
        }
        throw txErr;
      }

      const meta = PAYOUT_METHOD_META[payout.method];
      storage.createNotification({
        profileId: payout.userId,
        type: "withdrawal_rejected" as any,
        title: "❌ Payout Rejected",
        message: `Your ${meta.label} payout of ${amount.toFixed(2)} USDT was rejected and refunded to your balance.${req.body?.adminNote ? ` Reason: ${req.body.adminNote}` : ""}`,
      }).catch(() => {});

      sendAdminTelegram(
        `❌ <b>Payout #${payout.id} Rejected</b>\n` +
        `${meta.label} (${meta.colorName}) — ${amount.toFixed(2)} USDT refunded to user.`
      ).catch(() => {});

      res.json({ ok: true, payout: updated });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/merchant/transactions", isAuthenticated, async (req: any, res) => {
    const merchant = await storage.getMerchantByProfile(req.session.profileId);
    if (!merchant) return res.json({ transactions: [] });
    const txns = await storage.getMerchantTransactions(merchant.id, 200);
    res.json({ transactions: txns });
  });

  // ============ PUBLIC API (Bearer api_secret_key) ============

  app.post("/api/v1/checkout", requireApiKey, async (req, res) => {
    try {
      const parsed = checkoutApiSchema.parse(req.body);
      const merchant = req.merchant!;
      const rate = getDepositRate();
      let amountUsdt: number;
      let amountHtg: number;
      if (parsed.currency === "HTG") {
        amountHtg = parsed.amount;
        amountUsdt = parsed.amount / rate;
      } else {
        amountUsdt = parsed.amount;
        amountHtg = parsed.amount * rate;
      }
      if (amountUsdt < 0.5) {
        return res.status(400).json({ error: "Minimum charge is 0.50 USDT (~70 HTG)" });
      }
      const feeUsdt = +(amountUsdt * FEE_PCT).toFixed(4);
      const netUsdt = +(amountUsdt - feeUsdt).toFixed(4);
      const paymentId = "pay_" + crypto.randomBytes(14).toString("hex");
      const expiresAt = new Date(Date.now() + CHECKOUT_TTL_MS);

      await storage.createMerchantTransaction({
        paymentId,
        merchantId: merchant.id,
        orderId: parsed.order_id,
        amount: String(parsed.amount.toFixed(2)) as any,
        currency: parsed.currency,
        amountUsdt: String(amountUsdt.toFixed(4)) as any,
        amountHtg: String(amountHtg.toFixed(2)) as any,
        feeUsdt: String(feeUsdt.toFixed(4)) as any,
        netUsdt: String(netUsdt.toFixed(4)) as any,
        exchangeRate: String(rate.toFixed(4)) as any,
        successUrl: parsed.success_url || null,
        cancelUrl: parsed.cancel_url || null,
        description: parsed.description || null,
        expiresAt,
      } as any);

      const checkoutUrl = `${PUBLIC_BASE_URL}/checkout/${paymentId}`;

      res.json({
        ok: true,
        payment_id: paymentId,
        checkout_url: checkoutUrl,
        amount: parsed.amount,
        currency: parsed.currency,
        amount_usdt: amountUsdt.toFixed(4),
        amount_htg: amountHtg.toFixed(2),
        fee_usdt: feeUsdt.toFixed(4),
        net_usdt: netUsdt.toFixed(4),
        exchange_rate: rate,
        order_id: parsed.order_id,
        expires_at: expiresAt.toISOString(),
      });
    } catch (e: any) {
      res.status(400).json({ error: e?.message || String(e) });
    }
  });

  app.get("/api/v1/payment/:id", requireApiKey, async (req, res) => {
    const paymentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const t = await storage.getMerchantTransactionByPaymentId(paymentId);
    if (!t || t.merchantId !== req.merchant!.id) return res.status(404).json({ error: "Not found" });
    res.json({
      payment_id: t.paymentId,
      order_id: t.orderId,
      status: t.status,
      amount: t.amount,
      currency: t.currency,
      amount_usdt: t.amountUsdt,
      amount_htg: t.amountHtg,
      net_usdt: t.netUsdt,
      paid_at: t.paidAt,
      expires_at: t.expiresAt,
    });
  });

  // ============ CHECKOUT GATEWAY (session-auth — payer pays from balance) ============

  app.get("/api/checkout/:paymentId", async (req: any, res) => {
    const t = await storage.getMerchantTransactionByPaymentId(req.params.paymentId);
    if (!t) return res.status(404).json({ message: "Payment not found" });
    if (t.status === "pending" && new Date(t.expiresAt) < new Date()) {
      await storage.markMerchantTransactionExpired(t.paymentId);
      t.status = "expired" as any;
    }
    const merchant = await storage.getMerchantById(t.merchantId);
    let payerBalance: number | null = null;
    if (req.session?.profileId) {
      const p = await storage.getProfile(req.session.profileId);
      payerBalance = p ? Number(p.balance) : null;
    }
    res.json({
      payment_id: t.paymentId,
      order_id: t.orderId,
      status: t.status,
      amount: Number(t.amount),
      currency: t.currency,
      amount_usdt: Number(t.amountUsdt),
      amount_htg: Number(t.amountHtg),
      exchange_rate: Number(t.exchangeRate),
      description: t.description,
      success_url: t.successUrl,
      cancel_url: t.cancelUrl,
      expires_at: t.expiresAt,
      paid_at: t.paidAt,
      merchant: merchant ? {
        business_name: merchant.businessName,
        is_verified: merchant.isVerified,
      } : null,
      payer: req.session?.profileId ? {
        logged_in: true,
        balance_usdt: payerBalance,
      } : { logged_in: false },
    });
  });

  app.post("/api/checkout/:paymentId/pay", isAuthenticated, async (req: any, res) => {
    try {
      const t = await storage.getMerchantTransactionByPaymentId(req.params.paymentId);
      if (!t) return res.status(404).json({ message: "Payment not found" });
      if (t.status !== "pending") return res.status(400).json({ message: `Payment already ${t.status}` });
      if (new Date(t.expiresAt) < new Date()) {
        await storage.markMerchantTransactionExpired(t.paymentId);
        return res.status(400).json({ message: "Payment expired" });
      }
      const merchant = await storage.getMerchantById(t.merchantId);
      if (!merchant) return res.status(404).json({ message: "Merchant not found" });
      const payer = await storage.getProfile(req.session.profileId);
      if (!payer) return res.status(404).json({ message: "Payer not found" });
      if (payer.id === merchant.profileId) {
        return res.status(400).json({ message: "You cannot pay your own merchant order" });
      }
      const amountUsdt = Number(t.amountUsdt);
      const netUsdt = Number(t.netUsdt);
      const payerBal = Number(payer.balance);
      if (payerBal < amountUsdt) {
        return res.status(400).json({ message: `Insufficient balance. Need ${amountUsdt.toFixed(2)} USDT, you have ${payerBal.toFixed(2)} USDT.` });
      }

      // Atomic transfer: debit payer profile, credit MERCHANT BALANCE (separate from personal account)
      const updated = await db.transaction(async (tx) => {
        const [claimed] = await tx.update((await import("@shared/schema")).merchantTransactions)
          .set({ status: "completed", paidAt: new Date(), payerProfileId: payer.id })
          .where(and(eq((await import("@shared/schema")).merchantTransactions.paymentId, t.paymentId), eq((await import("@shared/schema")).merchantTransactions.status, "pending")))
          .returning();
        if (!claimed) return null;
        const [debited] = await tx.update(profiles)
          .set({ balance: sql`${profiles.balance} - ${amountUsdt}` })
          .where(and(eq(profiles.id, payer.id), sql`${profiles.balance} >= ${amountUsdt}`))
          .returning();
        if (!debited) throw new Error("INSUFFICIENT_PAYER_BALANCE");
        await tx.update(merchants)
          .set({ balance: sql`${merchants.balance} + ${netUsdt}`, updatedAt: new Date() })
          .where(eq(merchants.id, merchant.id));
        await tx.insert(merchantLedgerEntries).values({
          merchantId: merchant.id,
          paymentId: t.paymentId,
          entryType: "payment",
          balanceType: "available",
          amount: String(netUsdt.toFixed(4)) as any,
          currency: "USDT",
          idempotencyKey: `payment:${t.paymentId}`,
          description: `Payment received for order ${t.orderId}`,
        });
        if (Number(t.feeUsdt) > 0) {
          await tx.insert(merchantLedgerEntries).values({
            merchantId: merchant.id,
            paymentId: t.paymentId,
            entryType: "fee",
            balanceType: "available",
            amount: String((-Number(t.feeUsdt)).toFixed(4)) as any,
            currency: "USDT",
            idempotencyKey: `fee:${t.paymentId}`,
            description: "Izichanj payment fee",
          });
        }
        return claimed;
      });
      if (!updated) return res.status(409).json({ message: "Payment was concurrently processed" });

      // In-app notifications for both parties
      storage.createNotification({
        profileId: merchant.profileId,
        type: "transfer_received" as any,
        title: "💸 Izichanj Pay — Payment Received",
        message: `${payer.fullName} paid ${amountUsdt.toFixed(2)} USDT for order ${t.orderId}. Full amount credited (0% Izichanj Pay fee).`,
      }).catch(() => {});
      storage.createNotification({
        profileId: payer.id,
        type: "transfer_sent" as any,
        title: "✅ Payment Successful",
        message: `You paid ${amountUsdt.toFixed(2)} USDT to ${merchant.businessName} (order ${t.orderId}).`,
      }).catch(() => {});

      // Admin Telegram alert with full split breakdown
      const merchantHtg = netUsdt * Number(t.exchangeRate);
      sendAdminTelegram(
        `🛒 <b>Izichanj Pay — API Purchase Completed</b>\n\n` +
        `🏪 <b>Merchant:</b> ${merchant.businessName}\n` +
        `🆔 <b>Order ID:</b> <code>${t.orderId}</code>\n` +
        `🔖 <b>Payment ID:</b> <code>${t.paymentId}</code>\n` +
        `👤 <b>Buyer:</b> ${payer.fullName} (${payer.email})\n\n` +
        `💵 <b>Total Paid by Customer:</b> ${amountUsdt.toFixed(4)} USDT (${Number(t.amountHtg).toFixed(2)} HTG)\n` +
        `🏦 <b>Merchant Share:</b> ${netUsdt.toFixed(4)} USDT (${merchantHtg.toFixed(2)} HTG)\n` +
        `💰 <b>Izichanj Commission:</b> 0.0000 USDT (0% — Izichanj Pay is FREE)\n\n` +
        `📈 <b>Rate:</b> 1 USDT = ${Number(t.exchangeRate).toFixed(2)} HTG\n` +
        `🕒 ${new Date().toLocaleString("en-US", { timeZone: "America/Port-au-Prince" })}`
      ).catch(() => {});

      // Fire webhook (non-blocking)
      const webhookPayload = {
        event: "payment.completed",
        payment_id: t.paymentId,
        order_id: t.orderId,
        status: "completed",
        amount: Number(t.amount),
        currency: t.currency,
        amount_usdt: Number(t.amountUsdt),
        amount_htg: Number(t.amountHtg),
        fee_usdt: Number(t.feeUsdt),
        net_usdt: Number(t.netUsdt),
        exchange_rate: Number(t.exchangeRate),
        paid_at: new Date().toISOString(),
        merchant_id: merchant.id,
      };
      deliverWebhook(merchant, t.paymentId, webhookPayload).catch(() => {});

      res.json({
        ok: true,
        payment_id: t.paymentId,
        status: "completed",
        success_url: t.successUrl,
      });
    } catch (e: any) {
      console.error("[Checkout pay] error:", e);
      res.status(500).json({ message: e?.message || "Payment failed" });
    }
  });

  // Periodic expiry sweep (lightweight — runs every 5 min)
  setInterval(async () => {
    try {
      await db.execute(sql`UPDATE merchant_transactions SET status='expired' WHERE status='pending' AND expires_at < NOW()`);
    } catch {}
  }, 5 * 60 * 1000);
}
