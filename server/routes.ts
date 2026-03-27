import type { Express } from "express";
import type { Server } from "http";
import { ProxyAgent } from "undici";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, resetPinSchema } from "@shared/schema";
import { z } from "zod";
import { setupAuth, isAuthenticated } from "./auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { WITHDRAWAL_MIN_USDT, WITHDRAWAL_MAX_USDT, WITHDRAWAL_FEE_USDT, usdtToHtg, htgToUsdt, formatHtg, WITHDRAWAL_MIN_HTG, WITHDRAWAL_MAX_HTG, EXCHANGE_RATE_USDT_HTG, NETWORK_FEE_CONFIG, MANUAL_DEPOSIT_MIN_HTG, MANUAL_DEPOSIT_MIN_USDT, MANUAL_DEPOSIT_EXCHANGE_RATE } from "@shared/constants";
import { generateReceiptPDF, generateAdjustmentReceiptPDF } from "./receipt";
import { ensureKycImageSize } from "./image-compress";
import { deposits, profiles, virtualCards } from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
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
      const usdtAmount = htgToUsdt(htgAmount);
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

      const htgAmount = formatHtg(usdtToHtg(depositAmount));
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

      const { amountUsdt, payCurrency } = req.body;
      if (!amountUsdt || isNaN(Number(amountUsdt)) || Number(amountUsdt) <= 0) {
        return res.status(400).json({ message: "Amount must be greater than 0" });
      }

      const currency = (payCurrency === "usdtbsc" ? "usdtbsc" : "usdttrc20") as "usdttrc20" | "usdtbsc";
      const FEE_CONFIG: Record<string, { minAmount: number; fee: number }> = {
        usdttrc20: { minAmount: 12.00, fee: 1.50 },
        usdtbsc:   { minAmount: 10.25, fee: 0.25 },
      };
      const networkConfig = FEE_CONFIG[currency];
      const amount = Number(amountUsdt);
      if (amount < networkConfig.minAmount) {
        return res.status(400).json({ message: `Minimum deposit for ${currency === "usdtbsc" ? "BEP20" : "TRC20"} is $${networkConfig.minAmount.toFixed(2)} USDT.` });
      }
      const creditAmount = amount - networkConfig.fee;
      const orderId = `NP-${profile.id}-${Date.now()}`;
      const htgAmount = usdtToHtg(creditAmount);

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

        const [updatedDeposit] = await db.update(deposits).set({
          status: "approved",
        }).where(eq(deposits.id, deposit.id)).returning();

        const profile = await storage.getProfile(deposit.profileId);
        if (profile) {
          const depositAmount = parseFloat(deposit.amountUsdt);
          const DEPOSIT_FEES: Record<string, number> = { usdttrc20: 1.50, usdtbsc: 0.25 };
          const fee = DEPOSIT_FEES[deposit.payCurrency || "usdttrc20"] ?? 1.50;
          const creditAmount = Math.max(0, depositAmount - fee);
          const currentBalance = parseFloat(profile.balance);
          const newBalance = currentBalance + creditAmount;
          await storage.updateProfileBalance(deposit.profileId, newBalance);

          const htgAmount = formatHtg(usdtToHtg(creditAmount));
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

      console.log(`[LOGIN] Attempt for ${input.identifier}, found: ${!!profile}, hash starts: ${profile?.passwordHash?.substring(0, 10) || 'N/A'}`);
      if (!profile || profile.isDeleted) {
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
        await sendWhatsAppOtp(profile.phone || "", code, profile.fullName);
        const { passwordHash: _, twoFactorSecret: _s, ...safeProfile } = profile;
        return res.json({ ...safeProfile, needsVerification: true });
      }

      if (profile.twoFactorEnabled) {
        req.session.pending2faProfileId = profile.id;
        return res.json({ needs2FA: true });
      }

      req.session.profileId = profile.id;
      storage.createLoginLog(profile.id, "password", req.ip).catch(() => {});
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
      storage.createLoginLog(profileId, "2fa", req.ip).catch(() => {});
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
      const deposit = await storage.createDeposit({ ...input, profileId: profile.id, depositMethod: "usdt", expiresAt: manualExpiresAt });

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
        return res.status(403).json({ message: "Your account is temporarily frozen due to suspicious activity. Contact support." });
      }

      const parsed = api.withdrawals.create.input.parse(req.body);

      // Validate withdrawal PIN
      const withdrawalPinHash = (profile as any).withdrawalPinHash;
      if (!withdrawalPinHash) {
        return res.status(403).json({ message: "You must set a 6-digit withdrawal PIN before making withdrawals. Go to Security settings to set it up." });
      }
      const validPin = await bcrypt.compare(parsed.pin, withdrawalPinHash);
      if (!validPin) return res.status(401).json({ message: "Incorrect withdrawal PIN" });

      // Validate TRC-20 address
      if (!parsed.trcAddress || parsed.trcAddress.trim().length < 25) {
        return res.status(400).json({ message: "Invalid TRC-20 wallet address" });
      }

      const amountUsdt = parseFloat(parsed.amount);
      if (isNaN(amountUsdt) || amountUsdt <= 0) return res.status(400).json({ message: "Invalid amount" });

      if (amountUsdt < WITHDRAWAL_MIN_USDT) {
        return res.status(400).json({ message: `Minimum withdrawal is ${WITHDRAWAL_MIN_USDT} USDT` });
      }
      if (amountUsdt > WITHDRAWAL_MAX_USDT) {
        return res.status(400).json({ message: `Limit retrè chak jou a se ${WITHDRAWAL_MAX_USDT.toLocaleString()} USDT.` });
      }

      const totalDeducted = amountUsdt + WITHDRAWAL_FEE_USDT;
      const currentBalance = parseFloat(profile.balance || "0");
      if (currentBalance < totalDeducted) {
        return res.status(400).json({ message: `Insufficient balance. You need ${totalDeducted.toFixed(2)} USDT (${amountUsdt.toFixed(2)} + ${WITHDRAWAL_FEE_USDT} fee) but have ${currentBalance.toFixed(2)} USDT.` });
      }

      // Deduct amount + fee from balance immediately
      const newBalance = currentBalance - totalDeducted;
      await storage.updateProfileBalance(profile.id, newBalance);

      const withdrawal = await storage.createWithdrawal({
        amount: parsed.amount,
        currency: "MonCash" as any, // placeholder; trcAddress marks this as USDT TRC-20
        trcAddress: parsed.trcAddress.trim(),
        fee: WITHDRAWAL_FEE_USDT.toString(),
        profileId: profile.id,
      } as any);

      // Notify admin in-app
      const wAdmins = await storage.getAllProfiles();
      for (const admin of wAdmins.filter(a => a.role === "admin")) {
        await storage.createNotification({
          profileId: admin.id,
          type: "custom_message",
          title: "🔔 New USDT Withdrawal Request",
          message: `${profile.fullName} requested a withdrawal of ${amountUsdt.toFixed(2)} USDT (+ ${WITHDRAWAL_FEE_USDT} fee) to TRC-20 address: ${parsed.trcAddress.trim()}`,
        });
      }

      // In-app notification to user
      await storage.createNotification({
        profileId: profile.id,
        type: "withdrawal_approved" as any,
        title: "Withdrawal Under Review",
        message: `Your withdrawal of ${amountUsdt.toFixed(2)} USDT (fee: ${WITHDRAWAL_FEE_USDT} USDT) to ${parsed.trcAddress.trim()} is under review. Processing takes 15–60 minutes.`,
      });

      // Telegram alert to admin
      sendTelegramMessage(
        `💸 <b>New USDT Withdrawal Request</b>\n\n` +
        `👤 <b>Name:</b> ${profile.fullName}\n` +
        `📧 <b>Email:</b> ${profile.email}\n` +
        `🆔 <b>User ID:</b> ${profile.referenceId || profile.id}\n` +
        `💵 <b>Amount:</b> ${amountUsdt.toFixed(2)} USDT\n` +
        `💰 <b>Fee:</b> ${WITHDRAWAL_FEE_USDT} USDT\n` +
        `💳 <b>Total Deducted:</b> ${totalDeducted.toFixed(2)} USDT\n` +
        `🔑 <b>TRC-20 Address:</b> <code>${parsed.trcAddress.trim()}</code>\n\n` +
        `⏳ Awaiting admin approval.`
      ).catch(() => {});

      res.status(201).json(withdrawal);
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
    const htgAmount = formatHtg(usdtToHtg(Number(withdrawal.amount)));
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
      await storage.updateProfileBalance(withdrawal.profileId, currentBalance + refundAmount);
    }
    const htgAmount = formatHtg(usdtToHtg(Number(withdrawal.amount)));
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
    const finalAmountHtg = usdtToHtg(netUsdt);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const txRef = `IZ${pad(now.getDate())}${pad(now.getMonth() + 1)}${String(now.getFullYear()).slice(2)}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    return {
      type,
      transactionRef: record.transactionId || txRef,
      createdAt: record.createdAt || now,
      amountUsdt,
      fee,
      exchangeRate: EXCHANGE_RATE_USDT_HTG,
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
    res.json({
      moncash: process.env.COMPANY_MONCASH_PHONE || "509-XXXX-XXXX",
      natcash: process.env.COMPANY_NATCASH_PHONE || "509-XXXX-XXXX",
      exchangeRate: MANUAL_DEPOSIT_EXCHANGE_RATE,
      minHtg: MANUAL_DEPOSIT_MIN_HTG,
      minUsdt: MANUAL_DEPOSIT_MIN_USDT,
    });
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
        const until = new Date((profile as any).frozenUntil).toLocaleString();
        return res.status(403).json({ message: `Your account is temporarily frozen due to suspicious activity until ${until}. Contact support if you believe this is an error.` });
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

      const amountUsdt = (htgAmount / MANUAL_DEPOSIT_EXCHANGE_RATE).toFixed(2);

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

      const htgEquiv = formatHtg(usdtToHtg(Number(deposit.amountUsdt)));
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
        ? `\n\n🚨 ACCOUNT FROZEN until ${frozenUntil!.toLocaleString()} — 3 fraud attempts detected in 30 minutes!`
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

      const htgAmount = formatHtg(usdtToHtg(Number(deposit.amountUsdt)));
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

      const htgAmount = formatHtg(usdtToHtg(Number(withdrawal.amount)));
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
      const CARD_PRICE    = 30;    // what user pays
      const CARD_COST     = 22.80; // our actual cost (Strowallet $20 + ~$2.80 buffer/fees)
      const PROFIT_PER    = Number((CARD_PRICE - CARD_COST).toFixed(2)); // 7.20
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

      // IMPORTANT: The user's balance was already deducted ($26) when the pending card was created.
      // This retry only calls Strowallet's API — it does NOT touch the user's balance again.
      // Strowallet always receives $20 to load onto the card (regardless of what user paid).
      const fundAmount = 20;
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
      console.log("[ADMIN RETRY CARD] Strowallet raw response:", JSON.stringify(data, null, 2));

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
      storage.createLoginLog(profile.id, "pin", req.ip).catch(() => {});
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

      const CARD_COST_USD = 30;        // Amount deducted from user's Izichanj balance
      const STROWALLET_FUND_AMOUNT = 20; // Amount loaded onto the card via Strowallet ($10 activation fee kept by Izichanj)

      const balanceUsdt = parseFloat(profile.balance || "0");
      if (balanceUsdt < CARD_COST_USD) {
        return res.status(400).json({ message: `Insufficient balance. You need at least $${CARD_COST_USD} USDT to apply for a virtual card. Your current balance is $${balanceUsdt.toFixed(2)} USDT.` });
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
      console.log("[STROWALLET] Create card response:", JSON.stringify(data));

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
            `💵 <b>User charged:</b> $${CARD_COST_USD} USDT (card loaded with $${fundAmount})\n` +
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
          `💵 <b>Amount:</b> $${CARD_COST_USD} USDT\n` +
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

      // NOTE: No balance deduction — the $26 was already deducted when the pending card was created.
      // Strowallet always receives $20 for card funding regardless of what user paid.
      const fundAmount = 20;

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
      if (isNaN(fundAmount) || fundAmount < 19.99) {
        return res.status(400).json({ message: "Minimum funding is $19.99 USD" });
      }

      const balanceUsdt = parseFloat(profile.balance || "0");
      if (fundAmount > balanceUsdt) {
        return res.status(400).json({ message: `Insufficient USDT balance. Your current balance is $${balanceUsdt.toFixed(2)} USDT.` });
      }

      const response = await strowalletFetch(`${STROWALLET_BASE}/fund-card/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          card_id: card.cardId,
          amount: fundAmount.toString(),
          public_key: strowalletPublicKey,
        }),
      });

      const data = await response.json();
      console.log("[STROWALLET] Fund card response:", JSON.stringify(data));

      if (!response.ok || data.status === "error" || data.status === false) {
        return res.status(400).json({ message: data.message || data.error || "Failed to fund card" });
      }

      const newBalance = balanceUsdt - fundAmount;
      await storage.updateProfileBalance(profile.id, newBalance);

      const currentCardBalance = parseFloat(card.balance || "0");
      const updatedCard = await storage.updateVirtualCard(card.id, {
        balance: (currentCardBalance + fundAmount).toString(),
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
      console.log("[CARD TX] Strowallet response keys:", Object.keys(data || {}));
      if (!response.ok || data.success === false || data.status === "error" || data.status === false) {
        console.log("[CARD TX] Error response:", JSON.stringify(data));
        return res.json([]);
      }

      // Strowallet may return transactions nested in various ways
      const txList =
        Array.isArray(data.response) ? data.response :
        Array.isArray(data.response?.transactions) ? data.response.transactions :
        Array.isArray(data.response?.data) ? data.response.data :
        Array.isArray(data.data) ? data.data :
        Array.isArray(data.transactions) ? data.transactions :
        [];

      // Auto-sync balance from the transaction response if provided
      const latestBalance = data.response?.balance ?? data.balance ?? null;
      if (latestBalance !== null && latestBalance !== undefined) {
        await storage.updateVirtualCard(card.id, { balance: String(latestBalance) });
      }

      res.json(txList);
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

      // Deduct from balance (in USD)
      const currentBalance = Number(profile.balance);
      if (currentBalance < numAmount) {
        return res.status(400).json({ message: "Insufficient balance" });
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

        const userMessage = isBalanceError
          ? "Une erreur technique est survenue. Veuillez réessayer dans quelques minutes."
          : "Top-up échoué. Veuillez réessayer.";

        return res.status(400).json({ message: userMessage });
      }

      // Deduct balance
      await storage.updateProfileBalance(profile.id, currentBalance - numAmount);

      // Notify user via WhatsApp
      if (profile.phone) {
        sendWhatsAppNotification(
          profile.phone,
          `*Izichanj*\n\n📱 Top-Up Successful\n\nYou recharged ${phone} with $${numAmount} USD.\nTransaction ID: ${topupData.transactionId || "N/A"}\n\nhttps://izichanj.com`,
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

  return httpServer;
}
