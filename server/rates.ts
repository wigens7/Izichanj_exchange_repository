import { EXCHANGE_RATE_USDT_HTG, WITHDRAWAL_EXCHANGE_RATE_USDT_HTG } from "@shared/constants";

let depositRate: number = EXCHANGE_RATE_USDT_HTG;
let withdrawalRate: number = WITHDRAWAL_EXCHANGE_RATE_USDT_HTG;

export function getDepositRate(): number { return depositRate; }
export function getWithdrawalRate(): number { return withdrawalRate; }

export function setRates(deposit: number, withdrawal: number): void {
  depositRate = deposit;
  withdrawalRate = withdrawal;
}

export function rateUsdtToHtg(usdt: number): number { return usdt * depositRate; }
export function rateHtgToUsdt(htg: number): number { return htg / depositRate; }
export function rateUsdtToHtgWithdrawal(usdt: number): number { return usdt * withdrawalRate; }
