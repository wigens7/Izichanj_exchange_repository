---
name: Strowallet webhook duplicate deliveries
description: Why card-spend admin/user notifications must be deduplicated by transaction outcome, not by raw event string.
---

# Strowallet webhook fires multiple times per transaction

The `POST /api/strowallet/webhook` handler notifies admin (Telegram) and the user
(in-app + WhatsApp) on card events. Strowallet delivers the **same transaction more
than once** — typically authorization + settlement, plus its own delivery retries —
so without dedup admin gets the same spend alert several times.

**Rule:** dedup on **transaction identity + outcome class**, never on the raw event
string. Two deliveries for one spend often carry different `event/type/status`
strings but the same transaction id; keying on the raw string fails to collapse them.

**How it's done:** a `webhook_dedup` table (idempotent startup migration in
`server/index.ts`) with `event_key` PRIMARY KEY. The webhook computes:
- with a provider id: `${cardId}:${providerEventId}:${outcomeClass}`
- no provider id (fallback): `${cardId}:${amount}:${merchant}:${outcomeClass}:${bucket}`
  where bucket = provider event time to the minute, else receive time to 5-min.

`outcomeClass` is derived from the existing flags (nofunds/failure/debit/success/
freeze/kyc). This collapses auth+settlement into ONE alert while keeping **success
vs failure distinct** — exactly one notification per outcome, which is the product
requirement. Insert is `ON CONFLICT (event_key) DO NOTHING`; `rowCount === 0` ⇒
duplicate ⇒ early `return` before any notification. Dedup errors **fail open**
(proceed) so a dead dedup store never silently drops a real transaction alert.

**Note:** the NFC card *poller* (separate code path, ~`pollSingleNfcCardSpend`) is
deduped independently via the unique index on `nfc_card_transactions(card_id,
provider_tx_id)`. Different mechanism, same goal.
