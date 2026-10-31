/**
 * ZiiroPay webhook — business logic.
 *
 * Pure logic with an injected store, so it can be unit-tested without a database.
 * The production store (PostgreSQL / Drizzle) lives in ./ziiropay-webhook.ts.
 *
 * Money-safety rules implemented here
 *   1. Idempotency: every event is recorded in `ziiropay_events` with a UNIQUE index on the
 *      provider event `id` and on (`event`, `reference`). The record is written in the SAME
 *      database transaction as the balance change, so a crash can never leave money moved
 *      without a record (or a record without money moved).
 *   2. Serialisation: all work for one card runs under a per-card advisory lock — shared with
 *      the in-app withdraw route — so a webhook can never race the synchronous API response
 *      of the same withdrawal.
 *   3. No double credit vs the in-app flow: a withdrawal the user started inside Izichanj is
 *      already credited by the withdraw route. The webhook first tries to MATCH the event to
 *      that local record (by reference, else oldest un-confirmed withdrawal with the same
 *      amount in the last hour) and only confirms it. Money moves only for unmatched events
 *      (e.g. a withdrawal that completed at the provider after our request timed out).
 *   4. Safety caps: unmatched events that exceed the card's local balance, are not positive,
 *      or are absurdly large are NOT applied — they are held for admin review.
 */

import crypto from "crypto";

export const WITHDRAWAL_EVENT = "virtualcard.withdrawal.success";

export interface ZiiropayWebhookPayload {
  id?: unknown;
  event?: unknown;
  date?: unknown;
  amount?: unknown;
  fee?: unknown;
  credited?: unknown;
  cardId?: unknown;
  reason?: unknown;
  status?: unknown;
  narrative?: unknown;
  reference?: unknown;
  [key: string]: unknown;
}

export type WebhookOutcome =
  | "applied"          // money moved (unmatched withdrawal credited once)
  | "matched_local"    // already settled by the in-app withdraw route — only confirmed
  | "duplicate"        // same event delivered again — ignored
  | "held_for_review"  // unmatched and failed a safety check — admin must decide
  | "ignored_status"   // provider status is not a success status
  | "unknown_card"     // cardId not found locally
  | "recorded"         // non-financial event, recorded + admin alerted
  | "invalid";         // malformed payload

export interface WebhookResult {
  outcome: WebhookOutcome;
  /** HTTP status the handler should answer with. */
  httpStatus: number;
  message?: string;
}

export interface CardRef {
  kind: "nfc" | "virtual";
  id: number;
  profileId: number;
  cardId: string;
  balance: number;
  last4: string | null;
}

export interface EventRecord {
  providerEventId: string | null;
  event: string;
  reference: string | null;
  cardId: string | null;
  amount: number | null;
  payload: unknown;
}

/** Operations that run inside ONE database transaction holding the per-card lock. */
export interface WebhookTx {
  /** Insert the event row. Returns its row id, or null when the id OR (event, reference) already exists. */
  insertEvent(e: EventRecord): Promise<number | null>;
  setEventOutcome(rowId: number, outcome: string, details?: Record<string, unknown>): Promise<void>;
  findCard(cardId: string): Promise<CardRef | null>;
  /** True when a local withdrawal on this card already carries this provider reference. */
  hasLocalWithdrawalWithRef(card: CardRef, reference: string): Promise<boolean>;
  /**
   * Find the OLDEST local withdrawal on this card with the same amount, created within
   * `windowMs`, and not yet confirmed by a webhook; stamp it with `reference`.
   * Returns false when there is none.
   */
  claimUnconfirmedLocalWithdrawal(card: CardRef, amount: number, reference: string, windowMs: number): Promise<boolean>;
  /**
   * Atomically: card balance -= amount (only if it covers it), wallet += netToWallet,
   * and write the local transaction row stamped with `reference`.
   * Returns null when the card balance no longer covers `amount`.
   */
  applyWithdrawal(a: {
    card: CardRef;
    amount: number;
    fee: number;
    netToWallet: number;
    reference: string;
    description: string;
  }): Promise<{ walletBalance: number } | null>;
}

export interface WebhookStore {
  /** Run `fn` in a DB transaction that first takes the advisory lock for `lockKey`. */
  inLock<T>(lockKey: string, fn: (tx: WebhookTx) => Promise<T>): Promise<T>;
}

export interface WebhookDeps {
  store: WebhookStore;
  calcWithdrawal(amount: number): { fee: number; netToWallet: number };
  notifyAdmin(text: string): void | Promise<void>;
  notifyUser(profileId: number, title: string, message: string): void | Promise<void>;
  /** Largest single withdrawal the webhook will auto-apply (default 10,000 USD). */
  maxWithdrawalUsd?: number;
  /** How far back an in-app withdrawal may be matched to an event (default 60 minutes). */
  matchWindowMs?: number;
}

/** Lock key shared by this webhook and the in-app card routes. */
export function cardLockKey(cardId: string): string {
  return `ziiropay:card:${cardId}`;
}

const SUCCESS_STATUSES = new Set(["complete", "completed", "success", "successful"]);

