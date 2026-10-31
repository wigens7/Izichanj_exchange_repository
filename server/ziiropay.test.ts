import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import {
  buildCardKycInput,
  createDollarCard,
  extractList,
  fundCard,
  getCardDetails,
  getCardKycStatus,
  isProviderFailure,
  mapIdType,
  missingKycFields,
  normalizeDob,
  setCardStatus,
  splitPhone,
  withdrawCard,
  ziiropayRequest,
  ZiiropayNotConfiguredError,
} from "./ziiropay";
import {
  checkWebhookAuth,
  processZiiropayWebhook,
  type CardRef,
  type EventRecord,
  type WebhookDeps,
  type WebhookStore,
  type WebhookTx,
} from "./ziiropay-webhook-core";

// ════════════════════════════════════════════════════════════════════════════
//  Service layer (global fetch is mocked — no network)
// ════════════════════════════════════════════════════════════════════════════

type Call = { url: string; method: string; body: any };
const realFetch = globalThis.fetch;
let calls: Call[] = [];
let responder: (call: Call) => { status: number; json: any } = () => ({ status: 200, json: { success: true } });

function installFetchMock() {
  calls = [];
  (globalThis as any).fetch = async (url: string, init: any = {}) => {
    const call: Call = { url: String(url), method: init.method || "GET", body: init.body ? JSON.parse(init.body) : undefined };
    calls.push(call);
    const r = responder(call);
    return new Response(JSON.stringify(r.json), { status: r.status, headers: { "content-type": "application/json" } });
  };
}

beforeEach(() => {
  process.env.ZIIROPAY_API_KEY = "test_key_123";
  delete process.env.ZIIROPAY_MODE;
  delete process.env.ZIIROPAY_BASE_URL;
  delete process.env.PROXY_URL;
  responder = () => ({ status: 200, json: { success: true } });
  installFetchMock();
});
afterEach(() => {
  (globalThis as any).fetch = realFetch;
});

test("POST sends the key in the JSON body (never in the URL) to the documented endpoint", async () => {
  await fundCard("card_1", 12.5);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].url, "https://www.ziiropay.com/api/bitvcard/fund-withdraw-nfccard");
  assert.equal(calls[0].url.includes("test_key_123"), false);
  assert.deepEqual(calls[0].body, { card_id: "card_1", amount: "12.5", type: "fund", public_key: "test_key_123" });
});

test("GET sends the key and params in the query string", async () => {
  await getCardDetails("card_9");
  const u = new URL(calls[0].url);
  assert.equal(calls[0].method, "GET");
  assert.equal(u.pathname, "/api/bitvcard/fetch-nfccard-detail");
  assert.equal(u.searchParams.get("card_id"), "card_9");
  assert.equal(u.searchParams.get("public_key"), "test_key_123");
  assert.equal(u.searchParams.get("mode"), null);
});

test("mode=sandbox is only sent when ZIIROPAY_MODE=sandbox", async () => {
  process.env.ZIIROPAY_MODE = "sandbox";
  await withdrawCard("c", 5);
  assert.equal(calls[0].body.mode, "sandbox");
  assert.equal(calls[0].body.type, "withdraw");
  process.env.ZIIROPAY_MODE = "live";
  await withdrawCard("c", 5);
  assert.equal("mode" in calls[1].body, false);
});

test("missing ZIIROPAY_API_KEY throws a typed error and makes no request", async () => {
  delete process.env.ZIIROPAY_API_KEY;
  await assert.rejects(() => ziiropayRequest("GET", "x"), ZiiropayNotConfiguredError);
  assert.equal(calls.length, 0);
});

test("money-moving POSTs are never retried, even on a transient gateway error", async () => {
  responder = () => ({ status: 503, json: { message: "Service Unavailable" } });
  const res = await fundCard("card_1", 5);
  assert.equal(res.ok, false);
  assert.equal(calls.length, 1, "a fund request must be sent at most once");
});

