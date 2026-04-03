import { useQuery } from "@tanstack/react-query";
import { EXCHANGE_RATE_USDT_HTG, WITHDRAWAL_EXCHANGE_RATE_USDT_HTG } from "@shared/constants";

export interface Rates {
  depositRate: number;
  withdrawalRate: number;
}

const FALLBACK: Rates = {
  depositRate: EXCHANGE_RATE_USDT_HTG,
  withdrawalRate: WITHDRAWAL_EXCHANGE_RATE_USDT_HTG,
};

export function useRates(): Rates {
  const { data } = useQuery<Rates>({
    queryKey: ["/api/settings/rates"],
    staleTime: 30_000,
  });
  return data ?? FALLBACK;
}

export function makeUsdtToHtg(rate: number) {
  return (usdt: number) => usdt * rate;
}

export function makeHtgToUsdt(rate: number) {
  return (htg: number) => htg / rate;
}

export function makeUsdtToHtgWithdrawal(rate: number) {
  return (usdt: number) => usdt * rate;
}
