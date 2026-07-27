import { useQuery } from "@tanstack/react-query";
import { DEFAULT_CARD_PRICING, type CardPricingConfig } from "@shared/constants";

/**
 * Live card pricing (admin-editable). Falls back to compiled defaults
 * while loading or if the endpoint is unreachable.
 */
export function useCardPricing(): CardPricingConfig {
  const { data } = useQuery<CardPricingConfig>({
    queryKey: ["/api/settings/card-pricing"],
    staleTime: 30_000,
    refetchInterval: 60_000,       // keep quotes fresh even if admin changes pricing mid-session
    refetchOnWindowFocus: true,
  });
  return data ?? DEFAULT_CARD_PRICING;
}