test("freeze/unfreeze (idempotent POST) and GETs are retried on transient errors", async () => {
  let n = 0;
  responder = () => (++n < 2 ? { status: 503, json: {} } : { status: 200, json: { success: true } });
  const res = await setCardStatus("card_1", "frozen");
  assert.equal(res.ok, true);
  assert.equal(calls.length, 2);
  assert.deepEqual(
    { card_id: calls[1].body.card_id, status: calls[1].body.status },
    { card_id: "card_1", status: "frozen" },
  );
});

test("HTTP 200 with success:false is treated as a provider failure and message is surfaced", async () => {
  responder = () => ({ status: 200, json: { success: false, message: "Insufficient balance" } });
  const res = await fundCard("card_1", 5);
  assert.equal(res.ok, false);
  assert.equal(res.message, "Insufficient balance");
  assert.equal(isProviderFailure(200, { status: "error" }), true);
  assert.equal(isProviderFailure(200, { status: "active" }), false);
  assert.equal(isProviderFailure(422, {}), true);
});

test("createDollarCard maps the response to cardId/last4/brand", async () => {
  responder = () => ({
    status: 200,
    json: { success: true, response: { card_id: "abc-123", card_number: "4111111111115976", card_brand: "Visa" } },
  });
  const card = await createDollarCard({ name: "Jane Doe", customerId: "cust-1", amountUsd: 5 });
  assert.equal(card.cardId, "abc-123");
  assert.equal(card.last4, "5976");
  assert.equal(card.brand, "Visa");
  assert.deepEqual(calls[0].body, {
    name: "Jane Doe", customer_id: "cust-1", amount: "5", public_key: "test_key_123",
  });
  assert.equal(calls[0].url.endsWith("/create-nfc-card"), true);
});

test("getCardKycStatus: approved needs a customer_id; pending does not count", async () => {
  responder = () => ({
    status: 200,
    json: { success: true, data: { status: "approved", customer_id: "64b5a0-a2330d61cce5" } },
  });
  const ok = await getCardKycStatus("a@b.com");
  assert.equal(ok.approved, true);
  assert.equal(ok.customerId, "64b5a0-a2330d61cce5");
  assert.equal(new URL(calls[0].url).searchParams.get("email"), "a@b.com");

  responder = () => ({ status: 200, json: { success: true, data: { status: "pending", customer_id: "x" } } });
  const pending = await getCardKycStatus("a@b.com");
  assert.equal(pending.approved, false);
  assert.equal(pending.customerId, null);
});

test("getCardDetails exposes a numeric balance", async () => {
  responder = () => ({ status: 200, json: { success: true, response: { card_detail: { balance: "42.50", last4: "1234" } } } });
  const d = await getCardDetails("c");
  assert.equal(d.balance, 42.5);
  assert.equal(d.detail.last4, "1234");
});

test("extractList finds transaction arrays under several wrappers", () => {
  assert.deepEqual(extractList({ response: { card_transactions: [1, 2] } }), [1, 2]);
  assert.deepEqual(extractList({ data: { transactions: [3] } }), [3]);
  assert.deepEqual(extractList({ nothing: true }), []);
});

test("KYC helpers: id type, dob, phone, payload and missing-field detection", () => {
  assert.equal(mapIdType("Driver's License"), "drivers_license");
  assert.equal(mapIdType("passport"), "passport");
  assert.equal(mapIdType("CIN"), "national_id");
  assert.equal(normalizeDob("1990-05-17"), "1990-05-17");
  assert.equal(normalizeDob("not a date"), "");
  assert.deepEqual(splitPhone("+509 3700 1234"), { dial_code: "+509", phone_number: "37001234" });
  assert.deepEqual(splitPhone("37001234"), { dial_code: "+509", phone_number: "37001234" });
  assert.deepEqual(splitPhone("+1 (305) 555-0100"), { dial_code: "+1", phone_number: "3055550100" });

  const input = buildCardKycInput({
    profile: { email: "j@x.com", fullName: "Jean Pierre Louis", dateOfBirth: "1990-05-17", phone: "+50937001234", country: "Haiti" },
    kyc: { idType: "national_id", idNumber: "123456" },
    idFrontImageBase64: "QUJD",
  });
  assert.equal(input.first_name, "Jean");
  assert.equal(input.last_name, "Pierre Louis");
  assert.equal(input.country, "USA");
  assert.deepEqual(missingKycFields(input), []);
  assert.deepEqual(missingKycFields({ ...input, id_front_image: "", phone_number: "" }), ["phone_number", "id_front_image"]);
});

