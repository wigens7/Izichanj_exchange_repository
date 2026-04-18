import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported, type Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyDsNvrxg5RVZi6krxqdwDRitzyKEodSa-w",
  authDomain: "izichanj-app.firebaseapp.com",
  projectId: "izichanj-app",
  storageBucket: "izichanj-app.firebasestorage.app",
  messagingSenderId: "794869177402",
  appId: "1:794869177402:web:6c4b7d9c26bbf8058f2903",
  measurementId: "G-JMCW0KML73",
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

const VAPID_KEY = (import.meta.env.VITE_FIREBASE_VAPID_KEY as string) || "";

let _messaging: Messaging | null = null;
async function getMessagingInstance(): Promise<Messaging | null> {
  if (_messaging) return _messaging;
  try {
    if (!(await isSupported())) return null;
    _messaging = getMessaging(firebaseApp);
    return _messaging;
  } catch {
    return null;
  }
}

/** Register the FCM service worker (safe to call repeatedly). */
export async function registerFcmServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");
    if (existing) return existing;
    return await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
  } catch (e) {
    console.warn("[FCM] SW registration failed:", e);
    return null;
  }
}

/** Request notification permission and return an FCM token (or null). */
export async function requestFcmToken(): Promise<string | null> {
  if (typeof window === "undefined" || !("Notification" in window)) return null;
  const messaging = await getMessagingInstance();
  if (!messaging) {
    console.warn("[FCM] Messaging not supported on this browser.");
    return null;
  }
  let permission = Notification.permission;
  if (permission === "default") permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const registration = await registerFcmServiceWorker();
  if (!VAPID_KEY) {
    console.warn("[FCM] Missing VITE_FIREBASE_VAPID_KEY. Token cannot be generated.");
    return null;
  }
  try {
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration || undefined,
    });
    return token || null;
  } catch (e) {
    console.warn("[FCM] getToken failed:", e);
    return null;
  }
}

/** Subscribe to foreground push messages. Returns an unsubscribe function. */
export async function onForegroundPush(cb: (payload: any) => void): Promise<() => void> {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => {};
  return onMessage(messaging, cb);
}
