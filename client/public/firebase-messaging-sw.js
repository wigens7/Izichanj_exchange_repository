/* Firebase Cloud Messaging — background notifications service worker */
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

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || "Izichanj";
  const options = {
    body: (payload.notification && payload.notification.body) || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: payload.data || {},
    tag: (payload.data && payload.data.tag) || "izichanj-notification",
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) return c.navigate(url).then(() => c.focus());
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

/* PWA install support — minimal pass-through service worker behavior */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
