import assert from "node:assert/strict";
import test from "node:test";
import { isLiveMerchantApproved, merchantModeFromSecretKey, shouldSettleRealBalance } from "./merchant-mode";

test("recognizes test, new live, and legacy live secret keys", () => {
  assert.equal(merchantModeFromSecretKey("izk_test_sk_example"), "test");
  assert.equal(merchantModeFromSecretKey("izk_live_sk_example"), "live");
  assert.equal(merchantModeFromSecretKey("izi_sk_legacy_example"), "live");
  assert.equal(merchantModeFromSecretKey("izk_test_pk_example"), null);
  assert.equal(merchantModeFromSecretKey("unknown"), null);
});

test("live keys require all merchant approval flags", () => {
  const approved = { kycStatus: "verified", paymentEnabled: true, accountStatus: "active" };
  assert.equal(isLiveMerchantApproved(approved), true);
  assert.equal(isLiveMerchantApproved({ ...approved, kycStatus: "pending" }), false);
  assert.equal(isLiveMerchantApproved({ ...approved, paymentEnabled: false }), false);
  assert.equal(isLiveMerchantApproved({ ...approved, accountStatus: "pending" }), false);
});

test("only live payments settle customer and merchant balances", () => {
  assert.equal(shouldSettleRealBalance("test"), false);
  assert.equal(shouldSettleRealBalance("live"), true);
});
