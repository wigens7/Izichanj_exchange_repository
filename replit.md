# EASYCHANGE - Crypto to Cash Exchange Platform

## Overview
A secure fintech mobile web app for converting USDT (TRC20/BEP20) to MonCash/NatCash. Users register with email/password, complete KYC verification, submit deposits with transaction hashes, and request withdrawals to local mobile money accounts.

## Recent Changes
- **Feb 11, 2026**: Added file attachment capability to support chat. Users and admins can attach files (images, PDFs, docs, etc.) up to 10MB via paperclip button. Files uploaded to Replit Object Storage with presigned URLs. Images display inline as thumbnails, other files show as downloadable links. Schema updated with fileUrl/fileName columns in support_messages. Endpoints: POST /api/support/upload, POST /api/admin/support/upload for presigned URL generation.
- **Feb 11, 2026**: Enhanced support chat with end chat + star rating. Users see "End Chat" button in chat header, clicking shows 5-star rating UI. After rating and ending, users can start a new conversation anytime. Admin close sends automatic goodbye message. Conversations auto-close after 5 minutes of inactivity with bot goodbye. Schema updated with rating (1-5) and closedBy columns. Admin panel shows star ratings on closed conversations.
- **Feb 11, 2026**: Added support chat system. Floating chat bubble on all pages with bot FAQ (deposit, withdraw, KYC, balance, rates, security) and live agent support. Users can chat with bot or request agent. Admin panel has 6th "Support" tab with conversation list, message view, reply functionality, and close conversation. Auto-message when user requests agent: "Please be patient, an agent will talk to you soon." DB tables: support_conversations (status: active/waiting_agent/closed), support_messages (sender: user/bot/admin). i18n for EN/FR/HT.
- **Feb 11, 2026**: Integrated SendGrid for real email delivery. OTP verification codes now sent via SendGrid with branded HTML email template. Sender: wigens7@gmail.com. Falls back to console logging if SENDGRID_API_KEY is not set.
- **Feb 11, 2026**: Added notification system. Bell icon in mobile header and desktop top bar with unread count badge, dropdown showing notifications, mark read/all read, sound alerts (Web Audio API beep) when new notifications arrive. Auto-notifications created when admin approves/rejects deposits, withdrawals, KYC. Admin panel has 5th "Messages" tab for sending custom notifications to users (title + message to selected user). Notifications table in DB with types: deposit_approved, deposit_rejected, withdrawal_approved, withdrawal_rejected, kyc_verified, kyc_rejected, custom_message.
- **Feb 11, 2026**: Complete fintech design overhaul. New color system with deep navy sidebar (hsl 228), refined indigo/purple primary gradient, professional dark mode. Login page has split layout with feature showcase (desktop). Layout shell has dark sidebar with balance widget and branded header. All pages redesigned with consistent card layouts, status badges with dark mode support, and polished typography using Inter + Outfit fonts.
- **Feb 11, 2026**: Added exchange rate system (1 USDT = 139.50 HTG). Created shared/constants.ts with EXCHANGE_RATE_USDT_HTG and conversion utilities (usdtToHtg, htgToUsdt, formatHtg, formatUsdt). Dashboard shows balance and totals in HTG. Withdrawal form accepts USDT amounts with live HTG conversion preview. Deposit page shows HTG equivalent. Admin panel shows USDT amounts with HTG value columns. Transaction history shows both USDT and HTG. Updated i18n for all 3 languages.
- **Feb 10, 2026**: Added 2FA (TOTP) and WebAuthn fingerprint/biometric authentication. New /security page for managing 2FA and registered biometric devices. Login flow handles 2FA verification step. Fingerprint login option on login page.
- **Feb 10, 2026**: Added withdrawal method choice: users can withdraw via phone number or QR code. QR code method requires uploading a QR code image. Updated schema (withdrawMethod, qrCodeUrl columns), backend validation, frontend UI with method toggle, and admin panel display.
- **Feb 10, 2026**: Added multi-language support (English, French, Haitian Creole). Language selector on profile page with localStorage persistence. All pages translated. Added KYC enforcement on deposit/withdrawal endpoints and pages.
- **Feb 10, 2026**: Built comprehensive admin panel with 4 tabs (Users, Deposits, Withdrawals, KYC) with approve/reject functionality. Added email OTP verification flow after registration. Updated login/register redirects for verification. Fixed deposit/withdrawal type issues.
- **Feb 10, 2026**: Replaced Replit Auth with custom email/password authentication. Added sign-up form with password confirmation, sign-in form, bcrypt password hashing. Removed authUserId dependency from profiles table.

