/* Firebase Cloud Messaging — background notifications service worker (data-only) */
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDsNvrxg5RVZi6krxqdwDRitzyKEodSa-w",
  authDomain: "izichanj-app.firebaseapp.com",
  projectId: "izichanj-app",
  storageBucket: "izichanj-app.firebasestorage.app",
  messagingSenderId: "794869177402",
  appId: "1:794869177402:web:6c4b7d9c26bbf8058f2903",
  measurementId: "G-JMCW0KML73",
});

const messaging = firebase.messaging();

function buildOptions(data) {
  const d = data || {};
  return {
    body: d.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    image: d.image || undefined,
    data: d,
    tag: d.tag || ("izichanj-" + Date.now()),
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    silent: false,
  };
}

messaging.onBackgroundMessage((payload) => {
  const data = payload && payload.data ? payload.data : {};
  const title = data.title || (payload.notification && payload.notification.title) || "Izichanj";
  self.registration.showNotification(title, buildOptions(data));
});

/* Fallback raw push handler — fires even if onBackgroundMessage isn't invoked */
self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (e) { try { payload = { data: { body: event.data.text() } }; } catch (_) {} }
  const data = (payload && (payload.data || payload.notification)) || {};
  const title = data.title || "Izichanj";
  event.waitUntil(self.registration.showNotification(title, buildOptions(data)));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) return c.navigate(url).then(() => c.focus()).catch(() => c.focus());
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
