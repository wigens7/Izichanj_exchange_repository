---
name: OTP purpose binding
description: OTPs are global per-profile and reused across flows; bind a purpose when adding a new OTP-gated action.
---

# OTP purpose binding

`otps` rows are keyed only by `profileId` (+ code/expiry). `getValidOtp(profileId, code)`
returns the **most recent** OTP for that profile regardless of which flow created it
(login, email verification, withdrawal, etc.).

**Rule:** any new OTP-gated action must create its code with a `purpose` string and verify
with `getValidOtpByPurpose(profileId, code, purpose)` — never the bare `getValidOtp`.

**Why:** without purpose binding, a code issued for one flow can satisfy another (e.g. a
login/withdrawal code accepted by the admin contact-change flow), defeating "this code
proves control of the new contact." Found in code review of the admin contact-change feature.

**How to apply:** add a distinct purpose literal (e.g. `"admin_contact_change"`), pass it to
`createOtp(profileId, code, purpose)`, and gate the verify endpoint on
`getValidOtpByPurpose`. The `otps.purpose` column is nullable (NULL = legacy generic OTP).
