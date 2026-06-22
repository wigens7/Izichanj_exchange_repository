---
name: Telegram ↔ support chat bridge
description: Two-way bridge routing contract between support notifications and the inbound Telegram webhook
---

# Telegram ↔ support chat reply routing

Inbound admin replies are routed to a conversation by parsing `Conv #<id>` (regex `Conv(?:ersation)?\s*#(\d+)`) out of the Telegram `reply_to_message` text.

**Why:** The outbound support-message Telegram notification embeds `Conv #<id>`; the webhook reads it back when the admin uses Telegram's native Reply. The notification text is therefore a routing contract, not just cosmetic.

**How to apply:** If you change the support-message Telegram notification format, keep a `Conv #<id>` token (or update the webhook parser in lockstep), or admin replies from Telegram will fail to route. Fallbacks `#<id> msg` and `/reply <id> msg` also exist.

- Webhook secret: sha256(SESSION_SECRET + ":telegram-webhook"), verified via `X-Telegram-Bot-Api-Secret-Token`. Never use a hardcoded fallback (predictable secret = forgeable public webhook); random fallback only.
- Connect endpoint registers `https://<req host>/api/telegram/webhook` — run it from the production domain, not dev, since a bot has one active webhook.
- Webhook ignores `edited_message` to avoid duplicate replies; inbound also gated on `chat.id === TELEGRAM_CHAT_ID`.
- Quick replies (`support_quick_replies` table): admin replies with a lone `/shortcut` token → webhook expands it to the saved message before sending (conv still resolved via `Conv #<id>`). `/quick`|`/shortcuts`|`/qr` list them (no conv needed). Shortcut lookup is case-insensitive; managed from Admin → Support → Quick Replies, also one-tap chips in the web reply box.
