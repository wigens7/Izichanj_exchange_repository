---
name: Admin-initiated contact change OTP
description: Fail-closed delivery + server-side pending state for admin-driven phone/email changes.
---

# Admin contact-change flow

Admin changes a user's phone/email from the admin panel; an OTP is sent to the **new**
contact to prove ownership before applying.

**Pending state lives server-side** in `profiles.pending_email` / `pending_phone` (set on
send, applied on verify, cleared after). This prevents the verified value from drifting if
the admin edits fields between send and verify — do not move this state to the client.

**Delivery is fail-closed with an email fallback:** `sendWhatsAppOtp` returns a boolean and
`sendVerificationEmail` returns `{ ok }`. Phone changes go out by WhatsApp; if WhatsApp
fails (e.g. UltraMsg instance stopped for non-payment) the code falls back to email — the
new email if one is being set, otherwise the user's current `email`. The endpoint persists
pending state + OTP **only after** the code actually reaches the user on some channel;
otherwise it returns 502 and persists nothing. Response includes `phoneFallbackEmail` so the
UI can tell the admin where the phone code actually went.

**Why:** swallowing delivery errors and returning success leaves a user unable to read a
code that never arrived, while pending state sits applied-but-unverifiable.
