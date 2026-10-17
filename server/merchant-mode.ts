export type MerchantMode = "test" | "live";

export function merchantModeFromSecretKey(key: string): MerchantMode | null {
  if (key.startsWith("izk_test_sk_")) return "test";
  if (key.startsWith("izk_live_sk_") || key.startsWith("izi_sk_")) return "live";
  return null;
}

export function isLiveMerchantApproved(merchant: {
  kycStatus: string;
  paymentEnabled: boolean;
  accountStatus: string;
}): boolean {
  return merchant.kycStatus === "verified" && merchant.paymentEnabled && merchant.accountStatus === "active";
}

export function shouldSettleRealBalance(mode: MerchantMode): boolean {
  return mode === "live";
}
