import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { requestFcmToken, onForegroundPush, registerFcmServiceWorker } from "@/lib/firebase";

const STORAGE_KEY = "izichanj:fcm:dismissed";

export function NotificationPermissionPrompt() {
  const { data: user } = useUser();
  const { toast } = useToast();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  // Show popup shortly after login if permission is "default" and user hasn't dismissed it
  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (sessionStorage.getItem(STORAGE_KEY) === "1") return;
    if (Notification.permission !== "default") return;
    const t = setTimeout(() => setShow(true), 1500);
    return () => clearTimeout(t);
  }, [user?.id]);

  // If already granted on load, ensure SW is registered & try to (re)sync token silently
  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
      (async () => {
        await registerFcmServiceWorker();
        const token = await requestFcmToken();
        if (token) {
          try {
            await apiRequest("POST", "/api/profile/fcm-token", { token });
          } catch {}
        }
      })();
    }
  }, [user?.id]);

  // Foreground push -> show toast
  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      unsub = await onForegroundPush((payload) => {
        toast({
          title: payload?.notification?.title || "Izichanj",
          description: payload?.notification?.body || "",
        });
      });
    })();
    return () => unsub?.();
  }, [toast]);

  const enable = async () => {
    setBusy(true);
    try {
      const token = await requestFcmToken();
      if (!token) {
        toast({
          title: "Notifications not enabled",
          description: "Permission was denied or push is unavailable on this device.",
          variant: "destructive",
        });
        setShow(false);
        return;
      }
      await apiRequest("POST", "/api/profile/fcm-token", { token });
      toast({ title: "Notifications enabled", description: "You'll receive real-time alerts." });
      setShow(false);
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch (e: any) {
      toast({ title: "Could not enable notifications", description: e?.message || "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="rounded-xl border border-border bg-card shadow-2xl p-4" data-testid="prompt-notification-permission">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Stay updated in real time</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Get instant alerts for deposits, withdrawals, P2P trades and chat messages.
            </p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={enable} disabled={busy} data-testid="button-enable-notifications">
                {busy ? "Enabling..." : "Enable notifications"}
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss} data-testid="button-dismiss-notifications">
                Not now
              </Button>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
            data-testid="button-close-notification-prompt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
