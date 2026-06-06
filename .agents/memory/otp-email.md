---
name: OTP & email delivery (Izichanj)
description: How OTP is delivered across channels and why OTP emails were failing
---

# OTP & email delivery

OTP codes (6-digit, 5-min expiry) are sent on TWO channels in parallel: WhatsApp (UltraMsg) + email (Resend). The shared helper `sendOtpToProfile(profile, code, phoneOverride?)` in `server/routes.ts` does both and respects the admin per-user `otpBlocked` flag (generates+stores the code but skips delivery, pings Telegram). All OTP flows route through it: register, resend-otp, login-unverified, withdrawals OTP, forgot-pin, and (now) forgot-password.

**Why password reset was special:** forgot-password used to be email-only. It now sends both channels too, but keeps the password-reset-specific email wording (`sendPasswordResetEmail`) instead of the generic verification email.

**Email failure root cause (production):** Resend rejected every OTP/notification email with 403 `The izichanj.com domain is not verified`. This is NOT a code bug — the sending domain must be verified at https://resend.com/domains (add DNS SPF/DKIM records). 
**Fix paths:** (a) verify izichanj.com on Resend (correct long-term), or (b) set the `EMAIL_FROM` env var to a verified sender (e.g. `Izichanj <onboarding@resend.dev>` works without verification but only delivers to the Resend account owner in test mode). The sender is `process.env.EMAIL_FROM || "Izichanj <no-reply@izichanj.com>"` in `server/email.ts`.

**Note:** `SENDGRID_API_KEY` is also present in the env but the code currently uses Resend only; SendGrid would also require sender/domain verification.
