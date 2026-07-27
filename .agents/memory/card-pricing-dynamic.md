---
name: Dynamic card pricing
description: Visa/NFC card prices & fees are admin-editable at runtime; rules for changing them safely
---

- Card prices/fees are NO LONGER fixed constants: `server/cardPricing.ts` holds in-memory config seeded from `shared/constants.ts` defaults, overridden by app_settings key `card_pricing` (single JSON row), loaded at startup, edited via `PATCH /api/admin/settings/card-pricing` (public read at `GET /api/settings/card-pricing`).
- **Why:** admin needs to change prices without redeploys; server is authoritative for charges, client fetches live pricing via `useCardPricing()`.
- **How to apply:** never reintroduce direct use of `CARD_*`/`NFC_*` constants in money paths — always `getCardPricing()`. Pending virtual cards store a `pricingSnapshot` in `cardDetail`; retry flows must fund from the snapshot, not live pricing (admin price changes between charge and retry would misprice).
- Validation floors encode Strowallet costs: issuance $4.40 fixed + 3.4% of load (load min $5), top-up $1.90 fixed + 1.9% variable. If provider pricing changes, update the floors in `validateCardPricing`.
