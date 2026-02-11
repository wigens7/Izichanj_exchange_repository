export const EXCHANGE_RATE_USDT_HTG = 139.50;

export const WITHDRAWAL_MIN_HTG = 1000;
export const WITHDRAWAL_MAX_HTG = 100000;
export const WITHDRAWAL_MIN_USDT = WITHDRAWAL_MIN_HTG / EXCHANGE_RATE_USDT_HTG;
export const WITHDRAWAL_MAX_USDT = WITHDRAWAL_MAX_HTG / EXCHANGE_RATE_USDT_HTG;

export function usdtToHtg(usdt: number): number {
  return usdt * EXCHANGE_RATE_USDT_HTG;
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
