# EASYCHANGE - Crypto to Cash Exchange Platform

## Overview
A secure fintech mobile web app for converting USDT (TRC20/BEP20) to MonCash/NatCash. Users register with email/password, complete KYC verification, submit deposits with transaction hashes, and request withdrawals to local mobile money accounts.

## Recent Changes
- **Feb 10, 2026**: Replaced Replit Auth with custom email/password authentication. Added sign-up form with password confirmation, sign-in form, bcrypt password hashing. Removed authUserId dependency from profiles table.

## Architecture
- **Authentication**: Custom email/password with bcrypt hashing, express-session stored in PostgreSQL
- **Database**: PostgreSQL with Drizzle ORM
  - `sessions` table (express-session storage via connect-pg-simple)
  - `profiles` table (serial IDs, email/password auth, role, KYC status, balance)
  - `deposits`, `withdrawals`, `otps`, `kyc_documents` tables reference `profiles.id`
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
- `POST /api/auth/register` - Register with fullName, email, password, confirmPassword
- `POST /api/auth/login` - Login with email, password
- `POST /api/auth/logout` - Destroy session
- `GET /api/user` - Get current authenticated profile

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
