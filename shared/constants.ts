export const EXCHANGE_RATE_USDT_HTG = 143; // Deposit rate: 1 USDT = 143 HTG
export const WITHDRAWAL_EXCHANGE_RATE_USDT_HTG = 139; // Withdrawal rate: 1 USDT = 139 HTG
export const MANUAL_DEPOSIT_MIN_HTG = 1430; // 10 USDT minimum
export const MANUAL_DEPOSIT_MIN_USDT = 10;
export const MANUAL_DEPOSIT_EXCHANGE_RATE = EXCHANGE_RATE_USDT_HTG; // Same as global rate

export const NETWORK_FEE_CONFIG = {
  usdttrc20: { label: "TRC20", network: "TRON", minAmount: 5.00, fee: 2.50 },
  usdtbsc:   { label: "BEP20", network: "BSC",  minAmount: 1.00, fee: 0.25 },
} as const;

export type NetworkCurrency = keyof typeof NETWORK_FEE_CONFIG;

export const WITHDRAWAL_MIN_USDT = 10;
export const WITHDRAWAL_MAX_USDT = 10000;
export const WITHDRAWAL_FEE_USDT = 2.50;
export const TOPUP_FEE_USD = 1.86; // Fixed service fee per mobile top-up transaction
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
