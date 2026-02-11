import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type Notification } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import { Bell, Check, CheckCheck, CircleAlert, ArrowDownCircle, ArrowUpCircle, ShieldCheck, ShieldX, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";

const NOTIFICATION_SOUND_KEY = "easychange_notification_sound";

const DEFAULT_BEEP_FREQUENCY = 800;
const DEFAULT_BEEP_DURATION = 150;

function playNotificationSound() {
  const soundPref = localStorage.getItem(NOTIFICATION_SOUND_KEY) || "default";
  if (soundPref === "none") return;

  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (soundPref === "soft") {
      oscillator.frequency.value = 600;
      oscillator.type = "sine";
      gainNode.gain.value = 0.15;
    } else if (soundPref === "chime") {
      oscillator.frequency.value = 1200;
      oscillator.type = "sine";
      gainNode.gain.value = 0.12;
    } else {
      oscillator.frequency.value = DEFAULT_BEEP_FREQUENCY;
      oscillator.type = "sine";
      gainNode.gain.value = 0.2;
    }

    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + DEFAULT_BEEP_DURATION / 1000 + 0.1);
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + DEFAULT_BEEP_DURATION / 1000 + 0.1);
  } catch (e) {
  }
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "deposit_approved": return <ArrowDownCircle className="w-4 h-4 text-emerald-500" />;
    case "deposit_rejected": return <ArrowDownCircle className="w-4 h-4 text-red-500" />;
    case "withdrawal_approved": return <ArrowUpCircle className="w-4 h-4 text-emerald-500" />;
    case "withdrawal_rejected": return <ArrowUpCircle className="w-4 h-4 text-red-500" />;
    case "kyc_verified": return <ShieldCheck className="w-4 h-4 text-emerald-500" />;
    case "kyc_rejected": return <ShieldX className="w-4 h-4 text-red-500" />;
    case "custom_message": return <MessageSquare className="w-4 h-4 text-blue-500" />;
    default: return <CircleAlert className="w-4 h-4 text-muted-foreground" />;
  }
}

export function NotificationBell() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const prevCountRef = useRef<number | null>(null);

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: [api.notifications.unreadCount.path],
    refetchInterval: 10000,
  });

  const { data: notificationsData } = useQuery<Notification[]>({
    queryKey: [api.notifications.list.path],
    enabled: open,
  });

  const unreadCount = unreadData?.count || 0;

  useEffect(() => {
    if (prevCountRef.current !== null && unreadCount > prevCountRef.current) {
      playNotificationSound();
    }
    prevCountRef.current = unreadCount;
  }, [unreadCount]);

  const markRead = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", buildUrl(api.notifications.markRead.path, { id }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.notifications.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.notifications.unreadCount.path] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", api.notifications.markAllRead.path);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.notifications.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.notifications.unreadCount.path] });
    },
  });

  const handleOpen = useCallback((isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      queryClient.invalidateQueries({ queryKey: [api.notifications.list.path] });
    }
  }, [queryClient]);

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1" data-testid="badge-notification-count">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="end" sideOffset={8}>
        <div className="flex items-center justify-between gap-2 p-3 border-b border-border">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="text-xs"
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {!notificationsData || notificationsData.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm" data-testid="text-no-notifications">
              No notifications yet
            </div>
          ) : (
            notificationsData.map((notif) => (
              <div
                key={notif.id}
                className={`flex items-start gap-3 p-3 border-b border-border last:border-0 cursor-pointer transition-colors ${
                  notif.isRead ? "opacity-60" : "bg-primary/3"
                }`}
                onClick={() => {
                  if (!notif.isRead) markRead.mutate(notif.id);
                }}
                data-testid={`notification-item-${notif.id}`}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {getNotificationIcon(notif.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm ${notif.isRead ? "" : "font-semibold"}`}>{notif.title}</p>
                    {!notif.isRead && (
                      <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
