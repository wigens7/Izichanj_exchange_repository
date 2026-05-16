# Izichanj - Crypto to Cash Exchange Platform

## Overview
Izichanj is a secure fintech mobile web application facilitating the conversion of USDT (TRC20/BEP20) to local mobile money (MonCash/NatCash). It provides a seamless and secure experience for managing crypto and fiat currencies through features like KYC verification, automated crypto deposits, P2P transfers, virtual Visa cards, and comprehensive customer support. The platform aims to be a leading solution for digital asset liquidity in its target market.

## User Preferences
I prefer clear, concise language.
I prefer an iterative development approach with regular updates.
Please ask for confirmation before implementing major architectural changes.
I value detailed explanations for complex features or decisions.
Do not make changes to files in the `server/replit_integrations/object_storage/` directory without explicit instruction.

## System Architecture
The application features a modern, secure architecture with a fintech-inspired UI/UX. The design incorporates a deep navy sidebar, indigo/purple primary gradient, professional dark mode, and consistent card layouts, utilizing Inter and Outfit fonts.

**Technical Implementations:**
- **Authentication & Authorization**: Custom email/password authentication with bcrypt, `express-session`, PostgreSQL storage, 2FA (TOTP), WebAuthn (biometric), and role-based access control for an admin panel.
- **Internationalization**: Full multi-language support (English, French, Haitian Creole).
- **Deposits**: Automated crypto deposits via NOWPayments (non-custodial, TRC20/BEP20) with direct merchant wallet payouts and IPN webhook integration for balance crediting. Manual MonCash/NatCash deposit system with admin review and anti-fraud features.
- **Withdrawals**: USDT TRC-20 withdrawals with 6-digit PIN authorization, minimum/maximum limits, fixed fees, and admin approval workflow.
- **KYC Verification**: Mandatory KYC process integrated with Strowallet API, including ID/selfie uploads and admin approval/rejection flows.
- **P2P Transfers**: Facilitates USDT transfers between users using reference IDs, emails, or phone numbers.
- **Virtual Cards**: Strowallet API integration for virtual Visa cards, allowing application, funding, detail viewing, freezing/unfreezing, and transaction tracking.
- **Notifications**: Real-time in-app alerts with unread counts and sound for various system events, including push notifications via FCM.
- **Support Chat**: Bot-based FAQs and live agent support with file attachments and conversation rating.
- **Exchange Rates**: Dynamic exchange rate system (1 USDT = 139.50 HTG) for all conversions.
- **Security**: Account deletion, user banning, admin-controlled per-user OTP delivery block, and a user reporting system with admin alerts and resolution tools. Balance visibility is a persisted user preference (localStorage) honored everywhere balance is shown.
- **Referral System**: Admin-enabled affiliate system with unique referral codes, commission tracking for new user actions (email verification, KYC approval, first deposit), and payout requests.
- **P2P Market (USDT Escrow)**: A peer-to-peer USDT trading platform with KYC gating. Sellers post listings, buyers place orders, and trades occur via in-app chat with escrow functionality. Includes dispute resolution mechanisms for administrators.
- **Izichanj Pay — Merchant API**: Enables verified users to accept HTG/USDT payments on external sites. Features include API key generation, webhook integration, a branded checkout flow, and transaction tracking. Payments are processed with a 1.5% fee and converted to USDT if necessary.
- **Receipt System**: Generates secure PDF receipts for deposits and withdrawals, accessible after admin release. Receipts include transaction details, QR codes for public verification, and digital signatures.
- **Newsletter**: Opt-in email newsletter. Users subscribe/unsubscribe from their profile page. Admins compose subject + body in the admin Newsletter tab and broadcast to all subscribers via Resend. The greeting "Hi {fullName}," and the https://izichanj.com link are auto-prepended/appended; admin body is HTML-escaped (only http(s) URLs become clickable). Sends are paced (~1.6 req/sec) with rate-limit backoff and an in-flight lock to prevent double-broadcasts.

**System Design Choices:**
- **Database**: PostgreSQL with Drizzle ORM.
- **Object Storage**: Replit Object Storage for KYC documents and chat attachments.
- **Frontend**: React, Vite, TanStack Query, Wouter, Shadcn UI.
- **Backend**: Express.js.
- **PWA**: Installable Progressive Web App with Firebase Cloud Messaging (FCM) for push notifications.

## External Dependencies
- **NOWPayments API**: Automated crypto deposit processing.
- **Strowallet API**: KYC verification and virtual Visa card management.
- **UltraMsg API**: WhatsApp OTP delivery.
- **SendGrid**: Transactional email services.
- **PostgreSQL**: Primary database.
- **Replit Object Storage**: File storage.
- **otplib**: TOTP 2FA.
- **SimpleWebAuthn**: WebAuthn (biometric) authentication.
- **PDFKit**: Server-side PDF generation.
- **QRCode**: QR code generation for receipts.
- **Firebase Cloud Messaging (FCM)**: Push notifications.
- **firebase-admin**: Server-side FCM management.