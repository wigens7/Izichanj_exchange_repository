/**
 * ZiiroPay webhook — PostgreSQL store + Express handler.
 *
 * Business rules live in ./ziiropay-webhook-core.ts (unit-tested). This file only
 * supplies the database implementation and the HTTP wiring:
 *
 *   app.post("/api/ziiropay/webhook", createZiiropayWebhookHandler({ ... }))
 *
 * Required table (created at startup in server/index.ts):
 *   ziiropay_events — one row per processed event, UNIQUE on provider id and on (event, reference).
 */
import type { RequestHandler } from "express";
import { sql } from "drizzle-orm";
import { db } from "./db";
import {
  cardLockKey,
  checkWebhookAuth,
  processZiiropayWebhook,
  type CardRef,
  type EventRecord,
  type WebhookDeps,
  type WebhookStore,
  type WebhookTx,
} from "./ziiropay-webhook-core";

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function rowsOf(result: any): any[] {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function makeTx(tx: DbTx): WebhookTx {
  return {
    async insertEvent(e: EventRecord) {
      const res = await tx.execute(sql`
        INSERT INTO ziiropay_events (provider_event_id, event, reference, card_id, amount, outcome, payload)
        VALUES (${e.providerEventId}, ${e.event}, ${e.reference}, ${e.cardId}, ${e.amount}::numeric,
                'processing', ${JSON.stringify(e.payload ?? null)}::jsonb)
        ON CONFLICT DO NOTHING
        RETURNING id
      `);
      const row = rowsOf(res)[0];
      return row ? Number(row.id) : null;
    },

    async setEventOutcome(rowId, outcome, details) {
      await tx.execute(sql`
        UPDATE ziiropay_events
        SET outcome = ${outcome}, details = ${JSON.stringify(details ?? null)}::jsonb
        WHERE id = ${rowId}
      `);
    },

    async findCard(cardId): Promise<CardRef | null> {
      const res = await tx.execute(sql`
        SELECT kind, id, profile_id, card_id, balance, last4 FROM (
          SELECT 'nfc' AS kind, id, profile_id, card_id, nfc_balance AS balance, last4 FROM nfc_cards WHERE card_id = ${cardId}
          UNION ALL
          SELECT 'virtual' AS kind, id, profile_id, card_id, card_balance AS balance, last4 FROM virtual_cards WHERE card_id = ${cardId}
        ) c
        ORDER BY kind
        LIMIT 1
      `);
      const r = rowsOf(res)[0];
      if (!r) return null;
      return {
        kind: r.kind === "virtual" ? "virtual" : "nfc",
        id: Number(r.id),
        profileId: Number(r.profile_id),
        cardId: String(r.card_id),
        balance: Number(r.balance) || 0,
        last4: r.last4 ?? null,
      };
    },

    async hasLocalWithdrawalWithRef(card, reference) {
      // Only NFC cards have an in-app withdraw flow (and a provider_tx_id column).
      if (card.kind !== "nfc") return false;
      const res = await tx.execute(sql`
        SELECT 1 AS hit FROM nfc_card_transactions
        WHERE card_id = ${card.id} AND type = 'withdraw' AND provider_tx_id = ${reference}
        LIMIT 1
      `);
      return rowsOf(res).length > 0;
    },

    async claimUnconfirmedLocalWithdrawal(card, amount, reference, windowMs) {
      if (card.kind !== "nfc") return false;
      const res = await tx.execute(sql`
        UPDATE nfc_card_transactions
        SET provider_tx_id = ${reference}
        WHERE id = (
          SELECT id FROM nfc_card_transactions
          WHERE card_id = ${card.id}
            AND type = 'withdraw'
            AND provider_tx_id IS NULL
            AND amount = ${amount}::numeric
            AND created_at > NOW() - make_interval(secs => ${windowMs / 1000}::double precision)
          ORDER BY created_at ASC, id ASC
          LIMIT 1
          FOR UPDATE
        )
        RETURNING id
      `);
      return rowsOf(res).length > 0;
    },

    async applyWithdrawal({ card, amount, netToWallet, reference, description }) {
      // 1) Card balance: only decrement when it still covers the amount.
      const debit = card.kind === "nfc"
        ? await tx.execute(sql`
            UPDATE nfc_cards SET nfc_balance = nfc_balance - ${amount}::numeric
            WHERE id = ${card.id} AND nfc_balance >= ${amount}::numeric
            RETURNING id`)
        : await tx.execute(sql`
            UPDATE virtual_cards SET card_balance = card_balance - ${amount}::numeric
            WHERE id = ${card.id} AND card_balance >= ${amount}::numeric
            RETURNING id`);
      if (rowsOf(debit).length === 0) return null;

      // 2) Wallet credit (atomic increment — never read-modify-write).
      const credit = await tx.execute(sql`
        UPDATE profiles SET balance = (balance)::numeric + ${netToWallet}::numeric
        WHERE id = ${card.profileId}
        RETURNING balance
      `);
      const wallet = rowsOf(credit)[0];
      if (!wallet) throw new Error(`profile ${card.profileId} not found while crediting withdrawal`);

      // 3) Local transaction record (history + future matching).
      if (card.kind === "nfc") {
        await tx.execute(sql`
          INSERT INTO nfc_card_transactions (card_id, profile_id, type, amount, currency, description, provider_tx_id)
          VALUES (${card.id}, ${card.profileId}, 'withdraw', ${amount}::numeric, 'USD', ${description}, ${reference})
        `);
      } else {
        await tx.execute(sql`
          INSERT INTO card_transactions (card_id, profile_id, type, amount, currency, description)
          VALUES (${card.id}, ${card.profileId}, 'withdraw', ${amount}::numeric, 'USD', ${description})
        `);
      }
      return { walletBalance: Number(wallet.balance) };
    },
  };
}

export const drizzleWebhookStore: WebhookStore = {
  inLock(lockKey, fn) {
    return db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}::text))`);
      return fn(makeTx(tx));
    });
  },
};

/**
 * Serialise a card operation with the webhook. The in-app withdraw route runs its provider
 * call + local bookkeeping inside this lock, so a webhook for the same card waits until the
 * route has finished and can then match (not double-credit) the withdrawal.
 * `fn` may use the normal `storage` helpers — the lock is advisory and connection-independent.
 */
export function withCardLock<T>(cardId: string, fn: () => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${cardLockKey(cardId)}::text))`);
    return fn();
  });
}

