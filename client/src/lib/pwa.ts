import { useEffect, useState, useCallback } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event("izichanj:installable"));
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    window.dispatchEvent(new Event("izichanj:installed"));
  });
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS Safari
    window.navigator.standalone === true
  );
}

export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState<boolean>(!!deferredPrompt);
  const [installed, setInstalled] = useState<boolean>(isStandalone());

  useEffect(() => {
    const onInstallable = () => setCanInstall(true);
    const onInstalled = () => {
      setCanInstall(false);
      setInstalled(true);
    };
    window.addEventListener("izichanj:installable", onInstallable);
    window.addEventListener("izichanj:installed", onInstalled);
    return () => {
      window.removeEventListener("izichanj:installable", onInstallable);
      window.removeEventListener("izichanj:installed", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    setCanInstall(false);
    return choice.outcome === "accepted";
  }, []);

  return { canInstall, installed, promptInstall };
}

/** Register the main app service worker for PWA install eligibility. */
export async function registerAppServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
  } catch (e) {
    console.warn("[PWA] SW registration failed:", e);
  }
}