## Architecture
- **Authentication**: Custom email/password with bcrypt hashing, express-session stored in PostgreSQL
- **2FA**: TOTP-based two-factor authentication using otplib, QR code setup
- **WebAuthn**: Fingerprint/biometric login via SimpleWebAuthn
- **Database**: PostgreSQL with Drizzle ORM
  - `sessions` table (express-session storage via connect-pg-simple)
  - `profiles` table (serial IDs, email/password auth, role, KYC status, balance, twoFactorSecret, twoFactorEnabled)
  - `deposits`, `withdrawals`, `otps`, `kyc_documents`, `webauthn_credentials` tables reference `profiles.id`
- **Object Storage**: Replit Object Storage for KYC document uploads
- **Frontend**: React + Vite + TanStack Query + Wouter + Shadcn UI
- **Backend**: Express.js

## Key Files
- `shared/schema.ts` - Drizzle schema (profiles, deposits, withdrawals, etc.) + Zod validation schemas
- `shared/models/auth.ts` - Sessions table definition
- `shared/routes.ts` - API route definitions with Zod schemas
- `server/auth.ts` - Custom auth setup (session middleware, isAuthenticated)
- `server/routes.ts` - Express route handlers (auth + business logic)
- `server/storage.ts` - Database storage layer
- `server/replit_integrations/object_storage/` - Object storage integration
- `client/src/hooks/use-auth.ts` - Frontend auth hooks (useUser, useLogin, useRegister, useLogout)
- `client/src/pages/login.tsx` - Sign in / Sign up tabbed forms
- `client/src/components/layout-shell.tsx` - App layout with sidebar navigation

## Auth Endpoints
- `POST /api/auth/register` - Register with fullName, email, password, confirmPassword (sends OTP)
- `POST /api/auth/login` - Login with email, password (sends OTP if unverified)
- `POST /api/auth/verify-email` - Verify email with { code }
- `POST /api/auth/resend-otp` - Resend verification OTP
- `POST /api/auth/logout` - Destroy session
- `GET /api/user` - Get current authenticated profile
- `POST /api/auth/verify-2fa` - Verify 2FA code during login

## Security Endpoints (authenticated)
- `POST /api/security/2fa/setup` - Generate 2FA secret and QR code
- `POST /api/security/2fa/verify` - Verify TOTP code to enable 2FA
- `POST /api/security/2fa/disable` - Disable 2FA with code verification
- `GET /api/security/webauthn/credentials` - List registered WebAuthn devices
- `POST /api/security/webauthn/register-options` - Get WebAuthn registration options
- `POST /api/security/webauthn/register-verify` - Verify and save WebAuthn credential
- `DELETE /api/security/webauthn/credentials/:id` - Remove a WebAuthn device
- `POST /api/security/webauthn/auth-options` - Get WebAuthn authentication options (public)
- `POST /api/security/webauthn/auth-verify` - Verify WebAuthn authentication (public)

## Admin Endpoints (role=admin required)
- `GET /api/admin/users` - List all users
- `PATCH /api/admin/users/:id/balance` - Update user balance
- `GET /api/admin/deposits` - List all deposits
- `PATCH /api/admin/deposits/:id/approve` - Approve deposit
- `PATCH /api/admin/deposits/:id/reject` - Reject deposit
- `GET /api/admin/withdrawals` - List all withdrawals
- `PATCH /api/admin/withdrawals/:id/approve` - Approve withdrawal
- `PATCH /api/admin/withdrawals/:id/reject` - Reject withdrawal
- `PATCH /api/admin/kyc/:id/verify` - Verify KYC
- `PATCH /api/admin/kyc/:id/reject` - Reject KYC

## USDT Deposit Addresses
- TRC20: TRydVikZb957Y298cKsFL81aajz3sfaUmq
- BEP20: 0xbd1a6e9f3bcb8179883799585ef9d6dc06b8a974

## Admin Access
After registering, manually set a profile's role to "admin" in the database:
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'admin@example.com';
```

## Withdrawal OTP
Uses email OTP for withdrawal verification (separate from login).
Currently uses mock email sending (console.log). For production, integrate SendGrid/Nodemailer.
