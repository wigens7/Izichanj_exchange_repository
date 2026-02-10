# EASYCHANGE - Crypto to Cash Exchange Platform

## Overview
A secure fintech mobile web app for converting USDT (TRC20/BEP20) to MonCash/NatCash. Users authenticate via Replit Auth, complete KYC verification, submit deposits with transaction hashes, and request withdrawals to local mobile money accounts.

## Recent Changes
- **Feb 10, 2026**: Integrated Replit Auth, replacing custom email/password login. Renamed `users` table to `profiles` with `authUserId` linking to Replit Auth users table. Removed register page (Replit Auth handles registration). Updated all routes to use Replit Auth middleware.

## Architecture
- **Authentication**: Replit Auth (OpenID Connect) - supports Google, GitHub, Apple, email
- **Database**: PostgreSQL with Drizzle ORM
  - `users` table (Replit Auth - varchar IDs, managed by auth integration)
  - `sessions` table (Replit Auth session storage)
  - `profiles` table (serial IDs, linked via `authUserId` to Replit Auth users)
  - `deposits`, `withdrawals`, `otps`, `kyc_documents` tables reference `profiles.id`
- **Object Storage**: Replit Object Storage for KYC document uploads
- **Frontend**: React + Vite + TanStack Query + Wouter + Shadcn UI
- **Backend**: Express.js

## Key Files
- `shared/schema.ts` - Drizzle schema (profiles, deposits, withdrawals, etc.)
- `shared/models/auth.ts` - Replit Auth users/sessions tables
- `shared/routes.ts` - API route definitions with Zod schemas
- `server/routes.ts` - Express route handlers
- `server/storage.ts` - Database storage layer
- `server/replit_integrations/auth/` - Replit Auth integration
- `server/replit_integrations/object_storage/` - Object storage integration
- `client/src/hooks/use-auth.ts` - Frontend auth hook (useUser, useLogout)
- `client/src/components/layout-shell.tsx` - App layout with sidebar navigation

## USDT Deposit Addresses
- TRC20: TRydVikZb957Y298cKsFL81aajz3sfaUmq
- BEP20: 0xbd1a6e9f3bcb8179883799585ef9d6dc06b8a974

## Admin Access
After first login via Replit Auth, manually set a profile's role to "admin" in the database:
```sql
UPDATE profiles SET role = 'admin' WHERE auth_user_id = '<replit_auth_user_id>';
```

## Withdrawal OTP
Still uses email OTP for withdrawal verification (separate from Replit Auth login).
Currently uses mock email sending (console.log). For production, integrate SendGrid/Nodemailer.
