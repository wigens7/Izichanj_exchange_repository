importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

const query = new URL(self.location.href).searchParams;
const firebaseConfig = {
  apiKey: query.get("apiKey") || "AIzaSyDsNvrxg5RVZi6krxqdwDRitzyKEodSa-w",
  authDomain: query.get("authDomain") || "izichanj-app.firebaseapp.com",
  projectId: query.get("projectId") || "izichanj-app",
  storageBucket: query.get("storageBucket") || "izichanj-app.firebasestorage.app",
  messagingSenderId: query.get("messagingSenderId") || "794869177402",
  appId: query.get("appId") || "1:794869177402:web:6c4b7d9c26bbf8058f2903",
  measurementId: query.get("measurementId") || "G-JMCW0KML73",
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

function buildNotificationOptions(data) {
  return {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    image: data.image || undefined,
    data,
    tag: data.tag || "izichanj-fcm",
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200],
  };
}

messaging.onBackgroundMessage((payload) => {
  const data = (payload && payload.data) || {};
  const notification = (payload && payload.notification) || {};
  const title = data.title || notification.title || "Izichanj";
  self.registration.showNotification(title, buildNotificationOptions({
    ...notification,
    ...data,
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = new URL(data.url || "/", self.location.origin);
  const message = {
    type: "FCM_NOTIFICATION_CLICKED",
    url: target.pathname + target.search + target.hash,
    data,
  };

  event.waitUntil((async () => {
    const windowClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windowClients) {
      if ("focus" in client && "navigate" in client) {
        await client.navigate(target.href);
        client.postMessage(message);
        await client.focus();
        return;
      }
    }
    if (clients.openWindow) await clients.openWindow(target.href);
  })());
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
