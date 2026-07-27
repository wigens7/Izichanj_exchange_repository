export const EXCHANGE_RATE_USDT_HTG = 143; // Deposit rate: 1 USDT = 143 HTG
export const WITHDRAWAL_EXCHANGE_RATE_USDT_HTG = 139; // Withdrawal rate: 1 USDT = 139 HTG
export const MANUAL_DEPOSIT_MIN_HTG = 1430; // 10 USDT minimum
export const MANUAL_DEPOSIT_MIN_USDT = 10;
export const MANUAL_DEPOSIT_EXCHANGE_RATE = EXCHANGE_RATE_USDT_HTG; // Same as global rate

export const NETWORK_FEE_CONFIG = {
  usdttrc20: { label: "TRC20", network: "TRON", minAmount: 10.00, fee: 2.50, maxAmount: 50000 },
  usdtbsc:   { label: "BEP20", network: "BSC",  minAmount: 10.00, fee: 0.25, maxAmount: 50000 },
} as const;

export type NetworkCurrency = keyof typeof NETWORK_FEE_CONFIG;

export const WITHDRAWAL_MIN_USDT = 10;
export const WITHDRAWAL_MAX_USDT = 10000;
export const WITHDRAWAL_FEE_USDT = 2.50;
export const TOPUP_FEE_USD = 1.86; // Fixed service fee per mobile top-up transaction

// ────── Virtual Card Pricing ──────
// Card creation — FLAT TOTAL pricing (no add-on fees shown to user):
//   • User pays exactly $19.00 USDT, period.
//   • $5.00  → loaded onto the card (Strowallet's minimum allowed for virtualcards/create)
//   • $4.40  → Strowallet fixed fees ($2.50 + $1.90)
//   • $0.17  → Strowallet 3.4% variable fee on the $5 load (absorbed by Izichanj)
//   • $9.43  → Izichanj profit
export const CARD_TOTAL_PRICE_USD     = 19;     // What the user pays — flat, no extras
export const CARD_LOAD_AMOUNT_USD     = 5;      // Initial balance loaded (Strowallet API min = $5)
export const CARD_CREATION_FEE_USD    = CARD_TOTAL_PRICE_USD - CARD_LOAD_AMOUNT_USD; // $14 (shown as "card fee")
export const CARD_CREATION_VAR_PCT    = 0.034;  // Strowallet variable (absorbed; not added to user total)
// Card top-up (funding existing card):
//   • $2.15 fixed = $1.90 Strowallet fixed + $0.25 Izichanj profit
//   • Plus Strowallet variable: 1.9%
//   • Plus the funding amount itself (goes to the card)
export const CARD_TOPUP_FIXED_FEE_USD = 2.15;   // $0.25 Izichanj markup + $1.90 Strowallet fixed
export const CARD_TOPUP_VAR_PCT       = 0.019;  // Strowallet 1.9% variable
export const CARD_TOPUP_MIN_USD       = 5;      // Minimum top-up amount

// ────── Dynamic card pricing (admin-editable) ──────
// These defaults can be overridden at runtime from app_settings via the admin panel.
export interface CardTierPricing {
  price: number;         // Total the user pays to create the card
  loadAmount: number;    // Amount loaded onto the card at creation (Strowallet min $5)
  topupFixedFee: number; // Fixed fee per top-up
  topupVarPct: number;   // Variable % fee per top-up (0.019 = 1.9%)
  topupMin: number;      // Minimum top-up amount
}

export interface CardPricingConfig {
  virtual: CardTierPricing;
  nfc: CardTierPricing & {
    withdrawFee: number; // Flat fee to withdraw from NFC card back to wallet
    withdrawMin: number; // Minimum NFC withdrawal
  };
}

export const DEFAULT_CARD_PRICING: CardPricingConfig = {
  virtual: {
    price: CARD_TOTAL_PRICE_USD,
    loadAmount: CARD_LOAD_AMOUNT_USD,
    topupFixedFee: CARD_TOPUP_FIXED_FEE_USD,
    topupVarPct: CARD_TOPUP_VAR_PCT,
    topupMin: CARD_TOPUP_MIN_USD,
  },
  nfc: {
    price: 19,
    loadAmount: 5,
    topupFixedFee: 2.15,
    topupVarPct: 0.019,
    topupMin: 5,
    withdrawFee: 1.0,
    withdrawMin: 5,
  },
};

export interface CardChargeBreakdown {
  loadAmount: number;   // What actually goes onto the card
  fixedFee: number;     // Card / activation fee (markup + Stro fixed)
  variableFee: number;  // Network / percentage fee
  total: number;        // Total user pays from their wallet
}

