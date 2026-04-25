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

export interface CardChargeBreakdown {
  loadAmount: number;   // What actually goes onto the card
  fixedFee: number;     // Card / activation fee (markup + Stro fixed)
  variableFee: number;  // Network / percentage fee
  total: number;        // Total user pays from their wallet
}

export function calcCardCreationCost(loadAmount: number = CARD_LOAD_AMOUNT_USD): CardChargeBreakdown {
  // Flat pricing — total never changes regardless of load amount.
  // Network/variable fee is absorbed by Izichanj (kept for transparency, not billed to user).
  const variableFee = 0;
  const total       = CARD_TOTAL_PRICE_USD;
  const fixedFee    = +(total - loadAmount).toFixed(2);
  return { loadAmount, fixedFee, variableFee, total };
}

export function calcCardTopUpCost(loadAmount: number): CardChargeBreakdown {
  const variableFee = +(loadAmount * CARD_TOPUP_VAR_PCT).toFixed(2);
  const total       = +(loadAmount + CARD_TOPUP_FIXED_FEE_USD + variableFee).toFixed(2);
  return { loadAmount, fixedFee: CARD_TOPUP_FIXED_FEE_USD, variableFee, total };
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
