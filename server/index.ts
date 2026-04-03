import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { db } from "./db";
import { sql } from "drizzle-orm";

const app = express();
const httpServer = createServer(app);

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
