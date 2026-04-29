import type { Express, Request } from "express";
import type { Server } from "http";
import { ProxyAgent } from "undici";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, resetPinSchema } from "@shared/schema";
import { z } from "zod";
import { setupAuth, isAuthenticated } from "./auth";
import { registerMerchantRoutes } from "./merchant";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import {
  WITHDRAWAL_MIN_USDT, WITHDRAWAL_MAX_USDT, WITHDRAWAL_FEE_USDT, formatHtg,
  NETWORK_FEE_CONFIG, MANUAL_DEPOSIT_MIN_HTG, MANUAL_DEPOSIT_MIN_USDT, TOPUP_FEE_USD,
  CARD_LOAD_AMOUNT_USD, CARD_CREATION_FEE_USD, CARD_TOPUP_FIXED_FEE_USD, CARD_TOPUP_MIN_USD,
  calcCardCreationCost, calcCardTopUpCost,
  NFC_CARD_LOAD_AMOUNT_USD, NFC_TOPUP_MIN_USD, NFC_WITHDRAW_MIN_USD,
  calcNfcCardCreationCost, calcNfcCardTopUpCost, calcNfcCardWithdrawCost,
} from "@shared/constants";
import { getDepositRate, getWithdrawalRate, setRates, rateUsdtToHtg, rateHtgToUsdt, rateUsdtToHtgWithdrawal } from "./rates";
import { generateReceiptPDF, generateAdjustmentReceiptPDF } from "./receipt";
import { ensureKycImageSize } from "./image-compress";
import { deposits, profiles, virtualCards } from "@shared/schema";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";
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
const HAITI_TZ = "America/Port-au-Prince";

function haitiDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", { timeZone: HAITI_TZ, year: "numeric", month: "short", day: "numeric" }).format(new Date(date as any));
}

function haitiDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", { timeZone: HAITI_TZ, year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(date as any));
}

function getClientIp(req: Request): string {
  // 1. Cloudflare — most reliable when deployed behind CF
  const cfIp = req.headers["cf-connecting-ip"] as string;
  if (cfIp?.trim()) return cfIp.trim();

  // 2. X-Forwarded-For — leftmost IP is the original client
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const first = raw.split(",")[0].trim();
    if (first && first !== "::1" && first !== "127.0.0.1") return first;
  }

  // 3. X-Real-IP — set by Nginx and some load balancers
  const realIp = req.headers["x-real-ip"] as string;
  if (realIp?.trim()) return realIp.trim();

  // 4. Fly-Client-IP (Fly.io deployments)
  const flyIp = req.headers["fly-client-ip"] as string;
  if (flyIp?.trim()) return flyIp.trim();

  // 5. Fallback to Express req.ip (respects trust proxy setting)
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function getDeviceInfo(req: Request): string {
  const ua = req.headers["user-agent"] || "";
  let device = "Unknown";
  let os = "Unknown";
  let browser = "Unknown";
  if (/iPhone/i.test(ua)) device = "iPhone";
  else if (/iPad/i.test(ua)) device = "iPad";
  else if (/Android/i.test(ua) && /Mobile/i.test(ua)) device = "Android Phone";
  else if (/Android/i.test(ua)) device = "Android Tablet";
  else if (/Windows/i.test(ua)) device = "Windows PC";
  else if (/Macintosh/i.test(ua)) device = "Mac";
  else if (/Linux/i.test(ua)) device = "Linux PC";
  if (/Windows NT 10/i.test(ua)) os = "Windows 10/11";
  else if (/Windows NT 6\.3/i.test(ua)) os = "Windows 8.1";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) { const m = ua.match(/Android ([0-9.]+)/); os = m ? `Android ${m[1]}` : "Android"; }
  else if (/iPhone OS/i.test(ua)) { const m = ua.match(/iPhone OS ([0-9_]+)/); os = m ? `iOS ${m[1].replace(/_/g, ".")}` : "iOS"; }
  if (/Chrome\/([0-9]+)/i.test(ua) && !/Chromium|Edge|OPR/i.test(ua)) { const m = ua.match(/Chrome\/([0-9]+)/); browser = m ? `Chrome ${m[1]}` : "Chrome"; }
  else if (/Firefox\/([0-9]+)/i.test(ua)) { const m = ua.match(/Firefox\/([0-9]+)/); browser = m ? `Firefox ${m[1]}` : "Firefox"; }
  else if (/Safari\/([0-9]+)/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  else if (/Edg\/([0-9]+)/i.test(ua)) { const m = ua.match(/Edg\/([0-9]+)/); browser = m ? `Edge ${m[1]}` : "Edge"; }
  else if (/OPR\/([0-9]+)/i.test(ua)) browser = "Opera";
  return `${device} · ${os} · ${browser}`;
}

function getWebAuthnConfig(req: any) {
  const host = req.get("host") || req.hostname || "localhost";
  const rpID = host.split(":")[0];
  const protocol = req.protocol || "https";
  const origin = `${protocol}://${host}`;
  return { rpID, origin };
}

function buildGreeting(name?: string): string {
  if (!name || !name.trim()) return "";
  const firstName = name.trim().split(" ")[0];
  return `Bonjour ${firstName} 👋,\n\n`;
}

