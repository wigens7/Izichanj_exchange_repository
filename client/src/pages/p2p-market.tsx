import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useUser } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Store, ShieldOff, AlertTriangle, Ban, Plus, Pause, Play, Trash2,
  Send, Paperclip, MessageSquare, AlertCircle, CheckCircle2, ChevronRight,
  ShieldCheck, Loader2, RefreshCcw, X, Image as ImageIcon, Clock, Check,
  Lock, KeyRound, Settings, MessageCircle, Save, ArrowLeft
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { parseTs, formatTime } from "@/lib/dateUtils";

// ─── Presence Indicator ────────────────────────────────────────────────────
const ONLINE_WINDOW_MS = 2 * 60 * 1000;
function PresenceIndicator({ lastActivity, compact = false }: { lastActivity?: string | Date | null; compact?: boolean }) {
  if (!lastActivity) {
    return compact ? null : <span className="text-[10px] text-muted-foreground">Offline</span>;
  }
  const last = parseTs(lastActivity);
  if (!last) return compact ? null : <span className="text-[10px] text-muted-foreground">Offline</span>;
  const isOnline = Date.now() - last.getTime() < ONLINE_WINDOW_MS;
  if (isOnline) {
    return (
      <span className="inline-flex items-center gap-1" data-testid="presence-online">
        <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20 animate-pulse" />
        {!compact && <span className="text-[10px] text-emerald-500 font-medium">Online</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground" data-testid="presence-offline" title={last.toLocaleString()}>
      <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
      {!compact && <>Last seen {formatDistanceToNow(last as Date, { addSuffix: true })}</>}
    </span>
  );
}

const STATUS_COLORS: Record<string, string> = {
  active: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  paused: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  cancelled: "text-red-400 bg-red-400/10 border-red-400/30",
  completed: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  pending: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  paid: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  released: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  disputed: "text-red-400 bg-red-400/10 border-red-400/30",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${STATUS_COLORS[status] ?? "text-muted-foreground bg-muted border-border"}`}>
      {status}
    </span>
  );
}

function TimeAgo({ date }: { date: string }) {
  const d = parseTs(date);
  return <span className="text-xs text-muted-foreground">{d ? formatDistanceToNow(d, { addSuffix: true }) : ""}</span>;
}

function ExpiryCountdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState<number>(0);
  useEffect(() => {
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      setRemaining(Math.max(0, Math.floor(diff / 1000)));
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const urgent = remaining < 300;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${urgent ? "text-red-400" : "text-yellow-400"}`}>
      <Clock className="w-3 h-3" />
      {remaining > 0 ? `${m}:${String(s).padStart(2, "0")} left` : "Expired"}
    </span>
  );
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="text-center py-12 px-4 border border-dashed border-border rounded-lg my-4">
      <Icon className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export default function P2PMarketPage() {
  const { data: user } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: banData } = useQuery<any>({ queryKey: ["/api/p2p/ban"] });
  const { data: paymentMethods } = useQuery<any>({ queryKey: ["/api/p2p/payment-methods"] });

  const [activeTab, setActiveTab] = useState("marketplace");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showPostAd, setShowPostAd] = useState(false);
  const [showBuyDialog, setShowBuyDialog] = useState<any>(null);

  const isKycVerified = user?.kycStatus === "verified";
  const isBanned = banData?.banned;

  const requireKyc = (action: string) => {
    toast({
      title: "Identity verification required",
      description: `Please complete KYC in your Profile to ${action} on the P2P Market.`,
      variant: "destructive",
    });
  };

  if (isBanned) {
    const until = banData?.bannedUntil ? new Date(banData.bannedUntil) : null;
    return (
      <div className="p-4 space-y-4 max-w-lg mx-auto mt-8">
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="pt-6 text-center space-y-4">
            <Ban className="w-12 h-12 text-red-500 mx-auto" />
            <div>
              <h2 className="text-lg font-semibold">Temporarily Banned</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {banData?.reason ?? "Too many cancellations."}
                {until && <> Banned until <strong>{until.toLocaleString()}</strong>.</>}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Store className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold">P2P Market</h1>
        </div>
        <Button
          size="sm"
          onClick={() => isKycVerified ? setShowPostAd(true) : requireKyc("post an ad")}
          className="gap-2"
          data-testid="button-post-ad"
        >
          <Plus className="w-4 h-4" /> Post Ad
        </Button>
      </div>

      {!isKycVerified && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <ShieldOff className="w-5 h-5 text-yellow-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Identity verification required to trade</p>
              <p className="text-xs text-muted-foreground">You can browse offers below, but you'll need to complete KYC before posting or placing orders.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => window.location.href = "/profile"} className="gap-1 shrink-0" data-testid="button-go-kyc">
              <ShieldCheck className="w-4 h-4" /> Verify
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full" data-testid="p2p-tabs">
          <TabsTrigger value="marketplace" className="flex-1" data-testid="tab-marketplace">Marketplace</TabsTrigger>
          <TabsTrigger value="my-ads" className="flex-1" data-testid="tab-my-ads">My Ads</TabsTrigger>
          <TabsTrigger value="my-orders" className="flex-1" data-testid="tab-my-orders">My Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="marketplace">
          <MarketplaceTab
            onBuy={(ad) => isKycVerified ? setShowBuyDialog(ad) : requireKyc("buy USDT")}
            currentUserId={user?.id}
          />
        </TabsContent>

        <TabsContent value="my-orders">
          <MyOrdersTab onOpen={(order) => setSelectedOrder(order)} currentUserId={user?.id} />
        </TabsContent>

        <TabsContent value="my-ads">
          <MyAdsTab />
        </TabsContent>
      </Tabs>

      {showPostAd && (
        <PostAdDialog
          open={showPostAd}
          onClose={() => setShowPostAd(false)}
          paymentMethodsData={paymentMethods ?? { methods: ["MonCash", "NatCash"], currency: "HTG", group: "HT" }}
          userBalance={parseFloat(user?.balance ?? "0")}
        />
      )}

      {showBuyDialog && (
        <PlaceOrderDialog
          open={!!showBuyDialog}
          ad={showBuyDialog}
          onClose={() => setShowBuyDialog(null)}
          onPlaced={() => { setShowBuyDialog(null); setActiveTab("my-orders"); }}
        />
      )}

      {selectedOrder && (
        <TradeDialog
          open={!!selectedOrder}
          order={selectedOrder}
          currentUserId={user?.id}
          onClose={() => { setSelectedOrder(null); qc.invalidateQueries({ queryKey: ["/api/p2p/orders"] }); }}
        />
      )}
    </div>
  );
}

// ─── Marketplace Tab ───────────────────────────────────────────────────────
function MarketplaceTab({ onBuy, currentUserId }: { onBuy: (ad: any) => void; currentUserId?: number }) {
  const { data: ads, isLoading, refetch } = useQuery<any[]>({ queryKey: ["/api/p2p/ads"] });

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!ads?.length) return <EmptyState icon={Store} message="No ads available right now. Be the first to post one!" />;

  return (
    <div className="space-y-3 mt-2">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => refetch()} className="gap-1 text-xs text-muted-foreground" data-testid="button-refresh-ads">
          <RefreshCcw className="w-3 h-3" /> Refresh
        </Button>
      </div>
      {ads.map((ad) => (
        <AdCard key={ad.id} ad={ad} onBuy={onBuy} isMine={(ad.seller_id ?? ad.sellerId) === currentUserId} />
      ))}
    </div>
  );
}