// ════════════════════════════════════════════════════════════════════════════
//  Webhook core — in-memory store that mimics the DB guarantees:
//   • UNIQUE(provider id) and UNIQUE(event, reference)
//   • per-key advisory lock (serialised work)
//   • all-or-nothing transactions (rollback on throw)
// ════════════════════════════════════════════════════════════════════════════

interface LocalTxn { id: number; cardId: number; type: string; amount: number; providerTxId: string | null; createdAt: number; description?: string }
interface State {
  events: Array<EventRecord & { id: number; outcome: string }>;
  cards: CardRef[];
  wallets: Record<number, number>;
  txns: LocalTxn[];
  seq: number;
}

class FakeDb {
  state: State = { events: [], cards: [], wallets: {}, txns: [], seq: 1 };
  private queues = new Map<string, Promise<unknown>>();
  failNextApply = false;

  addCard(partial: Partial<CardRef> & { id: number }): CardRef {
    const card: CardRef = { kind: "nfc", profileId: 1, cardId: `card-${partial.id}`, balance: 100, last4: "5976", ...partial };
    this.state.cards.push(card);
    return card;
  }
  addLocalWithdrawal(cardId: number, amount: number, ageMs = 1000) {
    this.state.txns.push({ id: this.state.seq++, cardId, type: "withdraw", amount, providerTxId: null, createdAt: Date.now() - ageMs });
  }

  store: WebhookStore = {
    inLock: async (key, fn) => {
      const prev = this.queues.get(key) ?? Promise.resolve();
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      this.queues.set(key, prev.then(() => gate));
      await prev;
      const snapshot = structuredClone(this.state);
      try {
        return await fn(this.tx());
      } catch (e) {
        this.state = snapshot; // rollback
        throw e;
      } finally {
        release();
      }
    },
  };

  private tx(): WebhookTx {
    const s = () => this.state;
    return {
      insertEvent: async (e) => {
        const dupId = e.providerEventId && s().events.some((x) => x.providerEventId === e.providerEventId);
        const dupRef = e.reference && s().events.some((x) => x.event === e.event && x.reference === e.reference);
        if (dupId || dupRef) return null;
        const id = s().seq++;
        s().events.push({ ...e, id, outcome: "processing" });
        return id;
      },
      setEventOutcome: async (rowId, outcome) => {
        s().events.find((x) => x.id === rowId)!.outcome = outcome;
      },
      findCard: async (cardId) => s().cards.find((c) => c.cardId === cardId) ?? null,
      hasLocalWithdrawalWithRef: async (card, ref) =>
        s().txns.some((t) => t.cardId === card.id && t.type === "withdraw" && t.providerTxId === ref),
      claimUnconfirmedLocalWithdrawal: async (card, amount, ref, windowMs) => {
        const hit = s().txns
          .filter((t) => t.cardId === card.id && t.type === "withdraw" && t.providerTxId === null
            && Math.abs(t.amount - amount) < 0.001 && Date.now() - t.createdAt <= windowMs)
          .sort((a, b) => a.createdAt - b.createdAt || a.id - b.id)[0];
        if (!hit) return false;
        hit.providerTxId = ref;
        return true;
      },
      applyWithdrawal: async ({ card, amount, netToWallet, reference, description }) => {
        const c = s().cards.find((x) => x.id === card.id)!;
        if (c.balance + 1e-9 < amount) return null;
        c.balance = +(c.balance - amount).toFixed(2);
        s().wallets[c.profileId] = +((s().wallets[c.profileId] ?? 0) + netToWallet).toFixed(2);
        s().txns.push({ id: s().seq++, cardId: c.id, type: "withdraw", amount, providerTxId: reference, createdAt: Date.now(), description });
        if (this.failNextApply) { this.failNextApply = false; throw new Error("simulated crash after money moved"); }
        return { walletBalance: s().wallets[c.profileId] };
      },
    };
  }
}