async function sendWhatsAppOtp(phone: string, code: string, name?: string) {
  const instanceId = process.env.ULTRAMSG_INSTANCE_ID;
  const token = process.env.ULTRAMSG_TOKEN;
  if (!instanceId || !token) {
    console.log(`[MOCK WHATSAPP] Sending OTP ${code} to ${phone}`);
    return;
  }
  try {
    const greeting = buildGreeting(name);
    const text = `*Izichanj*\n\n${greeting}Your verification code is: *${code}*\n\nThis code expires in 5 minutes.\nDo not share it with anyone.`;
    const res = await fetch(`https://api.ultramsg.com/${instanceId}/messages/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, to: phone, body: text }),
    });
    const data = await res.json();
    if (data.sent === "true" || data.sent === true) {
      console.log(`[WHATSAPP] OTP sent to ${phone} via UltraMsg`);
    } else {
      console.error(`[WHATSAPP ERROR] UltraMsg response:`, JSON.stringify(data));
      console.log(`[FALLBACK] WhatsApp delivery failed. OTP code for ${phone}: ${code}`);
    }
  } catch (error: any) {
    console.error(`[WHATSAPP ERROR] Failed to send OTP to ${phone}:`, error.message);
    console.log(`[FALLBACK] WhatsApp delivery failed. OTP code for ${phone}: ${code}`);
  }
}

async function sendWhatsAppNotification(phone: string, message: string, name?: string) {
  const instanceId = process.env.ULTRAMSG_INSTANCE_ID;
  const token = process.env.ULTRAMSG_TOKEN;
  if (!instanceId || !token || !phone) {
    console.log(`[MOCK WHATSAPP NOTIFICATION] To ${phone}: ${message}`);
    return;
  }
  try {
    const greeting = buildGreeting(name);
    // Insert greeting after the first line (*Izichanj*\n\n)
    const body = message.startsWith("*Izichanj*\n\n")
      ? `*Izichanj*\n\n${greeting}${message.slice("*Izichanj*\n\n".length)}`
      : `${greeting}${message}`;
    const res = await fetch(`https://api.ultramsg.com/${instanceId}/messages/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, to: phone, body }),
    });
    const data = await res.json();
    if (data.sent === "true" || data.sent === true) {
      console.log(`[WHATSAPP] Notification sent to ${phone}`);
    } else {
      console.error(`[WHATSAPP ERROR] Notification failed:`, JSON.stringify(data));
    }
  } catch (error: any) {
    console.error(`[WHATSAPP ERROR] Failed to send notification to ${phone}:`, error.message);
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
  registerMerchantRoutes(app);

  // --- MonCash Payment Integration ---
  const MONCASH_CLIENT_ID = process.env.MONCASH_CLIENT_ID;
  const MONCASH_CLIENT_SECRET = process.env.MONCASH_CLIENT_SECRET;
  const MONCASH_BASE_URL = "https://sandbox.moncashbutton.digicelgroup.com";

  async function getMoncashAccessToken(): Promise<string> {
    const credentials = Buffer.from(`${MONCASH_CLIENT_ID}:${MONCASH_CLIENT_SECRET}`).toString("base64");
    const response = await fetch(`${MONCASH_BASE_URL}/Api/oauth/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: "scope=read,write&grant_type=client_credentials",
    });
    if (!response.ok) {
      const text = await response.text();
      console.error("MonCash token error:", text);
      throw new Error("Failed to get MonCash access token");
    }
    const data = await response.json() as any;
    return data.access_token;
  }

  async function createMoncashPayment(amount: number, orderId: string): Promise<{ redirectUrl: string }> {
    const token = await getMoncashAccessToken();
    const response = await fetch(`${MONCASH_BASE_URL}/Api/v1/CreatePayment`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ amount, orderId }),
    });
    if (!response.ok) {
      const text = await response.text();
      console.error("MonCash create payment error:", text);
      try {
        const errData = JSON.parse(text);
        if (errData.message) throw new Error(errData.message);
      } catch (parseErr: any) {
        if (parseErr.message && parseErr.message !== text) throw parseErr;
      }
      throw new Error("Failed to create MonCash payment");
    }
    const data = await response.json() as any;
    const paymentToken = data.payment_token?.token;
    if (!paymentToken) throw new Error("No payment token returned");
    return { redirectUrl: `${MONCASH_BASE_URL}/Moncash-middleware/Payment/Redirect?token=${paymentToken}` };
  }

  async function verifyMoncashPayment(transactionId: string): Promise<any> {
    const token = await getMoncashAccessToken();
    const response = await fetch(`${MONCASH_BASE_URL}/Api/v1/RetrieveTransactionPayment`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ transactionId }),
    });
    if (!response.ok) {
      const text = await response.text();
      console.error("MonCash verify error:", text);
      throw new Error("Failed to verify MonCash payment");
    }
    return await response.json();
  }

  app.post("/api/moncash/create-payment", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      if (profile.kycStatus !== "verified") return res.status(403).json({ message: "KYC verification required before making deposits" });

      const { amountHtg } = req.body;
      if (!amountHtg || isNaN(Number(amountHtg)) || Number(amountHtg) < 100) {
        return res.status(400).json({ message: "Minimum deposit is 100 HTG" });
      }

      const htgAmount = Number(amountHtg);
      const usdtAmount = rateHtgToUsdt(htgAmount);
      const orderId = `MCH-${profile.id}-${Date.now()}`;

      const { redirectUrl } = await createMoncashPayment(htgAmount, orderId);

      const deposit = await storage.createDeposit({
        profileId: profile.id,
        amountUsdt: usdtAmount.toFixed(2),
        txHash: orderId,
        depositMethod: "moncash",
        amountHtg: htgAmount.toFixed(2),
      });

      res.json({ redirectUrl, depositId: deposit.id, orderId });
    } catch (e: any) {
      console.error("MonCash create payment error:", e);
      res.status(500).json({ message: e.message || "Failed to create payment" });
    }
  });

  app.get("/api/moncash/verify", isAuthenticated, async (req: any, res) => {
    try {
      const { transactionId } = req.query;
      if (!transactionId) return res.status(400).json({ message: "Transaction ID required" });

      const paymentData = await verifyMoncashPayment(transactionId as string);
      const payment = paymentData?.payment;
      if (!payment) return res.status(400).json({ message: "Payment not found" });

      const orderId = payment.payer;
      const existing = await storage.getDepositByMoncashTransactionId(transactionId as string);
      if (existing) return res.json({ status: "already_processed", deposit: existing });

      const allDeposits = await storage.getDeposits();
      const deposit = allDeposits.find(d => d.txHash === payment.reference);
      if (!deposit) return res.status(404).json({ message: "Deposit record not found" });

      const profile = await storage.getProfile(deposit.profileId);
      if (!profile) return res.status(404).json({ message: "Profile not found" });

      const [updatedDeposit] = await db.update(deposits).set({
        moncashTransactionId: transactionId as string,
        status: "approved",
      }).where(eq(deposits.id, deposit.id)).returning();

      const depositAmount = parseFloat(deposit.amountUsdt);
      const currentBalance = parseFloat(profile.balance);
      const newBalance = currentBalance + depositAmount;
      await storage.updateProfileBalance(deposit.profileId, newBalance);

      const htgAmount = formatHtg(rateUsdtToHtg(depositAmount));
      await storage.createNotification({
        profileId: deposit.profileId,
        type: "deposit_approved",
        title: "MonCash Deposit Approved",
        message: `Your MonCash deposit of ${htgAmount} HTG (${depositAmount.toFixed(2)} USDT) has been automatically approved and added to your balance.`,
      });

      const admins = await storage.getAllProfiles();
      const adminList = admins.filter(a => a.role === "admin");
      for (const admin of adminList) {
        await storage.createNotification({
          profileId: admin.id,
          type: "custom_message",
          title: "MonCash Deposit Auto-Approved",
          message: `User ${profile.fullName} deposited ${htgAmount} HTG via MonCash (auto-approved). Transaction: ${transactionId}`,
        });
      }

      res.json({ status: "approved", deposit: updatedDeposit });
    } catch (e: any) {
      console.error("MonCash verify error:", e);
      res.status(500).json({ message: e.message || "Failed to verify payment" });
    }
  });

  app.get("/payment-success", (_req, res) => {
    const transactionId = _req.query.transactionId || "";
    res.redirect(`/deposit?moncash_txn=${transactionId}`);
  });

  // ============ NOWPayments Integration ============
  const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY || "";
  const NOWPAYMENTS_BASE_URL = "https://api.nowpayments.io/v1";

  app.post("/api/nowpayments/create-payment", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      if (profile.kycStatus !== "verified") return res.status(403).json({ message: "KYC verification required before making deposits" });

      // Block if there's already an active pending NOWPayments deposit
      const existingDeposits = await storage.getDeposits(profile.id);
      const activePending = existingDeposits.find(
        (d) =>
          d.depositMethod === "nowpayments" &&
          d.status === "pending" &&
          d.expiresAt &&
          new Date(d.expiresAt) > new Date()
      );
      if (activePending) {
        return res.status(409).json({ message: "You already have an active pending crypto deposit. Please complete that transfer or wait for it to expire before creating a new one." });
      }

      const { amountUsdt, payCurrency } = req.body;
      if (!amountUsdt || isNaN(Number(amountUsdt)) || Number(amountUsdt) <= 0) {
        return res.status(400).json({ message: "Amount must be greater than 0" });
      }

      const currency = (payCurrency === "usdtbsc" ? "usdtbsc" : "usdttrc20") as "usdttrc20" | "usdtbsc";
      const FEE_CONFIG: Record<string, { minAmount: number; maxAmount: number; fee: number }> = {
        usdttrc20: { minAmount: 10.00, maxAmount: 50000, fee: 2.50 },
        usdtbsc:   { minAmount: 10.00, maxAmount: 50000, fee: 0.25 },
      };
      const networkConfig = FEE_CONFIG[currency];
      const amount = Number(amountUsdt);
      const networkLabel = currency === "usdtbsc" ? "BEP20" : "TRC20";
      if (amount < networkConfig.minAmount) {
        return res.status(400).json({ message: `Minimum deposit for ${networkLabel} is $${networkConfig.minAmount.toFixed(2)} USDT.` });
      }
      if (amount > networkConfig.maxAmount) {
        return res.status(400).json({ message: `Maximum deposit for ${networkLabel} is $${networkConfig.maxAmount.toLocaleString()} USDT.` });
      }
      const creditAmount = amount - networkConfig.fee;
      const orderId = `NP-${profile.id}-${Date.now()}`;
      const htgAmount = rateUsdtToHtg(creditAmount);

      const response = await fetch(`${NOWPAYMENTS_BASE_URL}/payment`, {
        method: "POST",
        headers: {
          "x-api-key": NOWPAYMENTS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          price_amount: amount,
          price_currency: "usd",
          pay_currency: currency,
          order_id: orderId,
          order_description: `Deposit ${amount} USDT for ${profile.fullName}`,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("NOWPayments create payment error:", text);
        try {
          const errData = JSON.parse(text);
          if (errData.message) return res.status(400).json({ message: errData.message });
        } catch {}
        return res.status(500).json({ message: "Failed to create crypto payment" });
      }

      const paymentData = await response.json() as any;

      const depositExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
      const deposit = await storage.createDeposit({
        profileId: profile.id,
        amountUsdt: amount.toFixed(2),
        txHash: orderId,
        depositMethod: "nowpayments",
        amountHtg: htgAmount.toFixed(2),
        nowpaymentsPaymentId: String(paymentData.payment_id),
        payAddress: paymentData.pay_address,
        payCurrency: currency,
        expiresAt: depositExpiresAt,
        ipAddress: getClientIp(req),
      });

      // Telegram notification — address generated
      sendTelegramMessage(
        `📬 <b>Crypto Deposit Address Generated</b>\n\n` +
        `👤 <b>Name:</b> ${profile.fullName}\n` +
        `📧 <b>Email:</b> ${profile.email}\n` +
        `🆔 <b>User ID:</b> ${profile.referenceId || profile.id}\n` +
        `💵 <b>Amount:</b> ${amount.toFixed(2)} USDT (credit ${creditAmount.toFixed(2)} USDT after fee)\n` +
        `🌐 <b>Network:</b> ${currency === "usdtbsc" ? "BEP20 (BSC)" : "TRC20"}\n` +
        `🏦 <b>Address:</b> <code>${paymentData.pay_address}</code>\n\n` +
        `⏳ Waiting for the user to send funds.`
      ).catch(() => {});

      res.json({
        depositId: deposit.id,
        paymentId: paymentData.payment_id,
        payAddress: paymentData.pay_address,
        payAmount: paymentData.pay_amount,
        payCurrency: paymentData.pay_currency,
        expirationDate: paymentData.expiration_estimate_date,
        expiresAt: depositExpiresAt.toISOString(),
        orderId,
      });
    } catch (e: any) {
      console.error("NOWPayments create payment error:", e);
      res.status(500).json({ message: e.message || "Failed to create crypto payment" });
    }
  });

  app.get("/api/nowpayments/payment-status/:paymentId", isAuthenticated, async (req: any, res) => {
    try {
      const { paymentId } = req.params;
      const response = await fetch(`${NOWPAYMENTS_BASE_URL}/payment/${paymentId}`, {
        headers: { "x-api-key": NOWPAYMENTS_API_KEY },
      });
      if (!response.ok) {
        return res.status(500).json({ message: "Failed to check payment status" });
      }
      const data = await response.json() as any;
      res.json({
        paymentStatus: data.payment_status,
        actuallyPaid: data.actually_paid,
        payAmount: data.pay_amount,
        payCurrency: data.pay_currency,
        outcomeAmount: data.outcome_amount,
      });
    } catch (e: any) {
      console.error("NOWPayments status check error:", e);
      res.status(500).json({ message: "Failed to check payment status" });
    }
  });

  // POST /api/strowallet/webhook — handles all Strowallet card events (Card Issuing, Amucha, Bankly, Paga, Safe Haven)
  app.post("/api/strowallet/webhook", async (req, res) => {
    res.sendStatus(200); // Always respond immediately so Strowallet doesn't retry
    try {
      const event = req.body;
      console.log("[STROWALLET WEBHOOK] Received:", JSON.stringify(event));

      const eventType = String(event.event || event.type || event.status || "unknown");
      const customerEmail = event.customer_email || event.email || "";
      const cardId = event.card_id || event.cardId || "";
      const amount = event.amount || event.debit_amount || event.debit || "";
      const currency = event.currency || "USD";
      const reason = event.reason || event.message || event.error || event.description || "";
      const lowerEvent = eventType.toLowerCase();
      const lowerReason = String(reason).toLowerCase();

      // ── Merchant / spend details ─────────────────────────────────────────
      const merchant     = event.merchant_name || event.merchant || event.narration || event.description || event.reference || "";
      const mcc          = String(event.mcc || event.merchant_category_code || event.category || "");
      const last4        = event.last4 || event.card_last4 || event.pan_last4 || "";
      const lowerMerchant = merchant.toLowerCase();
      const newCardBal   = event.available_balance ?? event.balance ?? event.card_balance ?? null;

      // ── Suspicious merchant keyword lists ───────────────────────────────
      const CRYPTO_KEYWORDS = [
        "coinbase","binance","kraken","gemini","bitstamp","bitfinex","kucoin","bybit","okx",
        "huobi","crypto.com","blockchain","bitcoin","ethereum","solana","usdt","tether",
        "bitpay","moonpay","simplex","wyre","transak","ramp.network","onramper","localbitcoin",
        "paxful","hodlnaut","nexo","celsius","blockfi","coinmama","changelly","shapeshift",
        "cex.io","gate.io","mexc","bitmart","bkex","poloniex","bittrex","luno","coindcx",
      ];
      const ADULT_KEYWORDS = [
        "pornhub","onlyfans","xvideos","xhamster","brazzers","bang bros","bangbros",
        "naughtyamerica","naughty america","realitykings","reality kings","mofos",
        "digitalplayground","digital playground","kink","fetlife","jerkmate","chaturbate",
        "myfreecams","cam4","bongacams","stripchat","livejasmin","jasmin","imlive",
        "adulttime","adult time","hentai","xxxblackbook","adultfriendfinder","ashley madison",
        "fuckbook","sexplanet","fuckedhard","18eighteen","penthouse","playboy","hustler",
        "escort","massage parlor","strip club","adult content","xxx","pornography",
        "sexwork","sex work","webcam model","only fans","fansly","admireme",
      ];

      const isCryptoMerchant = CRYPTO_KEYWORDS.some(k => lowerMerchant.includes(k));
      // MCC 7995 = gambling, 7273 = escort, 5912 = adult stores
      const isAdultMcc    = ["7273","5912","7993","7995"].includes(mcc);
      const isAdultMerchant = isAdultMcc || ADULT_KEYWORDS.some(k => lowerMerchant.includes(k));
      const isSuspicious  = isCryptoMerchant || isAdultMerchant;

      // ── Classify the event ──────────────────────────────────────────────
      const isSuccess   = lowerEvent.includes("approved") || lowerEvent.includes("active") || lowerEvent.includes("created") || lowerEvent.includes("success");
      const isFailure   = lowerEvent.includes("fail") || lowerEvent.includes("declined") || lowerEvent.includes("rejected") || lowerEvent.includes("error") || lowerEvent.includes("denied");
      const isNoFunds   = lowerEvent.includes("insufficient") || lowerReason.includes("insufficient") || lowerReason.includes("no fund") || lowerReason.includes("not enough") || lowerReason.includes("balance") || lowerEvent.includes("low_balance") || lowerEvent.includes("no_fund");
      const isDebit     = lowerEvent.includes("debit") || lowerEvent.includes("transaction") || lowerEvent.includes("charge") || lowerEvent.includes("purchase");
      const isFreeze    = lowerEvent.includes("freeze") || lowerEvent.includes("blocked") || lowerEvent.includes("suspend");
      const isKycEvent  = lowerEvent.includes("kyc") || lowerEvent.includes("verification");

      // ── Choose emoji & header label ──────────────────────────────────────
      let emoji = "🔔";
      let label = "Strowallet Event";
      if (isNoFunds)          { emoji = "🚨"; label = "NO FUNDS — Card Creation Failed"; }
      else if (isFailure)     { emoji = "❌"; label = "Card Event Failed"; }
      else if (isSuccess)     { emoji = "✅"; label = "Card Activated"; }
      else if (isDebit && isSuspicious) { emoji = "🚨"; label = isCryptoMerchant ? "BLOCKED CATEGORY — Crypto Site Spend" : "BLOCKED CATEGORY — Adult Site Spend"; }
      else if (isDebit)       { emoji = "💳"; label = "Card Transaction — Spend Alert"; }
      else if (isFreeze)      { emoji = "🔒"; label = "Card Frozen/Blocked"; }
      else if (isKycEvent)    { emoji = "🪪"; label = "KYC Event"; }

      // ── Telegram admin alert (always sent for every event) ───────────────
      if (isDebit) {
        // Rich spend alert for every transaction
        const suspiciousWarning = isSuspicious
          ? `\n⛔ <b>POLICY VIOLATION DETECTED!</b>\n` +
            (isCryptoMerchant ? `   🪙 Crypto exchange / crypto site\n` : "") +
            (isAdultMerchant  ? `   🔞 Adult / pornography site\n` : "") +
            `   👉 Card has been automatically frozen.\n`
          : "";

        await sendTelegramMessage(
          `${emoji} <b>${label}</b>\n\n` +
          `👤 <b>User:</b> ${customerEmail || "—"}\n` +
          `💳 <b>Card:</b> ${cardId || "—"}${last4 ? ` (••••${last4})` : ""}\n` +
          `🏪 <b>Merchant:</b> ${merchant || "Unknown"}\n` +
          (mcc ? `🏷 <b>MCC:</b> ${mcc}\n` : "") +
          `💵 <b>Amount:</b> ${amount ? `$${amount} ${currency}` : "—"}\n` +
          (newCardBal !== null ? `💰 <b>Card Balance After:</b> $${newCardBal}\n` : "") +
          suspiciousWarning
        ).catch(() => {});
      } else {
        // Generic alert for non-spend events
        const rawPayload = JSON.stringify(event, null, 2).slice(0, 600);
        await sendTelegramMessage(
          `${emoji} <b>${label}</b>\n\n` +
          `📌 <b>Event:</b> <code>${eventType}</code>\n` +
          `📧 <b>Email:</b> ${customerEmail || "—"}\n` +
          `💳 <b>Card ID:</b> ${cardId || "—"}\n` +
          `💵 <b>Amount:</b> ${amount ? `${amount} ${currency}` : "—"}\n` +
          (reason ? `⚠️ <b>Reason:</b> ${reason}\n` : "") +
          `\n<pre>${rawPayload}</pre>`
        ).catch(() => {});
      }

      // ── Extra urgent alert for no-funds situation ────────────────────────
      if (isNoFunds) {
        await sendTelegramMessage(
          `🚨🚨 <b>URGENT — Strowallet Out of Funds!</b>\n\n` +
          `A user tried to create a card but Strowallet reported insufficient funds in your provider account.\n\n` +
          `📧 <b>User:</b> ${customerEmail || "—"}\n` +
          `💵 <b>Amount requested:</b> ${amount ? `${amount} ${currency}` : "—"}\n\n` +
          `👉 Please top up your Strowallet balance immediately to avoid losing user transactions.\n` +
          `🔗 https://strowallet.com`
        ).catch(() => {});
      }

      // ── Locate card & user in DB for in-app actions ──────────────────────
      let dbCard: any = null;
      let profile: any = null;
      if (cardId) {
        try {
          const allCards = await db.select().from(virtualCards).where(eq(virtualCards.cardId, cardId));
          dbCard = allCards[0] || null;
        } catch {}
      }
      if (!profile && customerEmail) {
        const allProfiles = await storage.getAllProfiles();
        profile = allProfiles.find((p: any) => p.email === customerEmail) || null;
      }
      if (!profile && dbCard) {
        try { profile = await storage.getProfile(dbCard.profileId); } catch {}
      }

      // ── Auto-sync card balance if Strowallet sent the new balance ─────────
      if (dbCard && isDebit && newCardBal !== null) {
        await storage.updateVirtualCard(dbCard.id, { balance: String(newCardBal) }).catch(() => {});
        console.log(`[WEBHOOK] Card ${dbCard.id} balance synced → ${newCardBal}`);
      }

      // ── Auto-freeze card on policy violations ────────────────────────────
      if (dbCard && isDebit && isSuspicious && dbCard.status === "active") {
        try {
          // Freeze on Strowallet side
          await strowalletFetch(`${STROWALLET_BASE}/freeze-card/`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({ card_id: dbCard.cardId, public_key: strowalletPublicKey, action: "freeze" }),
          });
          // Update status in our DB
          await storage.updateVirtualCard(dbCard.id, { status: "frozen" });
          console.log(`[WEBHOOK] Card ${dbCard.id} auto-frozen due to policy violation`);

          // Extra admin alert confirming freeze
          await sendTelegramMessage(
            `🔒 <b>Auto-Freeze Applied</b>\n\n` +
            `Card <code>${cardId}</code> has been automatically frozen due to the policy violation above.\n` +
            `User: ${customerEmail || profile?.email || "—"}\n\n` +
            `To unfreeze, go to Admin → Cards and toggle the freeze status.`
          ).catch(() => {});
        } catch (freezeErr) {
          console.error("[WEBHOOK] Auto-freeze failed:", freezeErr);
          await sendTelegramMessage(
            `⚠️ <b>Auto-Freeze FAILED</b> for card <code>${cardId}</code>.\n` +
            `Please freeze it manually in Strowallet dashboard immediately.`
          ).catch(() => {});
        }
      }

      // ── In-app notifications for the user ───────────────────────────────
      if (profile) {
          if (isSuccess) {
            await storage.createNotification({
              profileId: profile.id,
              type: "custom_message",
              title: "Virtual Card Ready",
              message: "Your virtual card is now active and ready to use.",
            });
            if (profile.phone) {
              sendWhatsAppNotification(
                profile.phone,
                `*Izichanj*\n\n💳 Virtual Card Ready\n\nYour virtual card has been activated and is ready to use.\n\nhttps://izichanj.com`,
                profile.fullName
              );
            }
          }

          if (isDebit) {
            const txMsg = isSuspicious
              ? `A transaction of $${amount} ${currency} was detected on a restricted site (${merchant || "unknown"}). Your card has been frozen for security. Contact support if needed.`
              : `You spent $${amount || "—"} ${currency}${merchant ? ` at ${merchant}` : ""} on your virtual card.${newCardBal !== null ? ` Remaining balance: $${newCardBal}.` : ""}`;

            await storage.createNotification({
              profileId: profile.id,
              type: "custom_message",
              title: isSuspicious ? "⛔ Card Frozen — Policy Violation" : "💳 Card Transaction",
              message: txMsg,
            });

            // WhatsApp notification for every spend
            if (profile.phone) {
              sendWhatsAppNotification(
                profile.phone,
                isSuspicious
                  ? `*Izichanj — Security Alert*\n\n⛔ Your virtual card was used on a restricted site (${merchant || "unknown"}) and has been automatically frozen.\n\nAmount: $${amount} ${currency}\n\nContact support if this was a mistake.\n\nhttps://izichanj.com`
                  : `*Izichanj*\n\n💳 Card Transaction\n\nYou spent $${amount || "—"} ${currency}${merchant ? ` at ${merchant}` : ""}.${newCardBal !== null ? `\nRemaining balance: $${newCardBal}` : ""}\n\nhttps://izichanj.com`,
                profile.fullName
              );
            }
          }

          if (isFreeze) {
            await storage.createNotification({
              profileId: profile.id,
              type: "custom_message",
              title: "Card Frozen",
              message: "Your virtual card has been frozen. Contact support if you did not request this.",
            });
          }

          if (isFailure && !isNoFunds) {
            await storage.createNotification({
              profileId: profile.id,
              type: "custom_message",
              title: "Card Request Failed",
              message: `Your virtual card request could not be processed. ${reason ? `Reason: ${reason}` : "Please contact support."}`,
            });
          }

          if (isKycEvent) {
            await storage.createNotification({
              profileId: profile.id,
              type: "custom_message",
              title: "KYC Status Update",
              message: `Your card verification status has been updated: ${eventType}. ${reason || ""}`.trim(),
            });
          }
      } else if (customerEmail) {
        // Profile lookup via email (fallback path already handled above)
        const allProfiles2 = await storage.getAllProfiles();
        const profile2 = allProfiles2.find((p: any) => p.email === customerEmail);
        if (profile2 && isSuccess) {
          await storage.createNotification({
            profileId: profile2.id,
            type: "custom_message",
            title: "Virtual Card Ready",
            message: "Your virtual card is now active and ready to use.",
          });
        }
      }

    } catch (e: any) {
      console.error("[STROWALLET WEBHOOK] Error:", e);
    }
  });

  app.post("/api/nowpayments/ipn", async (req, res) => {
    try {
      const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
      if (ipnSecret) {
        const receivedSig = req.headers["x-nowpayments-sig"] as string;
        if (!receivedSig) {
          console.error("[NOWPayments IPN] Missing signature header");
          return res.sendStatus(400);
        }
        const sortedBody = JSON.stringify(req.body, Object.keys(req.body).sort());
        const expectedSig = crypto.createHmac("sha512", ipnSecret).update(sortedBody).digest("hex");
        if (receivedSig !== expectedSig) {
          console.error("[NOWPayments IPN] Invalid signature");
          return res.sendStatus(400);
        }
      }

      const { payment_id, payment_status, order_id, actually_paid, pay_amount, outcome_amount } = req.body;
      console.log(`[NOWPayments IPN] Payment ${payment_id} status: ${payment_status}, order: ${order_id}`);

      if (payment_status === "finished" || payment_status === "confirmed") {
        const deposit = await storage.getDepositByNowpaymentsPaymentId(String(payment_id));
        if (!deposit) {
          console.error(`[NOWPayments IPN] Deposit not found for payment_id: ${payment_id}`);
          return res.sendStatus(200);
        }

        if (deposit.status === "approved") {
          return res.sendStatus(200);
        }

        await db.update(deposits).set({ status: "approved" }).where(eq(deposits.id, deposit.id));

        const profile = await storage.getProfile(deposit.profileId);
        if (profile) {
          const DEPOSIT_FEES: Record<string, number> = { usdttrc20: 2.50, usdtbsc: 0.25 };
          const depositAmount = parseFloat(deposit.amountUsdt);
          const fee = DEPOSIT_FEES[deposit.payCurrency || "usdttrc20"] ?? 2.50;
          const creditAmount = Math.max(0, depositAmount - fee);
          const currentBalance = parseFloat(profile.balance);
          const newBalance = currentBalance + creditAmount;
          await storage.updateProfileBalance(deposit.profileId, newBalance);

          // Referral commission: $2.00 for first qualifying crypto deposit >= $50
          if (profile.referredById && depositAmount >= 50) {
            try {
              const referrer = await storage.getProfile(profile.referredById);
              if (referrer && referrer.affiliateEnabled) {
                const existingEarning = await db.execute(sql`SELECT 1 FROM referral_earnings WHERE referrer_id = ${referrer.id} AND referee_id = ${deposit.profileId} AND type = 'deposit' LIMIT 1`);
                if ((existingEarning.rows as any[]).length === 0) {
                  await storage.createReferralEarning({ referrerId: referrer.id, refereeId: deposit.profileId, type: "deposit", amount: 2.00, description: `First crypto deposit ≥ $50 by ${profile.fullName}` });
                  await storage.creditReferralBalance(referrer.id, 2.00);
                }
              }
            } catch { /* ignore */ }
          }

          const htgAmount = formatHtg(rateUsdtToHtg(creditAmount));
          await storage.createNotification({
            profileId: deposit.profileId,
            type: "deposit_approved",
            title: "Crypto Deposit Approved",
            message: `Your crypto deposit of ${depositAmount.toFixed(2)} USDT has been confirmed. After the $${fee.toFixed(2)} network fee, ${creditAmount.toFixed(2)} USDT (${htgAmount} HTG) was credited to your balance.`,
          });

          const admins = await storage.getAllProfiles();
          const adminList = admins.filter(a => a.role === "admin");
          for (const admin of adminList) {
            await storage.createNotification({
              profileId: admin.id,
              type: "custom_message",
              title: "Crypto Deposit Auto-Approved",
              message: `User ${profile.fullName} deposited ${depositAmount.toFixed(2)} USDT via NOWPayments (auto-approved). Payment ID: ${payment_id}`,
            });
          }
        }
      }

      res.sendStatus(200);
    } catch (e: any) {
      console.error("NOWPayments IPN error:", e);
      res.sendStatus(200);
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const input = registerSchema.parse(req.body);
      const isBlacklisted = await storage.isBlacklisted(input.email, input.phone);
      if (isBlacklisted) {
        return res.status(403).json({ message: "This account cannot be created. Contact support for more information." });
      }

      const existingByPhone = await storage.getProfileByPhone(input.phone);
      if (existingByPhone && existingByPhone.emailVerified) {
        return res.status(400).json({ message: "An account with this phone number already exists" });
      }

      const existing = await storage.getProfileByEmail(input.email);
      if (existing) {
        if (!existing.emailVerified) {
          const code = crypto.randomInt(100000, 999999).toString();
          await storage.createOtp(existing.id, code);
          await sendWhatsAppOtp(existing.phone || input.phone, code, existing.fullName);
          req.session.profileId = existing.id;
          const { passwordHash: _, ...safeProfile } = existing;
          return res.status(201).json(safeProfile);
        }
        return res.status(400).json({ message: "An account with this email already exists" });
      }
      const passwordHash = await bcrypt.hash(input.password, 12);
      const profile = await storage.createProfile(input.fullName, input.email, passwordHash, input.phone);
      const registrationIp = getClientIp(req);
      // Resolve referral code → store referredById
      if (input.referralCode) {
        try {
          const referrer = await storage.getProfileByReferralCode(input.referralCode.trim().toUpperCase());
          if (referrer && referrer.affiliateEnabled && referrer.id !== profile.id) {
            await db.execute(sql`UPDATE profiles SET referred_by_id = ${referrer.id} WHERE id = ${profile.id}`);
          }
        } catch { /* ignore */ }
      }
      db.update(profiles).set({ registrationIp, lastIp: registrationIp }).where(eq(profiles.id, profile.id)).catch(() => {});
      const code = crypto.randomInt(100000, 999999).toString();
      await storage.createOtp(profile.id, code);
      await sendWhatsAppOtp(input.phone, code, input.fullName);
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
      // Referral commission: $0.05 on registration (email verify)
      if (profile.referredById) {
        try {
          const referrer = await storage.getProfile(profile.referredById);
          if (referrer && referrer.affiliateEnabled) {
            await storage.createReferralEarning({ referrerId: referrer.id, refereeId: profileId, type: "registration", amount: 0.05, description: `Registration of ${profile.fullName}` });
            await storage.creditReferralBalance(referrer.id, 0.05);
          }
        } catch { /* ignore */ }
      }
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
      await sendWhatsAppOtp(profile.phone || "", code, profile.fullName);
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

      const loginAttemptIp = getClientIp(req);
      const loginAttemptDevice = getDeviceInfo(req);
      console.log(`[LOGIN] Attempt for ${input.identifier}, found: ${!!profile}, hash starts: ${profile?.passwordHash?.substring(0, 10) || 'N/A'}`);
      if (!profile || profile.isDeleted) {
        storage.createSecurityEvent({ profileId: undefined, eventType: "failed_login", ipAddress: loginAttemptIp, deviceInfo: loginAttemptDevice, details: `Unknown identifier: ${input.identifier}`, status: "warning" }).catch(() => {});
        return res.status(401).json({ message: "Invalid email/phone or password" });
      }
      const valid = await bcrypt.compare(input.password, profile.passwordHash);
      console.log(`[LOGIN] Password compare result for ${input.identifier}: ${valid}`);
      if (!valid) {
        storage.createSecurityEvent({ profileId: profile.id, eventType: "failed_login", ipAddress: loginAttemptIp, deviceInfo: loginAttemptDevice, details: `Failed password attempt for ${input.identifier}`, status: "warning" }).catch(() => {});
        return res.status(401).json({ message: "Invalid email/phone or password" });
      }

      if (!profile.emailVerified) {
        req.session.profileId = profile.id;
        const code = crypto.randomInt(100000, 999999).toString();
        await storage.createOtp(profile.id, code);
        await sendWhatsAppOtp(profile.phone || "", code, profile.fullName);
        const { passwordHash: _, twoFactorSecret: _s, ...safeProfile } = profile;
        return res.json({ ...safeProfile, needsVerification: true });
      }

      if (profile.twoFactorEnabled) {
        req.session.pending2faProfileId = profile.id;
        return res.json({ needs2FA: true });
      }

      req.session.profileId = profile.id;
      const loginIp = loginAttemptIp;
      const loginDevice = loginAttemptDevice;
      storage.createLoginLog(profile.id, "password", loginIp, loginDevice).catch(() => {});
      storage.updateProfileIp(profile.id, loginIp, new Date()).catch(() => {});
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
      await sendWhatsAppOtp(input.phone, code, profile.fullName);
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
      storage.createSecurityEvent({ profileId: profile.id, eventType: "password_reset", ipAddress: getClientIp(req), deviceInfo: getDeviceInfo(req), details: "Password reset via OTP", status: "info" }).catch(() => {});
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
      const twoFaIp = getClientIp(req);
      const twoFaDevice = getDeviceInfo(req);
      storage.createLoginLog(profileId, "2fa", twoFaIp, twoFaDevice).catch(() => {});
      storage.updateProfileIp(profileId, twoFaIp, new Date()).catch(() => {});
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
    const { passwordHash: _, twoFactorSecret: _s, pinHash, ...safeProfile } = profile;
    res.json({ ...safeProfile, pinHash: !!pinHash });
  });

  // Send a test push notification to the logged-in user
  app.post("/api/profile/test-push", isAuthenticated, async (req: any, res) => {
    const { sendTestPush } = await import("./fcm");
    const result = await sendTestPush(req.session.profileId);
    if (result.ok) return res.json({ ok: true, message: "Test push sent!" });
    res.status(400).json({ ok: false, message: result.error });
  });

  // Admin: send a test push to any user by id
  app.post("/api/admin/profiles/:id/test-push", isAuthenticated, isAdmin, async (req: any, res) => {
    const { sendTestPush } = await import("./fcm");
    const result = await sendTestPush(Number(req.params.id));
    if (result.ok) return res.json({ ok: true });
    res.status(400).json({ ok: false, message: result.error });
  });

  // Save / refresh the user's FCM (Firebase Cloud Messaging) push token
  app.post("/api/profile/fcm-token", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = req.session.profileId;
      const token = (req.body?.token || "").toString().trim();
      if (!token || token.length < 20) {
        return res.status(400).json({ message: "Invalid token" });
      }
      await db.execute(sql`
        UPDATE profiles SET fcm_token = ${token}, fcm_token_updated_at = NOW() WHERE id = ${profileId}
      `);
      console.log(`[FCM] Token saved for profile #${profileId} (len=${token.length})`);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
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
      if (!input.txHash || input.txHash.length < 10) return res.status(400).json({ message: "Transaction hash is required for USDT deposits" });
      const manualExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
      const deposit = await storage.createDeposit({ ...input, profileId: profile.id, depositMethod: "usdt", expiresAt: manualExpiresAt, ipAddress: getClientIp(req) });

      // Notify admin in-app
      const admins = await storage.getAllProfiles();
      const adminList = admins.filter(a => a.role === "admin");
      for (const admin of adminList) {
        await storage.createNotification({
          profileId: admin.id,
          type: "custom_message",
          title: "New Deposit Request",
          message: `User ${profile.fullName} has submitted a new deposit request of ${input.amountUsdt} USDT.`,
        });
      }

      // Telegram notification
      sendTelegramMessage(
        `💰 <b>New Deposit Request</b>\n\n` +
        `👤 <b>Name:</b> ${profile.fullName}\n` +
        `📧 <b>Email:</b> ${profile.email}\n` +
        `🆔 <b>User ID:</b> ${profile.referenceId || profile.id}\n` +
        `💵 <b>Amount:</b> ${Number(input.amountUsdt).toFixed(2)} USDT\n` +
        `🔗 <b>TX Hash:</b> <code>${input.txHash}</code>\n\n` +
        `⏳ Awaiting admin approval in the panel.`
      ).catch(() => {});

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
    await sendWhatsAppOtp(profile.phone || "", code, profile.fullName);
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
      if (profile.isBanned) return res.status(403).json({ message: "Your account is temporarily banned or disabled. Please contact customer support." });
      if (profile.kycStatus !== "verified") return res.status(403).json({ message: "KYC verification required before making withdrawals" });
      if ((profile as any).frozenUntil && new Date((profile as any).frozenUntil) > new Date()) {
        const frozenUntilDate = haitiDate((profile as any).frozenUntil);
        return res.status(403).json({ message: `Your account is frozen until ${frozenUntilDate}. Withdrawals are not permitted during this period. Contact support if you believe this is an error.`, errorCode: "ACCOUNT_FROZEN", frozenUntil: (profile as any).frozenUntil });
      }

      const parsed = api.withdrawals.create.input.parse(req.body);
      const amountUsdt = parseFloat(parsed.amount);
      if (isNaN(amountUsdt) || amountUsdt <= 0) return res.status(400).json({ message: "Invalid amount" });
      if (amountUsdt < WITHDRAWAL_MIN_USDT) return res.status(400).json({ message: `Minimum withdrawal is ${WITHDRAWAL_MIN_USDT} USDT` });
      if (amountUsdt > WITHDRAWAL_MAX_USDT) return res.status(400).json({ message: `Maximum withdrawal per day is ${WITHDRAWAL_MAX_USDT.toLocaleString()} USDT` });

      const currentBalance = parseFloat(profile.balance || "0");

      // ── USDT TRC-20 Withdrawal ──
      if (parsed.currency === "USDT_TRC20") {
        const withdrawalPinHash = (profile as any).withdrawalPinHash;
        if (!withdrawalPinHash) return res.status(403).json({ message: "You must set a 6-digit withdrawal PIN before making USDT withdrawals. Go to Security settings to set it up." });

        if (!parsed.pin || !/^\d{6}$/.test(parsed.pin)) return res.status(400).json({ message: "6-digit withdrawal PIN is required" });
        const validPin = await bcrypt.compare(parsed.pin, withdrawalPinHash);
        if (!validPin) return res.status(401).json({ message: "Incorrect withdrawal PIN" });

        if (!parsed.trcAddress || parsed.trcAddress.trim().length < 25) return res.status(400).json({ message: "Invalid TRC-20 wallet address" });

        const totalDeducted = amountUsdt + WITHDRAWAL_FEE_USDT;
        if (currentBalance < totalDeducted) return res.status(400).json({ message: `Insufficient balance. You need ${totalDeducted.toFixed(2)} USDT (${amountUsdt.toFixed(2)} + ${WITHDRAWAL_FEE_USDT} fee) but have ${currentBalance.toFixed(2)} USDT.` });

        await storage.updateProfileBalance(profile.id, currentBalance - totalDeducted);

        const withdrawal = await storage.createWithdrawal({
          amount: parsed.amount,
          currency: "USDT_TRC20" as any,
          trcAddress: parsed.trcAddress.trim(),
          fee: WITHDRAWAL_FEE_USDT.toString(),
          profileId: profile.id,
          ipAddress: getClientIp(req),
        } as any);
        storage.createBalanceLog({ profileId: profile.id, previousBalance: currentBalance, newBalance: currentBalance - totalDeducted, change: -totalDeducted, action: "withdrawal_usdt", referenceId: String(withdrawal.id) }).catch(() => {});

        const admins = await storage.getAllProfiles();
        for (const admin of admins.filter(a => a.role === "admin")) {
          await storage.createNotification({ profileId: admin.id, type: "custom_message", title: "🔔 New USDT TRC-20 Withdrawal", message: `${profile.fullName} requested ${amountUsdt.toFixed(2)} USDT (+ ${WITHDRAWAL_FEE_USDT} fee) to TRC-20: ${parsed.trcAddress.trim()}` });
        }
        await storage.createNotification({ profileId: profile.id, type: "withdrawal_approved" as any, title: "Withdrawal Under Review", message: `Your withdrawal of ${amountUsdt.toFixed(2)} USDT (fee: ${WITHDRAWAL_FEE_USDT}) to ${parsed.trcAddress.trim()} is under review. Processing: 15–60 min.` });
        sendTelegramMessage(`💸 <b>New USDT TRC-20 Withdrawal</b>\n\n👤 ${profile.fullName}\n📧 ${profile.email}\n💵 <b>Amount:</b> ${amountUsdt.toFixed(2)} USDT\n💰 <b>Fee:</b> ${WITHDRAWAL_FEE_USDT} USDT\n💳 <b>Total:</b> ${(amountUsdt + WITHDRAWAL_FEE_USDT).toFixed(2)} USDT\n🔑 <b>TRC-20:</b> <code>${parsed.trcAddress.trim()}</code>\n\n⏳ Awaiting admin approval.`).catch(() => {});

        return res.status(201).json(withdrawal);
      }

      // ── MonCash / NatCash Withdrawal ──
      if (parsed.currency === "MonCash" || parsed.currency === "NatCash") {
        if (!parsed.withdrawMethod) return res.status(400).json({ message: "Withdrawal method is required (phone or qrcode)" });
        if (parsed.withdrawMethod === "phone" && (!parsed.phoneNumber || parsed.phoneNumber.length < 8)) return res.status(400).json({ message: "Phone number is required (min 8 digits)" });
        if (parsed.withdrawMethod === "qrcode" && !parsed.qrCodeUrl) return res.status(400).json({ message: "QR code image is required for QR code withdrawal" });
        if (!parsed.otp) return res.status(400).json({ message: "OTP is required" });

        const validOtp = await storage.getValidOtp(profile.id, parsed.otp);
        if (!validOtp) return res.status(401).json({ message: "Invalid or expired OTP" });
        await storage.markOtpVerified(validOtp.id);

        if (currentBalance < amountUsdt) return res.status(400).json({ message: `Insufficient balance. Your balance is ${currentBalance.toFixed(2)} USDT.` });

        await storage.updateProfileBalance(profile.id, currentBalance - amountUsdt);

        const htgAmount = rateUsdtToHtgWithdrawal(amountUsdt);

        const withdrawal = await storage.createWithdrawal({
          amount: parsed.amount,
          currency: parsed.currency as any,
          withdrawMethod: parsed.withdrawMethod as any,
          phoneNumber: parsed.withdrawMethod === "phone" ? parsed.phoneNumber : undefined,
          qrCodeUrl: parsed.withdrawMethod === "qrcode" ? parsed.qrCodeUrl : undefined,
          profileId: profile.id,
          ipAddress: getClientIp(req),
        } as any);
        storage.createBalanceLog({ profileId: profile.id, previousBalance: currentBalance, newBalance: currentBalance - amountUsdt, change: -amountUsdt, action: `withdrawal_${parsed.currency?.toLowerCase() || 'moncash'}`, referenceId: String(withdrawal.id) }).catch(() => {});

        const admins = await storage.getAllProfiles();
        for (const admin of admins.filter(a => a.role === "admin")) {
          await storage.createNotification({ profileId: admin.id, type: "custom_message", title: `🔔 New ${parsed.currency} Withdrawal`, message: `${profile.fullName} requested ${amountUsdt.toFixed(2)} USDT → ${formatHtg(htgAmount)} HTG via ${parsed.currency} (${parsed.withdrawMethod === "phone" ? parsed.phoneNumber : "QR Code"})` });
        }
        await storage.createNotification({ profileId: profile.id, type: "withdrawal_approved" as any, title: "Withdrawal Under Review", message: `Your ${parsed.currency} withdrawal of ${amountUsdt.toFixed(2)} USDT (${formatHtg(htgAmount)} HTG at 1 USDT = ${getWithdrawalRate()} HTG) is under review. Processing: 15–20 min.` });
        sendTelegramMessage(`💸 <b>New ${parsed.currency} Withdrawal</b>\n\n👤 ${profile.fullName}\n📧 ${profile.email}\n💵 <b>Amount:</b> ${amountUsdt.toFixed(2)} USDT → ${formatHtg(htgAmount)} HTG\n📱 <b>Method:</b> ${parsed.withdrawMethod === "phone" ? `Phone (${parsed.phoneNumber})` : "QR Code"}\n📲 <b>Wallet:</b> ${parsed.currency}\n\n⏳ Rate: 1 USDT = ${getWithdrawalRate()} HTG. Awaiting admin approval.`).catch(() => {});

        return res.status(201).json(withdrawal);
      }

      return res.status(400).json({ message: "Invalid withdrawal type" });
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0].message });
      console.error("[withdrawal create]", e);
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

    // Check if profile is locked (all fields set) AND the one-time edit override is not active
    const isLocked = profile.firstName && profile.lastName && profile.dateOfBirth && profile.country && profile.city && profile.phone;
    
    if (isLocked && !profile.canEditProfile) {
      return res.status(400).json({ message: "Personal information is locked and cannot be changed" });
    }
    
    const { firstName, lastName, dateOfBirth, country, city, phone } = req.body;
    
    if (!firstName || !lastName || !dateOfBirth || !country || !city || !phone) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const isBlacklisted = await storage.isBlacklisted(profile.email, phone, firstName, lastName, dateOfBirth);
    if (isBlacklisted) {
      return res.status(403).json({ message: "This information matches a restricted account. Contact support for more information." });
    }

    try {
      const updatedUser = await storage.updateProfile(profile.id, {
        firstName,
        lastName,
        dateOfBirth,
        country,
        city,
        phone,
        canEditProfile: false, // Revoke one-time edit permission after save
      });
      const { passwordHash: _, twoFactorSecret: _s, ...safeProfile } = updatedUser;
      res.json(safeProfile);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Admin: grant or revoke one-time profile edit permission
  app.patch("/api/admin/users/:id/grant-edit", isAuthenticated, async (req: any, res) => {
    const profile = await getProfileFromReq(req);
    if (!profile || profile.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const targetId = Number(req.params.id);
    const { allow } = req.body; // boolean
    try {
      await storage.updateProfile(targetId, { canEditProfile: !!allow });
      res.json({ success: true, canEditProfile: !!allow });
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
    const { idDocumentUrl, idDocumentBackUrl, selfieUrl, idType, idNumber, addressLine1 } = req.body;
    if (!idDocumentUrl || !idDocumentBackUrl || !selfieUrl) return res.status(400).json({ message: "Missing documents" });
    if (!idType || !idNumber) return res.status(400).json({ message: "ID type and ID number are required" });
    if (!addressLine1) return res.status(400).json({ message: "Address line 1 is required" });
    const kyc = await storage.createKyc({ profileId: profile.id, idDocumentUrl, idDocumentBackUrl, selfieUrl, idType, idNumber, addressLine1 });

    // Notify admin in-app
    const kycAdmins = await storage.getAllProfiles();
    const kycAdminList = kycAdmins.filter(a => a.role === "admin");
    for (const admin of kycAdminList) {
      await storage.createNotification({
        profileId: admin.id,
        type: "custom_message",
        title: "New KYC Submission",
        message: `User ${profile.fullName} has submitted documents for KYC verification.`,
      });
    }

    // Telegram notification
    sendTelegramMessage(
      `🪪 <b>New KYC Submission</b>\n\n` +
      `👤 <b>Name:</b> ${profile.fullName}\n` +
      `📧 <b>Email:</b> ${profile.email}\n` +
      `🆔 <b>User ID:</b> ${profile.referenceId || profile.id}\n` +
      `🪪 <b>ID Type:</b> ${idType}\n\n` +
      `📋 Review documents in the admin panel.`
    ).catch(() => {});

    res.status(201).json(kyc);
  });

  app.get(api.admin.users.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const search = req.query.search as string | undefined;
    if (search && search.trim()) {
      const results = await storage.searchProfiles(search.trim());
      return res.json(results);
    }
    const allProfiles = await storage.getAllProfiles();
    res.json(allProfiles);
  });

  // ── Exchange Rates (public read, admin write) ──
  app.get("/api/settings/rates", async (_req, res) => {
    res.json({ depositRate: getDepositRate(), withdrawalRate: getWithdrawalRate() });
  });

  app.patch("/api/admin/settings/rates", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { depositRate, withdrawalRate } = req.body;
      const dep = Number(depositRate);
      const wit = Number(withdrawalRate);
      if (!dep || dep < 1 || !wit || wit < 1) {
        return res.status(400).json({ message: "Both rates must be positive numbers" });
      }
      const { appSettings } = await import("@shared/schema");
      await db.insert(appSettings).values({ key: "deposit_rate", value: String(dep) }).onConflictDoUpdate({ target: appSettings.key, set: { value: String(dep), updatedAt: new Date() } });
      await db.insert(appSettings).values({ key: "withdrawal_rate", value: String(wit) }).onConflictDoUpdate({ target: appSettings.key, set: { value: String(wit), updatedAt: new Date() } });
      setRates(dep, wit);
      res.json({ depositRate: dep, withdrawalRate: wit });
    } catch (e) {
      console.error("Update rates error:", e);
      res.status(500).json({ message: "Failed to update rates" });
    }
  });

  // GeoIP lookup for admin (server-side, avoids CORS issues)
  app.get("/api/admin/geoip/:ip", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { ip } = req.params;
      if (!ip || ip === "unknown" || ip === "127.0.0.1" || ip.startsWith("::")) {
        return res.json({ country: "Local", city: "Local", isp: "" });
      }
      const response = await fetch(`http://ip-api.com/json/${ip}?fields=country,regionName,city,isp,status`, { signal: AbortSignal.timeout(4000) });
      const data = await response.json() as any;
      if (data.status === "success") {
        return res.json({ country: data.country, city: data.city, region: data.regionName, isp: data.isp });
      }
      res.json({ country: "Unknown", city: "", isp: "" });
    } catch {
      res.json({ country: "Unknown", city: "", isp: "" });
    }
  });

  app.delete("/api/admin/users/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const profileId = Number(req.params.id);
      const profile = await storage.getProfile(profileId);
      if (!profile) return res.status(404).json({ message: "User not found" });
      if (profile.role === "admin") return res.status(400).json({ message: "Cannot delete admin accounts" });

      const kyc = await storage.getKyc(profileId);

      await storage.addToBlacklist({
        email: profile.email,
        phone: profile.phone || undefined,
        firstName: profile.firstName || undefined,
        lastName: profile.lastName || undefined,
        dateOfBirth: profile.dateOfBirth || undefined,
        idDocumentUrl: kyc?.idDocumentUrl || undefined,
        idDocumentBackUrl: kyc?.idDocumentBackUrl || undefined,
        selfieUrl: kyc?.selfieUrl || undefined,
        reason: "Account deleted by admin",
        originalProfileId: profile.id,
        referenceId: profile.referenceId || undefined,
      });

      await storage.softDeleteProfile(profileId);
      res.json({ message: "Account deleted and blacklisted" });
    } catch (e) {
      console.error("Delete user error:", e);
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.get(api.admin.allKyc.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const allKyc = await storage.getAllKyc();
    res.json(allKyc);
  });

  app.patch(api.admin.updateBalance.path, isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const profileId = Number(req.params.id);
      const newBalance = Number(req.body.balance);
      const reason: string = req.body.reason || "Administrative Adjustment";

      const existingProfile = await storage.getProfile(profileId);
      if (!existingProfile) return res.status(404).json({ message: "User not found" });
      const oldBalance = parseFloat(existingProfile.balance || "0");

      const profile = await storage.updateProfileBalance(profileId, newBalance);

      const receiptId = crypto.randomUUID();
      const adjustmentAmount = newBalance - oldBalance;
      const pdfBuffer = await generateAdjustmentReceiptPDF({
        receiptId,
        createdAt: new Date(),
        userName: profile.fullName,
        userEmail: profile.email,
        userId: profile.id,
        oldBalance,
        newBalance,
        adjustmentAmount,
        reason,
      });

      const balanceMsg = `Your balance has been updated to ${newBalance.toFixed(2)} USDT. Reason: ${reason}.`;
      await storage.createNotification({ profileId: profile.id, type: "custom_message", title: "Balance Updated", message: balanceMsg });
      if (profile.phone) {
        sendWhatsAppNotification(profile.phone, `*Izichanj*\n\n💼 Balance Updated\n\n${balanceMsg}\n\nhttps://izichanj.com`, profile.fullName);
      }

      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="balance-adjustment-${receiptId}.pdf"`,
      });
      res.send(pdfBuffer);
    } catch (e: any) {
      console.error("[admin updateBalance]", e);
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/admin/users/:id/ban", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { isBanned } = req.body;
      const profile = await storage.setUserBanStatus(Number(req.params.id), isBanned);
      res.json(profile);
    } catch (e) {
      res.status(500).json({ message: "Internal Error" });
    }
  });

  // Admin: Freeze a user account for 7 days
  app.post("/api/admin/users/:id/freeze", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const profileId = Number(req.params.id);
      const target = await storage.getProfile(profileId);
      if (!target) return res.status(404).json({ message: "User not found" });
      const frozenUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const profile = await storage.freezeUser(profileId, frozenUntil);
      sendTelegramMessage(
        `🧊 <b>Account Frozen</b>\n\n👤 ${target.fullName} (${target.email})\n🔒 Frozen until: ${haitiDate(frozenUntil)}\nAction taken from admin report review.`
      ).catch(() => {});
      res.json({ message: "Account frozen for 7 days", frozenUntil, profile });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  // Admin: Unfreeze a user account
  app.post("/api/admin/users/:id/unfreeze", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const profileId = Number(req.params.id);
      const target = await storage.getProfile(profileId);
      if (!target) return res.status(404).json({ message: "User not found" });
      const profile = await storage.unfreezeUser(profileId);
      sendTelegramMessage(
        `✅ <b>Account Unfrozen</b>\n\n👤 ${target.fullName} (${target.email})\nAccount manually unfrozen by admin.`
      ).catch(() => {});
      res.json({ message: "Account unfrozen successfully", profile });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Internal Error" });
    }
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

  app.patch("/api/admin/users/:id/strowallet-customer-id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const profileId = Number(req.params.id);
      const profile = await storage.getProfile(profileId);
      if (!profile) return res.status(404).json({ message: "User not found" });

      const { strowalletCustomerId } = req.body;
      if (!strowalletCustomerId || typeof strowalletCustomerId !== "string" || !strowalletCustomerId.trim()) {
        return res.status(400).json({ message: "Strowallet Customer ID is required" });
      }

      const customerId = strowalletCustomerId.trim();
      await storage.updateProfile(profileId, { strowalletCustomerId: customerId });

      console.log(`[ADMIN] Set Strowallet ID for ${profile.email}:`, customerId);

      // Telegram notification
      sendTelegramMessage(
        `✅ <b>Strowallet ID Set by Admin</b>\n\n` +
        `👤 <b>Name:</b> ${profile.fullName}\n` +
        `📧 <b>Email:</b> ${profile.email}\n` +
        `🆔 <b>User ID:</b> ${profile.referenceId || profile.id}\n` +
        `🏦 <b>Strowallet ID:</b> <code>${customerId}</code>\n\n` +
        `💳 User can now create virtual Visa cards.`
      ).catch(() => {});

      res.json({ success: true, strowalletCustomerId: customerId });
    } catch (e: any) {
      console.error("Admin set Strowallet ID error:", e);
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  // Admin: edit user's first/last name (typo correction tool)
  app.patch("/api/admin/users/:id/name", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const profileId = Number(req.params.id);
      const target = await storage.getProfile(profileId);
      if (!target) return res.status(404).json({ message: "User not found" });

      const firstName = String(req.body?.firstName ?? "").trim();
      const lastName  = String(req.body?.lastName  ?? "").trim();
      if (!firstName || !lastName) {
        return res.status(400).json({ message: "First name and last name are required" });
      }
      if (firstName.length > 60 || lastName.length > 60) {
        return res.status(400).json({ message: "Names must be 60 characters or fewer" });
      }
      // Reject obvious junk — only letters, spaces, hyphens, apostrophes, accents
      const nameRegex = /^[\p{L}\s'\-.]+$/u;
      if (!nameRegex.test(firstName) || !nameRegex.test(lastName)) {
        return res.status(400).json({ message: "Names contain invalid characters" });
      }

      const oldFirst = target.firstName || "";
      const oldLast  = target.lastName  || "";
      const newFull  = `${firstName} ${lastName}`.trim();

      await storage.updateProfile(profileId, {
        firstName,
        lastName,
        fullName: newFull,
      });

      const adminProfile = await getProfileFromReq(req);
      console.log(`[ADMIN] Renamed user #${profileId}: "${oldFirst} ${oldLast}" → "${newFull}" by admin ${adminProfile?.email}`);

      sendTelegramMessage(
        `✏️ <b>User Name Edited by Admin</b>\n\n` +
        `🆔 <b>User ID:</b> ${target.referenceId || target.id}\n` +
        `📧 <b>Email:</b> ${target.email}\n` +
        `🔄 <b>Old:</b> <code>${oldFirst} ${oldLast}</code>\n` +
        `✅ <b>New:</b> <code>${newFull}</code>\n` +
        `👮 <b>By:</b> ${adminProfile?.email || "—"}`
      ).catch(() => {});

      res.json({ success: true, firstName, lastName, fullName: newFull });
    } catch (e: any) {
      console.error("Admin edit name error:", e);
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  // Admin: set TxtID on a deposit before approving
  app.patch("/api/admin/deposits/:id/set-txhash", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const { txHash } = req.body;
      if (!txHash || String(txHash).trim().length < 5) {
        return res.status(400).json({ message: "A valid Transaction ID is required (min 5 characters)" });
      }
      const deposit = await storage.updateDepositTxHash(id, String(txHash).trim());
      res.json(deposit);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch(api.admin.approveDeposit.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const depositBefore = await storage.getDepositById(Number(req.params.id));
    if (!depositBefore) return res.status(404).json({ message: "Deposit not found" });
    const isCrypto = depositBefore.depositMethod !== "moncash";
    if (isCrypto && !depositBefore.txHash) {
      return res.status(400).json({ message: "Transaction ID (TxtID) is required before approving a crypto deposit. Please set it first." });
    }
    const deposit = await storage.updateDepositStatus(Number(req.params.id), "approved");
    const profile = await storage.getProfile(deposit.profileId);
    if (profile) {
      const currentBalance = parseFloat(profile.balance || "0");
      const depositAmount = parseFloat(deposit.amountUsdt);
      const newBalance = currentBalance + depositAmount;
      await storage.updateProfileBalance(deposit.profileId, newBalance);
      storage.createBalanceLog({ profileId: profile.id, previousBalance: currentBalance, newBalance, change: depositAmount, action: "deposit", referenceId: String(deposit.id), adminId: req.session?.profileId }).catch(() => {});
    }
    // Referral commission: $2.00 when referee makes a deposit >= $50
    if (profile?.referredById) {
      try {
        const depositAmt = parseFloat(deposit.amountUsdt);
        if (depositAmt >= 50) {
          const referrer = await storage.getProfile(profile.referredById);
          if (referrer && referrer.affiliateEnabled) {
            // Only pay once per referee for first qualifying deposit
            const existing = await db.execute(sql`SELECT 1 FROM referral_earnings WHERE referrer_id = ${referrer.id} AND referee_id = ${deposit.profileId} AND type = 'deposit' LIMIT 1`);
            if ((existing.rows as any[]).length === 0) {
              await storage.createReferralEarning({ referrerId: referrer.id, refereeId: deposit.profileId, type: "deposit", amount: 2.00, description: `First deposit ≥ $50 by ${profile.fullName}` });
              await storage.creditReferralBalance(referrer.id, 2.00);
            }
          }
        }
      } catch { /* ignore */ }
    }
    const htgAmount = formatHtg(rateUsdtToHtg(Number(deposit.amountUsdt)));
    const depositMsg = `Your deposit of ${Number(deposit.amountUsdt).toFixed(2)} USDT (${htgAmount} HTG) has been approved and added to your balance.`;
    await storage.createNotification({
      profileId: deposit.profileId,
      type: "deposit_approved",
      title: "Deposit Approved",
      message: depositMsg,
    });
    if (profile?.phone) {
      sendWhatsAppNotification(profile.phone, `*Izichanj*\n\n✅ Deposit Approved\n\n${depositMsg}\n\nhttps://izichanj.com`, profile.fullName);
    }
    res.json(deposit);
  });

  app.patch(api.admin.rejectDeposit.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const deposit = await storage.updateDepositStatus(Number(req.params.id), "rejected");
    const rejectMsg = `Your deposit of ${Number(deposit.amountUsdt).toFixed(2)} USDT has been rejected. Please contact support for more information.`;
    await storage.createNotification({
      profileId: deposit.profileId,
      type: "deposit_rejected",
      title: "Deposit Rejected",
      message: rejectMsg,
    });
    const depositProfile = await storage.getProfile(deposit.profileId);
    if (depositProfile?.phone) {
      sendWhatsAppNotification(depositProfile.phone, `*Izichanj*\n\n❌ Deposit Rejected\n\n${rejectMsg}\n\nhttps://izichanj.com`, depositProfile.fullName);
    }
    res.json(deposit);
  });

  app.patch(api.admin.approveWithdrawal.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const withdrawal = await storage.updateWithdrawalStatus(Number(req.params.id), "approved");
    const htgAmount = formatHtg(rateUsdtToHtg(Number(withdrawal.amount)));
    const wApproveMsg = `Your withdrawal of ${Number(withdrawal.amount).toFixed(2)} USDT (${htgAmount} HTG) to ${withdrawal.currency} has been approved and is being processed.`;
    await storage.createNotification({
      profileId: withdrawal.profileId,
      type: "withdrawal_approved",
      title: "Withdrawal Approved",
      message: wApproveMsg,
    });
    const wProfile = await storage.getProfile(withdrawal.profileId);
    if (wProfile?.phone) {
      sendWhatsAppNotification(wProfile.phone, `*Izichanj*\n\n✅ Withdrawal Approved\n\n${wApproveMsg}\n\nhttps://izichanj.com`, wProfile.fullName);
    }
    res.json(withdrawal);
  });

  app.patch(api.admin.rejectWithdrawal.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const withdrawal = await storage.updateWithdrawalStatus(Number(req.params.id), "rejected");
    const profile = await storage.getProfile(withdrawal.profileId);
    if (profile) {
      const currentBalance = parseFloat(profile.balance || "0");
      const refundAmount = parseFloat(withdrawal.amount);
      const newBalance = currentBalance + refundAmount;
      await storage.updateProfileBalance(withdrawal.profileId, newBalance);
      storage.createBalanceLog({ profileId: profile.id, previousBalance: currentBalance, newBalance, change: refundAmount, action: "withdrawal_refund", referenceId: String(withdrawal.id), adminId: req.session?.profileId }).catch(() => {});
    }
    const htgAmount = formatHtg(rateUsdtToHtg(Number(withdrawal.amount)));
    const wRejectMsg = `Your withdrawal of ${Number(withdrawal.amount).toFixed(2)} USDT (${htgAmount} HTG) to ${withdrawal.currency} has been rejected. Your balance has been refunded. Please contact support.`;
    await storage.createNotification({
      profileId: withdrawal.profileId,
      type: "withdrawal_rejected",
      title: "Withdrawal Rejected",
      message: wRejectMsg,
    });
    if (profile?.phone) {
      sendWhatsAppNotification(profile.phone, `*Izichanj*\n\n❌ Withdrawal Rejected\n\n${wRejectMsg}\n\nhttps://izichanj.com`, profile.fullName);
    }
    res.json(withdrawal);
  });

  // ── Receipt: Admin Approve + Release ──────────────────────────────────────

  async function buildReceiptData(type: "deposit" | "withdrawal", record: any, profile: any) {
    const amountUsdt = Number(type === "deposit" ? record.amountUsdt : record.amount);
    let fee = 0;
    let network = "";
    if (type === "deposit") {
      const currency = record.payCurrency as string | undefined;
      if (currency === "usdttrc20" || currency === "USDTTRC20") { fee = NETWORK_FEE_CONFIG.usdttrc20.fee; network = "TRC20"; }
      else if (currency === "usdtbsc" || currency === "USDTBSC") { fee = NETWORK_FEE_CONFIG.usdtbsc.fee; network = "BEP20"; }
      else { fee = 1.50; network = "TRC20"; }
    }
    const netUsdt = amountUsdt - fee;
    const finalAmountHtg = rateUsdtToHtg(netUsdt);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const txRef = `IZ${pad(now.getDate())}${pad(now.getMonth() + 1)}${String(now.getFullYear()).slice(2)}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    return {
      type,
      transactionRef: record.transactionId || txRef,
      createdAt: record.createdAt || now,
      amountUsdt,
      fee,
      exchangeRate: getDepositRate(),
      finalAmountHtg,
      destination: type === "withdrawal" ? record.phoneNumber : null,
      walletAddress: type === "deposit" ? record.payAddress : null,
      currency: type === "withdrawal" ? record.currency : undefined,
      network,
      userName: profile?.fullName || "User",
      userEmail: profile?.email || "",
      status: "approved",
    };
  }

  // ── Manual MonCash/NatCash Deposit ─────────────────────────────────────────

  // GET company payment accounts for manual deposit
  app.get("/api/deposits/manual/payment-info", isAuthenticated, async (_req, res) => {
    const { appSettings } = await import("@shared/schema");
    const rows = await db.select().from(appSettings).where(
      sql`key IN ('moncash_phone', 'natcash_phone')`
    );
    const settingsMap = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    res.json({
      moncash: settingsMap["moncash_phone"] || process.env.COMPANY_MONCASH_PHONE || "509-XXXX-XXXX",
      natcash: settingsMap["natcash_phone"] || process.env.COMPANY_NATCASH_PHONE || "509-XXXX-XXXX",
      exchangeRate: getDepositRate(),
      minHtg: MANUAL_DEPOSIT_MIN_HTG,
      minUsdt: MANUAL_DEPOSIT_MIN_USDT,
    });
  });

  // PATCH admin update MonCash/NatCash deposit phone numbers
  app.patch("/api/admin/settings/payment-phones", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { moncash, natcash } = req.body;
      if (!moncash?.trim() || !natcash?.trim()) {
        return res.status(400).json({ message: "Both phone numbers are required" });
      }
      const { appSettings } = await import("@shared/schema");
      await db.insert(appSettings).values({ key: "moncash_phone", value: moncash.trim() })
        .onConflictDoUpdate({ target: appSettings.key, set: { value: moncash.trim(), updatedAt: new Date() } });
      await db.insert(appSettings).values({ key: "natcash_phone", value: natcash.trim() })
        .onConflictDoUpdate({ target: appSettings.key, set: { value: natcash.trim(), updatedAt: new Date() } });
      res.json({ moncash: moncash.trim(), natcash: natcash.trim() });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET upload URL for proof screenshot
  app.post("/api/deposits/manual/upload-url", isAuthenticated, async (req: any, res) => {
    try {
      const { ObjectStorageService } = await import("./replit_integrations/object_storage");
      const objectStorage = new ObjectStorageService();
      const uploadURL = await objectStorage.getObjectEntityUploadURL();
      const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);
      res.json({ uploadURL, objectPath });
    } catch (e: any) {
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  // POST submit manual deposit (MonCash or NatCash)
  app.post("/api/deposits/manual", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = req.session.profileId;
      const profile = await storage.getProfile(profileId);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      if (profile.kycStatus !== "verified") return res.status(403).json({ message: "KYC verification required to make deposits" });
      if (profile.isBanned) return res.status(403).json({ message: "Account suspended" });
      if ((profile as any).frozenUntil && new Date((profile as any).frozenUntil) > new Date()) {
        const frozenUntilDate = haitiDate((profile as any).frozenUntil);
        return res.status(403).json({ message: `Your account is frozen until ${frozenUntilDate}. Withdrawals are not permitted during this period. Contact support if you believe this is an error.`, errorCode: "ACCOUNT_FROZEN", frozenUntil: (profile as any).frozenUntil });
      }

      const { amountHtg, mobileWallet, transactionId, proofImageUrl } = req.body;

      if (!amountHtg || !mobileWallet || !transactionId || !proofImageUrl) {
        return res.status(400).json({ message: "All fields are required: amount, wallet type, transaction ID, and proof screenshot" });
      }

      if (!["moncash", "natcash"].includes(mobileWallet)) {
        return res.status(400).json({ message: "Invalid mobile wallet. Use 'moncash' or 'natcash'" });
      }

      const htgAmount = parseFloat(amountHtg);
      if (isNaN(htgAmount) || htgAmount < MANUAL_DEPOSIT_MIN_HTG) {
        return res.status(400).json({ message: `Minimum deposit is ${MANUAL_DEPOSIT_MIN_HTG} HTG (${MANUAL_DEPOSIT_MIN_USDT} USDT)` });
      }

      // Validate transaction ID is digits only
      if (!/^\d+$/.test(transactionId.trim())) {
        return res.status(400).json({ message: "Transaction ID must contain digits only (numbers)" });
      }

      // Anti-fraud: deduplicate transaction ID — check if already used
      const existingByTxId = await storage.getDepositByMoncashTransactionId(transactionId.trim());
      if (existingByTxId) {
        return res.status(409).json({ message: "This transaction ID has already been submitted. If this is an error, please contact support." });
      }

      const amountUsdt = (htgAmount / getDepositRate()).toFixed(2);

      const deposit = await storage.createDeposit({
        profileId,
        amountUsdt,
        amountHtg: htgAmount.toFixed(2),
        depositMethod: "moncash",
        moncashTransactionId: transactionId.trim(),
        proofImageUrl,
        txHash: null,
      });

      // Notify admins
      const allProfiles = await storage.getAllProfiles();
      const admins = allProfiles.filter(a => a.role === "admin");
      const walletLabel = mobileWallet === "moncash" ? "MonCash" : "NatCash";
      for (const admin of admins) {
        await storage.createNotification({
          profileId: admin.id,
          type: "custom_message",
          title: `New ${walletLabel} Deposit Pending`,
          message: `User ${profile.fullName} (ID: ${profileId}) submitted a ${walletLabel} deposit of ${htgAmount.toFixed(0)} HTG (${amountUsdt} USDT). Transaction ID: ${transactionId}. Please review in the Admin panel.`,
        });
      }

      await sendTelegramMessage(`🏦 *New ${walletLabel} Manual Deposit*\n\nUser: ${profile.fullName} (ID: ${profileId})\nAmount: ${htgAmount.toFixed(0)} HTG = ${amountUsdt} USDT\nTx ID: \`${transactionId}\`\nStatus: ⏳ Pending Review`);

      res.json({ message: "Deposit submitted successfully. It will be reviewed within 24 hours.", depositId: deposit.id });
    } catch (e: any) {
      console.error("[manual deposit]", e);
      res.status(500).json({ message: e.message || "Failed to submit deposit" });
    }
  });

  // PATCH reject a manual deposit with reason
  app.patch("/api/admin/deposits/:id/reject-manual", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const { reason } = req.body;
      if (!reason?.trim()) return res.status(400).json({ message: "Rejection reason is required" });

      const deposit = await storage.getDepositById(id);
      if (!deposit) return res.status(404).json({ message: "Deposit not found" });
      if (deposit.status === "approved") return res.status(400).json({ message: "Cannot reject an already approved deposit" });

      await storage.rejectDepositWithReason(id, reason.trim());
      const profile = await storage.getProfile(deposit.profileId);

      const htgEquiv = formatHtg(rateUsdtToHtg(Number(deposit.amountUsdt)));
      const rejectMsg = `Your deposit of ${Number(deposit.amountUsdt).toFixed(2)} USDT (${htgEquiv} HTG) was rejected. Reason: ${reason.trim()}. Please contact support if you believe this is an error.`;
      await storage.createNotification({
        profileId: deposit.profileId,
        type: "deposit_rejected",
        title: "Deposit Rejected",
        message: rejectMsg,
      });

      if (profile?.phone) {
        sendWhatsAppNotification(profile.phone, `*Izichanj*\n\n❌ Deposit Rejected\n\n${rejectMsg}`, profile.fullName);
      }

      res.json({ message: "Deposit rejected and user notified" });
    } catch (e: any) {
      console.error("[reject manual deposit]", e);
      res.status(500).json({ message: e.message });
    }
  });

  // ── Reject for Fraud (admin) ────────────────────────────────────────────
  app.patch("/api/admin/deposits/:id/reject-fraud", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const adminId = req.session.profileId;

      const deposit = await storage.getDepositById(id);
      if (!deposit) return res.status(404).json({ message: "Deposit not found" });
      if (deposit.status === "approved") return res.status(400).json({ message: "Cannot flag an already approved deposit" });

      const fraudReason = "Fraud detected — fake or invalid payment proof submitted";

      // Reject the deposit with the fraud reason
      await storage.rejectDepositWithReason(id, fraudReason);

      const profile = await storage.getProfile(deposit.profileId);

      // Record the fraud rejection for this user
      await storage.recordFraudRejection(deposit.profileId, id, adminId);

      // Count how many fraud rejections in the last 30 minutes
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
      const recentFrauds = await storage.getRecentFraudRejections(deposit.profileId, thirtyMinsAgo);

      let accountFrozen = false;
      let frozenUntil: Date | null = null;

      if (recentFrauds.length >= 3) {
        // Freeze the account for 24 hours
        frozenUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await storage.freezeUser(deposit.profileId, frozenUntil);
        accountFrozen = true;
      }

      const amountDisplay = `${Number(deposit.amountUsdt).toFixed(2)} USDT`;
      const frozenMsg = accountFrozen
        ? `\n\n🚨 ACCOUNT FROZEN until ${haitiDateTime(frozenUntil!)} (Haiti time) — 3 fraud attempts detected in 30 minutes!`
        : `\n⚠️ Warning ${recentFrauds.length}/3 fraud attempts in the last 30 minutes.`;

      // Notify admin via Telegram
      const adminMsg = `🚨 <b>FRAUD ALERT — Deposit #${id}</b>\n\n` +
        `User: ${profile?.fullName || "Unknown"} (ID: ${deposit.profileId})\n` +
        `Email: ${profile?.email || "—"}\n` +
        `Phone: ${profile?.phone || "—"}\n` +
        `Amount: ${amountDisplay}\n` +
        `TX ID: ${deposit.moncashTransactionId || "—"}\n` +
        `Fraud attempts (30min): ${recentFrauds.length}` +
        frozenMsg;

      await sendTelegramMessage(adminMsg);

      // Notify user via in-app notification
      const userNotifMsg = accountFrozen
        ? `Your deposit of ${amountDisplay} was rejected as fraudulent. Your account has been frozen for 24 hours due to repeated suspicious activity. Contact support if you believe this is an error.`
        : `Your deposit of ${amountDisplay} was rejected. Reason: Fraudulent or invalid payment proof. This is warning ${recentFrauds.length}/3 — further violations will result in account suspension.`;

      await storage.createNotification({
        profileId: deposit.profileId,
        type: "deposit_rejected",
        title: accountFrozen ? "🚨 Account Frozen — Fraud Detected" : "⚠️ Deposit Rejected — Fraud Warning",
        message: userNotifMsg,
      });

      // WhatsApp notification to user
      if (profile?.phone) {
        const whatsappMsg = accountFrozen
          ? `*Izichanj Security Alert*\n\n🚨 Your account has been *frozen for 24 hours* due to submitting fraudulent payment proof (3 violations detected).\n\nDeposit ${amountDisplay} rejected.\n\nContact support to appeal.`
          : `*Izichanj Security Warning*\n\n⚠️ Your deposit of ${amountDisplay} was rejected as fraudulent.\n\nThis is warning *${recentFrauds.length}/3* — after 3 violations your account will be frozen for 24 hours.`;
        sendWhatsAppNotification(profile.phone, whatsappMsg, profile.fullName);
      }

      res.json({
        message: accountFrozen
          ? `Deposit rejected for fraud. Account frozen for 24 hours (3 violations detected). Admin and user notified.`
          : `Deposit rejected for fraud (${recentFrauds.length}/3 violations). User warned. ${3 - recentFrauds.length} more will trigger auto-freeze.`,
        accountFrozen,
        fraudCount: recentFrauds.length,
      });
    } catch (e: any) {
      console.error("[reject fraud]", e);
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/admin/deposits/:id/approve-release", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      let deposit = await storage.getDepositById(id);
      if (!deposit) return res.status(404).json({ message: "Deposit not found" });

      const isCrypto = deposit.depositMethod !== "moncash";
      if (isCrypto && !deposit.txHash) {
        return res.status(400).json({ message: "Transaction ID (TxtID) is required before approving a crypto deposit. Please set it first." });
      }

      if (deposit.status !== "approved") {
        deposit = await storage.updateDepositStatus(id, "approved");
        const prof = await storage.getProfile(deposit.profileId);
        if (prof) {
          const currentBalance = parseFloat(prof.balance || "0");
          await storage.updateProfileBalance(deposit.profileId, currentBalance + parseFloat(deposit.amountUsdt));
        }
      }

      const receiptId = crypto.randomUUID();
      deposit = await storage.setDepositReceipt(id, receiptId);
      const prof = await storage.getProfile(deposit.profileId);

      const receiptData = await buildReceiptData("deposit", deposit, prof);
      const pdfBuffer = await generateReceiptPDF({ ...receiptData, receiptId });

      const htgAmount = formatHtg(rateUsdtToHtg(Number(deposit.amountUsdt)));
      const receiptMsg = `Your deposit of ${Number(deposit.amountUsdt).toFixed(2)} USDT (${htgAmount} HTG) has been approved. Your receipt is now available for download in your transaction history.`;
      await storage.createNotification({ profileId: deposit.profileId, type: "deposit_approved", title: "Deposit Approved — Receipt Ready", message: receiptMsg });
      if (prof?.phone) {
        sendWhatsAppNotification(prof.phone, `*Izichanj*\n\n✅ Deposit Approved\n\n${receiptMsg}\n\nhttps://izichanj.com`, prof.fullName);
      }

      res.set({ "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="receipt-${receiptId}.pdf"` });
      res.send(pdfBuffer);
    } catch (e: any) {
      console.error("[approve-release deposit]", e);
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/admin/withdrawals/:id/approve-release", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      let withdrawal = await storage.getWithdrawalById(id);
      if (!withdrawal) return res.status(404).json({ message: "Withdrawal not found" });

      if (withdrawal.status !== "approved") {
        withdrawal = await storage.updateWithdrawalStatus(id, "approved");
      }

      const receiptId = crypto.randomUUID();
      withdrawal = await storage.setWithdrawalReceipt(id, receiptId);
      const prof = await storage.getProfile(withdrawal.profileId);

      const receiptData = await buildReceiptData("withdrawal", withdrawal, prof);
      const pdfBuffer = await generateReceiptPDF({ ...receiptData, receiptId });

      const htgAmount = formatHtg(rateUsdtToHtg(Number(withdrawal.amount)));
      const receiptMsg = `Your withdrawal of ${Number(withdrawal.amount).toFixed(2)} USDT (${htgAmount} HTG) has been approved. Your receipt is now available for download.`;
      await storage.createNotification({ profileId: withdrawal.profileId, type: "withdrawal_approved", title: "Withdrawal Approved — Receipt Ready", message: receiptMsg });
      if (prof?.phone) {
        sendWhatsAppNotification(prof.phone, `*Izichanj*\n\n✅ Withdrawal Approved\n\n${receiptMsg}\n\nhttps://izichanj.com`, prof.fullName);
      }

      res.set({ "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="receipt-${receiptId}.pdf"` });
      res.send(pdfBuffer);
    } catch (e: any) {
      console.error("[approve-release withdrawal]", e);
      res.status(500).json({ message: e.message });
    }
  });

  // ── Receipt: Admin Preview (already approved) ─────────────────────────────

  app.get("/api/admin/receipts/deposit/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const deposit = await storage.getDepositById(Number(req.params.id));
      if (!deposit) return res.status(404).json({ message: "Deposit not found" });
      if (deposit.status !== "approved") return res.status(400).json({ message: "Deposit not yet approved" });
      let rid = deposit.receiptId;
      if (!rid) { rid = crypto.randomUUID(); await storage.setDepositReceipt(deposit.id, rid); }
      const prof = await storage.getProfile(deposit.profileId);
      const data = await buildReceiptData("deposit", deposit, prof);
      const pdfBuffer = await generateReceiptPDF({ ...data, receiptId: rid });
      res.set({ "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="receipt-${rid}.pdf"` });
      res.send(pdfBuffer);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/admin/receipts/withdrawal/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const w = await storage.getWithdrawalById(Number(req.params.id));
      if (!w) return res.status(404).json({ message: "Withdrawal not found" });
      if (w.status !== "approved") return res.status(400).json({ message: "Withdrawal not yet approved" });
      let rid = w.receiptId;
      if (!rid) { rid = crypto.randomUUID(); await storage.setWithdrawalReceipt(w.id, rid); }
      const prof = await storage.getProfile(w.profileId);
      const data = await buildReceiptData("withdrawal", w, prof);
      const pdfBuffer = await generateReceiptPDF({ ...data, receiptId: rid });
      res.set({ "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="receipt-${rid}.pdf"` });
      res.send(pdfBuffer);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Receipt: User Download (owner only, approved only) ────────────────────

  app.get("/api/receipts/deposit/:id", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = req.session.profileId;
      const deposit = await storage.getDepositById(Number(req.params.id));
      if (!deposit) return res.status(404).json({ message: "Not found" });
      if (deposit.profileId !== profileId) return res.status(403).json({ message: "Forbidden" });
      if (deposit.status !== "approved") return res.status(400).json({ message: "Receipt not yet available" });
      if (!deposit.receiptId) return res.status(400).json({ message: "Receipt has not been released yet" });
      const prof = await storage.getProfile(profileId);
      const data = await buildReceiptData("deposit", deposit, prof);
      const pdfBuffer = await generateReceiptPDF({ ...data, receiptId: deposit.receiptId });
      res.set({ "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="izichanj-receipt-${deposit.receiptId.slice(0, 8)}.pdf"` });
      res.send(pdfBuffer);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/receipts/withdrawal/:id", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = req.session.profileId;
      const w = await storage.getWithdrawalById(Number(req.params.id));
      if (!w) return res.status(404).json({ message: "Not found" });
      if (w.profileId !== profileId) return res.status(403).json({ message: "Forbidden" });
      if (w.status !== "approved") return res.status(400).json({ message: "Receipt not yet available" });
      if (!w.receiptId) return res.status(400).json({ message: "Receipt has not been released yet" });
      const prof = await storage.getProfile(profileId);
      const data = await buildReceiptData("withdrawal", w, prof);
      const pdfBuffer = await generateReceiptPDF({ ...data, receiptId: w.receiptId });
      res.set({ "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="izichanj-receipt-${w.receiptId.slice(0, 8)}.pdf"` });
      res.send(pdfBuffer);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Receipt: Public Verification ──────────────────────────────────────────

  app.get("/api/verify/:receiptId", async (req, res) => {
    try {
      const { receiptId } = req.params;
      const deposit = await storage.getDepositByReceiptId(receiptId);
      if (deposit) {
        const prof = await storage.getProfile(deposit.profileId);
        return res.json({
          found: true,
          type: "deposit",
          receiptId,
          status: deposit.status,
          amountUsdt: deposit.amountUsdt,
          createdAt: deposit.createdAt,
          userName: prof?.fullName?.split(" ")[0] || "User",
          network: deposit.payCurrency?.toUpperCase()?.includes("BSC") ? "BEP20" : "TRC20",
        });
      }
      const w = await storage.getWithdrawalByReceiptId(receiptId);
      if (w) {
        const prof = await storage.getProfile(w.profileId);
        return res.json({
          found: true,
          type: "withdrawal",
          receiptId,
          status: w.status,
          amount: w.amount,
          currency: w.currency,
          createdAt: w.createdAt,
          userName: prof?.fullName?.split(" ")[0] || "User",
        });
      }
      res.json({ found: false });
    } catch (e: any) {
      res.status(500).json({ found: false, error: e.message });
    }
  });

  app.patch(api.admin.verifyKyc.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const profileId = Number(req.params.id);
    await storage.updateKycStatus(profileId, "verified");
    const kycApproveMsg = "Your identity has been verified. You can now make deposits and withdrawals.";
    await storage.createNotification({
      profileId,
      type: "kyc_verified",
      title: "KYC Verified",
      message: kycApproveMsg,
    });
    const kycProfile = await storage.getProfile(profileId);
    if (kycProfile?.phone) {
      sendWhatsAppNotification(kycProfile.phone, `*Izichanj*\n\n✅ KYC Verified\n\n${kycApproveMsg}\n\nhttps://izichanj.com`, kycProfile.fullName);
    }
    // Referral commission: $0.25 when referee completes KYC
    if (kycProfile?.referredById) {
      try {
        const referrer = await storage.getProfile(kycProfile.referredById);
        if (referrer && referrer.affiliateEnabled) {
          await storage.createReferralEarning({ referrerId: referrer.id, refereeId: profileId, type: "kyc", amount: 0.25, description: `KYC verified by ${kycProfile.fullName}` });
          await storage.creditReferralBalance(referrer.id, 0.25);
        }
      } catch { /* ignore */ }
    }

    // Auto-register with Strowallet if not yet registered
    const _stroKey = process.env.STROWALLET_PUBLIC_KEY || "";
    const _stroBase = "https://strowallet.com/api/bitvcard";
    if (kycProfile && !kycProfile.strowalletCustomerId && _stroKey) {
      try {
        const kyc = await storage.getKyc(profileId);

        // Compress KYC images server-side — Strowallet rejects images > 2 MB
        const [autoCompressedId, autoCompressedSelfie] = await Promise.all([
          ensureKycImageSize(kyc?.idDocumentUrl || ""),
          ensureKycImageSize(kyc?.selfieUrl || ""),
        ]);

        const firstName = kycProfile.firstName || kycProfile.fullName.split(" ")[0] || "";
        const lastName = kycProfile.lastName || kycProfile.fullName.split(" ").slice(1).join(" ") || firstName;
        // Strowallet expects camelCase field names (confirmed from API error response)
        const payload = {
          public_key: _stroKey,
          firstName,
          lastName,
          customerEmail: kycProfile.email,
          phoneNumber: kycProfile.phone || "",
          dateOfBirth: kycProfile.dateOfBirth || "",
          // Hardcoded US billing address — required by Strowallet for card issuance
          country: "US",
          line1: "3401 N Miami Ave Ste 230",
          houseNumber: "3401",
          city: "Miami",
          state: "FL",
          zipCode: "33127",
          idType: kyc?.idType || "national_id",
          idNumber: kyc?.idNumber || kycProfile.email,
          userPhoto: autoCompressedSelfie,
          idImage: autoCompressedId,
        };
        console.log("[STROWALLET][AUTO-KYC] Registering cardholder for profile:", profileId);
        const proxyUrl = process.env.PROXY_URL;
        let stroRes: Response;
        if (proxyUrl) {
          const { fetch: undiciFetch } = await import("undici");
          const dispatcher = new ProxyAgent(proxyUrl);
          stroRes = await undiciFetch(`${_stroBase}/create-user/`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify(payload),
            dispatcher,
          } as any) as unknown as Response;
        } else {
          stroRes = await fetch(`${_stroBase}/create-user/`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify(payload),
          });
        }
        const stroData = await stroRes.json() as any;
        console.log("[STROWALLET][AUTO-KYC] Response:", JSON.stringify(stroData));
        // Must check success===false explicitly — Strowallet uses {success:false} not {status:"error"}
        if (stroRes.ok && stroData.success !== false && stroData.status !== "error" && stroData.status !== false) {
          const customerId = stroData.response?.customerId || stroData.response?.customer_id || stroData.customer_id || stroData.customerId || stroData.data?.customer_id;
          if (!customerId) {
            console.error("[STROWALLET][AUTO-KYC] Registration appeared to succeed but no customer_id in response:", JSON.stringify(stroData));
            throw new Error("Strowallet registration returned no customer_id");
          }
          await storage.updateProfile(profileId, { strowalletCustomerId: customerId });
          console.log("[STROWALLET][AUTO-KYC] Registered customer:", customerId);
          // Telegram — user is now ready for virtual card
          sendTelegramMessage(
            `✅ <b>User Ready for Virtual Card</b>\n\n` +
            `👤 <b>Name:</b> ${kycProfile.fullName}\n` +
            `📧 <b>Email:</b> ${kycProfile.email}\n` +
            `🆔 <b>User ID:</b> ${kycProfile.referenceId || kycProfile.id}\n` +
            `🏦 <b>Strowallet ID:</b> <code>${customerId}</code>\n\n` +
            `💳 This user can now create a virtual Visa card.`
          ).catch(() => {});
        }
      } catch (stroErr) {
        console.error("[STROWALLET][AUTO-KYC] Error (non-fatal):", stroErr);
      }
    }

    const kyc = await storage.getKyc(profileId);
    res.json(kyc);
  });

  app.patch(api.admin.rejectKyc.path, isAuthenticated, isAdmin, async (req: any, res) => {
    const profileId = Number(req.params.id);
    await storage.updateKycStatus(profileId, "rejected");
    const kycRejectMsg = "Your identity verification was rejected. Please resubmit your documents.";
    await storage.createNotification({
      profileId,
      type: "kyc_rejected",
      title: "KYC Rejected",
      message: kycRejectMsg,
    });
    const kycProfile = await storage.getProfile(profileId);
    if (kycProfile?.phone) {
      sendWhatsAppNotification(kycProfile.phone, `*Izichanj*\n\n❌ KYC Rejected\n\n${kycRejectMsg}\n\nhttps://izichanj.com`, kycProfile.fullName);
    }
    const kyc = await storage.getKyc(profileId);
    res.json(kyc);
  });

  // POST /api/admin/kyc/:id/request-resubmit — delete KYC docs, reset status, notify user
  app.post("/api/admin/kyc/:id/request-resubmit", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const profileId = Number(req.params.id);
      await storage.requestKycResubmit(profileId);
      const resubmitMsg = "Your KYC documents have been flagged for re-review. Please resubmit your identity documents to regain full access to Izichanj services.";
      await storage.createNotification({
        profileId,
        type: "kyc_rejected",
        title: "KYC Re-submission Required",
        message: resubmitMsg,
      });
      const resubmitProfile = await storage.getProfile(profileId);
      if (resubmitProfile?.phone) {
        sendWhatsAppNotification(
          resubmitProfile.phone,
          `*Izichanj*\n\n🔄 KYC Re-submission Required\n\n${resubmitMsg}\n\nhttps://izichanj.com`,
          resubmitProfile.fullName
        );
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Internal error" });
    }
  });

  // POST /api/admin/kyc/:id/strowallet-register — retry Strowallet registration for a verified user
  app.post("/api/admin/kyc/:id/strowallet-register", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const profileId = Number(req.params.id);
      const profile = await storage.getProfile(profileId);
      if (!profile) return res.status(404).json({ message: "User not found" });
      if (profile.kycStatus !== "verified") return res.status(400).json({ message: "User KYC is not verified" });

      const kyc = await storage.getKyc(profileId);
      const _stroKey = process.env.STROWALLET_PUBLIC_KEY || "";
      if (!_stroKey) return res.status(500).json({ message: "Strowallet key not configured" });

      // Compress KYC images server-side — Strowallet rejects images > 2 MB
      const [compressedIdImage, compressedSelfie] = await Promise.all([
        ensureKycImageSize(kyc?.idDocumentUrl || ""),
        ensureKycImageSize(kyc?.selfieUrl || ""),
      ]);

      const firstName = profile.firstName || profile.fullName.split(" ")[0] || "";
      const lastName = profile.lastName || profile.fullName.split(" ").slice(1).join(" ") || firstName;
      // Strowallet expects camelCase field names (confirmed from API error response)
      const payload = {
        public_key: _stroKey,
        firstName,
        lastName,
        customerEmail: profile.email,
        phoneNumber: profile.phone || "",
        dateOfBirth: profile.dateOfBirth || "",
        // Hardcoded US billing address — required by Strowallet for card issuance
        country: "US",
        line1: "3401 N Miami Ave Ste 230",
        houseNumber: "3401",
        city: "Miami",
        state: "FL",
        zipCode: "33127",
        idType: kyc?.idType || "",
        idNumber: kyc?.idNumber || "",
        userPhoto: compressedSelfie,
        idImage: compressedIdImage,
      };

      console.log(`[STROWALLET][ADMIN-RETRY] Payload keys: ${Object.keys(payload).join(", ")}`);

      const stroRes = await strowalletFetch(`${STROWALLET_BASE}/create-user/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await stroRes.json() as any;
      console.log("[STROWALLET][ADMIN-RETRY] Response:", JSON.stringify(data));

      // Check both status and success fields — Strowallet uses {success:false} not always {status:"error"}
      if (!stroRes.ok || data.success === false || data.status === "error" || data.status === false) {
        const errMsg = typeof data.message === "object" ? JSON.stringify(data.message) : (data.message || data.error || "Strowallet registration failed");
        return res.status(400).json({ message: errMsg });
      }

      const customerId = data.response?.customerId || data.response?.customer_id || data.customer_id || data.customerId || data.data?.customer_id;
      if (!customerId) {
        return res.status(500).json({ message: "Strowallet registration returned no customer_id. Raw: " + JSON.stringify(data) });
      }
      await storage.updateProfile(profileId, { strowalletCustomerId: customerId });

      // Telegram — user is now ready for virtual card
      sendTelegramMessage(
        `✅ <b>User Ready for Virtual Card</b>\n\n` +
        `👤 <b>Name:</b> ${profile.fullName}\n` +
        `📧 <b>Email:</b> ${profile.email}\n` +
        `🆔 <b>User ID:</b> ${profile.referenceId || profile.id}\n` +
        `🏦 <b>Strowallet ID:</b> <code>${customerId}</code>\n\n` +
        `💳 This user can now create a virtual Visa card.`
      ).catch(() => {});

      res.json({ success: true, customerId });
    } catch (e: any) {
      console.error("[STROWALLET][ADMIN-RETRY] Error:", e);
      res.status(500).json({ message: e.message || "Internal error" });
    }
  });

  // PATCH /api/admin/profiles/:id/strowallet-customer-id — manually set a user's Strowallet customer ID
  app.patch("/api/admin/profiles/:id/strowallet-customer-id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const profileId = Number(req.params.id);
      const { customerId } = req.body;
      if (!customerId || typeof customerId !== "string" || customerId.trim().length < 5) {
        return res.status(400).json({ message: "Invalid customer ID" });
      }
      const profile = await storage.getProfile(profileId);
      if (!profile) return res.status(404).json({ message: "User not found" });
      await storage.updateProfile(profileId, { strowalletCustomerId: customerId.trim() });
      console.log(`[ADMIN] Manually set Strowallet customer ID for profile ${profileId}: ${customerId.trim()}`);
      res.json({ success: true, customerId: customerId.trim() });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/admin/virtual-card-ready — list users verified by Strowallet and ready to create a card
  app.get("/api/admin/virtual-card-ready", isAuthenticated, isAdmin, async (req: any, res) => {
    const allProfiles = await storage.getAllProfiles();
    const ready = allProfiles.filter(p => p.kycStatus === "verified" && p.strowalletCustomerId && !p.deletedAt);
    res.json(ready);
  });

  // GET /api/admin/pending-cards — list all pending virtual card requests
  app.get("/api/admin/pending-cards", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const pendingCards = await storage.getAllPendingVirtualCards();
      res.json(pendingCards);
    } catch (e: any) {
      console.error("[admin pending-cards]", e);
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/admin/card-stats — profit tracker for virtual cards
  app.get("/api/admin/card-stats", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const allCards = await db.select().from(virtualCards);
      const activeCards   = allCards.filter(c => c.status === "active").length;
      const pendingCards2 = allCards.filter(c => c.status === "pending").length;
      const frozenCards   = allCards.filter(c => c.status === "frozen").length;
      const totalIssued   = activeCards + frozenCards; // cards that actually went through
      const breakdown     = calcCardCreationCost();          // flat $19 / $4 to card
      const CARD_PRICE    = breakdown.total;                 // user pays $19.00
      const STRO_FIXED    = 4.40;                            // $2.50 + $1.90 Strowallet fixed
      const STRO_VAR      = Number((breakdown.loadAmount * 0.034).toFixed(2)); // 3.4% of load (absorbed)
      const CARD_COST     = Number((breakdown.loadAmount + STRO_FIXED + STRO_VAR).toFixed(2));
      const PROFIT_PER    = Number((CARD_PRICE - CARD_COST).toFixed(2)); // $10.46
      res.json({
        activeCards,
        pendingCards: pendingCards2,
        frozenCards,
        totalIssued,
        cardPrice: CARD_PRICE,
        cardCost: CARD_COST,
        profitPerCard: PROFIT_PER,
        totalProfit: Number((totalIssued * PROFIT_PER).toFixed(2)),
        totalRevenue: Number((totalIssued * CARD_PRICE).toFixed(2)),
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/admin/cards/:id/cancel-refund — admin manually cancels a pending card and refunds the user
  app.post("/api/admin/cards/:id/cancel-refund", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const cardDbId = Number(req.params.id);

      // Atomic: only cancel if still pending, return the balance we need to refund
      const cancelled = await db
        .update(virtualCards)
        .set({ status: "cancelled" })
        .where(and(
          eq(virtualCards.id, cardDbId),
          eq(virtualCards.status, "pending"),
        ))
        .returning({ balance: virtualCards.balance, profileId: virtualCards.profileId });

      if (cancelled.length === 0) {
        return res.status(409).json({ message: "Card is not in pending status or was already cancelled." });
      }

      const { balance: heldBalance, profileId } = cancelled[0];
      const refundAmount = parseFloat(heldBalance || "20");

      const profile = await storage.getProfile(profileId);
      if (!profile) return res.status(404).json({ message: "User not found" });

      const newBalance = parseFloat(profile.balance || "0") + refundAmount;
      await storage.updateProfileBalance(profileId, newBalance);

      // In-app notification to user
      await storage.createNotification({
        profileId,
        type: "custom_message",
        title: "Virtual Card Request Cancelled — Refund Issued",
        message: `Your virtual card application was cancelled by support. $${refundAmount.toFixed(2)} USDT has been refunded to your balance. You can apply for a new card anytime.`,
      }).catch(() => {});

      // WhatsApp
      if (profile.phone) {
        sendWhatsAppNotification(
          profile.phone,
          `*Izichanj*\n\n❌ Your virtual card request was cancelled by our team.\n\n💵 $${refundAmount.toFixed(2)} USDT has been refunded to your balance.\n\nYou can apply for a new card anytime from the Virtual Cards section.\n\nhttps://izichanj.com`,
          profile.fullName
        );
      }

      sendTelegramMessage(
        `🔴 <b>Pending Card Cancelled (Admin)</b>\n\n` +
        `👤 <b>User:</b> ${profile.fullName}\n` +
        `📧 <b>Email:</b> ${profile.email}\n` +
        `💵 <b>Refunded:</b> $${refundAmount.toFixed(2)} USDT\n` +
        `💰 <b>New Balance:</b> $${newBalance.toFixed(2)} USDT\n` +
        `🗂 <b>Card DB ID:</b> #${cardDbId}`
      ).catch(() => {});

      res.json({ success: true, refunded: refundAmount, newBalance, userName: profile.fullName });
    } catch (e: any) {
      console.error("[admin cancel-refund card]", e);
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/admin/cards/:id/retry — retry Strowallet card creation for a pending card
  app.post("/api/admin/cards/:id/retry", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const cardDbId = Number(req.params.id);
      const card = await storage.getVirtualCardById(cardDbId);
      if (!card) return res.status(404).json({ message: "Card not found" });
      if (card.status !== "pending") return res.status(400).json({ message: "Card is not in pending status" });

      let profile = await storage.getProfile(card.profileId);
      if (!profile) return res.status(404).json({ message: "User not found" });
      if (!strowalletPublicKey) return res.status(500).json({ message: "Card service not configured" });

      // Auto-register the cardholder with Strowallet if they don't have a customer ID yet
      if (!profile.strowalletCustomerId) {
        if (profile.kycStatus !== "verified") {
          return res.status(400).json({ message: "User KYC is not verified — cannot register cardholder" });
        }
        const kyc = await storage.getKyc(profile.id);
        const [compressedIdImage, compressedSelfie] = await Promise.all([
          ensureKycImageSize(kyc?.idDocumentUrl || ""),
          ensureKycImageSize(kyc?.selfieUrl || ""),
        ]);
        const firstName = profile.firstName || profile.fullName.split(" ")[0] || "";
        const lastName  = profile.lastName  || profile.fullName.split(" ").slice(1).join(" ") || firstName;
        const regPayload = {
          public_key: strowalletPublicKey,
          firstName, lastName,
          customerEmail: profile.email,
          phoneNumber: profile.phone || "",
          dateOfBirth: profile.dateOfBirth || "",
          country: "US", line1: "3401 N Miami Ave Ste 230", houseNumber: "3401",
          city: "Miami", state: "FL", zipCode: "33127",
          idType: kyc?.idType || "", idNumber: kyc?.idNumber || "",
          userPhoto: compressedSelfie, idImage: compressedIdImage,
        };
        console.log(`[ADMIN RETRY CARD] Auto-registering cardholder for user ${profile.id} (${profile.email})`);
        const regRes = await strowalletFetch(`${STROWALLET_BASE}/create-user/`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(regPayload),
        });
        const regData = await regRes.json() as any;
        console.log("[ADMIN RETRY CARD] Auto-register response:", JSON.stringify(regData));
        if (!regRes.ok || regData.success === false || regData.status === "error" || regData.status === false) {
          // "Email already taken" means user was previously registered in Strowallet successfully —
          // we just don't have their customer_id saved. Admin must set it manually.
          const rawMsg = regData.message || regData.error || "";
          const msgStr = typeof rawMsg === "object" ? JSON.stringify(rawMsg) : String(rawMsg);
          if (msgStr.toLowerCase().includes("already been taken") || msgStr.toLowerCase().includes("already taken") || msgStr.toLowerCase().includes("already exists")) {
            return res.status(409).json({
              alreadyRegistered: true,
              message: "This user is already registered in Strowallet but the customer ID is missing from our records. Use the 'Set Customer ID' field to enter their Strowallet customer ID manually, then retry.",
            });
          }
          return res.status(400).json({ message: `Auto-register failed: ${msgStr}` });
        }
        const customerId = regData.response?.customerId || regData.response?.customer_id || regData.customer_id || regData.customerId || regData.data?.customer_id;
        if (!customerId) {
          return res.status(500).json({ message: "Auto-register returned no customer_id. Raw: " + JSON.stringify(regData) });
        }
        await storage.updateProfile(profile.id, { strowalletCustomerId: customerId });
        profile = (await storage.getProfile(profile.id))!;
        console.log(`[ADMIN RETRY CARD] Cardholder registered — Strowallet ID: ${customerId}`);
      }

      // IMPORTANT: User's balance was already deducted (CARD_TOTAL_PRICE_USD) when the pending card was created.
      // This retry only calls Strowallet's API — it does NOT touch the user's balance again.
      // Strowallet receives the configured load amount (Strowallet enforces $5 minimum).
      const fundAmount = CARD_LOAD_AMOUNT_USD;
      const nameOnCard = card.nameOnCard || profile.fullName;

      const createCardPayload: Record<string, string> = {
        name_on_card: nameOnCard,
        card_type: "visa",
        public_key: strowalletPublicKey,
        amount: fundAmount.toString(),
        customerEmail: profile.email,
        customer_id: profile.strowalletCustomerId,
      };

      console.log(`[ADMIN RETRY CARD] Retrying card creation for user ${profile.id} (${profile.email}), card DB id ${cardDbId}`);

      // Notify admin that retry was triggered
      sendTelegramMessage(
        `🔄 <b>Retry Card Issuance — Initiated</b>\n\n` +
        `👤 <b>User:</b> ${profile.fullName}\n` +
        `📧 <b>Email:</b> ${profile.email}\n` +
        `📞 <b>Phone:</b> ${profile.phone || "—"}\n` +
        `🪪 <b>Strowallet ID:</b> ${profile.strowalletCustomerId}\n` +
        `💵 <b>Amount:</b> $${fundAmount.toFixed(2)} USDT\n` +
        `🗂 <b>Pending card DB ID:</b> #${cardDbId}\n\n` +
        `⏳ Calling Strowallet API now…`
      ).catch(() => {});

      const response = await strowalletFetch(`${STROWALLET_BASE}/create-card/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(createCardPayload),
      });

      const data = await response.json();
      console.log("================== [ADMIN RETRY CREATE-CARD] ==================");
      console.log("[ADMIN RETRY] HTTP status:", response.status);
      console.log("[ADMIN RETRY] Request payload:", JSON.stringify(createCardPayload, null, 2));
      console.log("[ADMIN RETRY] Strowallet raw response:", JSON.stringify(data, null, 2));
      console.log("================================================================");

      if (!response.ok || data.status === "error" || data.status === false) {
        // Safely extract error — Strowallet sometimes returns objects, not strings
        const rawErr = data.message ?? data.error ?? data.errors ?? data;
        const errMsg = typeof rawErr === "string"
          ? rawErr
          : JSON.stringify(rawErr);
        const rawDump = JSON.stringify(data, null, 2);

        sendTelegramMessage(
          `❌ <b>Retry Card Issuance — Failed</b>\n\n` +
          `👤 <b>User:</b> ${profile.fullName}\n` +
          `📧 <b>Email:</b> ${profile.email}\n` +
          `🪪 <b>Strowallet ID:</b> ${profile.strowalletCustomerId}\n` +
          `🗂 <b>Pending card DB ID:</b> #${cardDbId}\n\n` +
          `⚠️ <b>Error:</b> <code>${errMsg}</code>\n\n` +
          `📋 <b>Full response:</b>\n<pre>${rawDump.slice(0, 800)}</pre>\n\n` +
          `👉 Card remains pending. Fix the issue above and retry again.`
        ).catch(() => {});
        return res.status(400).json({ success: false, message: errMsg });
      }

      // Success — activate the card
      const cardInfo = data.response || data.data || data;
      const newCardId = cardInfo.card_id || cardInfo.id || `stro_${Date.now()}`;
      const last4 = cardInfo.card_number ? String(cardInfo.card_number).slice(-4) : cardInfo.last4 || null;

      await storage.updateVirtualCard(cardDbId, {
        cardId: String(newCardId),
        last4,
        status: "active",
        cardDetail: cardInfo,
      });

      // Notify user in-app + WhatsApp
      await storage.createNotification({
        profileId: profile.id,
        type: "custom_message",
        title: "Your Virtual Card is Ready! 💳",
        message: "Your Visa virtual card has been issued successfully. You can now view your card details in the Virtual Cards section.",
      }).catch(() => {});

      if (profile.phone) {
        sendWhatsAppNotification(
          profile.phone,
          `*Izichanj*\n\n💳 Your virtual card is ready!\n\nYour Visa virtual card has been issued. Log in to view your card details.\n\nhttps://izichanj.com`,
          profile.fullName
        );
      }

      sendTelegramMessage(
        `✅ <b>Pending Card Issued Successfully</b>\n\n` +
        `👤 <b>User:</b> ${profile.fullName}\n` +
        `📧 <b>Email:</b> ${profile.email}\n` +
        `💳 <b>Card ID:</b> ${newCardId}\n` +
        `🔢 <b>Last 4:</b> ${last4 || "N/A"}`
      ).catch(() => {});

      res.json({ success: true, message: "Card issued successfully", cardId: newCardId, last4 });
    } catch (e: any) {
      console.error("[admin retry card]", e);
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/admin/strowallet/check-all-cardholders — fetch Strowallet KYC/cardholder status for every registered user
  app.post("/api/admin/strowallet/check-all-cardholders", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const allProfiles = await storage.getAllProfiles();
      const registered = allProfiles.filter(p => p.strowalletCustomerId && !p.deletedAt);

      if (registered.length === 0) {
        return res.json({ checked: 0, results: [], message: "No users registered with Strowallet yet." });
      }

      const results: any[] = [];

      for (const profile of registered) {
        try {
          const _stroBase = "https://strowallet.com/api/bitvcard";
          const _stroKey = process.env.STROWALLET_PUBLIC_KEY || "";
          const params = new URLSearchParams({
            public_key: _stroKey,
            customer_id: profile.strowalletCustomerId!,
          });
          const response = await strowalletFetch(`${_stroBase}/get-user/?${params.toString()}`, {
            method: "GET",
            headers: { "Accept": "application/json" },
          });
          const data = await response.json();
          const userData = data.response || data.data || data;
          // Try every possible field name Strowallet might use
          const status =
            userData?.status ||
            userData?.kyc_status ||
            userData?.verification_status ||
            userData?.account_status ||
            userData?.user_status ||
            userData?.approval_status ||
            userData?.is_active ||
            userData?.active ||
            userData?.is_approved ||
            data.status ||
            data.message ||
            "unknown";
          const statusStr = String(status).toLowerCase();
          const isApproved =
            statusStr.includes("approved") ||
            statusStr.includes("active") ||
            statusStr.includes("verified") ||
            statusStr.includes("success") ||
            status === true ||
            status === 1 ||
            status === "1";
          results.push({
            id: profile.id,
            name: profile.fullName,
            email: profile.email,
            phone: profile.phone,
            strowalletCustomerId: profile.strowalletCustomerId,
            status,
            isApproved,
            rawResponse: data,
          });
        } catch (err: any) {
          results.push({
            id: profile.id,
            name: profile.fullName,
            email: profile.email,
            strowalletCustomerId: profile.strowalletCustomerId,
            status: "error",
            isApproved: false,
            error: err.message,
          });
        }
      }

      // Send summary to Telegram
      const approved = results.filter(r => r.isApproved);
      const pending  = results.filter(r => !r.isApproved && r.status !== "error");
      const errors   = results.filter(r => r.status === "error");

      let telegramMsg = `🪪 <b>Strowallet Cardholder Status Check</b>\n\n` +
        `👥 <b>Total registered:</b> ${results.length}\n` +
        `✅ <b>Approved:</b> ${approved.length}\n` +
        `⏳ <b>Pending/Other:</b> ${pending.length}\n` +
        `❌ <b>Errors:</b> ${errors.length}\n\n`;

      results.forEach(r => {
        const icon = r.isApproved ? "✅" : r.status === "error" ? "❌" : "⏳";
        const rawSnippet = JSON.stringify(r.rawResponse || r.error || {}).slice(0, 300);
        telegramMsg += `${icon} <b>${r.name}</b> (ID: ${r.strowalletCustomerId})\n` +
          `   📧 ${r.email}\n` +
          `   📌 Status: <code>${r.status}</code>\n` +
          `   🔍 Raw: <code>${rawSnippet}</code>\n\n`;
      });

      await sendTelegramMessage(telegramMsg.slice(0, 4096)).catch(() => {});

      res.json({ checked: results.length, results });
    } catch (e: any) {
      console.error("[ADMIN] check-all-cardholders error:", e);
      res.status(500).json({ message: e.message || "Internal error" });
    }
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
      if (targetProfile.phone) {
        sendWhatsAppNotification(
          targetProfile.phone,
          `*Izichanj*\n\n📢 ${parsed.title}\n\n${parsed.message}\n\nhttps://izichanj.com`
        );
      }
      res.status(201).json({ ...notification, whatsappSent: !!targetProfile.phone });
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0].message });
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.post("/api/admin/notifications/send-bulk", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { profileIds, sendToAll, title, message } = req.body;
      if (!title || !message) return res.status(400).json({ message: "Title and message are required" });

      let targets: any[] = [];
      if (sendToAll) {
        const all = await storage.getAllProfiles();
        targets = all.filter((p: any) => !p.isDeleted && p.role !== "admin");
      } else {
        if (!Array.isArray(profileIds) || profileIds.length === 0)
          return res.status(400).json({ message: "Select at least one user" });
        const all = await storage.getAllProfiles();
        targets = all.filter((p: any) => profileIds.includes(p.id));
      }

      let whatsappCount = 0;
      for (const profile of targets) {
        await storage.createNotification({ profileId: profile.id, type: "custom_message", title, message });
        if (profile.phone) {
          sendWhatsAppNotification(profile.phone, `*Izichanj*\n\n📢 ${title}\n\n${message}\n\nhttps://izichanj.com`, profile.fullName);
          whatsappCount++;
        }
      }
      res.status(201).json({ sent: targets.length, whatsappSent: whatsappCount });
    } catch (e) {
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

  // ======= Telegram Notification Helper =======
  function maskName(fullName: string): string {
    return fullName
      .split(" ")
      .map(part => part.length <= 2 ? part[0] + "***" : part.slice(0, 3) + "***")
      .join(" ");
  }

  function maskEmail(email: string): string {
    const [local, domain] = email.split("@");
    const visible = local.length <= 2 ? local[0] : local.slice(0, 3);
    return `${visible}***@${domain}`;
  }

  async function sendTelegramMessage(text: string): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      });
    } catch (e) {
      console.error("[Telegram] Failed to send message:", e);
    }
  }

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
      const displayMsg = (message || "").trim() || (fileName ? `Sent a file: ${fileName}` : "Sent a file");
      const userMsg = await storage.addMessage({
        conversationId: conv.id,
        sender: "user",
        senderProfileId: profile.id,
        message: displayMsg,
        fileUrl: fileUrl || undefined,
        fileName: fileName || undefined,
      });

      // Telegram alert for every user message
      const telegramText = `💬 <b>New Support Message</b>\n\n👤 <b>Name:</b> ${profile.fullName}\n📧 <b>Email:</b> ${profile.email}\n🆔 <b>User ID:</b> ${profile.referenceId || profile.id}\n💬 <b>Conv #${conv.id}</b>\n\n📝 <b>Message:</b>\n${fileUrl ? `[File: ${fileName || "attachment"}]` : displayMsg}\n\n🔗 Reply via the admin panel.`;
      sendTelegramMessage(telegramText).catch(() => {});

      const botAnswer = getBotResponse(message);
      const responseMessages = [userMsg];
      if (botAnswer === "AGENT_REQUEST") {
        await storage.updateConversationStatus(conv.id, "waiting_agent");

        // Extra Telegram alert for agent requests
        sendTelegramMessage(`🚨 <b>Live Agent Requested!</b>\n\n👤 <b>Name:</b> ${profile.fullName}\n📧 <b>Email:</b> ${profile.email}\n🆔 <b>User ID:</b> ${profile.referenceId || profile.id}\n💬 Conversation #${conv.id}\n\nPlease respond ASAP via the admin panel.`).catch(() => {});

        // Notify admin in-app
        const admins = await storage.getAllProfiles();
        const adminList = admins.filter(a => a.role === "admin");
        for (const admin of adminList) {
          await storage.createNotification({
            profileId: admin.id,
            type: "custom_message",
            title: "Support Agent Requested",
            message: `User ${profile.fullName} is requesting a live support agent.`,
          });
        }

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

  // Auto-expire pending deposits whose 15-minute window has lapsed
  setInterval(async () => {
    try {
      const count = await storage.autoExpirePendingDeposits();
      if (count > 0) {
        console.log(`[AUTO-EXPIRE] Expired ${count} deposit(s) past the 15-minute window.`);
        sendTelegramMessage(
          `⏰ <b>${count} deposit${count > 1 ? "s" : ""} auto-expired</b>\n\nThese pending deposits exceeded the 15-minute window and have been marked as Expired. You can still approve them manually from the admin panel.`
        ).catch(() => {});
      }
    } catch (e) {
      console.error("Auto-expire deposits error:", e);
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

  // ======= PIN Login Routes =======
  app.post("/api/security/pin/set", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });

      const { pin, password } = req.body;
      if (!pin || !password) return res.status(400).json({ message: "PIN and password are required" });
      if (!/^\d{4}$/.test(pin)) return res.status(400).json({ message: "PIN must be exactly 4 digits" });

      const validPassword = await bcrypt.compare(password, profile.passwordHash);
      if (!validPassword) return res.status(400).json({ message: "Incorrect password" });

      const pinHash = await bcrypt.hash(pin, 10);
      await db.update(profiles).set({ pinHash }).where(eq(profiles.id, profile.id));
      res.json({ message: "PIN set successfully" });
    } catch (e) {
      console.error("PIN set error:", e);
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.post("/api/security/pin/remove", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });

      await db.update(profiles).set({ pinHash: null }).where(eq(profiles.id, profile.id));
      res.json({ message: "PIN removed successfully" });
    } catch (e) {
      console.error("PIN remove error:", e);
      res.status(500).json({ message: "Internal Error" });
    }
  });

  // ======= Withdrawal PIN (6-digit authorization PIN) =======
  app.get("/api/security/withdrawal-pin/status", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      res.json({ hasWithdrawalPin: !!(profile as any).withdrawalPinHash });
    } catch (e) {
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.post("/api/security/withdrawal-pin/set", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });

      const { pin, password } = req.body;
      if (!pin || !password) return res.status(400).json({ message: "PIN and password are required" });
      if (!/^\d{6}$/.test(pin)) return res.status(400).json({ message: "Withdrawal PIN must be exactly 6 digits" });

      const validPassword = await bcrypt.compare(password, profile.passwordHash);
      if (!validPassword) return res.status(400).json({ message: "Incorrect password" });

      const withdrawalPinHash = await bcrypt.hash(pin, 10);
      await db.update(profiles).set({ withdrawalPinHash } as any).where(eq(profiles.id, profile.id));
      res.json({ message: "Withdrawal PIN set successfully" });
    } catch (e) {
      console.error("Withdrawal PIN set error:", e);
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.post("/api/security/withdrawal-pin/change", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });

      const { currentPin, newPin } = req.body;
      if (!currentPin || !newPin) return res.status(400).json({ message: "Current and new PINs required" });
      if (!/^\d{6}$/.test(newPin)) return res.status(400).json({ message: "New withdrawal PIN must be exactly 6 digits" });

      const currentPinHash = (profile as any).withdrawalPinHash;
      if (!currentPinHash) return res.status(400).json({ message: "No withdrawal PIN set. Please set one first." });

      const validPin = await bcrypt.compare(currentPin, currentPinHash);
      if (!validPin) return res.status(400).json({ message: "Incorrect current PIN" });

      const withdrawalPinHash = await bcrypt.hash(newPin, 10);
      await db.update(profiles).set({ withdrawalPinHash } as any).where(eq(profiles.id, profile.id));
      res.json({ message: "Withdrawal PIN changed successfully" });
    } catch (e) {
      console.error("Withdrawal PIN change error:", e);
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.post("/api/auth/pin-login", async (req: any, res) => {
    try {
      const { email, pin } = req.body;
      if (!email || !pin) return res.status(400).json({ message: "Email and PIN are required" });

      const profile = await storage.getProfileByEmail(email);
      if (!profile) return res.status(400).json({ message: "Invalid credentials" });
      if (profile.isDeleted) return res.status(400).json({ message: "Account has been deleted" });
      if (!profile.pinHash) return res.status(400).json({ message: "PIN login not set up" });

      const validPin = await bcrypt.compare(pin, profile.pinHash);
      if (!validPin) return res.status(400).json({ message: "Incorrect PIN" });

      if (profile.isBanned) {
        req.session.profileId = profile.id;
      }

      if (profile.twoFactorEnabled) {
        req.session.pending2faProfileId = profile.id;
        return res.json({ needs2fa: true });
      }

      req.session.profileId = profile.id;
      const pinIp = getClientIp(req);
      storage.createLoginLog(profile.id, "pin", pinIp).catch(() => {});
      storage.updateProfileIp(profile.id, pinIp, new Date()).catch(() => {});
      const { passwordHash: _, twoFactorSecret: _s, pinHash: _p, ...safeProfile } = profile;
      res.json(safeProfile);
    } catch (e) {
      console.error("PIN login error:", e);
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.get("/api/auth/has-pin", async (req, res) => {
    try {
      const { email } = req.query;
      if (!email || typeof email !== "string") return res.json({ hasPin: false });
      const profile = await storage.getProfileByEmail(email);
      if (!profile || profile.isDeleted) return res.json({ hasPin: false });
      res.json({ hasPin: !!profile.pinHash });
    } catch (e) {
      res.json({ hasPin: false });
    }
  });

  app.post("/api/auth/forgot-pin", async (req, res) => {
    try {
      const input = forgotPasswordSchema.parse(req.body);
      const profile = await storage.getProfileByPhone(input.phone);
      if (!profile || profile.isDeleted) {
        return res.json({ message: "If an account exists with this number, you will receive a code." });
      }
      if (!profile.pinHash) {
        return res.json({ message: "If an account exists with this number, you will receive a code." });
      }
      const code = crypto.randomInt(100000, 999999).toString();
      await storage.createOtp(profile.id, code);
      await sendWhatsAppOtp(input.phone, code, profile.fullName);
      res.json({ message: "If an account exists with this number, you will receive a code." });
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0].message });
      console.error("Forgot PIN error:", e);
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.post("/api/auth/reset-pin", async (req, res) => {
    try {
      const input = resetPinSchema.parse(req.body);
      const profile = await storage.getProfileByPhone(input.phone);
      if (!profile || profile.isDeleted) {
        return res.status(400).json({ message: "Invalid phone number or code" });
      }
      const validOtp = await storage.getValidOtp(profile.id, input.code);
      if (!validOtp) {
        return res.status(400).json({ message: "Invalid or expired code" });
      }
      await storage.markOtpVerified(validOtp.id);
      const pinHash = await bcrypt.hash(input.newPin, 12);
      await db.update(profiles).set({ pinHash }).where(eq(profiles.id, profile.id));
      res.json({ message: "PIN reset successfully" });
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0].message });
      console.error("Reset PIN error:", e);
      res.status(500).json({ message: "Internal Error" });
    }
  });

  // ======= P2P Transfer Routes =======
  app.post("/api/transfers/lookup", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });

      const { identifier } = req.body;
      if (!identifier || typeof identifier !== "string") {
        return res.status(400).json({ message: "Identifier is required" });
      }

      const trimmed = identifier.trim();
      let recipient = await storage.getProfileByReferenceId(trimmed);
      if (!recipient) recipient = await storage.getProfileByEmail(trimmed);
      if (!recipient) recipient = await storage.getProfileByPhone(trimmed);

      if (!recipient || recipient.isDeleted || recipient.id === profile.id) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        id: recipient.id,
        fullName: recipient.fullName,
        referenceId: recipient.referenceId,
        email: recipient.email.replace(/(.{2}).*(@.*)/, "$1***$2"),
      });
    } catch (e) {
      console.error("Transfer lookup error:", e);
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.post("/api/transfers/send", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });

      if (profile.kycStatus !== "verified") {
        return res.status(403).json({ message: "KYC verification required to send funds" });
      }

      if (profile.isBanned) {
        return res.status(403).json({ message: "Your account is restricted" });
      }

      const { recipientId, amount, note } = req.body;
      if (!recipientId || !amount) {
        return res.status(400).json({ message: "Recipient and amount are required" });
      }

      const sendAmount = parseFloat(amount);
      if (isNaN(sendAmount) || sendAmount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      if (sendAmount < 1) {
        return res.status(400).json({ message: "Minimum transfer amount is 1 USDT" });
      }

      const senderBalance = parseFloat(profile.balance);
      if (senderBalance < sendAmount) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      const recipient = await storage.getProfile(recipientId);
      if (!recipient || recipient.isDeleted || recipient.id === profile.id) {
        return res.status(404).json({ message: "Recipient not found" });
      }

      const newSenderBalance = senderBalance - sendAmount;
      const newReceiverBalance = parseFloat(recipient.balance) + sendAmount;

      const senderBalanceBefore = senderBalance;
      await storage.updateProfileBalance(profile.id, newSenderBalance);
      await storage.updateProfileBalance(recipient.id, newReceiverBalance);

      const now = new Date();
      const dd = String(now.getDate()).padStart(2, "0");
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const yyyy = now.getFullYear();
      const hh = String(now.getHours()).padStart(2, "0");
      const mi = String(now.getMinutes()).padStart(2, "0");
      const ss = String(now.getSeconds()).padStart(2, "0");
      const txId = `IZ${dd}${mm}${yyyy}${hh}${mi}${ss}`;

      const transfer = await storage.createP2PTransfer({
        senderProfileId: profile.id,
        receiverProfileId: recipient.id,
        amount: sendAmount.toFixed(2),
        note: note || undefined,
        transactionId: txId,
      });
      const receiverBalBefore = parseFloat(recipient.balance);
      storage.createBalanceLog({ profileId: profile.id, previousBalance: senderBalanceBefore, newBalance: newSenderBalance, change: -sendAmount, action: "p2p_send", referenceId: String(transfer.id) }).catch(() => {});
      storage.createBalanceLog({ profileId: recipient.id, previousBalance: receiverBalBefore, newBalance: newReceiverBalance, change: sendAmount, action: "p2p_receive", referenceId: String(transfer.id) }).catch(() => {});

      const receivedMsg = `You received ${sendAmount.toFixed(2)} USDT from ${profile.fullName}${note ? ` - "${note}"` : ""}\nTransaction ID: ${txId}`;
      await storage.createNotification({
        profileId: recipient.id,
        type: "transfer_received",
        title: "Funds Received",
        message: receivedMsg,
      });

      const sentMsg = `You sent ${sendAmount.toFixed(2)} USDT to ${recipient.fullName}\nTransaction ID: ${txId}`;
      await storage.createNotification({
        profileId: profile.id,
        type: "transfer_sent",
        title: "Funds Sent",
        message: sentMsg,
      });

      if (recipient.phone) {
        sendWhatsAppNotification(recipient.phone, `*Izichanj*\n\n💰 ${receivedMsg}\n\nhttps://izichanj.com`, recipient.fullName);
      }
      if (profile.phone) {
        sendWhatsAppNotification(profile.phone, `*Izichanj*\n\n📤 ${sentMsg}\n\nhttps://izichanj.com`, profile.fullName);
      }

      res.json({ message: "Transfer successful", transfer });
    } catch (e) {
      console.error("Transfer send error:", e);
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.get("/api/transfers", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });

      const transfers = await storage.getP2PTransfers(profile.id);

      const enriched = await Promise.all(transfers.map(async (t) => {
        const sender = await storage.getProfile(t.senderProfileId);
        const receiver = await storage.getProfile(t.receiverProfileId);
        return {
          ...t,
          senderName: sender?.fullName || "Unknown",
          receiverName: receiver?.fullName || "Unknown",
          direction: t.senderProfileId === profile.id ? "sent" : "received",
        };
      }));

      res.json(enriched);
    } catch (e) {
      console.error("Get transfers error:", e);
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

      const { rpID, origin } = getWebAuthnConfig(req);
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

      const { rpID, origin } = getWebAuthnConfig(req);
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

      const { rpID } = getWebAuthnConfig(req);
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

      const { rpID, origin } = getWebAuthnConfig(req);
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

  // ============ VIRTUAL CARD (STROWALLET) ============

  const STROWALLET_BASE = "https://strowallet.com/api/bitvcard";
  const strowalletPublicKey = process.env.STROWALLET_PUBLIC_KEY || "";

  // Proxied fetch — routes through static IP proxy when PROXY_URL is set
  async function strowalletFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const proxyUrl = process.env.PROXY_URL;
    if (proxyUrl) {
      const { fetch: undiciFetch } = await import("undici");
      const dispatcher = new ProxyAgent(proxyUrl);
      return undiciFetch(url, { ...options, dispatcher } as any) as unknown as Response;
    }
    return fetch(url, options);
  }

  // GET /api/cards/strowallet-status — check if user is registered as a Strowallet cardholder
  app.get("/api/cards/strowallet-status", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      res.json({
        registered: !!profile.strowalletCustomerId,
        customerId: profile.strowalletCustomerId || null,
      });
    } catch (e) {
      res.status(500).json({ message: "Internal Error" });
    }
  });

  // POST /api/cards/register-cardholder — submit KYC to Strowallet
  app.post("/api/cards/register-cardholder", isAuthenticated, async (req: any, res) => {
    try {
      let profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      if (profile.kycStatus !== "verified") return res.status(403).json({ message: "Complete your Izichanj KYC verification first" });

      if (profile.strowalletCustomerId) {
        return res.json({ success: true, customerId: profile.strowalletCustomerId, alreadyRegistered: true });
      }

      const {
        idType,
        idNumber,
        addressLine1: bodyAddressLine1,
        // Extra fields provided by the form when missing from profile
        firstName: bodyFirstName,
        lastName: bodyLastName,
        dateOfBirth: bodyDob,
        phone: bodyPhone,
      } = req.body;
      if (!idType || !idNumber) return res.status(400).json({ message: "ID type and ID number are required" });

      // Save any missing profile fields provided via the registration form
      const profileUpdates: Record<string, any> = {};
      if (bodyFirstName && !profile.firstName)   profileUpdates.firstName   = bodyFirstName.trim();
      if (bodyLastName  && !profile.lastName)    profileUpdates.lastName    = bodyLastName.trim();
      if (bodyDob       && !profile.dateOfBirth) profileUpdates.dateOfBirth = bodyDob.trim();
      if (bodyPhone     && !profile.phone)       profileUpdates.phone       = bodyPhone.trim();
      if (Object.keys(profileUpdates).length > 0) {
        await storage.updateProfile(profile.id, profileUpdates);
        profile = (await storage.getProfile(profile.id))!; // Reload with updated data
        console.log(`[CARDHOLDER] Updated profile fields for ${profile.email}:`, Object.keys(profileUpdates));
      }

      const kycDoc = await storage.getKyc(profile.id);

      // Derive name from profile — fall back to splitting fullName
      const nameParts = (profile.fullName || "").trim().split(/\s+/);
      const firstName = profile.firstName || nameParts[0] || "";
      const lastName  = profile.lastName  || nameParts.slice(1).join(" ") || firstName;
      const dob = profile.dateOfBirth || "";
      const phone = profile.phone || "";
      const addressLine1 = bodyAddressLine1 || kycDoc?.addressLine1 || profile.city || "";

      if (!firstName || !lastName) {
        return res.status(400).json({ message: "First name and last name are required. Please complete your profile." });
      }
      if (!dob) {
        return res.status(400).json({ message: "Date of birth is required for card verification." });
      }
      if (!phone) {
        return res.status(400).json({ message: "Phone number is required for card verification." });
      }

      // Compress KYC images server-side — Strowallet rejects images > 2 MB
      const [compressedIdImage, compressedSelfie] = await Promise.all([
        ensureKycImageSize(kycDoc?.idDocumentUrl || ""),
        ensureKycImageSize(kycDoc?.selfieUrl || ""),
      ]);

      // Strowallet expects camelCase field names (confirmed from API error response)
      const payload = {
        public_key: strowalletPublicKey,
        firstName,
        lastName,
        customerEmail: profile.email,
        phoneNumber: phone,
        dateOfBirth: dob,
        // Hardcoded US billing address — required by Strowallet for card issuance
        country: "US",
        line1: "3401 N Miami Ave Ste 230",
        houseNumber: "3401",
        city: "Miami",
        state: "FL",
        zipCode: "33127",
        idType,
        idNumber,
        userPhoto: compressedSelfie,
        idImage: compressedIdImage,
      };

      console.log("[STROWALLET][CARDHOLDER] Registering:", { email: profile.email, idType });

      const response = await strowalletFetch(`${STROWALLET_BASE}/create-user/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json() as any;
      console.log("[STROWALLET][CARDHOLDER] Response:", JSON.stringify(data));

      // Check both status and success fields — Strowallet uses {success:false} not always {status:"error"}
      if (!response.ok || data.success === false || data.status === "error" || data.status === false) {
        const rawMsg = data.message || data.error || "";
        const msgStr = typeof rawMsg === "object" ? JSON.stringify(rawMsg) : String(rawMsg);
        
        // "Email already taken" means user was previously registered in Strowallet
        // Give helpful guidance to use the manual entry feature
        if (msgStr.toLowerCase().includes("already been taken") || msgStr.toLowerCase().includes("already taken") || msgStr.toLowerCase().includes("already exists")) {
          return res.status(409).json({
            alreadyRegistered: true,
            message: "This email is already registered in Strowallet. Please use the 'Already Registered?' option below and enter your Strowallet Customer ID.",
          });
        }
        return res.status(400).json({ message: `KYC registration failed: ${msgStr}` });
      }

      const customerId = data.response?.customerId || data.response?.customer_id || data.customer_id || data.customerId || data.data?.customer_id;
      if (!customerId) {
        return res.status(500).json({ message: "Strowallet returned no customer_id. Raw: " + JSON.stringify(data) });
      }
      await storage.updateProfile(profile.id, { strowalletCustomerId: customerId });

      // Telegram — user is now ready for virtual card
      sendTelegramMessage(
        `✅ <b>User Ready for Virtual Card</b>\n\n` +
        `👤 <b>Name:</b> ${profile.fullName}\n` +
        `📧 <b>Email:</b> ${profile.email}\n` +
        `🆔 <b>User ID:</b> ${profile.referenceId || profile.id}\n` +
        `🏦 <b>Strowallet ID:</b> <code>${customerId}</code>\n\n` +
        `💳 This user can now create a virtual Visa card.`
      ).catch(() => {});

      res.json({ success: true, customerId });
    } catch (e: any) {
      console.error("[STROWALLET][CARDHOLDER] Error:", e);
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  // POST /api/cards/set-strowallet-customer-id — manually set Strowallet ID when already registered
  app.post("/api/cards/set-strowallet-customer-id", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      if (profile.kycStatus !== "verified") return res.status(403).json({ message: "Complete your Izichanj KYC verification first" });

      if (profile.strowalletCustomerId) {
        return res.json({ success: true, customerId: profile.strowalletCustomerId, alreadySet: true });
      }

      const { strowalletCustomerId } = req.body;
      if (!strowalletCustomerId || typeof strowalletCustomerId !== "string" || !strowalletCustomerId.trim()) {
        return res.status(400).json({ message: "Strowallet Customer ID is required" });
      }

      const customerId = strowalletCustomerId.trim();
      await storage.updateProfile(profile.id, { strowalletCustomerId: customerId });

      console.log(`[CARDHOLDER] Set Strowallet ID for ${profile.email}:`, customerId);

      // Telegram notification
      sendTelegramMessage(
        `✅ <b>User Linked to Strowallet</b>\n\n` +
        `👤 <b>Name:</b> ${profile.fullName}\n` +
        `📧 <b>Email:</b> ${profile.email}\n` +
        `🆔 <b>User ID:</b> ${profile.referenceId || profile.id}\n` +
        `🏦 <b>Strowallet ID:</b> <code>${customerId}</code>\n\n` +
        `💳 This user can now create a virtual Visa card.`
      ).catch(() => {});

      res.json({ success: true, customerId, source: "manual" });
    } catch (e: any) {
      console.error("[CARDHOLDER] Set Strowallet ID Error:", e);
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  app.get("/api/cards", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      const cards = await storage.getVirtualCards(profile.id);
      res.json(cards);
    } catch (e) {
      console.error("Get cards error:", e);
      res.status(500).json({ message: "Internal Error" });
    }
  });

  app.post("/api/cards/create", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      if (profile.kycStatus !== "verified") return res.status(403).json({ message: "KYC verification required before applying for a virtual card" });

      if (!strowalletPublicKey) {
        return res.status(500).json({ message: "Card service not configured" });
      }

      // ── Flat pricing ──────────────────────────────────────────────────
      // User pays exactly $19.00. $4.00 → card, rest covers Strowallet
      // fixed/variable fees and Izichanj margin (variable absorbed internally).
      const breakdown = calcCardCreationCost(CARD_LOAD_AMOUNT_USD);
      const CARD_COST_USD          = breakdown.total;       // flat $19.00
      const STROWALLET_FUND_AMOUNT = breakdown.loadAmount;  // $4.00 → loaded on card

      const balanceUsdt = parseFloat(profile.balance || "0");
      if (balanceUsdt < CARD_COST_USD) {
        return res.status(400).json({ message: `Insufficient balance. You need $${CARD_COST_USD.toFixed(2)} USDT to apply for a virtual card. Your current balance is $${balanceUsdt.toFixed(2)} USDT.` });
      }

      const fundAmount = STROWALLET_FUND_AMOUNT; // What Strowallet loads onto the card

      const nameOnCard = `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || profile.fullName;

      if (!profile.strowalletCustomerId) {
        return res.status(400).json({ message: "Please complete the card KYC registration first before applying for a virtual card." });
      }

      const createCardPayload: Record<string, string> = {
        name_on_card: nameOnCard,
        card_type: "visa",
        public_key: strowalletPublicKey,
        amount: fundAmount.toString(),
        customerEmail: profile.email,
        customer_id: profile.strowalletCustomerId,
      };

      const response = await strowalletFetch(`${STROWALLET_BASE}/create-card/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(createCardPayload),
      });

      const data = await response.json();
      console.log("==================== [STROWALLET CREATE-CARD] ====================");
      console.log("[STROWALLET] HTTP status:", response.status);
      console.log("[STROWALLET] Request payload:", JSON.stringify(createCardPayload, null, 2));
      console.log("[STROWALLET] Raw response:", JSON.stringify(data, null, 2));
      console.log("==================================================================");

      if (!response.ok || data.status === "error" || data.status === false) {
        // Safely convert to string — Strowallet sometimes returns objects instead of strings
        const rawErr = data.message ?? data.error ?? data.errors ?? "";
        const rawMsg = String(typeof rawErr === "object" ? JSON.stringify(rawErr) : rawErr).toLowerCase();

        console.log("[STROWALLET] Create card error rawMsg:", rawMsg);

        const isProviderNoFunds =
          rawMsg.includes("insufficient") || rawMsg.includes("no fund") ||
          rawMsg.includes("not enough") || rawMsg.includes("low balance") ||
          rawMsg.includes("balance") || rawMsg.includes("wallet");

        // ── KYC not yet approved by Strowallet ───────────────────────────────
        if (rawMsg.includes("kyc") && (rawMsg.includes("not approved") || rawMsg.includes("complete") || rawMsg.includes("process"))) {
          sendTelegramMessage(
            `❌ <b>Card Creation Failed — KYC Pending</b>\n\n` +
            `👤 <b>User:</b> ${profile.fullName}\n` +
            `📧 <b>Email:</b> ${profile.email}\n` +
            `⚠️ <b>Reason:</b> Strowallet KYC not yet approved`
          ).catch(() => {});
          return res.status(422).json({
            code: "STROWALLET_KYC_PENDING",
            message: "Your card application is under review by our card provider. This process can take up to 48 hours after KYC approval. You will be notified once you can apply.",
          });
        }

        // ── Strowallet master account has insufficient funds ──────────────────
        if (isProviderNoFunds) {
          // Deduct the full $30 user charge from their balance (funds are held pending card issuance)
          const newBalance = balanceUsdt - CARD_COST_USD;
          await storage.updateProfileBalance(profile.id, newBalance);

          // Store CARD_COST_USD ($30) in balance so refund returns the full amount user paid
          const pendingCard = await storage.createVirtualCard({
            profileId: profile.id,
            cardId: `pending_${Date.now()}`,
            cardType: "visa",
            nameOnCard,
            last4: null,
            brand: "Visa",
            status: "pending",
            balance: CARD_COST_USD.toString(),
            currency: "USD",
            cardDetail: { pendingReason: "provider_no_funds", requestedAt: new Date().toISOString() },
          });

          // In-app notification for the user
          await storage.createNotification({
            profileId: profile.id,
            type: "custom_message",
            title: "Card Request Received",
            message: "Your card request has been received and is currently being processed. Please check back in 24 hours for your card details. Thank you for choosing Izichanj!",
          }).catch(() => {});

          // Urgent Telegram alert to admin
          sendTelegramMessage(
            `🚨🚨 <b>ACTION REQUIRED — Low Master Balance</b>\n\n` +
            `A user is waiting for card issuance but your Strowallet account has insufficient funds.\n\n` +
            `👤 <b>User:</b> ${profile.fullName}\n` +
            `📧 <b>Email:</b> ${profile.email}\n` +
            `📞 <b>Phone:</b> ${profile.phone || "—"}\n` +
            `🪪 <b>Strowallet ID:</b> ${profile.strowalletCustomerId}\n` +
            `💵 <b>User charged:</b> $${CARD_COST_USD.toFixed(2)} USDT (card loaded with $${fundAmount.toFixed(2)})\n` +
            `💰 <b>Remaining balance:</b> $${newBalance.toFixed(2)} USDT\n` +
            `🗂 <b>Pending card ID:</b> ${pendingCard.id}\n\n` +
            `👉 <b>Fund your Strowallet account, then issue the card manually or re-trigger card creation.</b>\n` +
            `🔗 https://strowallet.com`
          ).catch(() => {});

          return res.status(202).json({
            pending: true,
            message: "Your card request has been received and is currently being processed. Please check back in 24 hours for your card details. Thank you for choosing Izichanj!",
            card: pendingCard,
          });
        }

        // ── All other Strowallet errors ───────────────────────────────────────
        const friendlyErr = rawMsg || "Unknown error from card provider";
        sendTelegramMessage(
          `❌ <b>Card Creation Failed</b>\n\n` +
          `👤 <b>User:</b> ${profile.fullName}\n` +
          `📧 <b>Email:</b> ${profile.email}\n` +
          `📞 <b>Phone:</b> ${profile.phone || "—"}\n` +
          `💵 <b>Amount:</b> $${CARD_COST_USD.toFixed(2)} USDT\n` +
          `💰 <b>User balance:</b> $${balanceUsdt.toFixed(2)} USDT\n` +
          `⚠️ <b>Error:</b> ${friendlyErr}\n` +
          `📋 <b>Full response:</b>\n<pre>${JSON.stringify(data, null, 2).slice(0, 600)}</pre>\n\n` +
          `👉 Review this card request manually or contact Strowallet support.`
        ).catch(() => {});

        return res.status(400).json({ message: friendlyErr || "Failed to create virtual card" });
      }

      const cardInfo = data.response || data.data || data;
      const cardId = cardInfo.card_id || cardInfo.id || `stro_${Date.now()}`;
      const last4 = cardInfo.card_number ? cardInfo.card_number.slice(-4) : cardInfo.last4 || null;

      // Deduct the full $30 user charge (fundAmount $20 goes to card, $10 is Izichanj's activation fee)
      const newBalance = balanceUsdt - CARD_COST_USD;
      await storage.updateProfileBalance(profile.id, newBalance);

      const card = await storage.createVirtualCard({
        profileId: profile.id,
        cardId: String(cardId),
        cardType: "visa",
        nameOnCard,
        last4,
        brand: "Visa",
        status: "active",
        balance: fundAmount.toString(), // $20 — the actual card loaded balance shown to user
        currency: "USD",
        cardDetail: cardInfo,
      });

      res.status(201).json(card);
    } catch (e: any) {
      console.error("Create card error:", e);
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  // POST /api/cards/:id/cancel — user cancels a pending card and gets an instant refund
  app.post("/api/cards/:id/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });

      const cardDbId = Number(req.params.id);

      // ATOMIC: only mark cancelled if card belongs to this user AND is still pending.
      // This prevents double-refunds from rapid clicks or concurrent requests.
      const cancelled = await db
        .update(virtualCards)
        .set({ status: "cancelled" })
        .where(and(
          eq(virtualCards.id, cardDbId),
          eq(virtualCards.profileId, profile.id),
          eq(virtualCards.status, "pending"),
        ))
        .returning({ balance: virtualCards.balance });

      if (cancelled.length === 0) {
        // Either card not found, not owned by this user, or already cancelled/active
        return res.status(409).json({ message: "This card cannot be cancelled — it may have already been cancelled or is now active." });
      }

      // Refund the held amount back to user balance (only reached once per card)
      const refundAmount = parseFloat(cancelled[0].balance || "20");
      const currentBalance = parseFloat(profile.balance || "0");
      const newBalance = currentBalance + refundAmount;

      await storage.updateProfileBalance(profile.id, newBalance);

      // In-app notification
      await storage.createNotification({
        profileId: profile.id,
        type: "custom_message",
        title: "Virtual Card Cancelled — Refund Issued",
        message: `Your virtual card application has been cancelled and $${refundAmount.toFixed(2)} USDT has been instantly refunded to your balance.`,
      }).catch(() => {});

      // WhatsApp notification
      if (profile.phone) {
        sendWhatsAppNotification(
          profile.phone,
          `*Izichanj*\n\n❌ Virtual card request cancelled.\n\n💵 $${refundAmount.toFixed(2)} USDT has been refunded to your balance.\n\nYou can apply for a new card anytime from the Virtual Cards section.\n\nhttps://izichanj.com`,
          profile.fullName
        );
      }

      // Telegram alert
      sendTelegramMessage(
        `🔴 <b>Pending Card Cancelled (User Initiated)</b>\n\n` +
        `👤 <b>User:</b> ${profile.fullName}\n` +
        `📧 <b>Email:</b> ${profile.email}\n` +
        `💵 <b>Refunded:</b> $${refundAmount.toFixed(2)} USDT\n` +
        `💰 <b>New Balance:</b> $${newBalance.toFixed(2)} USDT\n` +
        `🗂 <b>Card DB ID:</b> #${cardDbId}`
      ).catch(() => {});

      res.json({ success: true, refunded: refundAmount, newBalance });
    } catch (e: any) {
      console.error("[cancel card]", e);
      res.status(500).json({ message: e.message });
    }
  });

  // DELETE /api/cards/:id — user permanently deletes a card from their account
  // - Pending cards: refund $30 (the card hasn't been issued yet)
  // - Active/Frozen cards: no refund (card was already issued and used)
  app.delete("/api/cards/:id", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });

      const cardDbId = Number(req.params.id);
      const card = await storage.getVirtualCard(cardDbId, profile.id);
      if (!card) return res.status(404).json({ message: "Card not found" });

      let refunded = 0;

      // Refund for pending cards that haven't been issued yet
      if (card.status === "pending") {
        const refundAmount = parseFloat(card.balance || "20") || 20;
        const currentBalance = parseFloat(profile.balance || "0");
        await storage.updateProfileBalance(profile.id, currentBalance + refundAmount);
        refunded = refundAmount;

        await storage.createNotification({
          profileId: profile.id,
          type: "custom_message",
          title: "Virtual Card Deleted — Refund Issued",
          message: `Your pending virtual card has been deleted and $${refundAmount.toFixed(2)} USDT has been refunded to your balance.`,
        }).catch(() => {});

        sendTelegramMessage(
          `🗑️ <b>Pending Card Deleted (User)</b>\n\n` +
          `👤 ${profile.fullName}\n📧 ${profile.email}\n` +
          `💵 <b>Refunded:</b> $${refundAmount.toFixed(2)} USDT\n` +
          `🗂 Card DB ID: #${cardDbId}`
        ).catch(() => {});
      } else {
        sendTelegramMessage(
          `🗑️ <b>Card Deleted (User)</b>\n\n` +
          `👤 ${profile.fullName}\n📧 ${profile.email}\n` +
          `📋 <b>Status was:</b> ${card.status}\n` +
          `🃏 <b>Last4:</b> ${card.last4 || "N/A"}\n` +
          `🗂 Card DB ID: #${cardDbId}`
        ).catch(() => {});
      }

      await storage.deleteVirtualCard(cardDbId, profile.id);
      res.json({ success: true, refunded });
    } catch (e: any) {
      console.error("[delete card]", e);
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  // POST /api/cards/:id/user-retry — user retries Strowallet card creation (no balance re-deduction)
  app.post("/api/cards/:id/user-retry", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });

      const card = await storage.getVirtualCard(Number(req.params.id), profile.id);
      if (!card) return res.status(404).json({ message: "Card not found" });
      if (card.status !== "pending") {
        return res.status(400).json({ message: "Card is not in pending status." });
      }
      if (!profile.strowalletCustomerId) {
        return res.status(400).json({ message: "No Strowallet customer account linked. Please contact support." });
      }

      const _stroBase = "https://strowallet.com/api/bitvcard";
      const _stroKey = process.env.STROWALLET_PUBLIC_KEY || "";

      // NOTE: No balance deduction — the full charge was already deducted when the pending card was created.
      // Strowallet receives the configured load amount (Strowallet enforces $5 minimum).
      const fundAmount = CARD_LOAD_AMOUNT_USD;

      const payload: Record<string, string> = {
        name_on_card: card.nameOnCard || profile.fullName,
        card_type: "visa",
        public_key: _stroKey,
        amount: fundAmount.toString(),
        customerEmail: profile.email,
        customer_id: profile.strowalletCustomerId,
      };

      const response = await strowalletFetch(`${_stroBase}/create-card/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log("[USER RETRY CARD] Strowallet response:", JSON.stringify(data, null, 2));

      if (!response.ok || data.status === "error" || data.status === false) {
        const rawErr = data.message ?? data.error ?? data.errors ?? data;
        const errMsg = typeof rawErr === "string" ? rawErr : JSON.stringify(rawErr);
        return res.status(400).json({ success: false, message: errMsg });
      }

      // Success — activate card in DB
      const cardInfo = data.response || data.data || data;
      const newCardId = cardInfo.card_id || cardInfo.id || `stro_${Date.now()}`;
      const last4 = cardInfo.card_number ? String(cardInfo.card_number).slice(-4) : cardInfo.last4 || null;

      await storage.updateVirtualCard(card.id, {
        cardId: String(newCardId),
        last4,
        status: "active",
        cardDetail: cardInfo,
      });

      await storage.createNotification({
        profileId: profile.id,
        type: "custom_message",
        title: "Your Virtual Card is Ready! 💳",
        message: "Your Visa virtual card has been issued. You can now view your card details.",
      }).catch(() => {});

      if (profile.phone) {
        sendWhatsAppNotification(
          profile.phone,
          `*Izichanj*\n\n💳 Your virtual card is ready!\n\nYour Visa virtual card has been successfully issued. Log in to view your card details.\n\nhttps://izichanj.com`,
          profile.fullName
        );
      }

      sendTelegramMessage(
        `✅ <b>Pending Card Issued (User Retry)</b>\n\n` +
        `👤 <b>User:</b> ${profile.fullName}\n` +
        `📧 <b>Email:</b> ${profile.email}\n` +
        `💳 <b>Card ID:</b> ${newCardId}\n` +
        `🔢 <b>Last 4:</b> ${last4 || "N/A"}`
      ).catch(() => {});

      res.json({ success: true, message: "Card issued successfully!", cardId: newCardId, last4 });
    } catch (e: any) {
      console.error("[user retry card]", e);
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/cards/:id/check-status — user polls Strowallet to see if their pending card was created
  app.post("/api/cards/:id/check-status", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });

      const card = await storage.getVirtualCard(Number(req.params.id), profile.id);
      if (!card) return res.status(404).json({ message: "Card not found" });

      // If already active, just return that
      if (card.status === "active") {
        return res.json({ found: true, card, message: "Your card is already active." });
      }
      if (card.status !== "pending") {
        return res.json({ found: false, message: `Card status is '${card.status}'.` });
      }

      if (!profile.strowalletCustomerId) {
        return res.json({ found: false, message: "No Strowallet customer linked to your account." });
      }

      const _stroBase = "https://strowallet.com/api/bitvcard";
      const _stroKey = process.env.STROWALLET_PUBLIC_KEY || "";

      // Try Strowallet's list-card endpoint to see if the card was created on their side
      let stroCard: any = null;
      try {
        const listRes = await strowalletFetch(`${_stroBase}/list-card/`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({
            public_key: _stroKey,
            customer_id: profile.strowalletCustomerId,
          }),
        });
        const listData = await listRes.json();
        console.log("[CHECK CARD STATUS] Strowallet list-card response:", JSON.stringify(listData));

        // Strowallet may return array or object with cards array
        const cards: any[] = Array.isArray(listData.response)
          ? listData.response
          : Array.isArray(listData.data)
          ? listData.data
          : Array.isArray(listData)
          ? listData
          : listData.cards || [];

        // Find a card that isn't already tracked (not our pending marker ID)
        stroCard = cards.find((c: any) =>
          c.card_id && !String(c.card_id).startsWith("pending_")
        ) || null;
      } catch (e) {
        console.warn("[CHECK CARD STATUS] list-card call failed:", e);
      }

      if (stroCard) {
        // Card found on Strowallet — activate it in our DB
        const newCardId = stroCard.card_id || stroCard.id;
        const last4 = stroCard.card_number ? String(stroCard.card_number).slice(-4) : stroCard.last4 || null;
        const updatedCard = await storage.updateVirtualCard(card.id, {
          cardId: String(newCardId),
          last4,
          status: "active",
          cardDetail: stroCard,
        });

        // In-app notification
        await storage.createNotification({
          profileId: profile.id,
          type: "custom_message",
          title: "Your Virtual Card is Ready! 💳",
          message: "Your Visa virtual card has been issued. You can now view your card details.",
        }).catch(() => {});

        sendTelegramMessage(
          `✅ <b>Pending Card Self-Resolved (User Check)</b>\n\n` +
          `👤 <b>User:</b> ${profile.fullName}\n` +
          `📧 <b>Email:</b> ${profile.email}\n` +
          `💳 <b>Card ID:</b> ${newCardId}\n` +
          `🔢 <b>Last 4:</b> ${last4 || "N/A"}`
        ).catch(() => {});

        return res.json({ found: true, card: updatedCard, message: "Your card is ready!" });
      }

      // Card not found on Strowallet yet
      return res.json({ found: false, message: "Your card is still being processed. Please check again later or contact support." });
    } catch (e: any) {
      console.error("[check card status]", e);
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/cards/:id/fund", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });

      const card = await storage.getVirtualCard(Number(req.params.id), profile.id);
      if (!card) return res.status(404).json({ message: "Card not found" });

      const { amount } = req.body;
      const fundAmount = parseFloat(amount);
      if (isNaN(fundAmount) || fundAmount < CARD_TOPUP_MIN_USD) {
        return res.status(400).json({ message: `Minimum funding is $${CARD_TOPUP_MIN_USD.toFixed(2)} USD` });
      }

      // ── Top-up pricing ───────────────────────────────────────────────
      // Total = fundAmount + $2.15 fixed ($0.25 Izichanj + $1.90 Strowallet) + 1.9% Strowallet variable
      const breakdown = calcCardTopUpCost(fundAmount);
      const totalCharge = breakdown.total;

      const balanceUsdt = parseFloat(profile.balance || "0");
      if (totalCharge > balanceUsdt) {
        return res.status(400).json({ message: `Insufficient USDT balance. You need $${totalCharge.toFixed(2)} USDT ($${fundAmount.toFixed(2)} to card + $${breakdown.fixedFee.toFixed(2)} fee + $${breakdown.variableFee.toFixed(2)} network fee). Your current balance is $${balanceUsdt.toFixed(2)} USDT.` });
      }

      const response = await strowalletFetch(`${STROWALLET_BASE}/fund-card/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          card_id: card.cardId,
          amount: fundAmount.toString(),  // Strowallet still receives the load amount
          public_key: strowalletPublicKey,
        }),
      });

      const data = await response.json();
      console.log("[STROWALLET] Fund card response:", JSON.stringify(data));

      if (!response.ok || data.status === "error" || data.status === false) {
        return res.status(400).json({ message: data.message || data.error || "Failed to fund card" });
      }

      // Deduct the FULL charge (load + fixed + variable fees) from user's wallet
      const newBalance = balanceUsdt - totalCharge;
      await storage.updateProfileBalance(profile.id, newBalance);

      const currentCardBalance = parseFloat(card.balance || "0");
      const updatedCard = await storage.updateVirtualCard(card.id, {
        balance: (currentCardBalance + fundAmount).toString(),
      });

      // Log local funding transaction so it appears in card history
      await storage.createCardTransaction({
        cardId: card.id,
        profileId: profile.id,
        type: "fund",
        amount: fundAmount.toFixed(2),
        currency: "USD",
        description: `Card funded — $${fundAmount.toFixed(2)} USD added (total charged $${totalCharge.toFixed(2)} incl. $${breakdown.fixedFee.toFixed(2)} fee + $${breakdown.variableFee.toFixed(2)} network)`,
      });

      res.json(updatedCard);
    } catch (e: any) {
      console.error("Fund card error:", e);
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  app.get("/api/cards/:id/details", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });

      const card = await storage.getVirtualCard(Number(req.params.id), profile.id);
      if (!card) return res.status(404).json({ message: "Card not found" });

      const response = await strowalletFetch(`${STROWALLET_BASE}/fetch-card-detail/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          card_id: card.cardId,
          public_key: strowalletPublicKey,
        }),
      });

      const data = await response.json();
      if (!response.ok || data.success === false || data.status === "error" || data.status === false) {
        console.log("[CARD DETAIL] Strowallet error response:", JSON.stringify(data));
        return res.json({ card, remoteDetail: null });
      }

      // Strowallet wraps card details one level deeper: data.response.card_detail
      const detail = data.response?.card_detail || data.response || data.data || data;
      console.log("[CARD DETAIL] Strowallet detail keys:", Object.keys(detail || {}));
      if (detail.balance !== undefined) {
        await storage.updateVirtualCard(card.id, {
          balance: String(detail.balance),
          cardDetail: detail,
        });
      }

      res.json({ card, remoteDetail: detail });
    } catch (e: any) {
      console.error("Fetch card detail error:", e);
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  // POST /api/cards/:id/refresh-balance — sync card balance from Strowallet and update DB
  app.post("/api/cards/:id/refresh-balance", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });

      const card = await storage.getVirtualCard(Number(req.params.id), profile.id);
      if (!card) return res.status(404).json({ message: "Card not found" });
      if (card.status === "pending" || card.status === "cancelled") {
        return res.status(400).json({ message: "Cannot refresh balance for a pending or cancelled card" });
      }

      const response = await strowalletFetch(`${STROWALLET_BASE}/fetch-card-detail/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ card_id: card.cardId, public_key: strowalletPublicKey }),
      });

      const data = await response.json();
      const detail = data.response?.card_detail || data.response || data.data || data;

      if (detail?.balance !== undefined && detail?.balance !== null) {
        const newBalance = String(detail.balance);
        await storage.updateVirtualCard(card.id, { balance: newBalance, cardDetail: detail });
        console.log(`[REFRESH BALANCE] Card ${card.id}: ${card.balance} → ${newBalance}`);
        return res.json({ balance: newBalance, synced: true });
      }

      // If Strowallet didn't return a balance, just return the stored one
      return res.json({ balance: card.balance, synced: false });
    } catch (e: any) {
      console.error("Refresh balance error:", e);
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  app.get("/api/cards/:id/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });

      const card = await storage.getVirtualCard(Number(req.params.id), profile.id);
      if (!card) return res.status(404).json({ message: "Card not found" });

      const response = await strowalletFetch(`${STROWALLET_BASE}/card-transactions/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          card_id: card.cardId,
          public_key: strowalletPublicKey,
        }),
      });

      const data = await response.json();
      console.log("[CARD TX] card_id:", card.cardId, "| response keys:", Object.keys(data || {}), "| success:", data?.success, "| status:", data?.status);

      if (!response.ok) {
        console.log("[CARD TX] HTTP error:", response.status, JSON.stringify(data));
        // Still return local transactions even if Strowallet fails
        const localOnly = await storage.getCardTransactions(card.id, profile.id);
        return res.json(localOnly.map((lt) => ({
          id: `local_${lt.id}`,
          type: lt.type,
          amount: lt.amount,
          currency: lt.currency,
          description: lt.description,
          date: lt.createdAt,
          source: "local",
        })));
      }

      // Log full structure for debugging (first time only)
      if (data && typeof data === "object") {
        console.log("[CARD TX] Full response (truncated):", JSON.stringify(data).slice(0, 800));
      }

      // Don't abort on success=false — Strowallet sometimes returns false even with data
      // Strowallet may return transactions nested in many different ways
      function findArray(obj: any, depth = 0): any[] | null {
        if (depth > 4) return null;
        if (Array.isArray(obj)) return obj;
        if (obj && typeof obj === "object") {
          for (const key of ["transactions", "data", "items", "records", "list", "response"]) {
            const found = findArray(obj[key], depth + 1);
            if (found) return found;
          }
        }
        return null;
      }

      const txList =
        Array.isArray(data.response?.card_transactions) ? data.response.card_transactions :
        Array.isArray(data.response) ? data.response :
        Array.isArray(data.response?.transactions) ? data.response.transactions :
        Array.isArray(data.response?.data) ? data.response.data :
        Array.isArray(data.response?.data?.transactions) ? data.response.data.transactions :
        Array.isArray(data.card_transactions) ? data.card_transactions :
        Array.isArray(data.data) ? data.data :
        Array.isArray(data.data?.transactions) ? data.data.transactions :
        Array.isArray(data.transactions) ? data.transactions :
        findArray(data) ?? [];

      console.log("[CARD TX] Found", txList.length, "Strowallet transactions");

      // Auto-sync balance from the transaction response if provided
      const latestBalance = data.response?.balance ?? data.balance ?? null;
      if (latestBalance !== null && latestBalance !== undefined) {
        await storage.updateVirtualCard(card.id, { balance: String(latestBalance) });
      }

      // Merge local funding records (from our DB) with Strowallet spending records
      const localTxns = await storage.getCardTransactions(card.id, profile.id);
      const localFormatted = localTxns.map((lt) => ({
        id: `local_${lt.id}`,
        type: lt.type,
        amount: lt.amount,
        currency: lt.currency,
        description: lt.description,
        date: lt.createdAt,
        source: "local",
      }));

      // Normalise Strowallet transactions so they have a consistent shape
      const stroFormatted = txList.map((t: any) => ({ ...t, source: "strowallet" }));

      // Merge and sort: newest first
      const merged = [...localFormatted, ...stroFormatted].sort((a: any, b: any) => {
        const da = new Date(a.date || a.created_at || a.transaction_date || 0).getTime();
        const db2 = new Date(b.date || b.created_at || b.transaction_date || 0).getTime();
        return db2 - da;
      });

      console.log("[CARD TX] Returning", merged.length, "total (local:", localFormatted.length, "+ strowallet:", stroFormatted.length, ")");
      res.json(merged);
    } catch (e: any) {
      console.error("Card transactions error:", e);
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  app.post("/api/cards/:id/freeze", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });

      const card = await storage.getVirtualCard(Number(req.params.id), profile.id);
      if (!card) return res.status(404).json({ message: "Card not found" });

      const newStatus = card.status === "frozen" ? "active" : "frozen";
      const updatedCard = await storage.updateVirtualCard(card.id, { status: newStatus });
      res.json(updatedCard);
    } catch (e: any) {
      console.error("Freeze card error:", e);
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  // ════════════════════════════════════════════════════════════════════════
  //  NFC VIRTUAL CARD SERVICE  (Strowallet BitVCard NFC)
  //  Runs alongside the standard virtual card. Apple Pay & Google Pay ready.
  //  Pricing:
  //    • Issuance: flat $19 (user) → $5 to card, fees absorbed/profit
  //    • Funding:  amount + ($1.90 + 1.9%) Strowallet fees + $0.25 Izichanj
  //    • Withdraw: amount → wallet, $1 service fee
  // ════════════════════════════════════════════════════════════════════════

  // List the user's NFC cards
  app.get("/api/nfc-cards", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      const cards = await storage.getNfcCards(profile.id);
      res.json(cards);
    } catch (e: any) {
      console.error("[NFC] list error:", e);
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  // Create a new NFC card — flat $19 charge, $5 to card, no separate cardholder needed
  app.post("/api/nfc-cards/create", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      if (profile.kycStatus !== "verified") {
        return res.status(403).json({ message: "KYC verification required before applying for an NFC card" });
      }
      if (!strowalletPublicKey) {
        return res.status(500).json({ message: "NFC card service not configured" });
      }

      const breakdown = calcNfcCardCreationCost(NFC_CARD_LOAD_AMOUNT_USD);
      const COST_USD = breakdown.total;       // flat $19
      const LOAD_USD = breakdown.loadAmount;  // $5 to card

      const balanceUsdt = parseFloat(profile.balance || "0");
      if (balanceUsdt < COST_USD) {
        return res.status(400).json({ message: `Insufficient balance. NFC cards cost $${COST_USD.toFixed(2)} USDT. Your balance: $${balanceUsdt.toFixed(2)} USDT.` });
      }

      const firstName = profile.firstName || profile.fullName.split(" ")[0] || "";
      const lastName  = profile.lastName  || profile.fullName.split(" ").slice(1).join(" ") || firstName;
      const nameOnCard = `${firstName} ${lastName}`.trim() || profile.fullName;

      // BitVCard NFC create — no cardholder pre-registration; profile data inline
      const payload: Record<string, string> = {
        public_key: strowalletPublicKey,
        name_on_card: nameOnCard,
        amount: LOAD_USD.toString(),
        firstName,
        lastName,
        customerEmail: profile.email,
        phoneNumber: profile.phone || "",
        dateOfBirth: profile.dateOfBirth || "",
        country: profile.country || "US",
        city: profile.city || "Miami",
      };

      const response = await strowalletFetch(`${STROWALLET_BASE}/create-nfc-card/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      const failed = !response.ok || data.status === "error" || data.status === false || data.success === false;
      if (failed) {
        // Only log full request/response on errors — payload contains PII
        const safePayload = { ...payload, dateOfBirth: "[REDACTED]", phoneNumber: payload.phoneNumber ? "***" + payload.phoneNumber.slice(-4) : "" };
        console.log("================== [STROWALLET CREATE-NFC-CARD ERROR] ==================");
        console.log("[NFC] HTTP status:", response.status);
        console.log("[NFC] Request payload (PII redacted):", JSON.stringify(safePayload, null, 2));
        console.log("[NFC] Raw response (full):", JSON.stringify(data, null, 2));
        console.log("=========================================================================");
      } else {
        console.log("[NFC] create-nfc-card OK — profile:", profile.id, "http:", response.status);
      }

      if (failed) {
        const rawErr = data.message ?? data.error ?? data.errors ?? data;
        const errMsg = typeof rawErr === "string" ? rawErr : JSON.stringify(rawErr);
        const lower = errMsg.toLowerCase();
        const isProviderNoFunds =
          lower.includes("insufficient") || lower.includes("no fund") ||
          lower.includes("not enough") || lower.includes("low balance") ||
          (lower.includes("balance") && lower.includes("wallet"));

        if (isProviderNoFunds) {
          // Master wallet low — hold funds, mark pending, alert admin
          const newBalance = balanceUsdt - COST_USD;
          await storage.updateProfileBalance(profile.id, newBalance);
          const pending = await storage.createNfcCard({
            profileId: profile.id,
            cardId: `pending_nfc_${Date.now()}`,
            nameOnCard,
            brand: "Visa",
            status: "pending",
            balance: COST_USD.toString(),
            currency: "USD",
            cardDetail: { pendingReason: "provider_no_funds", requestedAt: new Date().toISOString() },
          });
          await storage.createNotification({
            profileId: profile.id,
            type: "custom_message",
            title: "NFC Card Request Received",
            message: "Your contactless NFC card is being prepared. Check back within 24 hours for your card details.",
          }).catch(() => {});
          sendTelegramMessage(
            `🚨 <b>NFC CARD — Master Wallet Low</b>\n\n` +
            `👤 ${profile.fullName} (${profile.email})\n` +
            `💵 Charged $${COST_USD.toFixed(2)} USDT\n` +
            `🗂 Pending NFC card #${pending.id}\n\n` +
            `👉 Fund Strowallet, then issue manually.`
          ).catch(() => {});
          return res.status(202).json({
            pending: true,
            message: "Your NFC card request was received and is being processed. Check back within 24 hours.",
            card: pending,
          });
        }

        sendTelegramMessage(
          `❌ <b>NFC Card Creation Failed</b>\n\n` +
          `👤 ${profile.fullName} (${profile.email})\n` +
          `⚠️ <b>Error:</b> <code>${errMsg.slice(0, 200)}</code>\n` +
          `📋 <pre>${JSON.stringify(data, null, 2).slice(0, 600)}</pre>`
        ).catch(() => {});
        return res.status(400).json({ message: errMsg || "Failed to create NFC card" });
      }

      const cardInfo = data.response || data.data || data;
      const cardId = cardInfo.card_id || cardInfo.id || cardInfo.cardId || `nfc_${Date.now()}`;
      const last4 = cardInfo.card_number ? String(cardInfo.card_number).slice(-4) : cardInfo.last4 || null;

      const newBalance = balanceUsdt - COST_USD;
      await storage.updateProfileBalance(profile.id, newBalance);

      const card = await storage.createNfcCard({
        profileId: profile.id,
        cardId: String(cardId),
        nameOnCard,
        last4,
        brand: "Visa",
        status: "active",
        balance: LOAD_USD.toString(),
        currency: "USD",
        cardDetail: cardInfo,
      });

      await storage.createNfcCardTransaction({
        cardId: card.id,
        profileId: profile.id,
        type: "creation",
        amount: LOAD_USD.toFixed(2),
        currency: "USD",
        description: `NFC card issued — $${LOAD_USD.toFixed(2)} loaded (total charged $${COST_USD.toFixed(2)})`,
      });

      sendTelegramMessage(
        `✅ <b>NFC Card Issued</b>\n\n` +
        `👤 ${profile.fullName} (${profile.email})\n` +
        `💳 NFC Card ID: ${cardId}\n` +
        `🔢 Last 4: ${last4 || "N/A"}\n` +
        `💵 Charged $${COST_USD.toFixed(2)} USDT`
      ).catch(() => {});

      res.status(201).json(card);
    } catch (e: any) {
      console.error("[NFC create]", e);
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  // Fetch NFC card details (PAN, CVV, etc.) live from Strowallet
  app.get("/api/nfc-cards/:id/details", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      const card = await storage.getNfcCard(Number(req.params.id), profile.id);
      if (!card) return res.status(404).json({ message: "NFC card not found" });

      const params = new URLSearchParams({
        public_key: strowalletPublicKey,
        card_id: card.cardId,
      });
      const response = await strowalletFetch(`${STROWALLET_BASE}/fetch-nfccard-detail/?${params.toString()}`, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });
      const data = await response.json();

      if (!response.ok || data.status === "error" || data.status === false || data.success === false) {
        console.log("[NFC DETAIL] Strowallet error:", JSON.stringify(data));
        return res.json({ card, remoteDetail: null });
      }

      const detail = data.response?.card_detail || data.response || data.data || data;
      if (detail?.balance !== undefined && detail?.balance !== null) {
        await storage.updateNfcCard(card.id, { balance: String(detail.balance), cardDetail: detail });
      }
      res.json({ card, remoteDetail: detail });
    } catch (e: any) {
      console.error("[NFC details]", e);
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  // NFC card transactions (Strowallet spending records merged with local fund/withdraw logs)
  app.get("/api/nfc-cards/:id/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      const card = await storage.getNfcCard(Number(req.params.id), profile.id);
      if (!card) return res.status(404).json({ message: "NFC card not found" });

      const params = new URLSearchParams({
        public_key: strowalletPublicKey,
        card_id: card.cardId,
      });
      const response = await strowalletFetch(`${STROWALLET_BASE}/nfc-card-transactions/?${params.toString()}`, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });
      const data = await response.json();

      const local = await storage.getNfcCardTransactions(card.id, profile.id);
      const localFmt = local.map((lt) => ({
        id: `local_${lt.id}`,
        type: lt.type,
        amount: lt.amount,
        currency: lt.currency,
        description: lt.description,
        date: lt.createdAt,
        source: "local",
      }));

      if (!response.ok) {
        // Log full Strowallet error response for debugging (per spec)
        console.log("================== [STROWALLET NFC-TRANSACTIONS ERROR] ==================");
        console.log("[NFC TX] HTTP status:", response.status);
        console.log("[NFC TX] Card:", card.cardId, "| Profile:", profile.id);
        console.log("[NFC TX] Raw response (full):", JSON.stringify(data, null, 2));
        console.log("=========================================================================");
        return res.json(localFmt);
      }

      const remoteList: any[] =
        data.response?.card_transactions ||
        data.response?.transactions ||
        data.response?.data ||
        data.transactions ||
        data.data ||
        (Array.isArray(data.response) ? data.response : []) ||
        [];

      const remoteFmt = (Array.isArray(remoteList) ? remoteList : []).map((tx: any, i: number) => ({
        id: tx.id || tx.transaction_id || `remote_${i}`,
        type: tx.type || tx.transaction_type || "spend",
        amount: tx.amount,
        currency: tx.currency || "USD",
        description: tx.description || tx.merchant || tx.merchant_name || "Card transaction",
        date: tx.created_at || tx.date || tx.transaction_date,
        source: "strowallet",
      }));

      res.json([...remoteFmt, ...localFmt].sort((a, b) =>
        new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
      ));
    } catch (e: any) {
      console.error("[NFC tx]", e);
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  // Top-up an NFC card — user pays ALL fees + $0.25 Izichanj profit
  app.post("/api/nfc-cards/:id/fund", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      const card = await storage.getNfcCard(Number(req.params.id), profile.id);
      if (!card) return res.status(404).json({ message: "NFC card not found" });
      if (card.status !== "active") return res.status(400).json({ message: "Card is not active" });

      const fundAmount = parseFloat(req.body?.amount);
      if (isNaN(fundAmount) || fundAmount < NFC_TOPUP_MIN_USD) {
        return res.status(400).json({ message: `Minimum top-up is $${NFC_TOPUP_MIN_USD.toFixed(2)} USD` });
      }

      const breakdown = calcNfcCardTopUpCost(fundAmount);
      const totalCharge = breakdown.total;

      const balanceUsdt = parseFloat(profile.balance || "0");
      if (totalCharge > balanceUsdt) {
        return res.status(400).json({
          message: `Insufficient balance. You need $${totalCharge.toFixed(2)} USDT ($${fundAmount.toFixed(2)} to card + $${breakdown.fixedFee.toFixed(2)} fee + $${breakdown.variableFee.toFixed(2)} variable). Balance: $${balanceUsdt.toFixed(2)} USDT.`,
        });
      }

      const payload = {
        public_key: strowalletPublicKey,
        card_id: card.cardId,
        amount: fundAmount.toString(),
        type: "fund",
      };
      const response = await strowalletFetch(`${STROWALLET_BASE}/fund-withdraw-nfccard/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      const fundFailed = !response.ok || data.status === "error" || data.status === false || data.success === false;
      if (fundFailed) {
        console.log("================== [STROWALLET NFC FUND ERROR] ==================");
        console.log("[NFC FUND] HTTP:", response.status, "| Profile:", profile.id, "| Card:", card.cardId);
        console.log("[NFC FUND] Payload:", JSON.stringify({ ...payload, public_key: "[REDACTED]" }));
        console.log("[NFC FUND] Raw response (full):", JSON.stringify(data, null, 2));
        console.log("=================================================================");
      } else {
        console.log("[NFC FUND] OK — profile:", profile.id, "| card:", card.cardId, "| amount:", fundAmount);
      }

      if (fundFailed) {
        const rawErr = data.message ?? data.error ?? data.errors ?? data;
        const errMsg = typeof rawErr === "string" ? rawErr : JSON.stringify(rawErr);
        return res.status(400).json({ message: errMsg || "Failed to fund NFC card" });
      }

      // Charge user fully
      await storage.updateProfileBalance(profile.id, balanceUsdt - totalCharge);
      const updated = await storage.updateNfcCard(card.id, {
        balance: (parseFloat(card.balance || "0") + fundAmount).toString(),
      });
      await storage.createNfcCardTransaction({
        cardId: card.id,
        profileId: profile.id,
        type: "fund",
        amount: fundAmount.toFixed(2),
        currency: "USD",
        description: `NFC card funded — $${fundAmount.toFixed(2)} (total charged $${totalCharge.toFixed(2)} incl. $${breakdown.fixedFee.toFixed(2)} fee + $${breakdown.variableFee.toFixed(2)} variable)`,
      });
      res.json(updated);
    } catch (e: any) {
      console.error("[NFC fund]", e);
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  // Withdraw from NFC card back to user's Izichanj wallet
  app.post("/api/nfc-cards/:id/withdraw", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      const card = await storage.getNfcCard(Number(req.params.id), profile.id);
      if (!card) return res.status(404).json({ message: "NFC card not found" });
      if (card.status !== "active") return res.status(400).json({ message: "Card is not active" });

      const amount = parseFloat(req.body?.amount);
      if (isNaN(amount) || amount < NFC_WITHDRAW_MIN_USD) {
        return res.status(400).json({ message: `Minimum withdrawal is $${NFC_WITHDRAW_MIN_USD.toFixed(2)} USD` });
      }
      const cardBal = parseFloat(card.balance || "0");
      if (amount > cardBal) {
        return res.status(400).json({ message: `Insufficient card balance. Available: $${cardBal.toFixed(2)}` });
      }

      const breakdown = calcNfcCardWithdrawCost(amount);
      if (breakdown.netToWallet <= 0) {
        return res.status(400).json({ message: `Amount too small after $${breakdown.fee.toFixed(2)} service fee` });
      }

      const payload = {
        public_key: strowalletPublicKey,
        card_id: card.cardId,
        amount: amount.toString(),
        type: "withdraw",
      };
      const response = await strowalletFetch(`${STROWALLET_BASE}/fund-withdraw-nfccard/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      const wdFailed = !response.ok || data.status === "error" || data.status === false || data.success === false;
      if (wdFailed) {
        console.log("================== [STROWALLET NFC WITHDRAW ERROR] ==================");
        console.log("[NFC WITHDRAW] HTTP:", response.status, "| Profile:", profile.id, "| Card:", card.cardId);
        console.log("[NFC WITHDRAW] Payload:", JSON.stringify({ ...payload, public_key: "[REDACTED]" }));
        console.log("[NFC WITHDRAW] Raw response (full):", JSON.stringify(data, null, 2));
        console.log("=====================================================================");
      } else {
        console.log("[NFC WITHDRAW] OK — profile:", profile.id, "| card:", card.cardId, "| amount:", amount);
      }

      if (wdFailed) {
        const rawErr = data.message ?? data.error ?? data.errors ?? data;
        const errMsg = typeof rawErr === "string" ? rawErr : JSON.stringify(rawErr);
        return res.status(400).json({ message: errMsg || "Failed to withdraw from NFC card" });
      }

      // Credit wallet (net) and reduce card balance (full amount)
      const balanceUsdt = parseFloat(profile.balance || "0");
      await storage.updateProfileBalance(profile.id, balanceUsdt + breakdown.netToWallet);
      const updated = await storage.updateNfcCard(card.id, {
        balance: (cardBal - amount).toString(),
      });
      await storage.createNfcCardTransaction({
        cardId: card.id,
        profileId: profile.id,
        type: "withdraw",
        amount: amount.toFixed(2),
        currency: "USD",
        description: `NFC withdrawal — $${amount.toFixed(2)} pulled from card, $${breakdown.netToWallet.toFixed(2)} credited to wallet (− $${breakdown.fee.toFixed(2)} fee)`,
      });

      res.json({ card: updated, credited: breakdown.netToWallet, fee: breakdown.fee });
    } catch (e: any) {
      console.error("[NFC withdraw]", e);
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  // Refresh NFC card balance from Strowallet
  app.post("/api/nfc-cards/:id/refresh-balance", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      const card = await storage.getNfcCard(Number(req.params.id), profile.id);
      if (!card) return res.status(404).json({ message: "NFC card not found" });
      if (card.status === "pending" || card.status === "cancelled") {
        return res.status(400).json({ message: "Cannot refresh balance for a pending or cancelled card" });
      }

      const params = new URLSearchParams({
        public_key: strowalletPublicKey,
        card_id: card.cardId,
      });
      const response = await strowalletFetch(`${STROWALLET_BASE}/fetch-nfccard-detail/?${params.toString()}`, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });
      const data = await response.json();
      const detail = data.response?.card_detail || data.response || data.data || data;

      if (detail?.balance !== undefined && detail?.balance !== null) {
        const newBalance = String(detail.balance);
        await storage.updateNfcCard(card.id, { balance: newBalance, cardDetail: detail });
        return res.json({ balance: newBalance, synced: true });
      }
      return res.json({ balance: card.balance, synced: false });
    } catch (e: any) {
      console.error("[NFC refresh]", e);
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  // ─── Admin: Server Outbound IP Check ──────────────────────────────────────
  app.get("/api/admin/server-ip", async (req: any, res) => {
    try {
      const proxyUrl = process.env.PROXY_URL;

      // Direct server IP (Replit's IP)
      const directRes = await fetch("https://api.ipify.org?format=json");
      const directData = await directRes.json() as any;

      let proxyIp: string | null = null;
      let proxyError: string | null = null;

      if (proxyUrl) {
        try {
          const { fetch: undiciFetch } = await import("undici");
          const dispatcher = new ProxyAgent(proxyUrl);
          const proxyRes = await undiciFetch("https://api.ipify.org?format=json", { dispatcher });
          const proxyData = await proxyRes.json() as any;
          proxyIp = proxyData.ip;
        } catch (pe: any) {
          proxyError = pe.message;
        }
      }

      res.json({
        server_ip: directData.ip,
        proxy_ip: proxyIp,
        proxy_configured: !!proxyUrl,
        proxy_url_set: !!proxyUrl,
        strowallet_sees: proxyIp || directData.ip,
        proxy_error: proxyError,
      });
    } catch (e: any) {
      res.status(500).json({ message: "Could not determine outbound IP", error: e.message });
    }
  });

  app.get("/api/admin/login-activity", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 200;
      const logs = await storage.getLoginActivity(limit);
      res.json(logs);
    } catch (e) {
      res.status(500).json({ message: "Internal Error" });
    }
  });

  // ─── Reloadly Mobile Top-Up ───────────────────────────────────────────────

  async function getReloadlyToken(): Promise<string> {
    const clientId = process.env.RELOADLY_CLIENT_ID;
    const clientSecret = process.env.RELOADLY_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("Reloadly credentials not configured");

    const res = await fetch("https://auth.reloadly.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
        audience: "https://topups.reloadly.com",
      }),
    });
    const data = await res.json() as any;
    if (!data.access_token) throw new Error(data.error_description || "Failed to get Reloadly token");
    return data.access_token;
  }

  app.get("/api/topup/operators", isAuthenticated, async (req: any, res) => {
    try {
      const countryCode = (req.query.countryCode as string) || "HT";
      const token = await getReloadlyToken();
      const r = await fetch(
        `https://topups.reloadly.com/operators/countries/${countryCode}?suggestedAmountsMap=true&includePin=false`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/com.reloadly.topups-v1+json" } }
      );
      const data = await r.json() as any;
      res.json(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error("Reloadly operators error:", e.message);
      res.status(500).json({ message: e.message || "Failed to fetch operators" });
    }
  });

  app.post("/api/topup", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      if (profile.kycStatus !== "verified") return res.status(403).json({ message: "KYC verification required to use Mobile Top-Up." });

      const { phoneNumber, operatorId, amount } = req.body;
      if (!phoneNumber || !operatorId || !amount) {
        return res.status(400).json({ message: "Phone number, operator, and amount are required" });
      }

      const phone = String(phoneNumber).replace(/\D/g, "");
      if (phone.length < 7 || phone.length > 15) {
        return res.status(400).json({ message: "Invalid phone number" });
      }

      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      // Deduct from balance (in USD) — amount + $1.86 service fee
      const currentBalance = Number(profile.balance);
      const totalCharge = numAmount + TOPUP_FEE_USD;
      if (currentBalance < totalCharge) {
        return res.status(400).json({ message: `Solde insuffisant. Vous avez besoin de $${totalCharge.toFixed(2)} USD ($${numAmount.toFixed(2)} + $${TOPUP_FEE_USD.toFixed(2)} de frais) mais votre solde est de $${currentBalance.toFixed(2)} USD.` });
      }

      const token = await getReloadlyToken();

      const topupRes = await fetch("https://topups.reloadly.com/topups", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/com.reloadly.topups-v1+json",
        },
        body: JSON.stringify({
          operatorId,
          amount: numAmount,
          useLocalAmount: false,
          customIdentifier: `IZ-${profile.id}-${Date.now()}`,
          recipientPhone: { countryCode: "HT", number: phone },
          senderPhone: { countryCode: "HT", number: phone },
        }),
      });

      const topupData = await topupRes.json() as any;

      if (!topupRes.ok || topupData.errorCode) {
        const errorCode = (topupData.errorCode || "").toLowerCase();
        const errorMsg = (topupData.message || "").toLowerCase();

        const isBalanceError =
          errorCode.includes("insufficient") ||
          errorCode.includes("balance") ||
          errorCode.includes("low_balance") ||
          errorCode.includes("no_balance") ||
          errorMsg.includes("insufficient") ||
          errorMsg.includes("balance") ||
          errorMsg.includes("funds");

        // Always log full error privately for admin visibility
        console.error("[RELOADLY][TOPUP_ERROR] Real error (hidden from user):", JSON.stringify({
          errorCode: topupData.errorCode,
          message: topupData.message,
          httpStatus: topupRes.status,
          amount: numAmount,
          phone,
          operatorId,
          isBalanceError,
          timestamp: new Date().toISOString(),
        }));

        // Alert admin via Telegram if it's a Reloadly balance/funds issue
        if (isBalanceError) {
          sendTelegramMessage(
            `🚨 <b>Reloadly Fonds Insuffisants</b>\n\n` +
            `Un rechargement a échoué car le compte Reloadly n'a pas assez de fonds.\n\n` +
            `👤 <b>Utilisateur:</b> ${profile.fullName} (${profile.email})\n` +
            `📱 <b>Numéro:</b> +509${phone}\n` +
            `💵 <b>Montant:</b> $${numAmount} USD\n` +
            `🏢 <b>Opérateur ID:</b> ${operatorId}\n` +
            `❌ <b>Erreur Reloadly:</b> ${topupData.errorCode || "N/A"} — ${topupData.message || "N/A"}\n\n` +
            `⚠️ Rechargez le compte Reloadly immédiatement pour éviter d'autres échecs.`
          ).catch(() => {});
        }

        const userMessage = isBalanceError
          ? "Une erreur technique est survenue. Veuillez réessayer dans quelques minutes."
          : "Top-up échoué. Veuillez réessayer.";

        return res.status(400).json({ message: userMessage });
      }

      // Deduct balance: top-up amount + $1.86 service fee
      await storage.updateProfileBalance(profile.id, currentBalance - totalCharge);

      // Save top-up history to DB
      await storage.createTopUpTransaction({
        profileId: profile.id,
        operatorId: String(operatorId),
        operatorName: topupData.operatorName || "Unknown",
        phone,
        amountUsd: numAmount.toFixed(2),
        transactionId: topupData.transactionId ? String(topupData.transactionId) : undefined,
        status: "success",
      });

      // Notify user via WhatsApp
      if (profile.phone) {
        sendWhatsAppNotification(
          profile.phone,
          `*Izichanj*\n\n📱 Top-Up Successful\n\nYou recharged ${phone} with $${numAmount} USD.\nService fee: $${TOPUP_FEE_USD.toFixed(2)} USD\nTotal charged: $${totalCharge.toFixed(2)} USD\nTransaction ID: ${topupData.transactionId || "N/A"}\n\nhttps://izichanj.com`,
          profile.fullName
        );
      }

      res.json({
        success: true,
        transactionId: topupData.transactionId,
        amount: numAmount,
        phone,
        operator: topupData.operatorName,
        message: `Top-up of $${numAmount} sent successfully to ${phone}`,
      });
    } catch (e: any) {
      console.error("[RELOADLY][TOPUP_ERROR] Unexpected error (hidden from user):", e.message);
      res.status(500).json({ message: "Une erreur technique est survenue. Veuillez réessayer dans quelques minutes." });
    }
  });

  // GET /api/topup/history — user's past top-up transactions
  app.get("/api/topup/history", isAuthenticated, async (req: any, res) => {
    try {
      const profile = await getProfileFromReq(req);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });
      const history = await storage.getTopUpTransactions(profile.id);
      res.json(history);
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  // ─── Admin Audit & Security Endpoints ──────────────────────────────────────

  // GET /api/admin/users/:id/activity — 360 user activity view
  app.get("/api/admin/users/:id/activity", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const profileId = Number(req.params.id);
      const activity = await storage.getUserActivity(profileId);
      if (!activity) return res.status(404).json({ message: "User not found" });
      res.json(activity);
    } catch (e: any) {
      console.error("[admin user activity]", e);
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  // GET /api/admin/audit-log — global audit log with optional type filter
  app.get("/api/admin/audit-log", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const filterType = (req.query.type as string) || "all";
      const limit = Math.min(Number(req.query.limit) || 200, 500);
      const entries = await storage.getGlobalAuditLog(limit, filterType);
      res.json(entries);
    } catch (e: any) {
      console.error("[admin audit-log]", e);
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  // GET /api/admin/multi-account-alerts — users sharing same IP
  app.get("/api/admin/multi-account-alerts", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const alerts = await storage.getMultiAccountAlerts();
      res.json(alerts);
    } catch (e: any) {
      console.error("[admin multi-account-alerts]", e);
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  // GET /api/admin/withdrawals/:id/risk-check — risk assessment for a withdrawal
  app.get("/api/admin/withdrawals/:id/risk-check", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const info = await storage.getWithdrawalRiskInfo(Number(req.params.id));
      if (!info) return res.status(404).json({ message: "Withdrawal not found" });
      res.json(info);
    } catch (e: any) {
      console.error("[admin withdrawal risk-check]", e);
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  // GET /api/admin/balance-logs — all balance change history
  app.get("/api/admin/balance-logs", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const profileId = req.query.profileId ? Number(req.query.profileId) : undefined;
      const limit = Math.min(Number(req.query.limit) || 200, 500);
      const logs = await storage.getBalanceLogs(profileId, limit);
      res.json(logs);
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  // GET /api/admin/security-events — security events log
  app.get("/api/admin/security-events", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const profileId = req.query.profileId ? Number(req.query.profileId) : undefined;
      const limit = Math.min(Number(req.query.limit) || 200, 500);
      const events = await storage.getSecurityEvents(profileId, limit);
      res.json(events);
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  // ── User Reports ──────────────────────────────────────────────────────────

  // Upload URL for report proof image
  app.post("/api/reports/upload-url", isAuthenticated, async (req: any, res) => {
    try {
      const { ObjectStorageService } = await import("./replit_integrations/object_storage");
      const objectStorage = new ObjectStorageService();
      const uploadURL = await objectStorage.getObjectEntityUploadURL();
      const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);
      res.json({ uploadURL, objectPath });
    } catch (e: any) {
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  // Submit a user report
  app.post("/api/reports", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = req.session.profileId;
      const profile = await storage.getProfile(profileId);
      if (!profile) return res.status(401).json({ message: "Unauthorized" });

      const { reportedIdentifier, reason, description, proofImageUrl } = req.body;
      if (!reportedIdentifier?.trim() || !reason || !description?.trim()) {
        return res.status(400).json({ message: "Reported user, reason, and description are required" });
      }
      if (description.trim().length < 20) {
        return res.status(400).json({ message: "Description must be at least 20 characters" });
      }

      // Reported user must exist in DB with KYC approved
      let reportedProfile: any = null;
      const byEmail = await storage.getProfileByEmail(reportedIdentifier.trim().toLowerCase());
      if (byEmail) {
        reportedProfile = byEmail;
      } else {
        const byRef = await storage.getProfileByReferenceId(reportedIdentifier.trim());
        if (byRef) reportedProfile = byRef;
      }

      if (!reportedProfile) {
        return res.status(404).json({ message: "User not found. Only registered users can be reported.", field: "reportedIdentifier" });
      }
      if (reportedProfile.kycStatus !== "verified") {
        return res.status(400).json({ message: "This user has not completed KYC verification and cannot be reported.", field: "reportedIdentifier" });
      }
      if (reportedProfile.id === profileId) {
        return res.status(400).json({ message: "You cannot report yourself.", field: "reportedIdentifier" });
      }

      const reportedProfileId = reportedProfile.id;

      const report = await storage.createUserReport({
        reporterProfileId: profileId,
        reportedIdentifier: reportedIdentifier.trim(),
        reportedProfileId,
        reason,
        description: description.trim(),
        proofImageUrl: proofImageUrl || null,
      });

      // Telegram notification
      sendTelegramMessage(
        `🚨 <b>New User Report</b>\n\n` +
        `👤 <b>Reporter:</b> ${profile.fullName} (${profile.email})\n` +
        `🎯 <b>Reported:</b> ${reportedIdentifier.trim()}${reportedProfileId ? ` (ID: ${reportedProfileId})` : " (not found)"}\n` +
        `📋 <b>Reason:</b> ${reason}\n` +
        `📝 <b>Description:</b> ${description.trim().slice(0, 300)}\n` +
        `🖼 <b>Proof:</b> ${proofImageUrl ? "Yes (attached)" : "None"}\n\n` +
        `🔗 Review in Admin Panel → Reports tab`
      ).catch(() => {});

      res.json({ message: "Report submitted successfully", reportId: report.id });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  // Admin: list all reports
  app.get("/api/admin/reports", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 200, 500);
      const reports = await storage.getUserReports(limit);
      res.json(reports);
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  // Admin: update report status
  app.patch("/api/admin/reports/:id/status", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const { status, adminNote } = req.body;
      if (!["pending", "reviewed", "dismissed"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      const updated = await storage.updateUserReportStatus(id, status, adminNote);
      if (!updated) return res.status(404).json({ message: "Report not found" });
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  // ── Referral / Affiliate System ──────────────────────────────────────────────

  // Get or generate user's referral code
  app.get("/api/referral/code", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = req.session.profileId;
      const profile = await storage.getProfile(profileId);
      if (!profile) return res.status(404).json({ message: "Not found" });
      if (!profile.affiliateEnabled) return res.status(403).json({ message: "Affiliate not enabled for your account" });
      let code = profile.referralCode;
      if (!code) {
        code = await storage.generateReferralCode(profileId);
      }
      res.json({ referralCode: code });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  // Get referral stats for current user
  app.get("/api/referral/stats", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = req.session.profileId;
      const profile = await storage.getProfile(profileId);
      if (!profile) return res.status(404).json({ message: "Not found" });
      if (!profile.affiliateEnabled) return res.status(403).json({ message: "Affiliate not enabled for your account" });
      const stats = await storage.getReferralStats(profileId);
      const payouts = await storage.getReferralPayoutRequests(profileId);
      res.json({
        referralCode: profile.referralCode,
        referralBalance: parseFloat(profile.referralBalance || "0"),
        ...stats,
        payoutHistory: payouts,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  // User: request payout (transfer referralBalance → main balance via admin)
  app.post("/api/referral/request-payout", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = req.session.profileId;
      const profile = await storage.getProfile(profileId);
      if (!profile) return res.status(404).json({ message: "Not found" });
      if (!profile.affiliateEnabled) return res.status(403).json({ message: "Affiliate not enabled" });
      const balance = parseFloat(profile.referralBalance || "0");
      if (balance < 1) return res.status(400).json({ message: "Minimum payout is $1.00" });
      const hasPending = await storage.hasPendingReferralPayout(profileId);
      if (hasPending) return res.status(400).json({ message: "You already have a pending payout request" });
      const payout = await storage.createReferralPayoutRequest(profileId, balance);
      res.json(payout);
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  // Admin: toggle affiliate for a user
  app.patch("/api/admin/users/:id/toggle-affiliate", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const profileId = Number(req.params.id);
      const profile = await storage.getProfile(profileId);
      if (!profile) return res.status(404).json({ message: "User not found" });
      const newValue = !profile.affiliateEnabled;
      await db.update(profiles).set({ affiliateEnabled: newValue }).where(eq(profiles.id, profileId));
      // Auto-generate referral code when enabling
      if (newValue && !profile.referralCode) {
        await storage.generateReferralCode(profileId);
      }
      const updated = await storage.getProfile(profileId);
      // Send WhatsApp notification
      if (profile.phone) {
        if (newValue) {
          const code = updated?.referralCode ?? "";
          sendWhatsAppNotification(
            profile.phone,
            `*Izichanj*\n\n🎉 Félicitations! Your *Affiliate Program* is now *ACTIVE*!\n\nYour unique referral code: *${code}*\n\n📍 Find it in your *Profile page* → scroll to the *Affiliate Program* section.\n\n💸 *Commission structure:*\n• $0.05 – When a friend verifies their email\n• $0.25 – When a friend's KYC is approved\n• $2.00 – When a friend makes their first deposit of $50+\n\nShare your code and start earning today! 🚀\n\nhttps://izichanj.com`,
            profile.fullName
          );
        } else {
          sendWhatsAppNotification(
            profile.phone,
            `*Izichanj*\n\nℹ️ *Affiliate Program Update*\n\nYour affiliate/ambassador status has been *deactivated*. You will no longer earn referral commissions.\n\nIf you believe this is a mistake, please contact our support team.\n\nhttps://izichanj.com`,
            profile.fullName
          );
        }
      }
      res.json({ affiliateEnabled: updated?.affiliateEnabled, referralCode: updated?.referralCode });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  // Admin: list all payout requests
  app.get("/api/admin/referral-payouts", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const payouts = await storage.getReferralPayoutRequests();
      res.json(payouts);
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  // Admin: approve payout → move referralBalance to main balance
  app.patch("/api/admin/referral-payouts/:id/approve", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const payouts = await storage.getReferralPayoutRequests();
      const payout = payouts.find((p) => p.id === id);
      if (!payout) return res.status(404).json({ message: "Payout request not found" });
      if (payout.status !== "pending") return res.status(400).json({ message: "Already processed" });
      const amount = parseFloat(payout.amount);
      const profile = await storage.getProfile(payout.profile_id);
      if (!profile) return res.status(404).json({ message: "User not found" });
      // Deduct referral balance, credit main balance
      await db.execute(sql`UPDATE profiles SET referral_balance = GREATEST(0, COALESCE(referral_balance, 0) - ${amount}) WHERE id = ${payout.profile_id}`);
      const currentBalance = parseFloat(profile.balance || "0");
      const newBalance = currentBalance + amount;
      await storage.updateProfileBalance(payout.profile_id, newBalance);
      storage.createBalanceLog({ profileId: payout.profile_id, previousBalance: currentBalance, newBalance, change: amount, action: "referral_payout", referenceId: String(id), adminId: req.session?.profileId }).catch(() => {});
      const updated = await storage.updateReferralPayoutRequest(id, "approved", req.body.adminNote);
      // Notify user
      await storage.createNotification({ profileId: payout.profile_id, type: "deposit_approved", title: "Referral Payout Approved", message: `Your referral payout of $${amount.toFixed(2)} has been transferred to your main balance.` });
      const payoutProfile = await storage.getProfile(payout.profile_id);
      if (payoutProfile?.phone) sendWhatsAppNotification(payoutProfile.phone, `*Izichanj*\n\n✅ Referral Payout Approved\n\nYour referral balance of $${amount.toFixed(2)} has been transferred to your main balance.\n\nhttps://izichanj.com`, payoutProfile.fullName);
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  // Admin: reject payout
  app.patch("/api/admin/referral-payouts/:id/reject", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const { adminNote } = req.body;
      const updated = await storage.updateReferralPayoutRequest(id, "rejected", adminNote);
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Internal Error" });
    }
  });

  // ═══════════════════════════════════════════════════════════
  //  ADMIN P2P DISPUTE CENTER
  // ═══════════════════════════════════════════════════════════

  // GET /api/admin/p2p/disputes — list all disputed orders with buyer/seller info
  app.get("/api/admin/p2p/disputes", isAuthenticated, isAdmin, async (_req: any, res) => {
    try {
      const rows = await db.execute(sql`
        SELECT
          o.id, o.status, o.amount_usdt, o.amount_local, o.rate, o.currency,
          o.payment_method, o.dispute_reason, o.created_at, o.updated_at,
          o.buyer_id, o.seller_id, o.ad_id,
          b.full_name AS buyer_name, b.email AS buyer_email, b.reference_id AS buyer_ref,
          b.is_banned AS buyer_banned, b.frozen_until AS buyer_frozen,
          b.p2p_flagged_as AS buyer_flagged, b.p2p_seller_restricted AS buyer_restricted,
          s.full_name AS seller_name, s.email AS seller_email, s.reference_id AS seller_ref,
          s.is_banned AS seller_banned, s.frozen_until AS seller_frozen,
          s.p2p_flagged_as AS seller_flagged, s.p2p_seller_restricted AS seller_restricted,
          (SELECT COUNT(*) FROM p2p_chat_messages WHERE order_id = o.id) AS message_count
        FROM p2p_orders o
        JOIN profiles b ON b.id = o.buyer_id
        JOIN profiles s ON s.id = o.seller_id
        WHERE o.status = 'disputed'
        ORDER BY COALESCE(o.updated_at, o.created_at) DESC
      `);
      res.json(rows.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/admin/p2p/disputes/:id — full dispute detail with chat + login IPs
  app.get("/api/admin/p2p/disputes/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const orderId = Number(req.params.id);
      const orderRows = await db.execute(sql`
        SELECT
          o.*, o.amount_local AS total_htg, o.rate AS rate_htg,
          b.full_name AS buyer_name, b.email AS buyer_email, b.phone AS buyer_phone,
          b.reference_id AS buyer_ref, b.is_banned AS buyer_banned,
          b.frozen_until AS buyer_frozen, b.p2p_flagged_as AS buyer_flagged,
          b.p2p_seller_restricted AS buyer_restricted, b.country AS buyer_country,
          s.full_name AS seller_name, s.email AS seller_email, s.phone AS seller_phone,
          s.reference_id AS seller_ref, s.is_banned AS seller_banned,
          s.frozen_until AS seller_frozen, s.p2p_flagged_as AS seller_flagged,
          s.p2p_seller_restricted AS seller_restricted, s.country AS seller_country
        FROM p2p_orders o
        JOIN profiles b ON b.id = o.buyer_id
        JOIN profiles s ON s.id = o.seller_id
        WHERE o.id = ${orderId}
      `);
      const order = orderRows.rows[0] as any;
      if (!order) return res.status(404).json({ message: "Order not found" });

      const chatRows = await db.execute(sql`
        SELECT m.*, p.full_name AS sender_name
        FROM p2p_chat_messages m
        LEFT JOIN profiles p ON p.id = m.sender_id
        WHERE m.order_id = ${orderId}
        ORDER BY m.created_at ASC
      `);

      // Fetch recent login IPs for both parties
      const buyerLogins = await db.execute(sql`
        SELECT ip_address, device_info, login_at AS created_at FROM login_logs
        WHERE profile_id = ${order.buyer_id}
        ORDER BY login_at DESC LIMIT 5
      `);
      const sellerLogins = await db.execute(sql`
        SELECT ip_address, device_info, login_at AS created_at FROM login_logs
        WHERE profile_id = ${order.seller_id}
        ORDER BY login_at DESC LIMIT 5
      `);

      // Fetch past admin actions for this order
      const actionRows = await db.execute(sql`
        SELECT da.*, a.full_name AS admin_name
        FROM p2p_dispute_actions da
        LEFT JOIN profiles a ON a.id = da.admin_id
        WHERE da.order_id = ${orderId}
        ORDER BY da.created_at DESC
      `);

      res.json({
        order,
        chat: chatRows.rows,
        buyerLogins: buyerLogins.rows,
        sellerLogins: sellerLogins.rows,
        actions: actionRows.rows,
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/admin/p2p/disputes/:id/resolve — release to buyer OR refund to seller
  app.post("/api/admin/p2p/disputes/:id/resolve", isAuthenticated, isAdmin, async (req: any, res) => {
    const adminId = req.session.profileId;
    const orderId = Number(req.params.id);
    const { action, reason } = req.body;
    if (!action || !reason?.trim()) return res.status(400).json({ message: "action and reason are required" });
    if (!["release_buyer", "refund_seller"].includes(action)) return res.status(400).json({ message: "Invalid action" });

    try {
      const rows = await db.execute(sql`SELECT * FROM p2p_orders WHERE id = ${orderId}`);
      const order = rows.rows[0] as any;
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (!["disputed", "paid"].includes(order.status)) return res.status(400).json({ message: "Order is not in a resolvable state" });

      const amount = parseFloat(order.amount_usdt);

      if (action === "release_buyer") {
        // Credit buyer
        const buyerRows = await db.execute(sql`SELECT balance FROM profiles WHERE id = ${order.buyer_id}`);
        const prevBal = parseFloat((buyerRows.rows[0] as any)?.balance || "0");
        await db.execute(sql`UPDATE profiles SET balance = balance + ${amount} WHERE id = ${order.buyer_id}`);
        await db.execute(sql`INSERT INTO balance_logs (profile_id, previous_balance, new_balance, change, action, reference_id) VALUES (${order.buyer_id}, ${prevBal}, ${prevBal + amount}, ${amount}, 'p2p_admin_release', ${String(orderId)})`);
        await db.execute(sql`UPDATE p2p_orders SET status = 'released', released_at = NOW() WHERE id = ${orderId}`);
        await db.execute(sql`INSERT INTO p2p_chat_messages (order_id, sender_id, message) VALUES (${orderId}, ${adminId}, ${'✅ Admin Decision: Funds released to buyer after dispute investigation. Trade closed.'})`);
        // Notify both parties
        await db.execute(sql`INSERT INTO notifications (profile_id, type, title, message) VALUES (${order.buyer_id}, 'custom_message', 'Dispute Resolved — Funds Released', ${reason})`).catch(() => {});
        await db.execute(sql`INSERT INTO notifications (profile_id, type, title, message) VALUES (${order.seller_id}, 'custom_message', 'Dispute Resolved — Funds Released to Buyer', ${reason})`).catch(() => {});
      } else {
        // Refund seller — return USDT to seller balance (escrow was already deducted from ad)
        const sellerRows = await db.execute(sql`SELECT balance FROM profiles WHERE id = ${order.seller_id}`);
        const prevBal = parseFloat((sellerRows.rows[0] as any)?.balance || "0");
        await db.execute(sql`UPDATE profiles SET balance = balance + ${amount} WHERE id = ${order.seller_id}`);
        await db.execute(sql`INSERT INTO balance_logs (profile_id, previous_balance, new_balance, change, action, reference_id) VALUES (${order.seller_id}, ${prevBal}, ${prevBal + amount}, ${amount}, 'p2p_admin_refund', ${String(orderId)})`);
        // Restore ad available_usdt
        await db.execute(sql`UPDATE p2p_ads SET available_usdt = available_usdt + ${amount}, updated_at = NOW() WHERE id = ${order.ad_id}`);
        await db.execute(sql`UPDATE p2p_orders SET status = 'cancelled', cancelled_by = 'admin', cancellation_reason = ${reason}, cancelled_at = NOW() WHERE id = ${orderId}`);
        await db.execute(sql`INSERT INTO p2p_chat_messages (order_id, sender_id, message) VALUES (${orderId}, ${adminId}, ${'🔒 Admin Decision: Funds refunded to seller after dispute investigation. Trade closed.'})`);
        await db.execute(sql`INSERT INTO notifications (profile_id, type, title, message) VALUES (${order.seller_id}, 'custom_message', 'Dispute Resolved — Funds Refunded', ${reason})`).catch(() => {});
        await db.execute(sql`INSERT INTO notifications (profile_id, type, title, message) VALUES (${order.buyer_id}, 'custom_message', 'Dispute Resolved — Funds Returned to Seller', ${reason})`).catch(() => {});
      }

      // Log action
      await db.execute(sql`INSERT INTO p2p_dispute_actions (order_id, admin_id, action, reason) VALUES (${orderId}, ${adminId}, ${action}, ${reason})`);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/admin/p2p/disputes/:id/flag — flag a user involved in a dispute
  app.post("/api/admin/p2p/disputes/:id/flag", isAuthenticated, isAdmin, async (req: any, res) => {
    const adminId = req.session.profileId;
    const orderId = Number(req.params.id);
    const { userId, flagAs, reason } = req.body;
    if (!userId || !reason?.trim()) return res.status(400).json({ message: "userId and reason are required" });

    try {
      const newFlag = flagAs || null; // null = clear flag
      await db.execute(sql`UPDATE profiles SET p2p_flagged_as = ${newFlag} WHERE id = ${userId}`);
      await db.execute(sql`INSERT INTO p2p_dispute_actions (order_id, admin_id, action, reason, target_user_id) VALUES (${orderId}, ${adminId}, ${'flag_user:' + (newFlag ?? 'cleared')}, ${reason}, ${userId})`);
      if (newFlag) {
        await db.execute(sql`INSERT INTO notifications (profile_id, type, title, message) VALUES (${userId}, 'custom_message', 'Account Flagged', ${reason})`).catch(() => {});
      }
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/admin/p2p/users/:id/seller-restrict — toggle seller restriction
  app.post("/api/admin/p2p/users/:id/seller-restrict", isAuthenticated, isAdmin, async (req: any, res) => {
    const adminId = req.session.profileId;
    const userId = Number(req.params.id);
    const { restricted, reason, orderId } = req.body;
    try {
      await db.execute(sql`UPDATE profiles SET p2p_seller_restricted = ${!!restricted} WHERE id = ${userId}`);
      const actionLabel = restricted ? "seller_restricted" : "seller_unrestricted";
      if (orderId) {
        await db.execute(sql`INSERT INTO p2p_dispute_actions (order_id, admin_id, action, reason, target_user_id) VALUES (${orderId}, ${adminId}, ${actionLabel}, ${reason ?? 'No reason provided'}, ${userId})`);
      }
      await db.execute(sql`INSERT INTO notifications (profile_id, type, title, message) VALUES (${userId}, 'custom_message', ${restricted ? 'P2P Selling Restricted' : 'P2P Selling Restored'}, ${reason ?? (restricted ? 'Your ability to post P2P ads has been restricted.' : 'Your P2P selling privileges have been restored.')})`).catch(() => {});
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/admin/p2p/users/:id/ban — ban/unban with dispute log
  app.post("/api/admin/p2p/users/:id/ban", isAuthenticated, isAdmin, async (req: any, res) => {
    const adminId = req.session.profileId;
    const userId = Number(req.params.id);
    const { isBanned, reason, orderId } = req.body;
    try {
      await db.execute(sql`UPDATE profiles SET is_banned = ${!!isBanned} WHERE id = ${userId}`);
      if (orderId) {
        await db.execute(sql`INSERT INTO p2p_dispute_actions (order_id, admin_id, action, reason, target_user_id) VALUES (${orderId}, ${adminId}, ${isBanned ? 'ban_user' : 'unban_user'}, ${reason ?? 'No reason'}, ${userId})`);
      }
      await db.execute(sql`INSERT INTO notifications (profile_id, type, title, message) VALUES (${userId}, 'custom_message', ${isBanned ? 'Account Banned' : 'Account Restored'}, ${reason ?? (isBanned ? 'Your account has been permanently banned.' : 'Your account ban has been lifted.')})`).catch(() => {});
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/admin/p2p/users/:id/freeze — freeze/unfreeze with dispute log
  app.post("/api/admin/p2p/users/:id/freeze", isAuthenticated, isAdmin, async (req: any, res) => {
    const adminId = req.session.profileId;
    const userId = Number(req.params.id);
    const { freeze, durationDays, reason, orderId } = req.body;
    try {
      if (freeze) {
        const frozenUntil = new Date(Date.now() + (durationDays ?? 7) * 24 * 60 * 60 * 1000);
        await db.execute(sql`UPDATE profiles SET frozen_until = ${frozenUntil} WHERE id = ${userId}`);
        if (orderId) await db.execute(sql`INSERT INTO p2p_dispute_actions (order_id, admin_id, action, reason, target_user_id) VALUES (${orderId}, ${adminId}, ${'freeze_user'}, ${reason ?? 'No reason'}, ${userId})`);
        await db.execute(sql`INSERT INTO notifications (profile_id, type, title, message) VALUES (${userId}, 'custom_message', 'Account Frozen', ${reason ?? `Your account has been frozen for ${durationDays ?? 7} days.`})`).catch(() => {});
      } else {
        await db.execute(sql`UPDATE profiles SET frozen_until = NULL WHERE id = ${userId}`);
        if (orderId) await db.execute(sql`INSERT INTO p2p_dispute_actions (order_id, admin_id, action, reason, target_user_id) VALUES (${orderId}, ${adminId}, ${'unfreeze_user'}, ${reason ?? 'No reason'}, ${userId})`);
        await db.execute(sql`INSERT INTO notifications (profile_id, type, title, message) VALUES (${userId}, 'custom_message', 'Account Unfrozen', ${reason ?? 'Your account freeze has been lifted.'})`).catch(() => {});
      }
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/admin/p2p/disputes/:id/actions — fetch admin action log for an order
  app.get("/api/admin/p2p/disputes/:id/actions", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const orderId = Number(req.params.id);
      const rows = await db.execute(sql`
        SELECT da.*, a.full_name AS admin_name, u.full_name AS target_name
        FROM p2p_dispute_actions da
        LEFT JOIN profiles a ON a.id = da.admin_id
        LEFT JOIN profiles u ON u.id = da.target_user_id
        WHERE da.order_id = ${orderId}
        ORDER BY da.created_at DESC
      `);
      res.json(rows.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════
  //  P2P MARKET ROUTES
  // ═══════════════════════════════════════════════════════════

  const P2P_PAYMENT_METHODS: Record<string, string[]> = {
    HT: ["MonCash", "NatCash", "UNIBANK", "SOGEBANK"],
    US: ["Zelle", "CashApp", "PayPal", "Venmo", "Bank Transfer"],
    default: ["PayPal", "Bank Transfer", "Western Union"],
  };
  const HAITI_RATE_MIN = 130;
  const HAITI_RATE_MAX = 145;
  const P2P_BAN_HOURS = 2;
  const P2P_CANCEL_LIMIT = 3;

  function getP2PPaymentMethods(country: string): string[] {
    return P2P_PAYMENT_METHODS[country] || P2P_PAYMENT_METHODS.default;
  }

  // Returns "HT" for Haiti, "US" for USA, "default" for others
  function getCountryGroup(country: string): string {
    if (!country) return "default";
    const c = country.toUpperCase();
    if (c === "HT" || c === "HAITI") return "HT";
    if (c === "US" || c === "USA" || c === "UNITED STATES") return "US";
    return "default";
  }

  // Returns the currency code for a country group
  function getCountryCurrency(country: string): string {
    const g = getCountryGroup(country);
    if (g === "HT") return "HTG";
    if (g === "US") return "USD";
    return "USD";
  }

  function generateOrderId(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "P2P-";
    for (let i = 0; i < 8; i++) result += chars[Math.floor(Math.random() * chars.length)];
    return result;
  }

  // Auto-cancel expired orders and return funds to seller
  async function autoExpireOrders(): Promise<void> {
    try {
      const expired = await db.execute(sql`
        SELECT id, seller_id, amount_usdt, ad_id FROM p2p_orders
        WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < NOW()
      `);
      for (const row of expired.rows as any[]) {
        await db.execute(sql`UPDATE p2p_orders SET status = 'cancelled', cancelled_by = 'system', cancellation_reason = 'Trade expired after 60 minutes', cancelled_at = NOW() WHERE id = ${row.id}`);
        await db.execute(sql`UPDATE p2p_ads SET available_usdt = available_usdt + ${row.amount_usdt}, updated_at = NOW() WHERE id = ${row.ad_id}`);
        await db.execute(sql`INSERT INTO p2p_chat_messages (order_id, sender_id, message) VALUES (${row.id}, ${row.seller_id}, ${'⏰ This order has been automatically cancelled after 60 minutes of inactivity. USDT has been returned to the ad.'})`);
      }
    } catch (_) { /* silent */ }
  }

  // Check if KYC verified middleware for P2P
  const isKycVerified = async (req: any, res: any, next: any) => {
    const profileId = req.session?.profileId;
    if (!profileId) return res.status(401).json({ message: "Not authenticated" });
    const result = await db.execute(sql`SELECT kyc_status FROM profiles WHERE id = ${profileId}`);
    const profile = result.rows[0] as any;
    if (!profile || profile.kyc_status !== "verified") {
      return res.status(403).json({ message: "KYC verification required to access P2P Market" });
    }
    next();
  };

  // ── In-memory PIN lockout tracker (keyed by profileId) ──────────────────
  const pinLockout = new Map<number, { attempts: number; lockedUntil: Date | null }>();

  function getPinState(profileId: number) {
    if (!pinLockout.has(profileId)) pinLockout.set(profileId, { attempts: 0, lockedUntil: null });
    return pinLockout.get(profileId)!;
  }

  // GET /api/p2p/settings — seller's P2P settings (welcome message, merchant name, PIN status)
  app.get("/api/p2p/settings", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = req.session.profileId;
      const rows = await db.execute(sql`SELECT p2p_welcome_message, p2p_merchant_name, withdrawal_pin_hash FROM profiles WHERE id = ${profileId}`);
      const row = rows.rows[0] as any;
      const pinState = getPinState(profileId);
      const isLocked = pinState.lockedUntil && pinState.lockedUntil > new Date();
      res.json({
        welcomeMessage: row?.p2p_welcome_message ?? "",
        merchantName: row?.p2p_merchant_name ?? null,
        hasPin: !!(row?.withdrawal_pin_hash),
        pinLocked: !!isLocked,
        pinLockedUntil: isLocked ? pinState.lockedUntil : null,
        pinAttempts: pinState.attempts,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // PUT /api/p2p/settings — update seller's welcome message
  app.put("/api/p2p/settings", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = req.session.profileId;
      const { welcomeMessage } = req.body;
      const msg = typeof welcomeMessage === "string" ? welcomeMessage.trim().slice(0, 500) : "";
      await db.execute(sql`UPDATE profiles SET p2p_welcome_message = ${msg || null} WHERE id = ${profileId}`);
      res.json({ success: true, welcomeMessage: msg });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/p2p/merchant-name — set merchant display name (one-time, immutable)
  app.post("/api/p2p/merchant-name", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = req.session.profileId;
      const { merchantName } = req.body;
      const name = typeof merchantName === "string" ? merchantName.trim().slice(0, 60) : "";
      if (!name) return res.status(400).json({ message: "Merchant name cannot be empty." });
      // Check if already set — immutable once chosen
      const rows = await db.execute(sql`SELECT p2p_merchant_name FROM profiles WHERE id = ${profileId}`);
      const existing = (rows.rows[0] as any)?.p2p_merchant_name;
      if (existing) return res.status(409).json({ message: "Merchant name is already set and cannot be changed." });
      await db.execute(sql`UPDATE profiles SET p2p_merchant_name = ${name} WHERE id = ${profileId}`);
      res.json({ success: true, merchantName: name });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/p2p/orders/:id/release-pin — verify PIN then release USDT to buyer
  app.post("/api/p2p/orders/:id/release-pin", isAuthenticated, async (req: any, res) => {
    const profileId = req.session.profileId;
    const orderId = Number(req.params.id);
    const { pin } = req.body;

    try {
      // 1. Check lockout
      const state = getPinState(profileId);
      if (state.lockedUntil && state.lockedUntil > new Date()) {
        return res.status(429).json({
          message: "Too many failed attempts. For security reasons, the release feature is locked for 30 minutes. Please try again later.",
          locked: true,
          lockedUntil: state.lockedUntil,
        });
      }
      // Reset lockout if expired
      if (state.lockedUntil && state.lockedUntil <= new Date()) {
        state.attempts = 0;
        state.lockedUntil = null;
      }

      if (!pin) return res.status(400).json({ message: "PIN is required" });

      // 2. Get order and verify seller
      const rows = await db.execute(sql`SELECT * FROM p2p_orders WHERE id = ${orderId} AND seller_id = ${profileId}`);
      const order = rows.rows[0] as any;
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.status !== "paid") return res.status(400).json({ message: "Order must be in 'paid' status to release" });

      // 3. Get seller PIN hash
      const pinRows = await db.execute(sql`SELECT withdrawal_pin_hash, full_name FROM profiles WHERE id = ${profileId}`);
      const seller = pinRows.rows[0] as any;
      if (!seller?.withdrawal_pin_hash) {
        return res.status(403).json({ message: "You must set a withdrawal PIN before releasing funds. Go to Security settings." });
      }

      // 4. Verify PIN
      const bcryptLib = await import("bcrypt");
      const valid = await bcryptLib.compare(String(pin), seller.withdrawal_pin_hash);
      if (!valid) {
        state.attempts += 1;
        const remaining = 5 - state.attempts;
        // Log failed attempt
        await db.execute(sql`
          INSERT INTO security_events (profile_id, event_type, details, ip_address, status)
          VALUES (${profileId}, 'p2p_release_pin_fail', ${'Failed P2P release PIN attempt. Order: ' + orderId + '. Attempts: ' + state.attempts}, '', 'failed')
        `).catch(() => {});
        if (state.attempts >= 5) {
          state.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
          await db.execute(sql`
            INSERT INTO security_events (profile_id, event_type, details, ip_address, status)
            VALUES (${profileId}, 'p2p_release_pin_lockout', ${'P2P release locked for 30 min after 5 failed PIN attempts. Order: ' + orderId}, '', 'blocked')
          `).catch(() => {});
          return res.status(429).json({
            message: "Too many failed attempts. For security reasons, the release feature is locked for 30 minutes. Please try again later.",
            locked: true,
            lockedUntil: state.lockedUntil,
          });
        }
        return res.status(401).json({
          message: `Incorrect PIN. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining before lockout.`,
          attemptsRemaining: remaining,
        });
      }

      // 5. PIN correct — reset counter
      state.attempts = 0;
      state.lockedUntil = null;

      // 6. Release funds to buyer
      const amount = parseFloat(order.amount_usdt);
      const buyerRows = await db.execute(sql`SELECT balance FROM profiles WHERE id = ${order.buyer_id}`);
      const prevBuyerBal = parseFloat((buyerRows.rows[0] as any)?.balance || "0");
      await db.execute(sql`UPDATE profiles SET balance = balance + ${amount} WHERE id = ${order.buyer_id}`);
      await db.execute(sql`INSERT INTO balance_logs (profile_id, previous_balance, new_balance, change, action, reference_id) VALUES (${order.buyer_id}, ${prevBuyerBal}, ${prevBuyerBal + amount}, ${amount}, 'p2p_received', ${String(orderId)})`);
      await db.execute(sql`UPDATE p2p_orders SET status = 'released', released_at = NOW(), seller_confirmed_receipt = true WHERE id = ${orderId}`);
      await db.execute(sql`INSERT INTO p2p_chat_messages (order_id, sender_id, message) VALUES (${orderId}, ${profileId}, ${'✅ Seller has released USDT to buyer. Trade complete!'})`);
      await db.execute(sql`INSERT INTO notifications (profile_id, type, title, message) VALUES (${order.buyer_id}, 'custom_message', 'P2P Trade Complete', 'Your USDT has been released. Funds added to your balance.')`).catch(() => {});

      // Log success
      await db.execute(sql`
        INSERT INTO security_events (profile_id, event_type, details, ip_address, status)
        VALUES (${profileId}, 'p2p_release_success', ${'P2P release successful. Order: ' + orderId + ', Amount: ' + amount + ' USDT'}, '', 'success')
      `).catch(() => {});

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/p2p/pin-lockout-status — check current lockout for logged in seller
  app.get("/api/p2p/pin-lockout", isAuthenticated, async (req: any, res) => {
    const profileId = req.session.profileId;
    const state = getPinState(profileId);
    const isLocked = state.lockedUntil && state.lockedUntil > new Date();
    res.json({
      locked: !!isLocked,
      lockedUntil: isLocked ? state.lockedUntil : null,
      attempts: state.attempts,
    });
  });

  // POST /api/p2p/upload-url — get presigned upload URL for P2P chat image
  app.post("/api/p2p/upload-url", isAuthenticated, async (req: any, res) => {
    try {
      const { name, size, contentType } = req.body;
      if (!name) return res.status(400).json({ message: "File name required" });
      const maxSize = 10 * 1024 * 1024;
      if (size && size > maxSize) return res.status(400).json({ message: "File too large (max 10MB)" });
      const { ObjectStorageService } = await import("./replit_integrations/object_storage");
      const objectStorage = new ObjectStorageService();
      const uploadURL = await objectStorage.getObjectEntityUploadURL();
      const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);
      res.json({ uploadURL, objectPath });
    } catch (e: any) {
      console.error("P2P upload-url error:", e);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  // GET /api/p2p/payment-methods — get allowed methods for current user's country
  app.get("/api/p2p/payment-methods", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = req.session.profileId;
      const rows = await db.execute(sql`SELECT country FROM profiles WHERE id = ${profileId}`);
      const country = (rows.rows[0] as any)?.country || "default";
      const group = getCountryGroup(country);
      const currency = getCountryCurrency(country);
      res.json({ methods: getP2PPaymentMethods(group), country, group, currency });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/p2p/ban — check if current user is P2P-banned
  app.get("/api/p2p/ban", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = req.session.profileId;
      const ban = await db.execute(sql`
        SELECT banned_until, reason FROM p2p_bans
        WHERE profile_id = ${profileId} AND banned_until > NOW()
        LIMIT 1
      `);
      if (ban.rows.length > 0) {
        return res.json({ banned: true, bannedUntil: (ban.rows[0] as any).banned_until, reason: (ban.rows[0] as any).reason });
      }
      res.json({ banned: false });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/p2p/ads — marketplace listing (filtered by buyer's country group)
  app.get("/api/p2p/ads", isAuthenticated, isKycVerified, async (req: any, res) => {
    try {
      await autoExpireOrders();
      const profileId = req.session.profileId;
      const buyerRows = await db.execute(sql`SELECT country, id FROM profiles WHERE id = ${profileId}`);
      const buyer = buyerRows.rows[0] as any;
      const buyerGroup = getCountryGroup(buyer?.country || "default");
      // Filter to same market: HT users see HTG ads, US users see USD ads, others see all
      const ads = await db.execute(sql`
        SELECT a.*,
               COALESCE(p.p2p_merchant_name, 'Anonymous') as seller_name,
               p.country as seller_country,
               p.kyc_status as seller_kyc
        FROM p2p_ads a
        JOIN profiles p ON a.seller_id = p.id
        WHERE a.status = 'active'
          AND a.available_usdt > 0
          AND a.seller_id != ${profileId}
          AND (
            ${buyerGroup === "default"} = true
            OR a.country = ${buyer?.country || "default"}
            OR (${buyerGroup} = 'HT' AND a.currency = 'HTG')
            OR (${buyerGroup} = 'US' AND a.currency = 'USD')
          )
        ORDER BY a.rate_htg ASC
        LIMIT 100
      `);
      res.json(ads.rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // GET /api/p2p/ads/my — seller's own ads
  app.get("/api/p2p/ads/my", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = req.session.profileId;
      const ads = await db.execute(sql`
        SELECT a.*, 
          (SELECT COUNT(*) FROM p2p_orders o WHERE o.ad_id = a.id AND o.status NOT IN ('cancelled')) as order_count
        FROM p2p_ads a
        WHERE a.seller_id = ${profileId}
        ORDER BY a.created_at DESC
      `);
      res.json(ads.rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/p2p/ads — create a new ad (locks USDT from balance)
  app.post("/api/p2p/ads", isAuthenticated, isKycVerified, async (req: any, res) => {
    try {
      const profileId = req.session.profileId;
      const { amountUsdt, rateHtg, marginPct, currency, paymentMethods, minOrderUsdt, maxOrderUsdt, termsNote } = req.body;

      if (!amountUsdt || amountUsdt < 10) return res.status(400).json({ message: "Minimum listing is 10 USDT" });
      if (!paymentMethods || paymentMethods.length === 0) return res.status(400).json({ message: "At least one payment method required" });

      // Get seller profile
      const pRows = await db.execute(sql`SELECT balance, country, kyc_status, full_name, p2p_seller_restricted FROM profiles WHERE id = ${profileId}`);
      const seller = pRows.rows[0] as any;
      if (!seller) return res.status(404).json({ message: "Profile not found" });
      if (seller.kyc_status !== "verified") return res.status(403).json({ message: "KYC required" });
      if (seller.p2p_seller_restricted) return res.status(403).json({ message: "Your account has been restricted from posting P2P ads. Please contact support." });

      const balance = parseFloat(seller.balance);
      const amount = parseFloat(amountUsdt);
      if (balance < amount) return res.status(400).json({ message: "Insufficient balance" });

      const country = seller.country || "HT";
      const countryGroup = getCountryGroup(country);
      const allowedMethods = getP2PPaymentMethods(countryGroup);
      const adCurrency = getCountryCurrency(country);

      // Validate payment methods strictly against country-allowed list
      const methodsArray = Array.isArray(paymentMethods) ? paymentMethods : [paymentMethods];
      const invalidMethods = methodsArray.filter((m: string) => !allowedMethods.includes(m));
      if (invalidMethods.length > 0) {
        return res.status(400).json({ message: `${invalidMethods.join(", ")} not allowed for sellers in ${country}. Allowed: ${allowedMethods.join(", ")}` });
      }

      // Validate Haiti rate restriction
      if (countryGroup === "HT") {
        if (!rateHtg) return res.status(400).json({ message: "Rate (HTG/USDT) is required for Haiti sellers" });
        const rate = parseFloat(rateHtg);
        if (rate < HAITI_RATE_MIN || rate > HAITI_RATE_MAX) {
          return res.status(400).json({ message: `Rate must be between ${HAITI_RATE_MIN} and ${HAITI_RATE_MAX} HTG/USDT for Haiti` });
        }
      }

      // Lock funds: deduct from seller balance
      await db.execute(sql`UPDATE profiles SET balance = balance - ${amount} WHERE id = ${profileId}`);

      const methodsPgLiteral = '{' + methodsArray.map((m: string) => `"${m.replace(/"/g, '\\"')}"`).join(',') + '}';
      const ad = await db.execute(sql`
        INSERT INTO p2p_ads (seller_id, amount_usdt, available_usdt, rate_htg, margin_pct, currency, country, payment_methods, min_order_usdt, max_order_usdt, status, terms_note)
        VALUES (${profileId}, ${amount}, ${amount}, ${rateHtg || null}, ${marginPct || null}, ${adCurrency}, ${country}, ${methodsPgLiteral}::text[], ${minOrderUsdt || 10}, ${maxOrderUsdt || null}, 'active', ${termsNote || null})
        RETURNING *
      `);

      // Balance log
      await db.execute(sql`
        INSERT INTO balance_logs (profile_id, previous_balance, new_balance, change, action, reference_id)
        VALUES (${profileId}, ${balance}, ${balance - amount}, ${-amount}, 'p2p_ad_lock', ${String(ad.rows[0] ? (ad.rows[0] as any).id : "")})
      `);

      // Telegram alert: new P2P ad is now LIVE
      const newAd = ad.rows[0] as any;
      const sellerInfo = await db.execute(sql`SELECT full_name, email, reference_id FROM profiles WHERE id = ${profileId}`);
      const s = sellerInfo.rows[0] as any;
      sendTelegramMessage(
        `🆕 <b>New P2P Trade is LIVE!</b>\n\n` +
        `<b>Ad ID:</b> #${newAd.id}\n` +
        `<b>Seller:</b> ${s?.full_name || "Unknown"}\n` +
        `<b>Email:</b> ${s?.email || "—"}\n` +
        `<b>Ref:</b> ${s?.reference_id || profileId}\n` +
        `<b>Amount:</b> ${amount} USDT (locked in escrow)\n` +
        `<b>Rate:</b> ${rateHtg || "—"} ${adCurrency}/USDT\n` +
        `<b>Order range:</b> ${minOrderUsdt || 10} – ${maxOrderUsdt || "∞"} USDT\n` +
        `<b>Payment:</b> ${methodsArray.join(", ")}\n` +
        `<b>Country:</b> ${country}`
      ).catch(() => {});

      res.json(ad.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // PATCH /api/p2p/ads/:id/toggle-pause — pause or resume an ad
  app.patch("/api/p2p/ads/:id/toggle-pause", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = req.session.profileId;
      const adId = Number(req.params.id);
      const adRows = await db.execute(sql`SELECT * FROM p2p_ads WHERE id = ${adId} AND seller_id = ${profileId}`);
      const ad = adRows.rows[0] as any;
      if (!ad) return res.status(404).json({ message: "Ad not found" });
      const newStatus = ad.status === "active" ? "paused" : "active";
      await db.execute(sql`UPDATE p2p_ads SET status = ${newStatus}, updated_at = NOW() WHERE id = ${adId}`);
      res.json({ status: newStatus });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // DELETE /api/p2p/ads/:id — cancel an ad (refund available USDT)
  app.delete("/api/p2p/ads/:id", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = req.session.profileId;
      const adId = Number(req.params.id);
      const adRows = await db.execute(sql`SELECT * FROM p2p_ads WHERE id = ${adId} AND seller_id = ${profileId}`);
      const ad = adRows.rows[0] as any;
      if (!ad) return res.status(404).json({ message: "Ad not found" });
      if (ad.status === "cancelled") return res.status(400).json({ message: "Ad already cancelled" });

      // Check if there are any active (paid) orders - cannot cancel if paid orders exist
      const activeOrders = await db.execute(sql`
        SELECT COUNT(*) as cnt FROM p2p_orders WHERE ad_id = ${adId} AND status = 'paid'
      `);
      if (parseInt((activeOrders.rows[0] as any)?.cnt) > 0) {
        return res.status(400).json({ message: "Cannot cancel ad: there are orders with 'Paid' status awaiting release" });
      }

      const available = parseFloat(ad.available_usdt);

      // Refund available USDT back to seller
      await db.execute(sql`UPDATE profiles SET balance = balance + ${available} WHERE id = ${profileId}`);
      await db.execute(sql`UPDATE p2p_ads SET status = 'cancelled', updated_at = NOW() WHERE id = ${adId}`);

      // Cancel any pending orders for this ad
      await db.execute(sql`UPDATE p2p_orders SET status = 'cancelled', cancelled_by = 'seller', cancellation_reason = 'Ad cancelled by seller', cancelled_at = NOW() WHERE ad_id = ${adId} AND status = 'pending'`);

      const pRows = await db.execute(sql`SELECT balance FROM profiles WHERE id = ${profileId}`);
      const newBal = (pRows.rows[0] as any)?.balance;
      const prevBal = newBal - available;
      await db.execute(sql`
        INSERT INTO balance_logs (profile_id, previous_balance, new_balance, change, action, reference_id)
        VALUES (${profileId}, ${prevBal}, ${newBal}, ${available}, 'p2p_ad_cancel_refund', ${String(adId)})
      `);

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/p2p/orders — buyer creates an order
  app.post("/api/p2p/orders", isAuthenticated, isKycVerified, async (req: any, res) => {
    try {
      const buyerId = req.session.profileId;
      const { adId, amountUsdt, paymentMethod } = req.body;

      if (!adId || !amountUsdt || !paymentMethod) return res.status(400).json({ message: "Missing required fields" });

      // Check buyer ban
      const banCheck = await db.execute(sql`SELECT banned_until FROM p2p_bans WHERE profile_id = ${buyerId} AND banned_until > NOW() LIMIT 1`);
      if (banCheck.rows.length > 0) {
        const until = new Date((banCheck.rows[0] as any).banned_until).toLocaleTimeString();
        return res.status(403).json({ message: `You are temporarily banned from P2P until ${until} due to excessive cancellations.` });
      }

      // Get ad
      const adRows = await db.execute(sql`SELECT * FROM p2p_ads WHERE id = ${adId} AND status = 'active'`);
      const ad = adRows.rows[0] as any;
      if (!ad) return res.status(404).json({ message: "Ad not found or no longer active" });

      const amount = parseFloat(amountUsdt);
      const minOrder = parseFloat(ad.min_order_usdt);
      const maxOrder = ad.max_order_usdt ? parseFloat(ad.max_order_usdt) : Infinity;
      const available = parseFloat(ad.available_usdt);

      if (ad.seller_id === buyerId) return res.status(400).json({ message: "Cannot buy from your own ad" });
      if (amount < minOrder) return res.status(400).json({ message: `Minimum order is ${minOrder} USDT` });
      if (amount > maxOrder) return res.status(400).json({ message: `Maximum order is ${maxOrder} USDT` });
      if (amount > available) return res.status(400).json({ message: "Insufficient USDT available on this ad" });

      // Calculate local amount
      const rate = parseFloat(ad.rate_htg) || 140;
      const amountLocal = amount * rate;

      // Reserve USDT on the ad
      await db.execute(sql`UPDATE p2p_ads SET available_usdt = available_usdt - ${amount}, updated_at = NOW() WHERE id = ${adId}`);

      // Create order with 60-minute expiry
      const orderId = generateOrderId();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const orderRows = await db.execute(sql`
        INSERT INTO p2p_orders (order_id, ad_id, buyer_id, seller_id, amount_usdt, amount_local, rate, currency, payment_method, status, expires_at)
        VALUES (${orderId}, ${adId}, ${buyerId}, ${ad.seller_id}, ${amount}, ${amountLocal}, ${rate}, ${ad.currency || "HTG"}, ${paymentMethod}, 'pending', ${expiresAt})
        RETURNING *, amount_local as total_htg, rate as rate_htg
      `);
      const order = orderRows.rows[0] as any;

      // Auto-post seller welcome message if set
      const welcomeRows = await db.execute(sql`SELECT p2p_welcome_message, full_name FROM profiles WHERE id = ${order.seller_id}`);
      const sellerWelcome = (welcomeRows.rows[0] as any)?.p2p_welcome_message;
      if (sellerWelcome?.trim()) {
        await db.execute(sql`
          INSERT INTO p2p_chat_messages (order_id, sender_id, message)
          VALUES (${order.id}, ${order.seller_id}, ${sellerWelcome.trim()})
        `);
      }

      // Notify seller via WhatsApp
      const buyerRows = await db.execute(sql`SELECT full_name FROM profiles WHERE id = ${buyerId}`);
      const sellerRows = await db.execute(sql`SELECT full_name, phone FROM profiles WHERE id = ${ad.seller_id}`);
      const buyer = buyerRows.rows[0] as any;
      const seller = sellerRows.rows[0] as any;

      if (seller?.phone) {
        sendWhatsAppNotification(
          seller.phone,
          `*Izichanj P2P Market*\n\n📦 New Order Received!\n\nBuyer: ${buyer?.full_name || "A user"}\nAmount: ${amount} USDT\nRate: ${rate} ${ad.currency || "HTG"}\nTotal: ${amountLocal.toFixed(2)} ${ad.currency || "HTG"}\nPayment: ${paymentMethod}\nOrder ID: ${orderId}\n\nPlease respond quickly!`,
          seller.full_name
        );
      }

      // Telegram alert to admin for every new P2P order
      sendTelegramMessage(
        `🔔 <b>New P2P Order!</b>\n\n` +
        `<b>Trade ID:</b> #${orderId}\n` +
        `<b>Buyer:</b> ${buyer?.full_name || "Unknown"}\n` +
        `<b>Seller:</b> ${seller?.full_name || "Unknown"}\n` +
        `<b>Amount:</b> ${amount} USDT\n` +
        `<b>Total:</b> ${amountLocal.toFixed(2)} ${ad.currency || "HTG"}\n` +
        `<b>Payment:</b> ${paymentMethod}`
      ).catch(() => {});

      // Add system message to chat
      await db.execute(sql`
        INSERT INTO p2p_chat_messages (order_id, sender_id, message)
        VALUES (${order.id}, ${buyerId}, ${'Order created. Waiting for buyer to complete payment.'})
      `);

      res.json(order);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Handler for listing user's orders (buyer & seller)
  const getMyOrders = async (req: any, res: any) => {
    try {
      await autoExpireOrders();
      const profileId = req.session.profileId;
      const orders = await db.execute(sql`
        SELECT o.*,
          o.amount_local as total_htg,
          o.rate as rate_htg,
          bp.full_name as buyer_name,
          COALESCE(sp.p2p_merchant_name, 'Anonymous') as seller_name,
          a.rate_htg as ad_rate_htg, a.currency as ad_currency
        FROM p2p_orders o
        JOIN profiles bp ON o.buyer_id = bp.id
        JOIN profiles sp ON o.seller_id = sp.id
        JOIN p2p_ads a ON o.ad_id = a.id
        WHERE o.buyer_id = ${profileId} OR o.seller_id = ${profileId}
        ORDER BY o.created_at DESC
      `);
      res.json(orders.rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  };

  // GET /api/p2p/orders — alias (frontend uses this)
  app.get("/api/p2p/orders", isAuthenticated, getMyOrders);

  // GET /api/p2p/orders/my — buyer and seller orders
  app.get("/api/p2p/orders/my", isAuthenticated, getMyOrders);

  // GET /api/p2p/orders/:id — order detail
  app.get("/api/p2p/orders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = req.session.profileId;
      const orderId = Number(req.params.id);
      const rows = await db.execute(sql`
        SELECT o.*,
          bp.full_name as buyer_name, bp.phone as buyer_phone,
          COALESCE(sp.p2p_merchant_name, 'Anonymous') as seller_name, sp.phone as seller_phone,
          a.payment_methods as ad_payment_methods, a.terms_note
        FROM p2p_orders o
        JOIN profiles bp ON o.buyer_id = bp.id
        JOIN profiles sp ON o.seller_id = sp.id
        JOIN p2p_ads a ON o.ad_id = a.id
        WHERE o.id = ${orderId} AND (o.buyer_id = ${profileId} OR o.seller_id = ${profileId})
      `);
      if (!rows.rows[0]) return res.status(404).json({ message: "Order not found" });
      res.json(rows.rows[0]);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // PATCH /api/p2p/orders/:id/pay — buyer marks as paid (locks crypto)
  app.patch("/api/p2p/orders/:id/pay", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = req.session.profileId;
      const orderId = Number(req.params.id);
      const rows = await db.execute(sql`SELECT * FROM p2p_orders WHERE id = ${orderId} AND buyer_id = ${profileId}`);
      const order = rows.rows[0] as any;
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.status !== "pending") return res.status(400).json({ message: `Order is already ${order.status}` });

      await db.execute(sql`UPDATE p2p_orders SET status = 'paid', paid_at = NOW() WHERE id = ${orderId}`);

      // Add chat message
      await db.execute(sql`
        INSERT INTO p2p_chat_messages (order_id, sender_id, message)
        VALUES (${orderId}, ${profileId}, ${'💰 Buyer has marked this order as PAID. Seller: please verify payment and release crypto.'})
      `);

      // Notify seller
      const sellerRows = await db.execute(sql`SELECT full_name, phone FROM profiles WHERE id = ${order.seller_id}`);
      const seller = sellerRows.rows[0] as any;
      if (seller?.phone) {
        sendWhatsAppNotification(
          seller.phone,
          `*Izichanj P2P Market*\n\n✅ Payment Confirmed!\n\nOrder: ${order.order_id}\nBuyer says they have paid ${order.amount_local} ${order.currency}.\n\nPlease verify and release crypto if payment received.`,
          seller.full_name
        );
      }

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // PATCH /api/p2p/orders/:id/release — seller releases crypto to buyer
  app.patch("/api/p2p/orders/:id/release", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = req.session.profileId;
      const orderId = Number(req.params.id);
      const { confirmedReceipt } = req.body;
      if (!confirmedReceipt) return res.status(400).json({ message: "You must confirm you have received the funds before releasing crypto." });

      const rows = await db.execute(sql`SELECT * FROM p2p_orders WHERE id = ${orderId} AND seller_id = ${profileId}`);
      const order = rows.rows[0] as any;
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.status !== "paid") return res.status(400).json({ message: "Order must be in 'paid' status to release" });

      const amount = parseFloat(order.amount_usdt);

      // Credit buyer balance
      const buyerRows = await db.execute(sql`SELECT balance FROM profiles WHERE id = ${order.buyer_id}`);
      const prevBuyerBal = parseFloat((buyerRows.rows[0] as any)?.balance || "0");
      await db.execute(sql`UPDATE profiles SET balance = balance + ${amount} WHERE id = ${order.buyer_id}`);
      await db.execute(sql`
        INSERT INTO balance_logs (profile_id, previous_balance, new_balance, change, action, reference_id)
        VALUES (${order.buyer_id}, ${prevBuyerBal}, ${prevBuyerBal + amount}, ${amount}, 'p2p_order_received', ${order.order_id})
      `);

      // Update order
      await db.execute(sql`UPDATE p2p_orders SET status = 'released', seller_confirmed_receipt = true, released_at = NOW() WHERE id = ${orderId}`);

      // Check if ad is now fully sold
      const adRows = await db.execute(sql`SELECT available_usdt FROM p2p_ads WHERE id = ${order.ad_id}`);
      const adAvail = parseFloat((adRows.rows[0] as any)?.available_usdt || "0");
      if (adAvail <= 0) {
        await db.execute(sql`UPDATE p2p_ads SET status = 'completed', updated_at = NOW() WHERE id = ${order.ad_id}`);
      }

      // System chat message
      await db.execute(sql`
        INSERT INTO p2p_chat_messages (order_id, sender_id, message)
        VALUES (${orderId}, ${profileId}, ${'🎉 Crypto released! Trade complete. Thank you for using Izichanj P2P.'})
      `);

      // Notify buyer
      const buyerProfileRows = await db.execute(sql`SELECT full_name, phone FROM profiles WHERE id = ${order.buyer_id}`);
      const buyer = buyerProfileRows.rows[0] as any;
      if (buyer?.phone) {
        sendWhatsAppNotification(
          buyer.phone,
          `*Izichanj P2P Market*\n\n🎉 Trade Complete!\n\nOrder: ${order.order_id}\n${amount} USDT has been added to your Izichanj balance.\n\nThank you for trading with us!`,
          buyer.full_name
        );
      }

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // PATCH /api/p2p/orders/:id/cancel — cancel order (buyer or seller)
  app.patch("/api/p2p/orders/:id/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = req.session.profileId;
      const orderId = Number(req.params.id);
      const { reason } = req.body;
      if (!reason) return res.status(400).json({ message: "Cancellation reason is required" });

      const rows = await db.execute(sql`SELECT * FROM p2p_orders WHERE id = ${orderId}`);
      const order = rows.rows[0] as any;
      if (!order) return res.status(404).json({ message: "Order not found" });

      const isBuyer = order.buyer_id === profileId;
      const isSeller = order.seller_id === profileId;
      if (!isBuyer && !isSeller) return res.status(403).json({ message: "Not authorized" });

      // Seller cannot cancel if buyer already marked as paid
      if (isSeller && order.status === "paid") {
        return res.status(400).json({ message: "Cannot cancel: buyer has already marked as paid. Raise a dispute if needed." });
      }
      if (order.status !== "pending") {
        return res.status(400).json({ message: `Cannot cancel: order is ${order.status}` });
      }

      const role = isBuyer ? "buyer" : "seller";
      await db.execute(sql`
        UPDATE p2p_orders SET status = 'cancelled', cancelled_by = ${role}, cancellation_reason = ${reason}, cancelled_at = NOW()
        WHERE id = ${orderId}
      `);

      // Return USDT to ad available pool
      await db.execute(sql`
        UPDATE p2p_ads SET available_usdt = available_usdt + ${parseFloat(order.amount_usdt)}, updated_at = NOW()
        WHERE id = ${order.ad_id}
      `);

      // Log cancellation
      await db.execute(sql`
        INSERT INTO p2p_cancellations (profile_id, order_id, role, reason)
        VALUES (${profileId}, ${orderId}, ${role}, ${reason})
      `);

      // Anti-abuse: count buyer cancellations in last 24h
      if (isBuyer) {
        const cancelCount = await db.execute(sql`
          SELECT COUNT(*) as cnt FROM p2p_cancellations
          WHERE profile_id = ${profileId} AND role = 'buyer'
            AND created_at > NOW() - INTERVAL '24 hours'
        `);
        const cnt = parseInt((cancelCount.rows[0] as any)?.cnt || "0");
        if (cnt >= P2P_CANCEL_LIMIT) {
          const bannedUntil = new Date(Date.now() + P2P_BAN_HOURS * 3600 * 1000).toISOString();
          await db.execute(sql`DELETE FROM p2p_bans WHERE profile_id = ${profileId}`);
          await db.execute(sql`
            INSERT INTO p2p_bans (profile_id, banned_until, reason)
            VALUES (${profileId}, ${bannedUntil}, '3 cancellations within 24 hours')
          `);
        }
      }

      // Chat message
      await db.execute(sql`
        INSERT INTO p2p_chat_messages (order_id, sender_id, message)
        VALUES (${orderId}, ${profileId}, ${`❌ Order cancelled by ${role}. Reason: ${reason}`})
      `);

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // PATCH /api/p2p/orders/:id/dispute — raise dispute
  app.patch("/api/p2p/orders/:id/dispute", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = req.session.profileId;
      const orderId = Number(req.params.id);
      const { reason } = req.body;
      if (!reason) return res.status(400).json({ message: "Dispute reason is required" });

      const rows = await db.execute(sql`SELECT * FROM p2p_orders WHERE id = ${orderId}`);
      const order = rows.rows[0] as any;
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.buyer_id !== profileId && order.seller_id !== profileId) return res.status(403).json({ message: "Not authorized" });

      await db.execute(sql`UPDATE p2p_orders SET status = 'disputed', dispute_reason = ${reason}, updated_at = NOW() WHERE id = ${orderId}`);

      // Notify admin via Telegram
      const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
      const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
      if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
        const userRows = await db.execute(sql`SELECT full_name FROM profiles WHERE id = ${profileId}`);
        const userName = (userRows.rows[0] as any)?.full_name || "Unknown";
        const msg = `🚨 P2P Dispute!\n\nOrder: ${order.order_id}\nRaised by: ${userName}\nReason: ${reason}`;
        fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg }),
        }).catch(() => {});
      }

      // Chat message
      await db.execute(sql`
        INSERT INTO p2p_chat_messages (order_id, sender_id, message)
        VALUES (${orderId}, ${profileId}, ${`⚠️ DISPUTE raised. Reason: ${reason}. Admin has been notified.`})
      `);

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── P2P Anti-Off-Platform Filter ──
  // Forbidden words (case-insensitive). Use word-boundary patterns so "facebook" matches but "facebookery" does too (intentional - bypass attempts).
  const P2P_FORBIDDEN_WORDS = ["whatsapp", "telegram", "instagram", "facebook", "\\bfb\\b", "\\big\\b", "\\bwa\\b"];
  const P2P_URL_REGEX = /\bhttps?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|me|app|co|biz|info|shop|store|live|tv|xyz|link|us|fr|ht|cn|ru|in)\b/i;

  function checkP2PForbiddenContent(message: string | null | undefined): { blocked: boolean; reason?: string } {
    if (!message) return { blocked: false };
    const text = message.toLowerCase();
    for (const w of P2P_FORBIDDEN_WORDS) {
      const pattern = w.startsWith("\\b") ? new RegExp(w, "i") : new RegExp(`\\b${w}\\b`, "i");
      if (pattern.test(text)) return { blocked: true, reason: `forbidden_word:${w.replace(/\\b/g, "")}` };
    }
    if (P2P_URL_REGEX.test(message)) return { blocked: true, reason: "external_link" };
    return { blocked: false };
  }

  // GET /api/p2p/orders/:id/chat — alias for /messages (frontend uses this path)
  app.get("/api/p2p/orders/:id/chat", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = req.session.profileId;
      const orderId = Number(req.params.id);
      const orderCheck = await db.execute(sql`SELECT buyer_id, seller_id FROM p2p_orders WHERE id = ${orderId}`);
      const order = orderCheck.rows[0] as any;
      if (!order || (order.buyer_id !== profileId && order.seller_id !== profileId)) {
        return res.status(403).json({ message: "Not authorized" });
      }
      // Mark messages from other party as read
      await db.execute(sql`
        UPDATE p2p_chat_messages SET read_at = NOW()
        WHERE order_id = ${orderId} AND sender_id != ${profileId} AND read_at IS NULL
      `);
      const messages = await db.execute(sql`
        SELECT m.*, p.full_name as sender_name
        FROM p2p_chat_messages m
        JOIN profiles p ON m.sender_id = p.id
        WHERE m.order_id = ${orderId}
          AND (m.is_filtered = FALSE OR m.is_filtered IS NULL OR m.sender_id = ${profileId})
        ORDER BY m.created_at ASC
      `);
      res.json(messages.rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/p2p/orders/:id/chat — alias for /messages (frontend uses this path)
  app.post("/api/p2p/orders/:id/chat", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = req.session.profileId;
      const orderId = Number(req.params.id);
      const { message, fileUrl, fileName } = req.body;
      if (!message && !fileUrl) return res.status(400).json({ message: "Message or file required" });
      const orderCheck = await db.execute(sql`SELECT buyer_id, seller_id, status FROM p2p_orders WHERE id = ${orderId}`);
      const order = orderCheck.rows[0] as any;
      if (!order || (order.buyer_id !== profileId && order.seller_id !== profileId)) {
        return res.status(403).json({ message: "Not authorized" });
      }
      if (["released", "cancelled"].includes(order.status)) {
        return res.status(400).json({ message: "Trade is closed, chat disabled" });
      }
      // Anti-off-platform filter: save flagged messages but hide from other party
      const filterResult = checkP2PForbiddenContent(message);
      const isFiltered = filterResult.blocked;
      const msg = await db.execute(sql`
        INSERT INTO p2p_chat_messages (order_id, sender_id, message, file_url, file_name, is_filtered, filter_reason)
        VALUES (${orderId}, ${profileId}, ${message || null}, ${fileUrl || null}, ${fileName || null}, ${isFiltered}, ${filterResult.reason || null})
        RETURNING *
      `);
      const nameRows = await db.execute(sql`SELECT full_name FROM profiles WHERE id = ${profileId}`);
      res.json({
        ...(msg.rows[0] as any),
        sender_name: (nameRows.rows[0] as any)?.full_name,
        filtered: isFiltered,
        filter_warning: isFiltered ? "For your security, sharing social media contacts or external links is strictly prohibited on Izichanj." : undefined,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/p2p/orders/:id/pay — POST alias for PATCH pay route
  app.post("/api/p2p/orders/:id/pay", isAuthenticated, async (req: any, res) => {
    req.method = "PATCH";
    const profileId = req.session.profileId;
    const orderId = Number(req.params.id);
    try {
      const rows = await db.execute(sql`SELECT * FROM p2p_orders WHERE id = ${orderId} AND buyer_id = ${profileId}`);
      const order = rows.rows[0] as any;
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.status !== "pending") return res.status(400).json({ message: `Order is already ${order.status}` });
      await db.execute(sql`UPDATE p2p_orders SET status = 'paid', paid_at = NOW() WHERE id = ${orderId}`);
      await db.execute(sql`INSERT INTO p2p_chat_messages (order_id, sender_id, message) VALUES (${orderId}, ${profileId}, ${'💰 Buyer has marked this order as PAID. Seller: please verify payment and release crypto.'})`);
      const sellerRows = await db.execute(sql`SELECT full_name, phone FROM profiles WHERE id = ${order.seller_id}`);
      const seller = sellerRows.rows[0] as any;
      if (seller?.phone) {
        sendWhatsAppNotification(seller.phone, `*Izichanj P2P Market*\n\n✅ Payment Confirmed!\n\nOrder: ${order.order_id}\nBuyer says they have paid ${order.amount_local} ${order.currency}.\n\nPlease verify and release crypto if payment received.`, seller.full_name);
      }
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/p2p/orders/:id/release — POST alias for PATCH release route
  app.post("/api/p2p/orders/:id/release", isAuthenticated, async (req: any, res) => {
    const profileId = req.session.profileId;
    const orderId = Number(req.params.id);
    const { confirmedReceipt } = req.body;
    try {
      if (!confirmedReceipt) return res.status(400).json({ message: "You must confirm you have received the funds before releasing crypto." });
      const rows = await db.execute(sql`SELECT * FROM p2p_orders WHERE id = ${orderId} AND seller_id = ${profileId}`);
      const order = rows.rows[0] as any;
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.status !== "paid") return res.status(400).json({ message: "Order must be in 'paid' status to release" });
      const amount = parseFloat(order.amount_usdt);
      const buyerRows = await db.execute(sql`SELECT balance FROM profiles WHERE id = ${order.buyer_id}`);
      const prevBuyerBal = parseFloat((buyerRows.rows[0] as any)?.balance || "0");
      await db.execute(sql`UPDATE profiles SET balance = balance + ${amount} WHERE id = ${order.buyer_id}`);
      await db.execute(sql`INSERT INTO balance_logs (profile_id, previous_balance, new_balance, change, action, reference_id) VALUES (${order.buyer_id}, ${prevBuyerBal}, ${prevBuyerBal + amount}, ${amount}, 'p2p_received', ${String(orderId)})`);
      await db.execute(sql`UPDATE p2p_orders SET status = 'released', released_at = NOW(), seller_confirmed_receipt = true WHERE id = ${orderId}`);
      await db.execute(sql`INSERT INTO p2p_chat_messages (order_id, sender_id, message) VALUES (${orderId}, ${profileId}, ${'✅ Seller has released USDT to buyer. Trade complete!'})`);
      await db.execute(sql`INSERT INTO notifications (profile_id, type, title, message) VALUES (${order.buyer_id}, 'custom_message', 'P2P Trade Complete', 'Your USDT has been released by the seller. Funds added to your balance.')`).catch(() => {});
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/p2p/orders/:id/cancel — cancel order with mandatory reason + buyer confirmation
  app.post("/api/p2p/orders/:id/cancel", isAuthenticated, async (req: any, res) => {
    const profileId = req.session.profileId;
    const orderId = Number(req.params.id);
    const { reason, buyerConfirmedNoPayment } = req.body;
    if (!reason?.trim()) return res.status(400).json({ message: "A cancellation reason is required." });
    try {
      const rows = await db.execute(sql`SELECT * FROM p2p_orders WHERE id = ${orderId} AND (buyer_id = ${profileId} OR seller_id = ${profileId})`);
      const order = rows.rows[0] as any;
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (!["pending", "paid"].includes(order.status)) return res.status(400).json({ message: `Cannot cancel a ${order.status} order.` });
      const role = order.buyer_id === profileId ? "buyer" : "seller";
      // Seller cannot cancel if buyer already marked as paid
      if (role === "seller" && order.status === "paid") {
        return res.status(400).json({ message: "Cannot cancel: buyer has already marked as paid. Raise a dispute if needed." });
      }
      // Update order status
      await db.execute(sql`
        UPDATE p2p_orders SET status = 'cancelled', cancelled_by = ${role}, cancellation_reason = ${reason.trim()}, cancelled_at = NOW()
        WHERE id = ${orderId}
      `);
      // Return USDT to ad's available pool and re-activate ad if it was paused due to zero availability
      await db.execute(sql`
        UPDATE p2p_ads SET
          available_usdt = available_usdt + ${parseFloat(order.amount_usdt)},
          status = CASE WHEN status = 'paused' AND available_usdt + ${parseFloat(order.amount_usdt)} > 0 THEN 'active' ELSE status END,
          updated_at = NOW()
        WHERE id = ${order.ad_id} AND status NOT IN ('cancelled', 'completed')
      `);
      // Log to p2p_cancellations with buyer confirmation flag
      await db.execute(sql`
        INSERT INTO p2p_cancellations (profile_id, order_id, role, reason, buyer_confirmed_no_payment)
        VALUES (${profileId}, ${orderId}, ${role}, ${reason.trim()}, ${role === "buyer" ? !!buyerConfirmedNoPayment : null})
      `);
      // Chat message with reason
      const chatMsg = role === "buyer"
        ? `❌ Order cancelled by buyer. Reason: ${reason.trim()}. USDT returned to seller's ad.`
        : `❌ Order cancelled by seller. Reason: ${reason.trim()}. USDT returned to ad — ad is now live again.`;
      await db.execute(sql`INSERT INTO p2p_chat_messages (order_id, sender_id, message) VALUES (${orderId}, ${profileId}, ${chatMsg})`);
      // Anti-abuse: count buyer cancellations in last 24h
      if (role === "buyer") {
        const cancelCount = await db.execute(sql`SELECT COUNT(*) as cnt FROM p2p_cancellations WHERE profile_id = ${profileId} AND role = 'buyer' AND created_at > NOW() - INTERVAL '24 hours'`);
        const cnt = parseInt((cancelCount.rows[0] as any)?.cnt || "0");
        if (cnt >= P2P_CANCEL_LIMIT) {
          const bannedUntil = new Date(Date.now() + P2P_BAN_HOURS * 3600 * 1000).toISOString();
          await db.execute(sql`DELETE FROM p2p_bans WHERE profile_id = ${profileId}`);
          await db.execute(sql`INSERT INTO p2p_bans (profile_id, banned_until, reason) VALUES (${profileId}, ${bannedUntil}, '3 cancellations within 24 hours')`);
        }
      }
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/p2p/orders/:id/dispute — POST alias for PATCH dispute route
  app.post("/api/p2p/orders/:id/dispute", isAuthenticated, async (req: any, res) => {
    const profileId = req.session.profileId;
    const orderId = Number(req.params.id);
    const { reason } = req.body;
    try {
      if (!reason?.trim()) return res.status(400).json({ message: "Dispute reason required" });
      const rows = await db.execute(sql`SELECT * FROM p2p_orders WHERE id = ${orderId} AND (buyer_id = ${profileId} OR seller_id = ${profileId})`);
      const order = rows.rows[0] as any;
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (!["pending", "paid"].includes(order.status)) return res.status(400).json({ message: "Can only dispute pending or paid orders" });
      await db.execute(sql`UPDATE p2p_orders SET status = 'disputed', dispute_reason = ${reason}, updated_at = NOW() WHERE id = ${orderId}`);
      await db.execute(sql`INSERT INTO p2p_chat_messages (order_id, sender_id, message) VALUES (${orderId}, ${profileId}, ${`⚠️ Dispute opened: ${reason}`})`);
      const [buyerR, sellerR] = await Promise.all([
        db.execute(sql`SELECT full_name FROM profiles WHERE id = ${order.buyer_id}`),
        db.execute(sql`SELECT full_name FROM profiles WHERE id = ${order.seller_id}`)
      ]);
      const buyer = (buyerR.rows[0] as any)?.full_name;
      const seller = (sellerR.rows[0] as any)?.full_name;
      sendTelegramMessage(`⚠️ <b>P2P Dispute Opened</b>\n\nOrder: ${order.order_id}\nBuyer: ${buyer}\nSeller: ${seller}\nAmount: ${order.amount_usdt} USDT\nReason: ${reason}`).catch(() => {});
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/p2p/orders/:id/chat/read — mark messages as read
  app.post("/api/p2p/orders/:id/chat/read", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = req.session.profileId;
      const orderId = Number(req.params.id);
      await db.execute(sql`
        UPDATE p2p_chat_messages SET read_at = NOW()
        WHERE order_id = ${orderId} AND sender_id != ${profileId} AND read_at IS NULL
      `);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/p2p/orders/:id/messages — get chat messages
  app.get("/api/p2p/orders/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = req.session.profileId;
      const orderId = Number(req.params.id);

      // Verify user is party to this order
      const orderCheck = await db.execute(sql`SELECT buyer_id, seller_id FROM p2p_orders WHERE id = ${orderId}`);
      const order = orderCheck.rows[0] as any;
      if (!order || (order.buyer_id !== profileId && order.seller_id !== profileId)) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const messages = await db.execute(sql`
        SELECT m.*, p.full_name as sender_name
        FROM p2p_chat_messages m
        JOIN profiles p ON m.sender_id = p.id
        WHERE m.order_id = ${orderId}
          AND (m.is_filtered = FALSE OR m.is_filtered IS NULL OR m.sender_id = ${profileId})
        ORDER BY m.created_at ASC
      `);
      res.json(messages.rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // POST /api/p2p/orders/:id/messages — send a chat message
  app.post("/api/p2p/orders/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = req.session.profileId;
      const orderId = Number(req.params.id);
      const { message, fileUrl, fileName } = req.body;

      if (!message && !fileUrl) return res.status(400).json({ message: "Message or file required" });

      // Verify user is party
      const orderCheck = await db.execute(sql`SELECT buyer_id, seller_id, status FROM p2p_orders WHERE id = ${orderId}`);
      const order = orderCheck.rows[0] as any;
      if (!order || (order.buyer_id !== profileId && order.seller_id !== profileId)) {
        return res.status(403).json({ message: "Not authorized" });
      }
      if (["released", "cancelled"].includes(order.status)) {
        return res.status(400).json({ message: "Trade is closed, chat disabled" });
      }

      // Anti-off-platform filter
      const filterResult = checkP2PForbiddenContent(message);
      const isFiltered = filterResult.blocked;
      const msg = await db.execute(sql`
        INSERT INTO p2p_chat_messages (order_id, sender_id, message, file_url, file_name, is_filtered, filter_reason)
        VALUES (${orderId}, ${profileId}, ${message || null}, ${fileUrl || null}, ${fileName || null}, ${isFiltered}, ${filterResult.reason || null})
        RETURNING *
      `);
      const nameRows = await db.execute(sql`SELECT full_name FROM profiles WHERE id = ${profileId}`);
      res.json({
        ...(msg.rows[0] as any),
        sender_name: (nameRows.rows[0] as any)?.full_name,
        filtered: isFiltered,
        filter_warning: isFiltered ? "For your security, sharing social media contacts or external links is strictly prohibited on Izichanj." : undefined,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Canal+ Subscriptions ──────────────────────────────────────────────────
  const CANALPLUS_PLANS = [
    { name: "ToutCanal+", priceHtg: 3850, channels: 150 },
    { name: "Evasion+",   priceHtg: 2850, channels: 115 },
    { name: "Evasion",    priceHtg: 1850, channels: 90  },
    { name: "Acces",      priceHtg: 790,  channels: 45  },
  ];

  app.get("/api/canalplus/plans", isAuthenticated, (_req, res) => {
    const rate = getDepositRate();
    res.json(CANALPLUS_PLANS.map((p) => ({
      ...p,
      priceUsdt: parseFloat((p.priceHtg / rate).toFixed(4)),
    })));
  });

  app.post("/api/canalplus/subscribe", isAuthenticated, async (req: any, res) => {
    try {
      const { planName, cardNumber, autoRenew } = req.body;
      const profileId = req.session.profileId;
      if (!planName || !cardNumber) return res.status(400).json({ message: "Plan and card number are required" });
      if (!/^\d{14}$/.test(cardNumber)) return res.status(400).json({ message: "Card number must be exactly 14 digits" });

      const plan = CANALPLUS_PLANS.find((p) => p.name === planName);
      if (!plan) return res.status(400).json({ message: "Invalid plan selected" });

      const rate = getDepositRate();
      const priceUsdt = parseFloat((plan.priceHtg / rate).toFixed(4));

      const profileRows = await db.execute(sql`SELECT balance FROM profiles WHERE id = ${profileId}`);
      const balance = parseFloat((profileRows.rows[0] as any)?.balance || "0");
      if (balance < priceUsdt) {
        return res.status(400).json({ message: `Insufficient balance. You need ${priceUsdt.toFixed(4)} USDT but have ${balance.toFixed(4)} USDT.` });
      }

      await db.execute(sql`UPDATE profiles SET balance = balance - ${priceUsdt} WHERE id = ${profileId}`);

      const sub = await db.execute(sql`
        INSERT INTO canalplus_subscriptions (profile_id, plan_name, plan_price_htg, plan_price_usdt, card_number, auto_renew, status)
        VALUES (${profileId}, ${plan.name}, ${plan.priceHtg}, ${priceUsdt}, ${cardNumber}, ${autoRenew || false}, 'pending')
        RETURNING *
      `);

      const profileInfo = await db.execute(sql`SELECT full_name, email, reference_id FROM profiles WHERE id = ${profileId}`);
      const p = profileInfo.rows[0] as any;
      sendTelegramMessage(
        `📺 <b>New Canal+ Subscription Request</b>\n\n` +
        `👤 <b>Name:</b> ${p?.full_name || "Unknown"}\n` +
        `📧 <b>Email:</b> ${p?.email || "—"}\n` +
        `🆔 <b>Ref:</b> ${p?.reference_id || profileId}\n` +
        `📋 <b>Plan:</b> ${plan.name} (${plan.channels} channels)\n` +
        `💵 <b>Amount:</b> ${plan.priceHtg} HTG = ${priceUsdt.toFixed(4)} USDT\n` +
        `🎴 <b>Card:</b> <code>${cardNumber}</code>\n` +
        `🔄 <b>Auto-renew:</b> ${autoRenew ? "Yes" : "No"}\n\n` +
        `⏳ Awaiting your approval in the Admin Panel → Canal+ tab.`
      ).catch(() => {});

      res.json({ success: true, subscription: sub.rows[0] });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/canalplus/my", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = req.session.profileId;
      const rows = await db.execute(sql`
        SELECT * FROM canalplus_subscriptions WHERE profile_id = ${profileId} ORDER BY created_at DESC
      `);
      res.json(rows.rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/canalplus", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const rows = await db.execute(sql`
        SELECT s.*, p.full_name, p.email, p.reference_id, p.phone
        FROM canalplus_subscriptions s
        JOIN profiles p ON p.id = s.profile_id
        ORDER BY s.created_at DESC
      `);
      res.json(rows.rows);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/admin/canalplus/:id/approve", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const sub = await db.execute(sql`SELECT * FROM canalplus_subscriptions WHERE id = ${id}`);
      const s = sub.rows[0] as any;
      if (!s) return res.status(404).json({ message: "Subscription not found" });
      if (s.status !== "pending") return res.status(400).json({ message: "Already processed" });

      await db.execute(sql`UPDATE canalplus_subscriptions SET status = 'success' WHERE id = ${id}`);

      const profileRows = await db.execute(sql`SELECT phone, full_name FROM profiles WHERE id = ${s.profile_id}`);
      const profile = profileRows.rows[0] as any;
      if (profile?.phone) {
        const msg = `*Izichanj*\n\n✅ Canal+ Activé!\n\nVotre abonnement Canal+ pour la carte *${s.card_number}* a été activement activé.\n\nPlan: *${s.plan_name}*\n\nProfitez de vos programmes! 📺`;
        sendWhatsAppNotification(profile.phone, msg, profile.full_name);
      }

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/admin/canalplus/:id/reject", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const sub = await db.execute(sql`SELECT * FROM canalplus_subscriptions WHERE id = ${id}`);
      const s = sub.rows[0] as any;
      if (!s) return res.status(404).json({ message: "Subscription not found" });
      if (s.status !== "pending") return res.status(400).json({ message: "Already processed" });

      await db.execute(sql`UPDATE canalplus_subscriptions SET status = 'failed' WHERE id = ${id}`);
      await db.execute(sql`UPDATE profiles SET balance = balance + ${s.plan_price_usdt} WHERE id = ${s.profile_id}`);

      const profileRows = await db.execute(sql`SELECT phone, full_name FROM profiles WHERE id = ${s.profile_id}`);
      const profile = profileRows.rows[0] as any;
      if (profile?.phone) {
        const msg = `*Izichanj*\n\n❌ Canal+ Refusé\n\nVotre demande d'abonnement Canal+ pour la carte *${s.card_number}* (Plan: ${s.plan_name}) a été refusée.\n\nMontant remboursé: *${Number(s.plan_price_usdt).toFixed(4)} USDT*\n\nContactez le support pour plus d'informations.`;
        sendWhatsAppNotification(profile.phone, msg, profile.full_name);
      }

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── APK Download Tracking ──
  const APK_DRIVE_URL = "https://drive.google.com/uc?export=download&id=14Jyjou9BpgDuCusGMMykAw7e6RecxenJ";

  app.get("/api/download-app", async (req: any, res) => {
    try {
      const profileId = req.session?.profileId || null;
      const ua = req.headers["user-agent"] || "";
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || null;
      let deviceType = "desktop";
      if (/android/i.test(ua)) deviceType = "android";
      else if (/iphone|ipad|ipod/i.test(ua)) deviceType = "ios";
      else if (/mobile/i.test(ua)) deviceType = "mobile";

      await db.execute(sql`
        INSERT INTO app_downloads (profile_id, device_type, ip_address, user_agent)
        VALUES (${profileId}, ${deviceType}, ${ip}, ${ua.slice(0, 500)})
      `);
    } catch (e) {
      console.warn("Download tracking failed:", (e as Error).message);
    }
    res.redirect(302, APK_DRIVE_URL);
  });

  app.get("/api/admin/app-downloads", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const total = await db.execute(sql`SELECT COUNT(*) AS total FROM app_downloads`);
      const byDevice = await db.execute(sql`
        SELECT device_type, COUNT(*) AS count FROM app_downloads GROUP BY device_type ORDER BY count DESC
      `);
      const recent = await db.execute(sql`
        SELECT d.id, d.profile_id, d.device_type, d.ip_address, d.created_at,
               p.full_name, p.email, p.reference_id
        FROM app_downloads d
        LEFT JOIN profiles p ON p.id = d.profile_id
        ORDER BY d.created_at DESC LIMIT 50
      `);
      const downloaderIds = await db.execute(sql`
        SELECT DISTINCT profile_id FROM app_downloads WHERE profile_id IS NOT NULL
      `);
      res.json({
        total: Number((total.rows[0] as any).total),
        byDevice: byDevice.rows,
        recent: recent.rows,
        downloaderIds: (downloaderIds.rows as any[]).map((r) => r.profile_id),
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  return httpServer;
}
