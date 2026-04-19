import admin from "firebase-admin";
import { db } from "./db";
import { sql } from "drizzle-orm";

let initialized = false;
let initFailed = false;

function init(): boolean {
  if (initialized) return true;
  if (initFailed) return false;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    initFailed = true;
    console.warn("[FCM] FIREBASE_SERVICE_ACCOUNT_JSON not set — push disabled.");
    return false;
  }
  try {
    const sa = JSON.parse(raw);
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: sa.project_id,
        clientEmail: sa.client_email,
        privateKey: sa.private_key,
      }),
    });
    initialized = true;
    console.log(`[FCM] Admin initialized for project: ${sa.project_id}`);
    return true;
  } catch (e) {
    initFailed = true;
    console.warn("[FCM] Admin init failed:", (e as Error).message);
    return false;
  }
}

/**
 * Send a push notification to a single user by profileId.
 * Looks up their FCM token from the DB. Silently no-ops if token missing.
 * Auto-clears invalid/expired tokens.
 */
export async function sendPushToProfile(
  profileId: number,
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<boolean> {
  if (!init()) return false;
  try {
    const rows = await db.execute(sql`SELECT fcm_token FROM profiles WHERE id = ${profileId}`);
    const token = (rows.rows[0] as any)?.fcm_token;
    if (!token) return false;

    const dataPayload: Record<string, string> = {
      title: String(title || "Izichanj"),
      body: String(body || ""),
      url: String(data.url || "/"),
      ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    };
    await admin.messaging().send({
      token,
      data: dataPayload,
      webpush: {
        headers: { Urgency: "high", TTL: "2419200" },
        fcmOptions: { link: dataPayload.url },
      },
      android: { priority: "high" },
    });
    console.log(`[FCM] Push sent to profile #${profileId}: "${title}"`);
    return true;
  } catch (e: any) {
    const code = e?.errorInfo?.code || e?.code || "";
    if (
      code === "messaging/registration-token-not-registered" ||
      code === "messaging/invalid-registration-token" ||
      code === "messaging/invalid-argument"
    ) {
      try {
        await db.execute(sql`UPDATE profiles SET fcm_token = NULL WHERE id = ${profileId}`);
        console.log(`[FCM] Cleared invalid token for profile #${profileId}`);
      } catch {}
    } else {
      console.warn(`[FCM] Push failed for profile #${profileId}:`, e?.message || e);
    }
    return false;
  }
}

/** Send a test push to confirm the pipeline works (admin endpoint helper). */
export async function sendTestPush(profileId: number): Promise<{ ok: boolean; error?: string }> {
  if (!init()) return { ok: false, error: "Firebase Admin not initialized (missing service account)" };
  try {
    const rows = await db.execute(sql`SELECT fcm_token, email FROM profiles WHERE id = ${profileId}`);
    const row = rows.rows[0] as any;
    if (!row?.fcm_token) return { ok: false, error: "No FCM token saved for this user" };
    await admin.messaging().send({
      token: row.fcm_token,
      data: {
        title: "🔔 Izichanj test notification",
        body: "If you see this, push notifications are working perfectly.",
        url: "/",
      },
      webpush: { headers: { Urgency: "high", TTL: "2419200" }, fcmOptions: { link: "/" } },
      android: { priority: "high" },
    });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}
