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

  const sessionTtl = 5 * 60;
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
      resave: true,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: sessionTtl * 1000,
      },
    })
  );
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (!req.session.profileId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};
