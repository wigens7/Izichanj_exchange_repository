// ── Dynamic card pricing (admin-editable) ──────────────────────────────
// In-memory config seeded from DEFAULT_CARD_PRICING, overridden by the
// `card_pricing` JSON row in app_settings. Same pattern as server/rates.ts.
import { DEFAULT_CARD_PRICING, type CardPricingConfig } from "@shared/constants";

const SETTINGS_KEY = "card_pricing";
// Strowallet's virtualcards/create API rejects loads below $5.
export const STROWALLET_MIN_LOAD_USD = 5;

let current: CardPricingConfig = structuredClone(DEFAULT_CARD_PRICING);

export function getCardPricing(): CardPricingConfig {
  return current;
}

function num(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Merge a partial/untrusted object over defaults, keeping only finite numbers. */
function sanitize(raw: any): CardPricingConfig {
  const d = structuredClone(DEFAULT_CARD_PRICING);
  if (!raw || typeof raw !== "object") return d;
  const v = raw.virtual ?? {};
  const n = raw.nfc ?? {};
  return {
    virtual: {
      price:         num(v.price)         ?? d.virtual.price,
      loadAmount:    num(v.loadAmount)    ?? d.virtual.loadAmount,
      topupFixedFee: num(v.topupFixedFee) ?? d.virtual.topupFixedFee,
      topupVarPct:   num(v.topupVarPct)   ?? d.virtual.topupVarPct,
      topupMin:      num(v.topupMin)      ?? d.virtual.topupMin,
    },
    nfc: {
      price:         num(n.price)         ?? d.nfc.price,
      loadAmount:    num(n.loadAmount)    ?? d.nfc.loadAmount,
      topupFixedFee: num(n.topupFixedFee) ?? d.nfc.topupFixedFee,
      topupVarPct:   num(n.topupVarPct)   ?? d.nfc.topupVarPct,
      topupMin:      num(n.topupMin)      ?? d.nfc.topupMin,
      withdrawFee:   num(n.withdrawFee)   ?? d.nfc.withdrawFee,
      withdrawMin:   num(n.withdrawMin)   ?? d.nfc.withdrawMin,
    },
  };
}

// Known Strowallet provider costs (what Izichanj pays per operation).
// Validation refuses configs that don't at least cover these.
const STRO_CREATE_FIXED_USD = 4.4;   // $2.50 + $1.90 fixed at issuance
const STRO_CREATE_VAR_PCT   = 0.034; // 3.4% of load at issuance
const STRO_TOPUP_FIXED_USD  = 1.9;   // fixed per top-up
const STRO_TOPUP_VAR_PCT    = 0.019; // 1.9% variable per top-up

/** Money-safety validation. Returns an error message, or null if OK. */
export function validateCardPricing(cfg: CardPricingConfig): string | null {
  for (const [label, t] of [["Virtual card", cfg.virtual], ["NFC card", cfg.nfc]] as const) {
    if (t.price <= 0 || t.price > 1000) return `${label}: price must be between $0.01 and $1000`;
    if (t.loadAmount < STROWALLET_MIN_LOAD_USD) return `${label}: load amount must be at least $${STROWALLET_MIN_LOAD_USD} (card provider minimum)`;
    if (t.loadAmount >= t.price) return `${label}: load amount ($${t.loadAmount}) must be LESS than the price ($${t.price}) — otherwise you lose money on every card`;
    // Creation must cover provider issuance costs: load + $4.40 fixed + 3.4% of load
    const creationCost = +(t.loadAmount + STRO_CREATE_FIXED_USD + t.loadAmount * STRO_CREATE_VAR_PCT).toFixed(2);
    if (t.price < creationCost) return `${label}: price ($${t.price}) doesn't cover provider costs ($${creationCost} = $${t.loadAmount} load + $${STRO_CREATE_FIXED_USD} fixed + 3.4% of load) — you would lose money on every card`;
    if (t.topupFixedFee < STRO_TOPUP_FIXED_USD) return `${label}: top-up fixed fee must be at least $${STRO_TOPUP_FIXED_USD} (provider's fixed cost per top-up)`;
    if (t.topupFixedFee > 100) return `${label}: top-up fixed fee must be at most $100`;
    if (t.topupVarPct < STRO_TOPUP_VAR_PCT) return `${label}: top-up variable % must be at least ${(STRO_TOPUP_VAR_PCT * 100).toFixed(1)}% (provider's variable cost)`;
    if (t.topupVarPct >= 0.5) return `${label}: top-up variable % must be below 50%`;
    if (t.topupMin < 1 || t.topupMin > 1000) return `${label}: minimum top-up must be between $1 and $1000`;
  }
  if (cfg.nfc.withdrawFee < 0 || cfg.nfc.withdrawFee > 100) return "NFC card: withdraw fee must be between $0 and $100";
  if (cfg.nfc.withdrawMin < 1 || cfg.nfc.withdrawMin > 1000) return "NFC card: minimum withdrawal must be between $1 and $1000";
  if (cfg.nfc.withdrawMin <= cfg.nfc.withdrawFee) return "NFC card: minimum withdrawal must be greater than the withdraw fee";
  return null;
}

/** Load saved pricing from app_settings at startup (defaults if absent/invalid). */
export async function loadCardPricing(db: any, sql: any): Promise<void> {
  try {
    const rows = await db.execute(sql`SELECT value FROM app_settings WHERE key = ${SETTINGS_KEY} LIMIT 1`);
    const row = (rows.rows as any[])[0];
    if (row?.value) {
      const cfg = sanitize(JSON.parse(row.value));
      const err = validateCardPricing(cfg);
      if (err) {
        console.warn(`[card-pricing] Saved config invalid (${err}); using defaults`);
      } else {
        current = cfg;
        console.log(`[card-pricing] Loaded: virtual $${cfg.virtual.price}, nfc $${cfg.nfc.price}`);
        return;
      }
    }
    console.log("[card-pricing] Using default pricing");
  } catch (e) {
    console.warn("[card-pricing] Could not load from DB, using defaults:", (e as Error).message);
  }
}

/** Validate + persist + apply new pricing. Returns error message or null. */
export async function saveCardPricing(db: any, appSettings: any, raw: any): Promise<string | null> {
  const cfg = sanitize(raw);
  const err = validateCardPricing(cfg);
  if (err) return err;
  await db
    .insert(appSettings)
    .values({ key: SETTINGS_KEY, value: JSON.stringify(cfg) })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: JSON.stringify(cfg), updatedAt: new Date() } });
  current = cfg;
  return null;
}
