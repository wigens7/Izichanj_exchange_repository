---
name: Schema/DB drift & db:push danger
description: Why drizzle-kit push is unsafe here and how schema changes are actually applied
---

# Schema/DB drift in this project

The database contains tables that are NOT defined in `shared/schema.ts` (confirmed: `p2p_dispute_actions`). Because of this drift, `drizzle-kit push` (the `db:push` script) is dangerous:

- When you add a new table, drizzle's interactive diff may pair the new table with an "orphaned" DB-only table and offer to **rename** (which drops the original) instead of **create**.

**Why:** The project predates parts of its current schema file; some tables were created by ad-hoc SQL / startup migrations and never added to `shared/schema.ts`.

**How to apply:** Prefer the project's established pattern for schema changes — idempotent **startup migrations** in `server/index.ts` (a long list of `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` blocks, each wrapped in try/catch and logged as `[startup migration] X ensured`). These run on every boot in dev AND production, so production gets the schema without relying on deploy-time `db:push`. For a brand-new table also add the Drizzle definition to `shared/schema.ts` (for typed queries) and create the table directly via `psql "$DATABASE_URL"` in dev to match. Avoid `npm run db:push` unless the drift is first reconciled.
