import session from "express-session";
import connectPg from "connect-pg-simple";
import type { Express, RequestHandler } from "express";

declare module "express-session" {
  interface SessionData {
    profileId: number;
    pending2faProfileId: number;
    currentChallenge: string;
    webauthnProfileId: number;
  }
}

export function setupAuth(app: Express) {
  app.set("trust proxy", 1);

  // Session lasts 8 hours on the server; frontend InactivityGuard handles
  // the 5-minute user-facing inactivity logout independently.
  const sessionTtl = 8 * 60 * 60; // 8 hours in seconds
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  app.use(
    session({
      secret: process.env.SESSION_SECRET!,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: sessionTtl * 1000,
      },
    })
  );
}

// In-memory throttle: only write last_activity at most once per profile per minute.
const lastHeartbeatAt = new Map<number, number>();
const HEARTBEAT_INTERVAL_MS = 60_000;

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (!req.session.profileId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  // Fire-and-forget heartbeat; throttled so we don't hammer the DB on every request.
  const pid = req.session.profileId as number;
  const now = Date.now();
  const last = lastHeartbeatAt.get(pid) ?? 0;
  if (now - last >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeatAt.set(pid, now);
    import("./db").then(({ db }) =>
      import("drizzle-orm").then(({ sql }) =>
        db.execute(sql`UPDATE profiles SET last_activity = NOW() WHERE id = ${pid}`)
      )
    ).catch(() => {});
  }
  next();
};
