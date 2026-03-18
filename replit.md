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
    - Automated crypto deposits via NOWPayments API for USDT (TRC20/BEP20), with IPN callback for auto-approval.
    - Manual USDT deposit option requiring transaction hash submission.
    - MonCash payment gateway integration (currently disabled).
- **Withdrawals**: Users can withdraw to local mobile money accounts, with options for phone number or QR code.
- **KYC Verification**: Mandatory KYC process involving ID document uploads, selfie, and personal information collection, integrated with Strowallet API. KYC status is managed with admin approval/rejection flows and options for re-submission requests.
- **P2P Transfers**: Allows users to send USDT to other users via reference ID, email, or phone.
- **Virtual Cards**: Integration with Strowallet API for virtual Visa cards, enabling users to apply, fund, view details, freeze/unfreeze, and track transactions.
- **Notifications**: Real-time notification system with in-app alerts, unread counts, and sound, for various system events (e.g., deposit/withdrawal status, KYC updates, custom admin messages).
- **Support Chat**: A floating chat bubble providing bot-based FAQs and live agent support with file attachment capabilities, conversation rating, and auto-closure.
- **Exchange Rates**: Dynamic exchange rate system (1 USDT = 139.50 HTG) integrated throughout the platform for conversions and display.
- **Security**: Account deletion with blacklisting, user banning features for administrators.

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