function makeDeps(fake: FakeDb, over: Partial<WebhookDeps> = {}) {
  const admin: string[] = [];
  const users: Array<{ profileId: number; title: string; message: string }> = [];
  const deps: WebhookDeps = {
    store: fake.store,
    calcWithdrawal: (amount) => ({ fee: 1, netToWallet: +(amount - 1).toFixed(2) }),
    notifyAdmin: (t) => { admin.push(t); },
    notifyUser: (profileId, title, message) => { users.push({ profileId, title, message }); },
    ...over,
  };
  return { deps, admin, users };
}

// The exact payload from the integration spec.
const SPEC_PAYLOAD = {
  id: "13108c63-42b9-4675d696c",
  event: "virtualcard.withdrawal.success",
  date: "2026-10-12T23:40:23Z",
  amount: "5.00",
  fee: "0.00",
  credited: "5.00",
  cardId: "01a0fcac-7c9e-77d7-a25b79b5",
  reason: "",
  status: "complete",
  narrative: "Withdraw from virtual card",
  reference: "IIDSABQC",
};

function setup(over: Partial<WebhookDeps> = {}) {
  const fake = new FakeDb();
  const card = fake.addCard({ id: 7, cardId: SPEC_PAYLOAD.cardId, balance: 20, profileId: 3 });
  fake.state.wallets[3] = 50;
  return { fake, card, ...makeDeps(fake, over) };
}

test("webhook: unmatched withdrawal is applied exactly once (card −5, wallet +4, txn + event recorded)", async () => {
  const { fake, deps, users, admin } = setup();
  const r = await processZiiropayWebhook(SPEC_PAYLOAD, deps);
  assert.equal(r.outcome, "applied");
  assert.equal(r.httpStatus, 200);
  assert.equal(fake.state.cards[0].balance, 15);
  assert.equal(fake.state.wallets[3], 54);
  assert.equal(fake.state.txns.length, 1);
  assert.equal(fake.state.txns[0].providerTxId, "IIDSABQC");
  assert.equal(fake.state.events.length, 1);
  assert.equal(fake.state.events[0].outcome, "applied");
  assert.equal(users.length, 1);
  assert.equal(users[0].profileId, 3);
  assert.equal(admin.length, 1);
});

test("webhook: redelivery of the same event never credits twice", async () => {
  const { fake, deps } = setup();
  await processZiiropayWebhook(SPEC_PAYLOAD, deps);
  const again = await processZiiropayWebhook(SPEC_PAYLOAD, deps);
  assert.equal(again.outcome, "duplicate");
  assert.equal(fake.state.wallets[3], 54);
  assert.equal(fake.state.cards[0].balance, 15);
  assert.equal(fake.state.txns.length, 1);
});

test("webhook: same reference with a different id, or same id with a different reference, is a duplicate", async () => {
  const { fake, deps } = setup();
  await processZiiropayWebhook(SPEC_PAYLOAD, deps);
  const sameRef = await processZiiropayWebhook({ ...SPEC_PAYLOAD, id: "other-id" }, deps);
  const sameId = await processZiiropayWebhook({ ...SPEC_PAYLOAD, reference: "OTHERREF" }, deps);
  assert.equal(sameRef.outcome, "duplicate");
  assert.equal(sameId.outcome, "duplicate");
  assert.equal(fake.state.wallets[3], 54);
});

test("webhook: 8 concurrent deliveries of the same event apply exactly once", async () => {
  const { fake, deps } = setup();
  const results = await Promise.all(Array.from({ length: 8 }, () => processZiiropayWebhook(SPEC_PAYLOAD, deps)));
  assert.equal(results.filter((r) => r.outcome === "applied").length, 1);
  assert.equal(results.filter((r) => r.outcome === "duplicate").length, 7);
  assert.equal(fake.state.wallets[3], 54);
  assert.equal(fake.state.cards[0].balance, 15);
});

test("webhook: a withdrawal already credited by the in-app route is only confirmed, never credited again", async () => {
  const { fake, card, deps, users } = setup();
  fake.addLocalWithdrawal(card.id, 5);
  const r = await processZiiropayWebhook(SPEC_PAYLOAD, deps);
  assert.equal(r.outcome, "matched_local");
  assert.equal(fake.state.wallets[3], 50, "wallet untouched");
  assert.equal(fake.state.cards[0].balance, 20, "card untouched");
  assert.equal(fake.state.txns[0].providerTxId, "IIDSABQC", "local row stamped with the provider reference");
  assert.equal(users.length, 0);
  const dup = await processZiiropayWebhook(SPEC_PAYLOAD, deps);
  assert.equal(dup.outcome, "duplicate");
});

