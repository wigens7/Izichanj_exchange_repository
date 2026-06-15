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

**Delivery is fail-closed and phone changes ALWAYS dual-send:** `sendWhatsAppOtp` returns a
boolean and `sendVerificationEmail` returns `{ ok }`. A phone change sends the code by
WhatsApp **and** email in parallel every time (not just on WhatsApp failure) — to the new
email if one is being set, otherwise the user's current account `email`. **Why:** UltraMsg
returns `sent: true` as soon as it queues a message even when the destination number has no
WhatsApp account, so a WhatsApp "success" does NOT prove receipt; emailing a copy guarantees
the user (who controls their account email) gets the code. The endpoint persists pending
state + OTP **only after** the code reaches the user on at least one channel; otherwise 502,
persists nothing. Response includes `phoneEmailedTo` (only when distinct from the new email)
so the UI can show where the emailed copy went without listing the same inbox twice.

**Why:** swallowing delivery errors and returning success leaves a user unable to read a
code that never arrived, while pending state sits applied-but-unverifiable.