function AdCard({ ad, onBuy, isMine }: { ad: any; onBuy: (ad: any) => void; isMine: boolean }) {
  const rate = parseFloat(ad.rate_htg ?? ad.rateHtg ?? 0);
  const avail = parseFloat(ad.available_usdt ?? ad.availableUsdt ?? 0);
  const minOrd = parseFloat(ad.min_order_usdt ?? ad.minOrderUsdt ?? 0);
  const maxOrd = parseFloat(ad.max_order_usdt ?? ad.maxOrderUsdt ?? 0);
  const methods: string[] = ad.payment_methods ?? ad.paymentMethods ?? [];
  const sellerName = ad.seller_name ?? ad.sellerName ?? "Seller";
  const termsNote = ad.terms_note ?? ad.terms;
  const currency = ad.currency ?? "HTG";

  return (
    <Card className="border-border hover:border-primary/40 transition-colors" data-testid={`ad-card-${ad.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-semibold text-sm truncate">{sellerName}</span>
              <PresenceIndicator lastActivity={ad.seller_last_activity ?? ad.sellerLastActivity} />
              {isMine && <Badge variant="outline" className="text-[10px] py-0">You</Badge>}
            </div>
            <div className="text-2xl font-bold text-primary">{rate.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">{currency}/USDT</span></div>
            <div className="text-xs text-muted-foreground mt-1">
              Available: <span className="text-foreground font-medium">{avail.toFixed(2)} USDT</span>
              {" · "}Min: <span className="text-foreground">{minOrd.toFixed(0)}</span>
              {" – "}Max: <span className="text-foreground">{maxOrd.toFixed(0)} USDT</span>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {methods.map((m: string) => (
                <span key={m} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] border border-border text-muted-foreground">{m}</span>
              ))}
            </div>
            {termsNote && <p className="text-xs text-muted-foreground mt-2 line-clamp-2 italic">"{termsNote}"</p>}
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <StatusBadge status={ad.status} />
            {!isMine && ad.status === "active" && avail > 0 && (
              <Button size="sm" onClick={() => onBuy(ad)} className="gap-1" data-testid={`button-buy-${ad.id}`}>
                Buy USDT
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Seller Settings Panel ─────────────────────────────────────────────────
function SellerSettingsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: settings } = useQuery<any>({ queryKey: ["/api/p2p/settings"] });
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  const [merchantInput, setMerchantInput] = useState("");
  const [merchantAgreed, setMerchantAgreed] = useState(false);
  const [showMerchantForm, setShowMerchantForm] = useState(false);

  useEffect(() => {
    if (settings?.welcomeMessage !== undefined) setMsg(settings.welcomeMessage);
  }, [settings?.welcomeMessage]);

  const saveMut = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/p2p/settings", { welcomeMessage: msg }),
    onSuccess: () => { toast({ title: "Settings saved", description: "Welcome message updated." }); setOpen(false); },
    onError: () => toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" }),
  });

  const merchantMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/p2p/merchant-name", { merchantName: merchantInput }),
    onSuccess: () => {
      toast({ title: "Merchant name set!", description: `"${merchantInput}" is now your permanent display name.` });
      qc.invalidateQueries({ queryKey: ["/api/p2p/settings"] });
      setShowMerchantForm(false);
      setMerchantInput("");
      setMerchantAgreed(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message ?? "Failed to set merchant name.", variant: "destructive" }),
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-muted/20 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
        data-testid="button-seller-settings"
      >
        <Settings className="w-4 h-4 shrink-0" />
        <span className="flex-1 text-left truncate">
          {settings?.welcomeMessage ? (
            <><span className="text-foreground">Welcome msg: </span>{settings.welcomeMessage}</>
          ) : "Set welcome message for buyers…"}
        </span>
      </button>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Merchant Display Name</span>
            {settings?.merchantName && (
              <Badge className="text-[10px] py-0 px-1.5 bg-emerald-500/20 text-emerald-400 border-emerald-500/30 ml-auto">
                <Lock className="w-2.5 h-2.5 mr-1" /> Locked
              </Badge>
            )}
          </div>

          {settings?.merchantName ? (
            <div className="flex items-center gap-2 bg-muted/30 border border-border rounded-lg px-3 py-2.5">
              <Store className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-semibold text-foreground">{settings.merchantName}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">Visible to buyers only</span>
            </div>
          ) : showMerchantForm ? (
            <div className="space-y-2.5">
              <Input
                value={merchantInput}
                onChange={e => setMerchantInput(e.target.value.slice(0, 60))}
                placeholder="e.g. CryptoExchange HT, MoneyFast, etc."
                maxLength={60}
                className="text-sm"
                data-testid="input-merchant-name"
              />
              <p className="text-[10px] text-muted-foreground">{merchantInput.length}/60 characters — buyers will see this instead of your real name.</p>
              <div className="border border-red-500/30 bg-red-500/10 rounded-lg p-3 space-y-2">
                <p className="text-[11px] font-semibold text-red-300 uppercase tracking-wider">Important — Read Before Saving</p>
                <div className="flex items-start gap-2.5">
                  <Checkbox
                    id="merchant-agree"
                    checked={merchantAgreed}
                    onCheckedChange={(v) => setMerchantAgreed(!!v)}
                    className="mt-0.5 shrink-0 border-red-400 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                    data-testid="checkbox-merchant-agree"
                  />
                  <label htmlFor="merchant-agree" className="text-xs text-red-100/90 leading-relaxed cursor-pointer select-none">
                    I understand that this merchant name is <strong>permanent and cannot be changed</strong> after saving. I agree to this condition.
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => { setShowMerchantForm(false); setMerchantInput(""); setMerchantAgreed(false); }}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => merchantMut.mutate()}
                  disabled={!merchantInput.trim() || !merchantAgreed || merchantMut.isPending}
                  data-testid="button-save-merchant-name"
                >
                  {merchantMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Permanently
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowMerchantForm(true)}
              className="w-full text-left text-xs px-3 py-2.5 rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
              data-testid="button-set-merchant-name"
            >
              + Add a merchant name (optional — shown to buyers instead of your KYC name)
            </button>
          )}
        </div>

        <div className="border-t border-border" />

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Buyer Welcome Message</span>
          </div>
          <Textarea
            value={msg}
            onChange={e => setMsg(e.target.valu