test("webhook: two in-app withdrawals of the same amount are matched FIFO by two webhooks", async () => {
  const { fake, card, deps } = setup();
  fake.addLocalWithdrawal(card.id, 5, 5000);
  fake.addLocalWithdrawal(card.id, 5, 1000);
  const a = await processZiiropayWebhook(SPEC_PAYLOAD, deps);
  const b = await processZiiropayWebhook({ ...SPEC_PAYLOAD, id: "second", reference: "SECOND01" }, deps);
  assert.deepEqual([a.outcome, b.outcome], ["matched_local", "matched_local"]);
  assert.deepEqual(fake.state.txns.map((t) => t.providerTxId), ["IIDSABQC", "SECOND01"]);
  assert.equal(fake.state.wallets[3], 50);
});

test("webhook: an in-app withdrawal outside the match window is NOT matched (applied instead)", async () => {
  const { fake, card, deps } = setup();
  fake.addLocalWithdrawal(card.id, 5, 2 * 60 * 60 * 1000); // 2 hours old
  const r = await processZiiropayWebhook(SPEC_PAYLOAD, deps);
  assert.equal(r.outcome, "applied");
});

test("webhook racing the in-app route: webhook waits for the route's lock, then matches (no double credit)", async () => {
  const { fake, card, deps } = setup();
  const lockKey = `ziiropay:card:${SPEC_PAYLOAD.cardId}`;

  // The in-app route holds the card lock while it calls the provider and books the withdrawal.
  const route = fake.store.inLock(lockKey, async () => {
    await new Promise((r) => setTimeout(r, 40));
    fake.addLocalWithdrawal(card.id, 5, 0); // route books + credits wallet itself
    fake.state.wallets[3] += 4;
    fake.state.cards[0].balance -= 5;
  });
  // Webhook arrives while the route is still running.
  await new Promise((r) => setTimeout(r, 5));
  const hook = processZiiropayWebhook(SPEC_PAYLOAD, deps);

  const [, result] = await Promise.all([route, hook]);
  assert.equal(result.outcome, "matched_local");
  assert.equal(fake.state.wallets[3], 54, "credited once (by the route)");
  assert.equal(fake.state.cards[0].balance, 15);
});

test("webhook: a crash mid-transaction rolls everything back, and the provider retry then applies once", async () => {
  const { fake, deps } = setup();
  fake.failNextApply = true;
  await assert.rejects(() => processZiiropayWebhook(SPEC_PAYLOAD, deps), /simulated crash/);
  assert.equal(fake.state.wallets[3], 50, "wallet rolled back");
  assert.equal(fake.state.cards[0].balance, 20, "card rolled back");
  assert.equal(fake.state.events.length, 0, "event row rolled back");
  const retry = await processZiiropayWebhook(SPEC_PAYLOAD, deps);
  assert.equal(retry.outcome, "applied");
  assert.equal(fake.state.wallets[3], 54);
});

test("webhook: amount above the card's local balance is held for review — no money moves", async () => {
  const { fake, deps, admin } = setup();
  const r = await processZiiropayWebhook({ ...SPEC_PAYLOAD, amount: "500.00" }, deps);
  assert.equal(r.outcome, "held_for_review");
  assert.equal(fake.state.wallets[3], 50);
  assert.equal(fake.state.cards[0].balance, 20);
  assert.equal(fake.state.events[0].outcome, "held_for_review");
  assert.match(admin[0], /HELD/);
});

test("webhook: net amount ≤ 0 after the service fee is held for review", async () => {
  const { fake, deps } = setup({ calcWithdrawal: (a) => ({ fee: 10, netToWallet: a - 10 }) });
  const r = await processZiiropayWebhook(SPEC_PAYLOAD, deps);
  assert.equal(r.outcome, "held_for_review");
  assert.equal(fake.state.wallets[3], 50);
});

