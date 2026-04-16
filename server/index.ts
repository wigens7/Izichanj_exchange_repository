import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { db } from "./db";
import { sql } from "drizzle-orm";

const app = express();
const httpServer = createServer(app);

// Trust all proxy hops so req.ip and X-Forwarded-For reflect the real client IP
app.set("trust proxy", true);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Run idempotent schema migrations on startup
  try {
    await db.execute(sql`ALTER TYPE card_status ADD VALUE IF NOT EXISTS 'cancelled'`);
  } catch (e) {
    // Ignore if already exists or enum not found
    console.warn("[startup migration] card_status enum update skipped:", (e as Error).message);
  }

  // Fix: clear fake Strowallet customer IDs that are just our internal profile IDs (e.g. "38", "39")
  // Real Strowallet IDs are UUIDs or alphanumeric — never plain small integers
  try {
    const cleared = await db.execute(sql`
      UPDATE profiles
      SET strowallet_customer_id = NULL
      WHERE strowallet_customer_id ~ '^[0-9]+$'
        AND strowallet_customer_id::integer = id
    `);
    if ((cleared.rowCount ?? 0) > 0) {
      console.log(`[startup migration] Cleared ${cleared.rowCount} fake Strowallet customer ID(s) (were just profile IDs)`);
    }
  } catch (e) {
    console.warn("[startup migration] fake strowallet ID cleanup skipped:", (e as Error).message);
  }

  // Fix: restore Manoucheka's real Strowallet customer ID lost due to snake_case bug
  try {
    const result = await db.execute(sql`
      UPDATE profiles
      SET strowallet_customer_id = 'fd7b7b47-7873-4deb-b281-a8f188cf497f'
      WHERE id = 38
        AND (strowallet_customer_id IS NULL OR strowallet_customer_id = '')
    `);
    if ((result.rowCount ?? 0) > 0) {
      console.log("[startup migration] Restored Manoucheka's real Strowallet customer ID");
    }
  } catch (e) {
    console.warn("[startup migration] Manoucheka strowallet ID restore skipped:", (e as Error).message);
  }

  // Add proof_image_url and rejection_reason columns for manual deposits
  try {
    await db.execute(sql`ALTER TABLE deposits ADD COLUMN IF NOT EXISTS proof_image_url TEXT`);
    await db.execute(sql`ALTER TABLE deposits ADD COLUMN IF NOT EXISTS rejection_reason TEXT`);
    console.log("[startup migration] Manual deposit columns ensured");
  } catch (e) {
    console.warn("[startup migration] manual deposit columns skipped:", (e as Error).message);
  }

  // Add frozen_until column for anti-fraud account freezing
  try {
    await db.execute(sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS frozen_until TIMESTAMP`);
    console.log("[startup migration] frozen_until column ensured");
  } catch (e) {
    console.warn("[startup migration] frozen_until column skipped:", (e as Error).message);
  }

  // Add withdrawal_pin_hash for 6-digit withdrawal authorization PIN
  try {
    await db.execute(sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS withdrawal_pin_hash TEXT`);
    console.log("[startup migration] withdrawal_pin_hash column ensured");
  } catch (e) {
    console.warn("[startup migration] withdrawal_pin_hash skipped:", (e as Error).message);
  }

  // Add trc_address and fee columns to withdrawals for USDT TRC-20 withdrawals
  try {
    await db.execute(sql`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS trc_address TEXT`);
    await db.execute(sql`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS fee DECIMAL(10,2) DEFAULT 2.50`);
    // Add USDT_TRC20 to the currency enum
    await db.execute(sql`ALTER TYPE currency ADD VALUE IF NOT EXISTS 'USDT_TRC20'`);
    console.log("[startup migration] USDT TRC-20 withdrawal columns ensured");
  } catch (e) {
    console.warn("[startup migration] withdrawal TRC-20 columns skipped:", (e as Error).message);
  }

  // Create fraud_rejections table for tracking admin fraud flags
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS fraud_rejections (
        id SERIAL PRIMARY KEY,
        profile_id INTEGER NOT NULL REFERENCES profiles(id),
        deposit_id INTEGER NOT NULL,
        admin_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    console.log("[startup migration] fraud_rejections table ensured");
  } catch (e) {
    console.warn("[startup migration] fraud_rejections table skipped:", (e as Error).message);
  }

  // Create top_up_transactions table for mobile top-up history
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS top_up_transactions (
        id SERIAL PRIMARY KEY,
        profile_id INTEGER NOT NULL REFERENCES profiles(id),
        operator_id TEXT NOT NULL,
        operator_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        amount_usd DECIMAL(10,2) NOT NULL,
        transaction_id TEXT,
        status TEXT DEFAULT 'success' NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    console.log("[startup migration] top_up_transactions table ensured");
  } catch (e) {
    console.warn("[startup migration] top_up_transactions table skipped:", (e as Error).message);
  }

  // Create card_transactions table for local funding records
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS card_transactions (
        id SERIAL PRIMARY KEY,
        card_id INTEGER NOT NULL REFERENCES virtual_cards(id),
        profile_id INTEGER NOT NULL REFERENCES profiles(id),
        type TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        currency TEXT DEFAULT 'USD' NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    console.log("[startup migration] card_transactions table ensured");
  } catch (e) {
    console.warn("[startup migration] card_transactions table skipped:", (e as Error).message);
  }

  // Fix: reset any card marked "active" that still has a pending_ card_id (never really issued)
  try {
    const fixed = await db.execute(sql`
      UPDATE virtual_cards
      SET status = 'pending'
      WHERE card_id LIKE 'pending_%'
        AND status = 'active'
    `);
    if ((fixed.rowCount ?? 0) > 0) {
      console.log(`[startup migration] Reset ${fixed.rowCount} fake-active pending card(s) → status=pending`);
    }
  } catch (e) {
    console.warn("[startup migration] pending card status fix skipped:", (e as Error).message);
  }

  // App settings table for dynamic exchange rates
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      INSERT INTO app_settings (key, value) VALUES ('deposit_rate', '143'), ('withdrawal_rate', '139')
      ON CONFLICT (key) DO NOTHING
    `);
    console.log("[startup migration] app_settings table ensured");
  } catch (e) {
    console.warn("[startup migration] app_settings skipped:", (e as Error).message);
  }

  // Load dynamic rates from DB into memory
  try {
    const { setRates } = await import("./rates");
    const rows = await db.execute(sql`SELECT key, value FROM app_settings WHERE key IN ('deposit_rate', 'withdrawal_rate')`);
    let dep = 143, wit = 139;
    for (const row of rows.rows as any[]) {
      if (row.key === "deposit_rate") dep = Number(row.value);
      if (row.key === "withdrawal_rate") wit = Number(row.value);
    }
    setRates(dep, wit);
    console.log(`[rates] Loaded: deposit=${dep}, withdrawal=${wit}`);
  } catch (e) {
    console.warn("[rates] Could not load from DB, using defaults:", (e as Error).message);
  }

  // IP tracking columns on profiles, deposits, withdrawals
  try {
    await db.execute(sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_ip TEXT`);
    await db.execute(sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS registration_ip TEXT`);
    await db.execute(sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP`);
    await db.execute(sql`ALTER TABLE deposits ADD COLUMN IF NOT EXISTS ip_address TEXT`);
    await db.execute(sql`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS ip_address TEXT`);
    console.log("[startup migration] IP tracking columns ensured");
  } catch (e) {
    console.warn("[startup migration] IP tracking columns skipped:", (e as Error).message);
  }

  // One-time fix: correct incomplete name for wigens7@gmail.com
  try {
    await db.execute(sql`
      UPDATE profiles
      SET full_name = 'Wilgentz PIERRE'
      WHERE email = 'wigens7@gmail.com'
        AND full_name != 'Wilgentz PIERRE'
    `);
    console.log("[startup migration] wigens7 full_name ensured: Wilgentz PIERRE");
  } catch (e) {
    console.warn("[startup migration] wigens7 name fix skipped:", (e as Error).message);
  }

  // User reports table
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_reports (
        id SERIAL PRIMARY KEY,
        reporter_profile_id INTEGER NOT NULL REFERENCES profiles(id),
        reported_identifier TEXT NOT NULL,
        reported_profile_id INTEGER REFERENCES profiles(id),
        reason TEXT NOT NULL,
        description TEXT NOT NULL,
        proof_image_url TEXT,
        status TEXT DEFAULT 'pending' NOT NULL,
        admin_note TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        reviewed_at TIMESTAMP
      )
    `);
    console.log("[startup migration] user_reports table ensured");
  } catch (e) {
    console.warn("[startup migration] user_reports skipped:", (e as Error).message);
  }

  // Security events table for audit trail
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS security_events (
        id SERIAL PRIMARY KEY,
        profile_id INTEGER REFERENCES profiles(id),
        event_type TEXT NOT NULL,
        ip_address TEXT,
        device_info TEXT,
        details TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    console.log("[startup migration] security_events table ensured");
  } catch (e) {
    console.warn("[startup migration] security_events skipped:", (e as Error).message);
  }

  // Balance logs table for financial integrity
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS balance_logs (
        id SERIAL PRIMARY KEY,
        profile_id INTEGER NOT NULL REFERENCES profiles(id),
        previous_balance DECIMAL(10,2) NOT NULL,
        new_balance DECIMAL(10,2) NOT NULL,
        change DECIMAL(10,2) NOT NULL,
        action TEXT NOT NULL,
        reference_id TEXT,
        admin_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    console.log("[startup migration] balance_logs table ensured");
  } catch (e) {
    console.warn("[startup migration] balance_logs skipped:", (e as Error).message);
  }

  // Add device_info column to login_logs
  try {
    await db.execute(sql`ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS device_info TEXT`);
    console.log("[startup migration] login_logs.device_info ensured");
  } catch (e) {
    console.warn("[startup migration] login_logs.device_info skipped:", (e as Error).message);
  }

  // Add status column to security_events (for failed/success distinction)
  try {
    await db.execute(sql`ALTER TABLE security_events ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'info'`);
    console.log("[startup migration] security_events.status ensured");
  } catch (e) {
    console.warn("[startup migration] security_events.status skipped:", (e as Error).message);
  }

  // One-time cleanup: clear stale IP logs captured before the real-IP fix.
  // All IPs that were the Replit proxy/server IP (10.x.x.x internal or identical
  // across all users) are wiped so multi-account detection starts from clean data.
  try {
    const flagKey = "ip_cleanup_v1_done";
    const alreadyDone = await db.execute(
      sql`SELECT 1 FROM app_settings WHERE key = ${flagKey} LIMIT 1`
    );
    if ((alreadyDone.rows as any[]).length === 0) {
      await db.execute(sql`UPDATE login_logs SET ip_address = NULL WHERE ip_address IS NOT NULL`);
      await db.execute(sql`UPDATE security_events SET ip_address = NULL WHERE ip_address IS NOT NULL`);
      await db.execute(sql`UPDATE deposits SET ip_address = NULL WHERE ip_address IS NOT NULL`);
      await db.execute(sql`UPDATE withdrawals SET ip_address = NULL WHERE ip_address IS NOT NULL`);
      await db.execute(
        sql`INSERT INTO app_settings (key, value) VALUES (${flagKey}, 'true') ON CONFLICT (key) DO NOTHING`
      );
      console.log("[startup migration] stale IP data cleared — real IP tracking now active");
    }
  } catch (e) {
    console.warn("[startup migration] IP cleanup skipped:", (e as Error).message);
  }

  // Referral / Affiliate system migration
  try {
    await db.execute(sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS affiliate_enabled BOOLEAN NOT NULL DEFAULT false`);
    await db.execute(sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE`);
    await db.execute(sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_balance DECIMAL(10,2) NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by_id INTEGER REFERENCES profiles(id)`);
    await db.execute(sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'referral_earning_type') THEN
          CREATE TYPE referral_earning_type AS ENUM ('registration', 'kyc', 'deposit');
        END IF;
      END $$
    `);
    await db.execute(sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'referral_payout_status') THEN
          CREATE TYPE referral_payout_status AS ENUM ('pending', 'approved', 'rejected');
        END IF;
      END $$
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS referral_earnings (
        id SERIAL PRIMARY KEY,
        referrer_id INTEGER NOT NULL REFERENCES profiles(id),
        referee_id INTEGER NOT NULL REFERENCES profiles(id),
        type referral_earning_type NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        description TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS referral_payout_requests (
        id SERIAL PRIMARY KEY,
        profile_id INTEGER NOT NULL REFERENCES profiles(id),
        amount DECIMAL(10,2) NOT NULL,
        status referral_payout_status NOT NULL DEFAULT 'pending',
        admin_note TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        reviewed_at TIMESTAMP
      )
    `);
    console.log("[startup migration] referral system tables ensured");
  } catch (e) {
    console.warn("[startup migration] referral system skipped:", (e as Error).message);
  }

  // P2P Market tables
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS p2p_ads (
        id SERIAL PRIMARY KEY,
        seller_id INTEGER NOT NULL REFERENCES profiles(id),
        amount_usdt DECIMAL(10,2) NOT NULL,
        available_usdt DECIMAL(10,2) NOT NULL,
        rate_htg DECIMAL(10,4),
        margin_pct DECIMAL(5,2),
        currency TEXT NOT NULL DEFAULT 'HTG',
        country TEXT NOT NULL DEFAULT 'HT',
        payment_methods TEXT[] NOT NULL DEFAULT '{}',
        min_order_usdt DECIMAL(10,2) NOT NULL DEFAULT 10,
        max_order_usdt DECIMAL(10,2),
        status TEXT NOT NULL DEFAULT 'active',
        terms_note TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS p2p_orders (
        id SERIAL PRIMARY KEY,
        order_id VARCHAR(20) UNIQUE,
        ad_id INTEGER NOT NULL REFERENCES p2p_ads(id),
        buyer_id INTEGER NOT NULL REFERENCES profiles(id),
        seller_id INTEGER NOT NULL REFERENCES profiles(id),
        amount_usdt DECIMAL(10,2) NOT NULL,
        amount_local DECIMAL(12,2) NOT NULL,
        rate DECIMAL(10,4) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'HTG',
        payment_method TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        cancelled_by TEXT,
        cancellation_reason TEXT,
        dispute_reason TEXT,
        seller_confirmed_receipt BOOLEAN NOT NULL DEFAULT false,
        paid_at TIMESTAMP,
        released_at TIMESTAMP,
        cancelled_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS p2p_chat_messages (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES p2p_orders(id),
        sender_id INTEGER NOT NULL REFERENCES profiles(id),
        message TEXT,
        file_url TEXT,
        file_name TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS p2p_cancellations (
        id SERIAL PRIMARY KEY,
        profile_id INTEGER NOT NULL REFERENCES profiles(id),
        order_id INTEGER NOT NULL REFERENCES p2p_orders(id),
        role TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS p2p_bans (
        id SERIAL PRIMARY KEY,
        profile_id INTEGER NOT NULL REFERENCES profiles(id),
        banned_until TIMESTAMP NOT NULL,
        reason TEXT NOT NULL DEFAULT '3 cancellations within 24 hours',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    // Add expires_at to p2p_orders if missing
    await db.execute(sql`ALTER TABLE p2p_orders ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP`);
    // Add read_at to p2p_chat_messages if missing
    await db.execute(sql`ALTER TABLE p2p_chat_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP`);
    // Add welcome_message to profiles for P2P seller settings
    await db.execute(sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS p2p_welcome_message TEXT`);
    // Add seller_confirmed_receipt to p2p_orders if missing
    await db.execute(sql`ALTER TABLE p2p_orders ADD COLUMN IF NOT EXISTS seller_confirmed_receipt BOOLEAN DEFAULT false`);
    // P2P seller restriction + flagging
    await db.execute(sql`ALTER TABLE p2p_orders ADD COLUMN IF NOT EXISTS dispute_reason TEXT`);
    await db.execute(sql`ALTER TABLE p2p_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`);
    await db.execute(sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS p2p_seller_restricted BOOLEAN DEFAULT false`);
    await db.execute(sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS p2p_flagged_as TEXT`);
    // Dispute action log table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS p2p_dispute_actions (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL,
        admin_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        reason TEXT NOT NULL,
        target_user_id INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    // Cancellation flow — buyer confirmed no payment checkbox log
    await db.execute(sql`ALTER TABLE p2p_cancellations ADD COLUMN IF NOT EXISTS buyer_confirmed_no_payment BOOLEAN DEFAULT FALSE`);
    // Merchant name — one-time immutable seller display name for buyers
    await db.execute(sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS p2p_merchant_name TEXT`);
    console.log("[startup migration] P2P market tables ensured");
  } catch (e) {
    console.warn("[startup migration] P2P market tables skipped:", (e as Error).message);
  }

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS app_downloads (
        id SERIAL PRIMARY KEY,
        profile_id INTEGER REFERENCES profiles(id),
        device_type TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    console.log("[startup migration] app_downloads table ensured");
  } catch (e) {
    console.warn("[startup migration] app_downloads skipped:", (e as Error).message);
  }

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS canalplus_subscriptions (
        id SERIAL PRIMARY KEY,
        profile_id INTEGER NOT NULL REFERENCES profiles(id),
        plan_name TEXT NOT NULL,
        plan_price_htg DECIMAL(10,2) NOT NULL,
        plan_price_usdt DECIMAL(10,4) NOT NULL,
        card_number VARCHAR(14) NOT NULL,
        auto_renew BOOLEAN NOT NULL DEFAULT false,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("[startup migration] canalplus_subscriptions table ensured");
  } catch (e) {
    console.warn("[startup migration] canalplus_subscriptions skipped:", (e as Error).message);
  }

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
