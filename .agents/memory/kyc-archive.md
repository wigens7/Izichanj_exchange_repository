---
name: KYC document preservation (kyc_archives)
description: How/why KYC docs are permanently archived through destructive actions
---

# KYC document preservation

KYC documents (front ID, back ID, selfie) live in object storage; the `kyc_documents` row holds the URLs. Several flows used to destroy the URL pointer while leaving the (now unfindable) files orphaned in object storage — causing permanent loss of admin-viewable KYC.

Data-loss flows that must snapshot first:
- `requestKycResubmit` — hard-deletes the kyc_documents row.
- `createKyc` on an existing row — overwrites old URLs with the resubmission.
- admin account deletion — soft-deletes the profile.
- admin KYC reject — docs stay but the user typically resubmits next (overwrite).

**Solution:** `kyc_archives` table (never deleted) + `storage.archiveUserKyc(profileId, reason, adminId?)` which snapshots profile info + current KYC URLs. It is called BEFORE each destructive action above. Admin "Blacklist" tab reads `GET /api/admin/blacklist`.

**Why a SEPARATE table (not `blacklisted_users`):** `blacklisted_users` feeds `isBlacklisted()` which BLOCKS re-registration. KYC-resubmit users are still active and must not be locked out, so their archive must live elsewhere.

**Note on viewing:** archived docs render via the public `GET /objects/*` route (no auth/ACL — pre-existing, lives in the forbidden `server/replit_integrations/object_storage/` dir). The global request logger in `server/index.ts` is set to skip response bodies for `/api/admin/(blacklist|kyc)` so KYC PII isn't written to logs.