/** Collect every credential-looking value a webhook request carries. */
function presentedSecrets(req: any): string[] {
  const out: string[] = [];
  const q = req.query?.token ?? req.query?.secret;
  if (typeof q === "string" && q) out.push(q);
  const h = req.headers?.["x-webhook-secret"];
  if (typeof h === "string" && h) out.push(h);
  const authz = req.headers?.authorization;
  if (typeof authz === "string" && /^Bearer\s+/i.test(authz)) out.push(authz.replace(/^Bearer\s+/i, "").trim());
  return out;
}

export function createZiiropayWebhookHandler(deps: Omit<WebhookDeps, "store">): RequestHandler {
  return async (req, res) => {
    const auth = checkWebhookAuth({
      configuredSecret: process.env.ZIIROPAY_WEBHOOK_SECRET || "",
      isProduction: process.env.NODE_ENV === "production",
      presented: presentedSecrets(req),
    });
    if (!auth.ok) {
      console.warn(`[ZIIROPAY WEBHOOK] rejected (${auth.status}): ${auth.message}`);
      res.status(auth.status).json({ message: auth.message });
      return;
    }

    try {
      const result = await processZiiropayWebhook(req.body, { ...deps, store: drizzleWebhookStore });
      res.status(result.httpStatus).json({
        received: result.outcome !== "invalid",
        outcome: result.outcome,
        ...(result.message ? { message: result.message } : {}),
      });
    } catch (e: any) {
      // 500 makes the provider redeliver; the idempotency guards make that safe.
      console.error("[ZIIROPAY WEBHOOK] processing error:", e?.message || e);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  };
}