export function calcCardCreationCost(
  loadAmount: number = DEFAULT_CARD_PRICING.virtual.loadAmount,
  totalPrice: number = DEFAULT_CARD_PRICING.virtual.price,
): CardChargeBreakdown {
  // Flat pricing — total never changes regardless of load amount.
  // Network/variable fee is absorbed by Izichanj (kept for transparency, not billed to user).
  const variableFee = 0;
  const total       = totalPrice;
  const fixedFee    = +(total - loadAmount).toFixed(2);
  return { loadAmount, fixedFee, variableFee, total };
}

export function calcCardTopUpCost(
  loadAmount: number,
  fixedFee: number = DEFAULT_CARD_PRICING.virtual.topupFixedFee,
  varPct: number = DEFAULT_CARD_PRICING.virtual.topupVarPct,
): CardChargeBreakdown {
  const variableFee = +(loadAmount * varPct).toFixed(2);
  const total       = +(loadAmount + fixedFee + variableFee).toFixed(2);
  return { loadAmount, fixedFee, variableFee, total };
}

// ────── NFC Virtual Card Pricing ──────
// NFC card creation — same flat $19.00 pricing as the standard virtual card.
//   • $5.00  → loaded onto card (Strowallet API minimum)
//   • $4.40  → Strowallet fixed fees
//   • $0.17  → 3.4% variable fee (absorbed by Izichanj)
//   • $9.43  → Izichanj profit
export const NFC_CARD_TOTAL_PRICE_USD  = 19;
export const NFC_CARD_LOAD_AMOUNT_USD  = 5;
// NFC top-up: user pays ALL Strowallet fees + $0.25 Izichanj profit.
//   • Total = amount + ($1.90 Stro fixed + $0.25 Izichanj) + 1.9% Stro variable
export const NFC_TOPUP_FIXED_FEE_USD   = 2.15;   // $1.90 Stro + $0.25 profit
export const NFC_TOPUP_VAR_PCT         = 0.019;  // 1.9% Strowallet variable
export const NFC_TOPUP_MIN_USD         = 5;
// NFC withdrawal back to user wallet: small flat $1 service fee
export const NFC_WITHDRAW_FEE_USD      = 1.00;
export const NFC_WITHDRAW_MIN_USD      = 5;

export function calcNfcCardCreationCost(
  loadAmount: number = DEFAULT_CARD_PRICING.nfc.loadAmount,
  totalPrice: number = DEFAULT_CARD_PRICING.nfc.price,
): CardChargeBreakdown {
  // Flat pricing — total never changes regardless of load amount.
  const variableFee = 0;
  const total       = totalPrice;
  const fixedFee    = +(total - loadAmount).toFixed(2);
  return { loadAmount, fixedFee, variableFee, total };
}

export function calcNfcCardTopUpCost(
  loadAmount: number,
  fixedFee: number = DEFAULT_CARD_PRICING.nfc.topupFixedFee,
  varPct: number = DEFAULT_CARD_PRICING.nfc.topupVarPct,
): CardChargeBreakdown {
  const variableFee = +(loadAmount * varPct).toFixed(2);
  const total       = +(loadAmount + fixedFee + variableFee).toFixed(2);
  return { loadAmount, fixedFee, variableFee, total };
}

export function calcNfcCardWithdrawCost(
  amount: number,
  fee: number = DEFAULT_CARD_PRICING.nfc.withdrawFee,
): { amount: number; fee: number; netToWallet: number } {
  // User asks to pull `amount` off the card — we charge the card for `amount`,
  // then credit (amount - fee) back to their Izichanj USDT balance.
  const netToWallet = +Math.max(0, amount - fee).toFixed(2);
  return { amount, fee, netToWallet };
}

// ────── Merchant API Pricing ──────
// 0% transaction fee — Izichanj Pay is FREE for merchants to drive adoption.
export const MERCHANT_API_FEE_PCT = 0;
// HTG equivalents (kept for backward compat)
export const WITHDRAWAL_MIN_HTG = WITHDRAWAL_MIN_USDT * EXCHANGE_RATE_USDT_HTG;
export const WITHDRAWAL_MAX_HTG = WITHDRAWAL_MAX_USDT * EXCHANGE_RATE_USDT_HTG;

export function usdtToHtg(usdt: number): number {
  return usdt * EXCHANGE_RATE_USDT_HTG;
}

export function usdtToHtgWithdrawal(usdt: number): number {
  return usdt * WITHDRAWAL_EXCHANGE_RATE_USDT_HTG;
}

export function htgToUsdt(htg: number): number {
  return htg / EXCHANGE_RATE_USDT_HTG;
}

export function formatHtg(amount: number): string {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatUsdt(amount: number): string {
  return amount.toFixed(2);
}
