import type { Express } from "express";
    import { db } from "./db";
    import { sql } from "drizzle-orm";
    import bcrypt from "bcryptjs";
    import { isAuthenticated } from "./auth";
    import { storage } from "./storage";

    const P2P_CANCEL_LIMIT = 3;
    const P2P_BAN_HOURS = 24;

    const PAYMENT_METHODS = [
    "MonCash",
    "NatCash",
    "BH Bank",
    "Capital Bank",
    "Unibank",
    "Sogebank",
    "Cash",
    ];

    /**
     * Drizzle returns a plain array for some drivers and a node-postgres
     * QueryResult ({ rows: [] }) for others. Keep the API contract stable
     * for the P2P client regardless of the active database driver.
     */
    function resultRows<T = any>(result: unknown): T[] {
    if (Array.isArray(result)) return result as T[];
    if (result && typeof result === "object" && Array.isArray((result as { rows?: unknown }).rows)) {
      return (result as { rows: T[] }).rows;
    }
    return [];
    }

    function generateOrderId(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `P2P${ts}${rand}`.slice(0, 20);
    }

    /**
    * Run startup migrations for all P2P tables and columns.
    * Every statement uses IF NOT EXISTS so it is safe to run on every boot.
    */
    async function runP2pMigrations(): Promise<void> {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS p2p_ads (
          id                SERIAL PRIMARY KEY,
          seller_id         INTEGER NOT NULL REFERENCES profiles(id),
          amount_usdt       DECIMAL(10,2) NOT NULL,
          available_usdt    DECIMAL(10,2) NOT NULL,
          rate_htg          DECIMAL(10,4),
          margin_pct        DECIMAL(5,2),
          currency          TEXT NOT NULL DEFAULT 'HTG',
          country           TEXT NOT NULL DEFAULT 'HT',
          payment_methods   TEXT[] NOT NULL,
          min_order_usdt    DECIMAL(10,2) NOT NULL DEFAULT 10,
          max_order_usdt    DECIMAL(10,2),
          status            TEXT NOT NULL DEFAULT 'active',
          terms_note        TEXT,
          created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    } catch (e) { console.warn("[p2p migration] p2p_ads:", (e as Error).message); }

    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS p2p_orders (
          id                        SERIAL PRIMARY KEY,
          order_id                  VARCHAR(20) UNIQUE,
          ad_id                     INTEGER NOT NULL REFERENCES p2p_ads(id),
          buyer_id                  INTEGER NOT NULL REFERENCES profiles(id),
          seller_id                 INTEGER NOT NULL REFERENCES profiles(id),
          amount_usdt               DECIMAL(10,2) NOT NULL,
          amount_local              DECIMAL(12,2) NOT NULL,
          rate                      DECIMAL(10,4) NOT NULL,
          currency                  TEXT NOT NULL DEFAULT 'HTG',
          payment_method            TEXT NOT NULL,
          status                    TEXT NOT NULL DEFAULT 'pending',
          cancelled_by              TEXT,
          cancellation_reason       TEXT,
          dispute_reason            TEXT,
          seller_confirmed_receipt  BOOLEAN NOT NULL DEFAULT FALSE,
          paid_at                   TIMESTAMP,
          released_at               TIMESTAMP,
          cancelled_at              TIMESTAMP,
          created_at                TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    } catch (e) { console.warn("[p2p migration] p2p_orders:", (e as Error).message); }

    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS p2p_chat_messages (
          id            SERIAL PRIMARY KEY,
          order_id      INTEGER NOT NULL REFERENCES p2p_orders(id),
          sender_id     INTEGER NOT NULL REFERENCES profiles(id),
          message       TEXT,
          file_url      TEXT,
          file_name     TEXT,
          read_at       TIMESTAMP,
          is_filtered   BOOLEAN NOT NULL DEFAULT FALSE,
          filter_reason TEXT,
          created_at    TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    } catch (e) { console.warn("[p2p migration] p2p_chat_messages:", (e as Error).message); }

    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS p2p_cancellations (
          id                         SERIAL PRIMARY KEY,
          profile_id                 INTEGER NOT NULL REFERENCES profiles(id),
          order_id                   INTEGER NOT NULL REFERENCES p2p_orders(id),
          role                       TEXT NOT NULL,
          reason                     TEXT NOT NULL,
          buyer_confirmed_no_payment BOOLEAN NOT NULL DEFAULT FALSE,
          created_at                 TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    } catch (e) { console.warn("[p2p migration] p2p_cancellations:", (e as Error).message); }

    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS p2p_bans (
          id           SERIAL PRIMARY KEY,
          profile_id   INTEGER NOT NULL REFERENCES profiles(id),
          banned_until TIMESTAMP NOT NULL,
          reason       TEXT NOT NULL DEFAULT '3 cancellations within 24 hours',
          created_at   TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    } catch (e) { console.warn("[p2p migration] p2p_bans:", (e as Error).message); }

    try {
      await db.execute(sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS p2p_merchant_name TEXT`);
    } catch (e) { console.warn("[p2p migration] profiles.p2p_merchant_name:", (e as Error).message); }

    // Performance indexes (best-effort)
    for (const stmt of [
      sql`CREATE INDEX IF NOT EXISTS idx_p2p_ads_status ON p2p_ads(status)`,
      sql`CREATE INDEX IF NOT EXISTS idx_p2p_orders_buyer ON p2p_orders(buyer_id)`,
      sql`CREATE INDEX IF NOT EXISTS idx_p2p_orders_seller ON p2p_orders(seller_id)`,
      sql`CREATE INDEX IF NOT EXISTS idx_p2p_bans_profile ON p2p_bans(profile_id)`,
      sql`CREATE INDEX IF NOT EXISTS idx_p2p_chat_order ON p2p_chat_messages(order_id)`,
    ]) {
      await db.execute(stmt).catch(() => {});
    }

    console.log("[p2p migration] P2P tables ready");
    }

    export async function registerP2pRoutes(app: Express): Promise<void> {
    await runP2pMigrations();

    // GET /api/p2p/ban — check if current user is banned from P2P trading
    app.get("/api/p2p/ban", isAuthenticated, async (req: any, res) => {
      const profileId = req.session?.profileId;
      if (!profileId) return res.status(401).json({ error: "Unauthorized" });
      try {
        const rows = await db.execute(sql`
          SELECT banned_until, reason FROM p2p_bans
          WHERE profile_id = ${profileId} AND banned_until > NOW()
          LIMIT 1
        `);
        const ban = resultRows<any>(rows)[0];
        if (ban) return res.json({ banned: true, reason: ban.reason, bannedUntil: ban.banned_until });
        return res.json({ banned: false });
      } catch (e) {
        console.error("[p2p/ban]", e);
        return res.status(500).json({ error: "Internal error" });
      }
    });

    // GET /api/p2p/settings — P2P platform configuration
    app.get("/api/p2p/settings", isAuthenticated, async (_req, res) => {
      return res.json({
        paymentMethods: PAYMENT_METHODS,
        cancelLimit: P2P_CANCEL_LIMIT,
        banHours: P2P_BAN_HOURS,
        minOrderUsdt: 10,
        maxAdsPerUser: 5,
      });
    });

    // GET /api/p2p/payment-methods — list accepted payment methods
    app.get("/api/p2p/payment-methods", isAuthenticated, async (_req, res) => {
      return res.json({ methods: PAYMENT_METHODS });
    });

    // GET /api/p2p/merchant-name — get current user's P2P display name
    app.get("/api/p2p/merchant-name", isAuthenticated, async (req: any, res) => {
      const profileId = req.session?.profileId;
      if (!profileId) return res.status(401).json({ error: "Unauthorized" });
      try {
        const rows = await db.execute(sql`SELECT p2p_merchant_name, full_name FROM profiles WHERE id = ${profileId}`);
        const row = resultRows<any>(rows)[0];
        if (!row) return res.status(404).json({ error: "Profile not found" });
        return res.json({ name: row.p2p_merchant_name || row.full_name });
      } catch (e) {
        console.error("[p2p/merchant-name GET]", e);
        return res.status(500).json({ error: "Internal error" });
      }
    });

    // POST /api/p2p/merchant-name — set P2P display name (2-30 characters)
    app.post("/api/p2p/merchant-name", isAuthenticated, async (req: any, res) => {
      const profileId = req.session?.profileId;
      if (!profileId) return res.status(401).json({ error: "Unauthorized" });
      const name = (req.body?.name ?? "").toString().trim();
      if (!name || name.length < 2 || name.length > 30) {
        return res.status(400).json({ error: "Name must be 2-30 characters" });
      }
      try {
        await db.execute(sql`UPDATE profiles SET p2p_merchant_name = ${name} WHERE id = ${profileId}`);
        return res.json({ name });
      } catch (e) {
        console.error("[p2p/merchant-name POST]", e);
        return res.status(500).json({ error: "Internal error" });
      }
    });

    // GET /api/p2p/ads — list active marketplace ads (excludes own ads and banned sellers)
    app.get("/api/p2p/ads", isAuthenticated, async (req: any, res) => {
      const profileId = req.session?.profileId;
      if (!profileId) return res.status(401).json({ error: "Unauthorized" });
      try {
        const rows = await db.execute(sql`
          SELECT
            a.*,
            COALESCE(p.p2p_merchant_name, p.full_name) AS seller_name,
            p.last_activity
          FROM p2p_ads a
          JOIN profiles p ON p.id = a.seller_id
          LEFT JOIN p2p_bans b ON b.profile_id = a.seller_id AND b.banned_until > NOW()
          WHERE a.status = 'active'
            AND a.seller_id != ${profileId}
            AND a.available_usdt > 0
            AND b.id IS NULL
          ORDER BY a.created_at DESC
        `);
        return res.json(resultRows(rows));
      } catch (e) {
        console.error("[p2p/ads GET]", e);
        return res.status(500).json({ error: "Internal error" });
      }
    });

    // POST /api/p2p/ads — create a sell ad (locks USDT from seller balance into escrow pool)
    app.post("/api/p2p/ads", isAuthenticated, async (req: any, res) => {
      const profileId = req.session?.profileId;
      if (!profileId) return res.status(401).json({ error: "Unauthorized" });
      const {
        amountUsdt, rateHtg, currency = "HTG",
        paymentMethods, minOrderUsdt = 10, maxOrderUsdt, termsNote,
      } = req.body || {};
      const amount = parseFloat(amountUsdt);
      const rate = parseFloat(rateHtg);
      const minOrder = parseFloat(String(minOrderUsdt));
      const maxOrder = maxOrderUsdt ? parseFloat(String(maxOrderUsdt)) : null;
      if (!amount || amount <= 0) return res.status(400).json({ error: "Invalid amount" });
      if (!rate || rate <= 0) return res.status(400).json({ error: "Invalid rate" });
      if (!Array.isArray(paymentMethods) || paymentMethods.length === 0) {
        return res.status(400).json({ error: "Select at least one payment method" });
      }
      if (minOrder < 1) return res.status(400).json({ error: "Minimum order must be at least 1 USDT" });
      if (maxOrder !== null && maxOrder < minOrder) {
        return res.status(400).json({ error: "Max order must be >= min order" });
      }
      try {
        const profRows = await db.execute(sql`SELECT kyc_status, balance FROM profiles WHERE id = ${profileId}`);
        const profile = resultRows<any>(profRows)[0];
        if (!profile || profile.kyc_status !== "verified") {
          return res.status(403).json({ error: "KYC verification required to sell on P2P" });
        }
        const currentBalance = parseFloat(profile.balance ?? "0");
        if (currentBalance < amount) {
          return res.status(400).json({ error: "Insufficient balance" });
        }
        const countRows = await db.execute(sql`
          SELECT COUNT(*) AS cnt FROM p2p_ads
          WHERE seller_id = ${profileId} AND status IN ('active', 'paused')
        `);
        if (Number(resultRows<any>(countRows)[0]?.cnt ?? 0) >= 5) {
          return res.status(400).json({ error: "Maximum 5 active ads allowed" });
        }
        // Lock USDT from seller balance into the ad's escrow pool
        await storage.updateProfileBalance(profileId, currentBalance - amount);
        const adRows = await db.execute(sql`
          INSERT INTO p2p_ads
            (seller_id, amount_usdt, available_usdt, rate_htg, currency, payment_methods,
             min_order_usdt, max_order_usdt, terms_note, status)
          VALUES
            (${profileId}, ${amount}, ${amount}, ${rate}, ${currency}, ${paymentMethods},
             ${minOrder}, ${maxOrder}, ${termsNote ?? null}, 'active')
          RETURNING *
        `);
        return res.status(201).json(resultRows(adRows)[0]);
      } catch (e) {
        console.error("[p2p/ads POST]", e);
        return res.status(500).json({ error: "Internal error" });
      }
    });

    // GET /api/p2p/ads/my — list the current user's own ads
    app.get("/api/p2p/ads/my", isAuthenticated, async (req: any, res) => {
      const profileId = req.session?.profileId;
      if (!profileId) return res.status(401).json({ error: "Unauthorized" });
      try {
        const rows = await db.execute(sql`
          SELECT * FROM p2p_ads WHERE seller_id = ${profileId} ORDER BY created_at DESC
        `);
        return res.json(resultRows(rows));
      } catch (e) {
        console.error("[p2p/ads/my]", e);
        return res.status(500).json({ error: "Internal error" });
      }
    });

    // POST /api/p2p/ads/:id/toggle-pause — pause an active ad or resume a paused ad
    app.post("/api/p2p/ads/:id/toggle-pause", isAuthenticated, async (req: any, res) => {
      const profileId = req.session?.profileId;
      if (!profileId) return res.status(401).json({ error: "Unauthorized" });
      const adId = Number(req.params.id);
      try {
        const adRows = await db.execute(sql`
          SELECT id, status FROM p2p_ads WHERE id = ${adId} AND seller_id = ${profileId}
        `);
        const ad = resultRows<any>(adRows)[0];
        if (!ad) return res.status(404).json({ error: "Ad not found" });
        if (!["active", "paused"].includes(ad.status)) {
          return res.status(400).json({ error: "Cannot toggle this ad" });
        }
        const newStatus = ad.status === "active" ? "paused" : "active";
        const updated = await db.execute(sql`
          UPDATE p2p_ads SET status = ${newStatus}, updated_at = NOW()
          WHERE id = ${adId} RETURNING *
        `);
        return res.json(resultRows(updated)[0]);
      } catch (e) {
        console.error("[p2p/ads toggle-pause]", e);
        return res.status(500).json({ error: "Internal error" });
      }
    });

    // DELETE /api/p2p/ads/:id — cancel ad and return remaining USDT to seller's balance
    app.delete("/api/p2p/ads/:id", isAuthenticated, async (req: any, res) => {
      const profileId = req.session?.profileId;
      if (!profileId) return res.status(401).json({ error: "Unauthorized" });
      const adId = Number(req.params.id);
      try {
        const adRows = await db.execute(sql`
          SELECT id, available_usdt FROM p2p_ads WHERE id = ${adId} AND seller_id = ${profileId}
        `);
        const ad = resultRows<any>(adRows)[0];
        if (!ad) return res.status(404).json({ error: "Ad not found" });
        const activeOrders = await db.execute(sql`
          SELECT COUNT(*) AS cnt FROM p2p_orders
          WHERE ad_id = ${adId} AND status IN ('pending', 'paid', 'disputed')
        `);
        if (Number(resultRows<any>(activeOrders)[0]?.cnt ?? 0) > 0) {
          return res.status(400).json({ error: "Cannot delete ad with active orders" });
        }
        const available = parseFloat(ad.available_usdt ?? "0");
        if (available > 0) {
          const profRows = await db.execute(sql`SELECT balance FROM profiles WHERE id = ${profileId}`);
          const currentBalance = parseFloat(resultRows<any>(profRows)[0]?.balance ?? "0");
          await storage.updateProfileBalance(profileId, currentBalance + available);
        }
        await db.execute(sql`
          UPDATE p2p_ads SET status = 'cancelled', available_usdt = 0, updated_at = NOW()
          WHERE id = ${adId}
        `);
        return res.json({ ok: true });
      } catch (e) {
        console.error("[p2p/ads DELETE]", e);
        return res.status(500).json({ error: "Internal error" });
      }
    });

    // GET /api/p2p/orders — list all orders where the user is buyer or seller
    app.get("/api/p2p/orders", isAuthenticated, async (req: any, res) => {
      const profileId = req.session?.profileId;
      if (!profileId) return res.status(401).json({ error: "Unauthorized" });
      try {
        const rows = await db.execute(sql`
          SELECT
            o.*,
            COALESCE(bp.p2p_merchant_name, bp.full_name) AS buyer_name,
            COALESCE(sp.p2p_merchant_name, sp.full_name) AS seller_name,
            sp.last_activity AS seller_last_activity,
            bp.last_activity AS buyer_last_activity,
            a.rate_htg, a.currency AS ad_currency,
            a.payment_methods AS ad_payment_methods
          FROM p2p_orders o
          JOIN profiles bp ON bp.id = o.buyer_id
          JOIN profiles sp ON sp.id = o.seller_id
          LEFT JOIN p2p_ads a ON a.id = o.ad_id
          WHERE o.buyer_id = ${profileId} OR o.seller_id = ${profileId}
          ORDER BY o.created_at DESC
        `);
        return res.json(resultRows(rows));
      } catch (e) {
        console.error("[p2p/orders GET]", e);
        return res.status(500).json({ error: "Internal error" });
      }
    });

    // POST /api/p2p/orders — create order and lock USDT from ad pool (escrow)
    app.post("/api/p2p/orders", isAuthenticated, async (req: any, res) => {
      const profileId = req.session?.profileId;
      if (!profileId) return res.status(401).json({ error: "Unauthorized" });
      const { adId, amountUsdt, paymentMethod } = req.body || {};
      const amount = parseFloat(amountUsdt);
      if (!adId || !amount || amount <= 0) return res.status(400).json({ error: "Invalid order data" });
      if (!paymentMethod) return res.status(400).json({ error: "Payment method required" });
      try {
        const profRows = await db.execute(sql`SELECT kyc_status FROM profiles WHERE id = ${profileId}`);
        const buyer = resultRows<any>(profRows)[0];
        if (!buyer || buyer.kyc_status !== "verified") {
          return res.status(403).json({ error: "KYC verification required to buy on P2P" });
        }
        const banRows = await db.execute(sql`
          SELECT id FROM p2p_bans WHERE profile_id = ${profileId} AND banned_until > NOW() LIMIT 1
        `);
        if (resultRows(banRows).length > 0) {
          return res.status(403).json({ error: "You are temporarily banned from P2P trading" });
        }
        const adRows = await db.execute(sql`SELECT * FROM p2p_ads WHERE id = ${adId} AND status = 'active'`);
        const ad = resultRows<any>(adRows)[0];
        if (!ad) return res.status(404).json({ error: "Ad not found or not active" });
        if (ad.seller_id === profileId) return res.status(400).json({ error: "Cannot buy your own ad" });
        const available = parseFloat(ad.available_usdt);
        const minOrder = parseFloat(ad.min_order_usdt);
        const maxOrder = parseFloat(ad.max_order_usdt || ad.amount_usdt);
        if (amount < minOrder) return res.status(400).json({ error: `Minimum order is ${minOrder} USDT` });
        if (amount > maxOrder) return res.status(400).json({ error: `Maximum order is ${maxOrder} USDT` });
        if (amount > available) return res.status(400).json({ error: "Insufficient available USDT in this ad" });
        const rate = parseFloat(ad.rate_htg);
        const amountLocal = amount * rate;
        const orderId = generateOrderId();
        // Lock USDT: reduce ad available pool
        await db.execute(sql`
          UPDATE p2p_ads SET available_usdt = available_usdt - ${amount}, updated_at = NOW()
          WHERE id = ${adId}
        `);
        const orderRows = await db.execute(sql`
          INSERT INTO p2p_orders
            (order_id, ad_id, buyer_id, seller_id, amount_usdt, amount_local,
             rate, currency, payment_method, status)
          VALUES
            (${orderId}, ${adId}, ${profileId}, ${ad.seller_id}, ${amount},
             ${amountLocal}, ${rate}, ${ad.currency || "HTG"}, ${paymentMethod}, 'pending')
          RETURNING *
        `);
        const order = resultRows<any>(orderRows)[0];
        await db.execute(sql`
          INSERT INTO p2p_chat_messages (order_id, sender_id, message)
          VALUES (${order.id}, ${profileId},
            ${'📦 Order created. Please send payment within 30 minutes, then mark as paid.'})
        `);
        return res.status(201).json(order);
      } catch (e) {
        console.error("[p2p/orders POST]", e);
        return res.status(500).json({ error: "Internal error" });
      }
    });

    // POST /api/p2p/orders/:id/pay — buyer marks external payment as sent
    app.post("/api/p2p/orders/:id/pay", isAuthenticated, async (req: any, res) => {
      const profileId = req.session?.profileId;
      if (!profileId) return res.status(401).json({ error: "Unauthorized" });
      const orderId = Number(req.params.id);
      try {
        const orderRows = await db.execute(sql`SELECT * FROM p2p_orders WHERE id = ${orderId}`);
        const order = resultRows<any>(orderRows)[0];
        if (!order) return res.status(404).json({ error: "Order not found" });
        if (order.buyer_id !== profileId) return res.status(403).json({ error: "Only the buyer can mark as paid" });
        if (order.status !== "pending") {
          return res.status(400).json({ error: `Cannot mark as paid: order is ${order.status}` });
        }
        await db.execute(sql`UPDATE p2p_orders SET status = 'paid', paid_at = NOW() WHERE id = ${orderId}`);
        await db.execute(sql`
          INSERT INTO p2p_chat_messages (order_id, sender_id, message)
          VALUES (${orderId}, ${profileId},
            ${'✅ Payment sent. Seller: please verify receipt and release USDT.'})
        `);
        return res.json({ ok: true, status: "paid" });
      } catch (e) {
        console.error("[p2p/orders/pay]", e);
        return res.status(500).json({ error: "Internal error" });
      }
    });

    // POST /api/p2p/orders/:id/release-pin — verify seller PIN before releasing escrow
    app.post("/api/p2p/orders/:id/release-pin", isAuthenticated, async (req: any, res) => {
      const profileId = req.session?.profileId;
      if (!profileId) return res.status(401).json({ error: "Unauthorized" });
      const orderId = Number(req.params.id);
      const pin = (req.body?.pin ?? "").toString().trim();
      if (!pin) return res.status(400).json({ error: "PIN required" });
      try {
        const orderRows = await db.execute(sql`SELECT * FROM p2p_orders WHERE id = ${orderId}`);
        const order = resultRows<any>(orderRows)[0];
        if (!order) return res.status(404).json({ error: "Order not found" });
        if (order.seller_id !== profileId) return res.status(403).json({ error: "Only the seller can release funds" });
        if (order.status !== "paid") return res.status(400).json({ error: "Order must be in paid status" });
        const sellerRows = await db.execute(sql`
          SELECT withdrawal_pin_hash, pin_hash FROM profiles WHERE id = ${profileId}
        `);
        const seller = resultRows<any>(sellerRows)[0];
        const pinHash = seller?.withdrawal_pin_hash || seller?.pin_hash;
        if (!pinHash) {
          return res.status(400).json({ error: "No PIN set. Please configure a PIN in security settings." });
        }
        const valid = await bcrypt.compare(pin, pinHash);
        if (!valid) return res.status(400).json({ error: "Incorrect PIN" });
        return res.json({ ok: true });
      } catch (e) {
        console.error("[p2p/orders/release-pin]", e);
        return res.status(500).json({ error: "Internal error" });
      }
    });

    // POST /api/p2p/orders/:id/release — seller releases escrowed USDT to buyer's wallet
    app.post("/api/p2p/orders/:id/release", isAuthenticated, async (req: any, res) => {
      const profileId = req.session?.profileId;
      if (!profileId) return res.status(401).json({ error: "Unauthorized" });
      const orderId = Number(req.params.id);
      try {
        const orderRows = await db.execute(sql`SELECT * FROM p2p_orders WHERE id = ${orderId}`);
        const order = resultRows<any>(orderRows)[0];
        if (!order) return res.status(404).json({ error: "Order not found" });
        if (order.seller_id !== profileId) return res.status(403).json({ error: "Only the seller can release funds" });
        if (order.status !== "paid") return res.status(400).json({ error: "Order must be in paid status" });
        const amount = parseFloat(order.amount_usdt);
        const buyerRows = await db.execute(sql`SELECT balance FROM profiles WHERE id = ${order.buyer_id}`);
        const buyerBalance = parseFloat(resultRows<any>(buyerRows)[0]?.balance ?? "0");
        // Credit USDT to buyer's wallet
        await storage.updateProfileBalance(order.buyer_id, buyerBalance + amount);
        await db.execute(sql`
          UPDATE p2p_orders
          SET status = 'released', released_at = NOW(), seller_confirmed_receipt = TRUE
          WHERE id = ${orderId}
        `);
        // Auto-complete the ad when no USDT remains and no pending orders
        await db.execute(sql`
          UPDATE p2p_ads SET updated_at = NOW(),
            status = CASE
              WHEN available_usdt <= 0 AND NOT EXISTS (
                SELECT 1 FROM p2p_orders
                WHERE ad_id = p2p_ads.id AND status IN ('pending', 'paid', 'disputed')
              ) THEN 'completed'
              ELSE status
            END
          WHERE id = ${order.ad_id}
        `);
        await db.execute(sql`
          INSERT INTO p2p_chat_messages (order_id, sender_id, message)
          VALUES (${orderId}, ${profileId}, ${'🎉 USDT released successfully! Trade complete.'})
        `);
        storage.createNotification({
          profileId: order.buyer_id,
          type: "custom_message",
          title: "P2P Trade Complete",
          message: `${amount} USDT has been credited to your wallet.`,
        }).catch(() => {});
        return res.json({ ok: true, status: "released" });
      } catch (e) {
        console.error("[p2p/orders/release]", e);
        return res.status(500).json({ error: "Internal error" });
      }
    });

    // POST /api/p2p/orders/:id/cancel — cancel order and restore USDT to ad pool
    app.post("/api/p2p/orders/:id/cancel", isAuthenticated, async (req: any, res) => {
      const profileId = req.session?.profileId;
      if (!profileId) return res.status(401).json({ error: "Unauthorized" });
      const orderId = Number(req.params.id);
      const reason = (req.body?.reason ?? "").toString().trim();
      const buyerConfirmedNoPayment = req.body?.buyerConfirmedNoPayment === true;
      if (!reason) return res.status(400).json({ error: "Cancellation reason required" });
      try {
        const orderRows = await db.execute(sql`SELECT * FROM p2p_orders WHERE id = ${orderId}`);
        const order = resultRows<any>(orderRows)[0];
        if (!order) return res.status(404).json({ error: "Order not found" });
        const isBuyer = order.buyer_id === profileId;
        const isSeller = order.seller_id === profileId;
        if (!isBuyer && !isSeller) return res.status(403).json({ error: "Not a participant in this order" });
        if (!["pending", "paid"].includes(order.status)) {
          return res.status(400).json({ error: `Cannot cancel: order is ${order.status}` });
        }
        if (order.status === "paid" && isBuyer && !buyerConfirmedNoPayment) {
          return res.status(400).json({ error: "Please confirm you have NOT sent payment before cancelling" });
        }
        const role = isBuyer ? "buyer" : "seller";
        await db.execute(sql`
          UPDATE p2p_orders
          SET status = 'cancelled', cancelled_by = ${role},
              cancellation_reason = ${reason}, cancelled_at = NOW()
          WHERE id = ${orderId}
        `);
        // Restore USDT to the ad's available pool
        await db.execute(sql`
          UPDATE p2p_ads
          SET available_usdt = available_usdt + ${parseFloat(order.amount_usdt)}, updated_at = NOW()
          WHERE id = ${order.ad_id}
        `);
        await db.execute(sql`
          INSERT INTO p2p_chat_messages (order_id, sender_id, message)
          VALUES (${orderId}, ${profileId}, ${
            `❌ Order cancelled by ${role}. Reason: ${reason}`
          })
        `);
        await db.execute(sql`
          INSERT INTO p2p_cancellations (profile_id, order_id, role, reason, buyer_confirmed_no_payment)
          VALUES (${profileId}, ${orderId}, ${role}, ${reason}, ${buyerConfirmedNoPayment})
        `);
        // Auto-ban buyer after exceeding cancellation limit within 24 hours
        if (isBuyer) {
          const countRows = await db.execute(sql`
            SELECT COUNT(*) AS cnt FROM p2p_cancellations
            WHERE profile_id = ${profileId} AND role = 'buyer'
              AND created_at > NOW() - INTERVAL '24 hours'
          `);
          const cnt = Number(resultRows<any>(countRows)[0]?.cnt ?? 0);
          if (cnt >= P2P_CANCEL_LIMIT) {
            const bannedUntil = new Date(Date.now() + P2P_BAN_HOURS * 3600 * 1000).toISOString();
            await db.execute(sql`DELETE FROM p2p_bans WHERE profile_id = ${profileId}`);
            await db.execute(sql`
              INSERT INTO p2p_bans (profile_id, banned_until, reason)
              VALUES (${profileId}, ${bannedUntil}, '3 cancellations within 24 hours')
            `);
          }
        }
        return res.json({ ok: true, status: "cancelled" });
      } catch (e) {
        console.error("[p2p/orders/cancel]", e);
        return res.status(500).json({ error: "Internal error" });
      }
    });

    // POST /api/p2p/orders/:id/dispute — open a dispute for admin resolution
    app.post("/api/p2p/orders/:id/dispute", isAuthenticated, async (req: any, res) => {
      const profileId = req.session?.profileId;
      if (!profileId) return res.status(401).json({ error: "Unauthorized" });
      const orderId = Number(req.params.id);
      const reason = (req.body?.reason ?? "").toString().trim();
      if (!reason) return res.status(400).json({ error: "Dispute reason required" });
      try {
        const orderRows = await db.execute(sql`SELECT * FROM p2p_orders WHERE id = ${orderId}`);
        const order = resultRows<any>(orderRows)[0];
        if (!order) return res.status(404).json({ error: "Order not found" });
        if (order.buyer_id !== profileId && order.seller_id !== profileId) {
          return res.status(403).json({ error: "Not a participant in this order" });
        }
        if (!["pending", "paid"].includes(order.status)) {
          return res.status(400).json({ error: `Cannot dispute: order is ${order.status}` });
        }
        await db.execute(sql`
          UPDATE p2p_orders SET status = 'disputed', dispute_reason = ${reason}
          WHERE id = ${orderId}
        `);
        await db.execute(sql`
          INSERT INTO p2p_chat_messages (order_id, sender_id, message)
          VALUES (${orderId}, ${profileId}, ${`⚠️ Dispute opened: ${reason}`})
        `);
        return res.json({ ok: true, status: "disputed" });
      } catch (e) {
        console.error("[p2p/orders/dispute]", e);
        return res.status(500).json({ error: "Internal error" });
      }
    });
    }
    