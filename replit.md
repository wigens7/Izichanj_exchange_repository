# Izichanj - Crypto to Cash Exchange Platform

## Overview
Izichanj is a secure fintech mobile web application designed to facilitate the conversion of USDT (TRC20/BEP20) to local mobile money (MonCash/NatCash). The platform aims to provide a seamless and secure experience for users to manage their crypto and fiat currencies, including features like KYC verification, automated crypto deposits, P2P transfers, virtual Visa cards, and comprehensive customer support. The project envisions becoming a leading platform for crypto-to-cash exchanges in its target market, offering a robust and user-friendly solution for digital asset liquidity.

## User Preferences
I prefer clear, concise language.
I prefer an iterative development approach with regular updates.
Please ask for confirmation before implementing major architectural changes.
I value detailed explanations for complex features or decisions.
Do not make changes to files in the `server/replit_integrations/object_storage/` directory without explicit instruction.

## System Architecture
The application features a modern, secure architecture. The UI/UX is built with a fintech design overhaul, incorporating a deep navy sidebar, indigo/purple primary gradient, and professional dark mode, utilizing Inter and Outfit fonts. All pages are designed with consistent card layouts and status badges.

**Technical Implementations:**
- **Authentication**: Custom email/password authentication using bcrypt hashing and `express-session` stored in PostgreSQL. It supports 2FA (TOTP with `otplib`) and WebAuthn (fingerprint/biometric authentication via `SimpleWebAuthn`).
- **Authorization**: Role-based access control, notably for the comprehensive admin panel.
- **Internationalization**: Full multi-language support (English, French, Haitian Creole) with language selection and persistence.
- **Deposits**:
    - **Crypto (NOWPayments, non-custodial)**: User enters an amount and selects network (TRC20 or BEP20). A one-time payment address is generated via NOWPayments API and displayed for 15 minutes. Funds go directly to the merchant's Binance wallet via NOWPayments auto-payout. When NOWPayments fires an IPN webhook on confirmation, the balance is auto-credited minus the network fee (TRC20: $2.50 fee, min $5.00; BEP20: $0.25 fee, min $1.00). Duplicate payment_id protection built in.
    - Manual MonCash/NatCash deposit system: User selects wallet, uploads payment screenshot + transaction ID. Reviewed by admin. Duplicate TX ID detection (anti-fraud). Admin sees proof screenshot, rejects with reason (user notified via WhatsApp + in-app). Company phone numbers via `COMPANY_MONCASH_PHONE` and `COMPANY_NATCASH_PHONE` env vars. DB: `proof_image_url` + `rejection_reason` columns on deposits (startup migration).
