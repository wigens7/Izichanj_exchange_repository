import { getApps, getApp, initializeApp, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, isSupported, onMessage, type MessagePayload, type Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDsNvrxg5RVZi6krxqdwDRitzyKEodSa-w",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "izichanj-app.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "izichanj-app",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "izichanj-app.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "794869177402",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:794869177402:web:6c4b7d9c26bbf8058f2903",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-JMCW0KML73",
};

export const firebaseApp: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export function initializeFirebase(): FirebaseApp {
  return firebaseApp;
}

const vapidKey = (import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined) || "";

let messagingInstance: Messaging | null = null;

async function getMessagingInstance(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;
  try {
    if (!(await isSupported())) return null;
    messagingInstance = getMessaging(firebaseApp);
    return messagingInstance;
  } catch {
    return null;
  }
}

function getServiceWorkerUrl(): string {
  const query = new URLSearchParams(firebaseConfig).toString();
  return "/firebase-messaging-sw.js?" + query;
}

export async function registerFcmServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(getServiceWorkerUrl(), { scope: "/" });
  } catch (error) {
    console.warn("[FCM] Service worker registration failed:", error);
    return null;
  }
}

export function printFcmToken(token: string): void {
  console.info("[FCM] Device token:", token);
}

export async function requestFcmToken(): Promise<string | null> {
  if (typeof window === "undefined" || !("Notification" in window)) return null;
  const messaging = await getMessagingInstance();
  if (!messaging) {
    console.warn("[FCM] Messaging is not supported in this browser.");
    return null;
  }

  let permission = Notification.permission;
  if (permission === "default") permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const registration = await registerFcmServiceWorker();
  if (!vapidKey) {
    console.warn("[FCM] Missing VITE_FIREBASE_VAPID_KEY. Token cannot be generated.");
    return null;
  }

  try {
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration || undefined,
    });
    if (token) printFcmToken(token);
    return token || null;
  } catch (error) {
    console.warn("[FCM] Token retrieval failed:", error);
    return null;
  }
}

export async function onForegroundPush(callback: (payload: MessagePayload) => void): Promise<() => void> {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}

export type NotificationOpenedPayload = {
  url: string;
  data: Record<string, string>;
};

export async function onNotificationOpened(
  callback: (payload: NotificationOpenedPayload) => void,
): Promise<() => void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return () => {};

  const handler = (event: MessageEvent) => {
    if (event.data?.type !== "FCM_NOTIFICATION_CLICKED") return;
    callback({
      url: String(event.data.url || "/"),
      data: (event.data.data || {}) as Record<string, string>,
    });
  };

  navigator.serviceWorker.addEventListener("message", handler);
  return () => navigator.serviceWorker.removeEventListener("message", handler);
}
