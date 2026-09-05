# Firebase Cloud Messaging setup

This repository is a TypeScript/React Progressive Web App. It does not contain a Flutter or native Android module, so the browser implementation uses the Firebase Web SDK and a service worker for foreground, background, and terminated-state notifications.

## Client configuration

Create the following public Vite variables from the Firebase Web app in the same Firebase project used by the server service account:

- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_STORAGE_BUCKET
- VITE_FIREBASE_MESSAGING_SENDER_ID
- VITE_FIREBASE_APP_ID
- VITE_FIREBASE_MEASUREMENT_ID (optional)
- VITE_FIREBASE_VAPID_KEY

The current source keeps the existing web configuration as a fallback, but production should set every value explicitly. The uploaded google-services.json is an Android client configuration and does not provide the Web app ID or Web Push VAPID key.

## Server configuration

Set FIREBASE_SERVICE_ACCOUNT_JSON as a server-side secret containing the Firebase Admin service-account JSON. Never commit the Admin SDK JSON file, private key, or any other credential to Git.

The server stores the browser token at POST /api/profile/fcm-token and sends data-only messages through Firebase Admin. Invalid tokens are cleared automatically.

## Notification states

- Foreground: onMessage displays an in-app toast.
- Background and terminated: client/public/firebase-messaging-sw.js handles onBackgroundMessage and displays the notification.
- Notification clicks: the service worker navigates to the payload URL and posts an FCM_NOTIFICATION_CLICKED event to an existing client window. Opening the target URL directly is the web equivalent of handling a terminated-state initial message.
- Permission: the browser Notification.requestPermission() call is made at runtime from the notification prompt. This is the web equivalent of Android 13's runtime notification permission.

## Native Android note

There is no AndroidManifest.xml in this repository. If a separate native Android or Flutter client is added, it must use the uploaded Android configuration and include the Android 13 permission plus a high-importance channel and icon metadata in that client. Do not add a fake Android module to this web repository.