function str(v: unknown): string {
  return v === undefined || v === null ? "" : String(v).trim();
}

export function parseUsdAmount(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function esc(s: unknown): string {
  return str(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function safe(fn: () => void | Promise<void>): Promise<void> {
  try { await fn(); } catch (e: any) { console.error("[ZIIROPAY WEBHOOK] notification failed:", e?.message || e); }
}

export async function processZiiropayWebhook(raw: unknown, deps: WebhookDeps): Promise<WebhookResult> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { outcome: "invalid", httpStatus: 400, message: "Body must be a JSON object" };
  }
  const payload = raw as ZiiropayWebhookPayload;
  const event = str(payload.event);
  if (!event) return { outcome: "invalid", httpStatus: 400, message: "Missing event" };

  if (event === WITHDRAWAL_EVENT) return handleWithdrawal(payload, deps);
  return handleOtherEvent(event, payload, deps);
}

// ─────────────────────────── virtualcard.withdrawal.success ───────────────────────────

async function handleWithdrawal(payload: ZiiropayWebhookPayload, deps: WebhookDeps): Promise<WebhookResult> {
  const maxUsd = deps.maxWithdrawalUsd ?? 10_000;
  const matchWindowMs = deps.matchWindowMs ?? 60 * 60 * 1000;

  const providerEventId = str(payload.id) || null;
  const reference = str(payload.reference) || null;
  const cardId = str(payload.cardId);
  const amount = parseUsdAmount(payload.amount);

  if (!providerEventId && !reference) {
    return { outcome: "invalid", httpStatus: 400, message: "Missing id and reference" };
  }
  if (!cardId) return { outcome: "invalid", httpStatus: 400, message: "Missing cardId" };
  if (amount === null) return { outcome: "invalid", httpStatus: 400, message: "Invalid amount" };

  if (!SUCCESS_STATUSES.has(str(payload.status).toLowerCase())) {
    console.log(`[ZIIROPAY WEBHOOK] withdrawal ${reference || providerEventId} ignored — status "${str(payload.status)}"`);
    return { outcome: "ignored_status", httpStatus: 200 };
  }

  const stamp = reference || providerEventId!; // value stored on local rows
  const record: EventRecord = {
    providerEventId, event: WITHDRAWAL_EVENT, reference, cardId, amount, payload,
  };

  type Decision =
    | { outcome: "duplicate" }
    | { outcome: "unknown_card" }
    | { outcome: "matched_local" }
    | { outcome: "held_for_review"; reason: string; card: CardRef }
    | { outcome: "applied"; card: CardRef; fee: number; netToWallet: number; walletBalance: number };

  const decision = await deps.store.inLock<Decision>(cardLockKey(cardId), async (tx) => {
    const card = await tx.findCard(cardId);
    if (!card) return { outcome: "unknown_card" };

    const rowId = await tx.insertEvent(record);
    if (rowId === null) return { outcome: "duplicate" };

    // (a) Already settled by the in-app withdraw route → confirm only, never credit again.
    if (await tx.hasLocalWithdrawalWithRef(card, stamp)) {
      await tx.setEventOutcome(rowId, "matched_local", { by: "reference" });
      return { outcome: "matched_local" };
    }
    if (await tx.claimUnconfirmedLocalWithdrawal(card, amount, stamp, matchWindowMs)) {
      await tx.setEventOutcome(rowId, "matched_local", { by: "amount_window" });
      return { outcome: "matched_local" };
    }

    // (b) Unmatched → apply the system's withdrawal logic exactly once, behind safety checks.
    const { fee, netToWallet } = deps.calcWithdrawal(amount);
    let reason = "";
    if (amount > maxUsd) reason = `amount exceeds auto-apply cap ($${maxUsd})`;
    else if (amount > card.balance + 0.005) reason = `amount exceeds local card balance ($${card.balance.toFixed(2)})`;
    else if (!(netToWallet > 0)) reason = "net amount after service fee is not positive";
    if (reason) {
      await tx.setEventOutcome(rowId, "held_for_review", { reason });
      return { outcome: "held_for_review", reason, card };
    }

    const description =
      `Card withdrawal (ref ${stamp}) — $${amount.toFixed(2)} pulled from card, ` +
      `$${netToWallet.toFixed(2)} credited to wallet (− $${fee.toFixed(2)} fee)`;
    const applied = await tx.applyWithdrawal({ card, amount, fee, netToWallet, reference: stamp, description });
    if (!applied) {
      const why = "card balance no longer covers the amount";
      await tx.setEventOutcome(rowId, "held_for_review", { reason: why });
      return { outcome: "held_for_review", reason: why, card };
    }
    await tx.setEventOutcome(rowId, "applied", { fee, netToWallet });
    return { outcome: "applied", card, fee, netToWallet, walletBalance: applied.walletBalance };
  });

  // Notifications happen AFTER the transaction commits and never affect the HTTP answer.
  switch (decision.outcome) {
    case "applied": {
      const { card, fee, netToWallet } = decision;
      await safe(() => deps.notifyUser(
        card.profileId,
        "Card withdrawal completed",
        `$${amount.toFixed(2)} was withdrawn from your card ****${card.last4 || "----"} and $${netToWallet.toFixed(2)} USDT was credited to your wallet.`,
      ));
      await safe(() => deps.notifyAdmin(
        `✅ <b>ZiiroPay withdrawal applied</b>\n\n` +
        `💳 Card ****${esc(card.last4 || "????")} (${esc(card.kind)} #${card.id}, profile ${card.profileId})\n` +
        `💵 $${amount.toFixed(2)} from card → $${netToWallet.toFixed(2)} to wallet (fee $${fee.toFixed(2)})\n` +
        `🔖 ref <code>${esc(stamp)}</code>\n` +
        `ℹ️ No in-app withdrawal matched this event, so it was credited from the webhook.`,
      ));
      break;
    }
    case "held_for_review": {
      await safe(() => deps.notifyAdmin(
        `⚠️ <b>ZiiroPay withdrawal HELD for review</b>\n\n` +
        `💳 Card ****${esc(decision.card.last4 || "????")} (${esc(decision.card.kind)} #${decision.card.id}, profile ${decision.card.profileId})\n` +
        `💵 $${amount.toFixed(2)}\n🔖 ref <code>${esc(stamp)}</code>\n` +
        `❗ ${esc(decision.reason)}\n\nNo balance was changed.`,
      ));
      break;
    }
    case "unknown_card": {
      await safe(() => deps.notifyAdmin(
        `⚠️ <b>ZiiroPay withdrawal for UNKNOWN card</b>\n\n` +
        `💳 cardId <code>${esc(cardId)}</code>\n💵 $${amount.toFixed(2)}\n🔖 ref <code>${esc(stamp)}</code>\n\nNothing was applied.`,
      ));
      break;
    }
    default:
      break;
  }

  console.log(`[ZIIROPAY WEBHOOK] withdrawal ref=${stamp} card=${cardId} → ${decision.outcome}`);
  return { outcome: decision.outcome, httpStatus: 200 };
}

// ─────────────────────────── other events (alert only) ───────────────────────────

async function handleOtherEvent(event: string, payload: ZiiropayWebhookPayload, deps: WebhookDeps): Promise<WebhookResult> {
  const providerEventId = str(payload.id) || null;
  const reference = str(payload.reference) || null;
  const cardId = str(payload.cardId) || null;
  const amount = parseUsdAmount(payload.amount);
  const record: EventRecord = { providerEventId, event, reference, cardId, amount, payload };

  const lockKey = cardId ? cardLockKey(cardId) : `ziiropay:event:${providerEventId || reference || event}`;
  const fresh = await deps.store.inLock<boolean>(lockKey, async (tx) => {
    const rowId = await tx.insertEvent(record);
    if (rowId === null) return false;
    await tx.setEventOutcome(rowId, "recorded");
    return true;
  });
  if (!fresh) return { outcome: "duplicate", httpStatus: 200 };

  await safe(() => deps.notifyAdmin(
    `🔔 <b>ZiiroPay event</b>\n\n📌 <code>${esc(event)}</code>\n` +
    (cardId ? `💳 cardId <code>${esc(cardId)}</code>\n` : "") +
    (amount !== null ? `💵 $${amount.toFixed(2)}\n` : "") +
    (reference ? `🔖 ref <code>${esc(reference)}</code>\n` : "") +
    `\nNo balance was changed. Review in the ZiiroPay dashboard if needed.`,
  ));
  console.log(`[ZIIROPAY WEBHOOK] event ${event} recorded`);
  return { outcome: "recorded", httpStatus: 200 };
}

// ─────────────────────────── request authentication ───────────────────────────

export type WebhookAuthResult = { ok: true } | { ok: false; status: number; message: string };

/**
 * ZiiroPay's documentation describes NO signature header for webhooks, so the supported
 * protection is a shared secret that only ZiiroPay and this server know. Register the
 * webhook URL in the ZiiroPay dashboard as:
 *
 *     https://<your-domain>/api/ziiropay/webhook?token=<ZIIROPAY_WEBHOOK_SECRET>
 *
 * (the secret is also accepted in an `x-webhook-secret` header or `Authorization: Bearer`).
 * In production the endpoint FAILS CLOSED when no secret is configured, because it moves money.
 */
export function checkWebhookAuth(args: {
  configuredSecret: string;
  isProduction: boolean;
  /** Every secret-looking value the request carried (query token, header, bearer). */
  presented: string[];
}): WebhookAuthResult {
  const secret = args.configuredSecret.trim();
  if (!secret) {
    if (args.isProduction) {
      return { ok: false, status: 503, message: "Webhook secret not configured" };
    }
    console.warn("[ZIIROPAY WEBHOOK] ZIIROPAY_WEBHOOK_SECRET is not set — accepting UNAUTHENTICATED webhook (non-production only)");
    return { ok: true };
  }
  const want = Buffer.from(secret);
  for (const candidate of args.presented) {
    const got = Buffer.from(candidate);
    if (got.length === want.length && crypto.timingSafeEqual(got, want)) return { ok: true };
  }
  return { ok: false, status: 401, message: "Invalid webhook credentials" };
}