- **Withdrawals**: USDT TRC-20 (Tron network) withdrawals only. Users enter a TRC-20 wallet address and authorize with a separate 6-digit withdrawal PIN. Min 10 USDT, Max 10,000 USDT/day, fixed 2.50 USDT fee (deducted immediately from balance along with the withdrawal amount). Status shown as "Under Review" pending admin approval. Haitian Creole Terms of Service included in the form.
- **KYC Verification**: Mandatory KYC process involving ID document uploads, selfie, and personal information collection, integrated with Strowallet API. KYC status is managed with admin approval/rejection flows and options for re-submission requests.
- **P2P Transfers**: Allows users to send USDT to other users via reference ID, email, or phone.
- **Virtual Cards**: Integration with Strowallet API for virtual Visa cards, enabling users to apply, fund, view details, freeze/unfreeze, and track transactions. Card fundings are logged locally in the `card_transactions` DB table (Strowallet only returns spending/merchant transactions, not funding events). Transaction history merges both local funding records and Strowallet spending data.
- **Notifications**: Real-time notification system with in-app alerts, unread counts, and sound, for various system events (e.g., deposit/withdrawal status, KYC updates, custom admin messages).
- **Support Chat**: A floating chat bubble providing bot-based FAQs and live agent support with file attachment capabilities, conversation rating, and auto-closure.
- **Exchange Rates**: Dynamic exchange rate system (1 USDT = 139.50 HTG) integrated throughout the platform for conversions and display.
- **Security**: Account deletion with blacklisting, user banning features for administrators.
- **User Reports**: Any authenticated user can report another user (by email or reference ID) via the "Report a User" page. Reports include a reason (8 categories), a description, and an optional proof screenshot upload. On submission, the admin receives an instant Telegram notification. Admins can view all reports in a dedicated "Reports" tab in the admin panel, expand each report to see full details and proof image, add notes, and mark reports as Reviewed or Dismissed.
- **Referral / Affiliate System**: Manual invitation system where admins can enable affiliate status per user. Once enabled, the user gets a unique referral code (format: `IZI{id}{hex}`). New users can enter a referral code during registration. Commission structure: $0.05 on referee email verification, $0.25 on KYC approval, $2.00 on first deposit ≥ $50 (once per referee). Earnings accumulate in `referral_balance` field. Users can request payout transfer to main balance (min $1.00). Admins approve/reject payout requests in the "Referrals" tab of the admin panel. Anti-fraud: referral code only credited if referrer's `affiliateEnabled = true`. DB tables: `referral_earnings` (per-event ledger) + `referral_payout_requests` (payout requests). Referral code field shown in registration form. Referral panel shown on Profile page only when `affiliateEnabled = true`.
- **P2P Market (USDT Escrow Marketplace)**: Full peer-to-peer USDT trading system at `/p2p`. KYC-gated (verified users only). Sellers post USDT listings with rate (130–145 HTG/USDT for Haiti), amount, min/max order range, payment methods, and optional trade terms. Funds locked in escrow on ad post. Buyers place orders; both parties trade via in-app chat with file attachment support. Order lifecycle: pending → paid → released (or cancelled/disputed). Release requires seller confirmation checkbox. Disputes send Telegram alert to admin. Anti-abuse: 3 cancellations within 24h triggers 2-hour ban. DB tables: `p2p_ads`, `p2p_orders`, `p2p_chat_messages`, `p2p_cancellations`, `p2p_bans`. Navigation: "P2P Market" replaces "FAQ" in sidebar (FAQ moved to Profile page accordion section).
- **FAQ Section (Profile Page)**: 8-item FAQ accordion added at the bottom of the Profile page (`/profile`) covering deposits, fees, withdrawals, KYC, P2P, virtual cards, fund transfers, and disputes.
- **P2P Dispute & Investigation Center (Admin)**: Dedicated "Disputes" tab in the admin panel. Lists all active disputed orders with buyer/seller info. Expandable detail panel per dispute includes: full trade chat history with image attachments, escrow status banner, both parties' login IP/device history, per-user action buttons (Flag as Reported Buyer/Seller, Seller Restrict, Freeze 7 days, Ban/Unban), shared reason input required for all actions, and resolution panel (Release to Buyer / Refund to Seller) with automatic notification to both parties. All admin actions are logged to the `p2p_dispute_actions` table with the admin name, action, reason, and target user. Profile fields added: `p2p_seller_restricted` (blocks ad posting), `p2p_flagged_as` (displays flag badges). New DB table: `p2p_dispute_actions`.

**System Design Choices:**
- **Database**: PostgreSQL is used as the primary database, managed with Drizzle ORM.
- **Object Storage**: Replit Object Storage is utilized for storing KYC documents and support chat attachments.
- **Frontend**: Developed using React, Vite, TanStack Query, Wouter, and Shadcn UI.
- **Backend**: Built with Express.js.

## External Dependencies
- **NOWPayments API**: For automated crypto deposit processing.
- **Strowallet API**: For KYC verification and virtual Visa card management.
- **UltraMsg API**: For WhatsApp OTP delivery (registration, login, password reset, PIN reset, withdrawal verification).
- **SendGrid**: For sending transactional emails, such as OTP verification (fallback to console logging if API key not set).
- **PostgreSQL**: Relational database for all application data.
- **Replit Object Storage**: Cloud storage for files (KYC documents, chat attachments).
- **MonCash Payment Gateway**: For MonCash deposits (currently disabled).
- **otplib**: For TOTP-based 2FA generation and verification.
- **SimpleWebAuthn**: For WebAuthn (biometric/fingerprint) authentication.
- **PDFKit**: For server-side PDF receipt generation.
- **QRCode**: For generating QR codes embedded in PDF receipts.

## Receipt System
- **DB fields**: `receipt_id` (unique UUID) and `receipt_url` added to both `deposits` and `withdrawals` tables.
- **Access control**: Receipts only accessible after admin manually releases them via "Approve & Release Receipt".
- **PDF format**: Branded header (logo), semi-transparent watermark, transaction details, masked destination, QR code linking to `/verify/:receiptId`, digital signature footer.
- **Admin routes**: `PATCH /api/admin/deposits/:id/approve-release`, `PATCH /api/admin/withdrawals/:id/approve-release` (approve + generate + download PDF), `GET /api/admin/receipts/deposit/:id` (preview), `GET /api/admin/receipts/withdrawal/:id` (preview).
- **User routes**: `GET /api/receipts/deposit/:id` and `GET /api/receipts/withdrawal/:id` (owner-only, approved with receiptId required).
- **Public verification**: `GET /api/verify/:receiptId` returns read-only JSON; frontend page at `/verify/:receiptId`.