test("webhook: unknown card → nothing applied, admin alerted, no event row (so it can be reprocessed later)", async () => {
  const { fake, deps, admin } = setup();
  const r = await processZiiropayWebhook({ ...SPEC_PAYLOAD, cardId: "does-not-exist" }, deps);
  assert.equal(r.outcome, "unknown_card");
  assert.equal(r.httpStatus, 200);
  assert.equal(fake.state.events.length, 0);
  assert.equal(admin.length, 1);
});

test("webhook: non-success status is ignored; malformed payloads are rejected with 400", async () => {
  const { fake, deps } = setup();
  assert.equal((await processZiiropayWebhook({ ...SPEC_PAYLOAD, status: "failed" }, deps)).outcome, "ignored_status");
  for (const bad of [
    null, "x", [], {},
    { ...SPEC_PAYLOAD, amount: "abc" },
    { ...SPEC_PAYLOAD, amount: "-5" },
    { ...SPEC_PAYLOAD, amount: "0" },
    { ...SPEC_PAYLOAD, cardId: "" },
    { ...SPEC_PAYLOAD, id: "", reference: "" },
  ]) {
    const r = await processZiiropayWebhook(bad, deps);
    assert.equal(r.outcome, "invalid");
    assert.equal(r.httpStatus, 400);
  }
  assert.equal(fake.state.wallets[3], 50);
  assert.equal(fake.state.events.length, 0);
});

test("webhook: withdrawals on a legacy virtual card are applied once too", async () => {
  const fake = new FakeDb();
  fake.addCard({ id: 9, kind: "virtual", cardId: "legacy-card", balance: 10, profileId: 4 });
  fake.state.wallets[4] = 0;
  const { deps } = makeDeps(fake);
  const r = await processZiiropayWebhook({ ...SPEC_PAYLOAD, cardId: "legacy-card" }, deps);
  assert.equal(r.outcome, "applied");
  assert.equal(fake.state.wallets[4], 4);
  assert.equal(fake.state.cards[0].balance, 5);
});

test("webhook: other events are recorded + admin alerted once, never touching balances", async () => {
  const { fake, deps, admin } = setup();
  const evt = { id: "evt-1", event: "virtualcard.created.complete", cardId: SPEC_PAYLOAD.cardId, amount: "3", status: "active", reference: "REF1" };
  assert.equal((await processZiiropayWebhook(evt, deps)).outcome, "recorded");
  assert.equal((await processZiiropayWebhook(evt, deps)).outcome, "duplicate");
  assert.equal(admin.length, 1);
  assert.equal(fake.state.wallets[3], 50);
  assert.equal(fake.state.cards[0].balance, 20);
});

test("webhook: a failing notifier never changes the outcome or the money", async () => {
  const { fake, deps } = setup({
    notifyAdmin: () => { throw new Error("telegram down"); },
    notifyUser: () => { throw new Error("whatsapp down"); },
  });
  const r = await processZiiropayWebhook(SPEC_PAYLOAD, deps);
  assert.equal(r.outcome, "applied");
  assert.equal(fake.state.wallets[3], 54);
});

test("webhook auth: fails closed in production without a secret; accepts query/header/bearer when set", () => {
  const prodNoSecret = checkWebhookAuth({ configuredSecret: "", isProduction: true, presented: ["anything"] });
  assert.deepEqual(prodNoSecret, { ok: false, status: 503, message: "Webhook secret not configured" });

  assert.equal(checkWebhookAuth({ configuredSecret: "s3cret", isProduction: true, presented: [] }).ok, false);
  assert.equal(checkWebhookAuth({ configuredSecret: "s3cret", isProduction: true, presented: ["wrong"] }).ok, false);
  assert.equal(checkWebhookAuth({ configuredSecret: "s3cret", isProduction: true, presented: ["nope", "s3cret"] }).ok, true);
  assert.equal(checkWebhookAuth({ configuredSecret: "s3cret", isProduction: true, presented: ["s3cre"] }).ok, false);
  assert.equal(checkWebhookAuth({ configuredSecret: "", isProduction: false, presented: [] }).ok, true);
});
