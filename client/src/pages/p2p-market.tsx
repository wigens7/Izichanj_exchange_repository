import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useUser } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Store, ShieldOff, Ban, Plus, ShoppingCart, AlertTriangle, Send,
  ShieldCheck, Loader2, RefreshCcw, Lock, Settings, MessageCircle, Trash2, Pause, Play,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const ONLINE_WINDOW_MS = 2 * 60 * 1000;

function PresenceIndicator({ lastActivity, compact = false }: { lastActivity?: string | Date | null; compact?: boolean }) {
  if (!lastActivity) return compact ? null : <span className="text-[10px] text-muted-foreground">Offline</span>;
  const last = new Date(lastActivity);
  if (isNaN(last.getTime())) return compact ? null : <span className="text-[10px] text-muted-foreground">Offline</span>;
  const isOnline = Date.now() - last.getTime() < ONLINE_WINDOW_MS;

  if (isOnline) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20 animate-pulse" />
        {!compact && <span className="text-[10px] text-emerald-500 font-medium">Online</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
      <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
      {!compact && <>Last seen {formatDistanceToNow(last, { addSuffix: true })}</>}
    </span>
  );
}

const STATUS_COLORS: Record<string, string> = {
  active: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  paused: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  cancelled: "text-red-400 bg-red-400/10 border-red-400/30",
  completed: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  released: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  paid: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  disputed: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  pending: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${STATUS_COLORS[status] ?? "text-muted-foreground bg-muted border-border"}`}>
      {status}
    </span>
  );
}

const num = (v: any) => parseFloat(v ?? 0) || 0;

export default function P2PMarketPage() {
  const { data: user } = useUser();

  const { data: banData } = useQuery<any>({ queryKey: ["/api/p2p/ban"] });
  const [activeTab, setActiveTab] = useState("marketplace");

  const isKycVerified = user?.kycStatus === "verified";
  const isBanned = banData?.banned;

  if (isBanned) {
    return (
      <div className="p-4 space-y-4 max-w-lg mx-auto mt-8">
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="pt-6 text-center space-y-4">
            <Ban className="w-12 h-12 text-red-500 mx-auto" />
            <div>
              <h2 className="text-lg font-semibold">Temporarily Banned</h2>
              <p className="text-sm text-muted-foreground mt-1">{banData?.reason ?? "Account restricted."}</p>
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
        <PostAdButton isKycVerified={isKycVerified} />
      </div>

      {!isKycVerified && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <ShieldOff className="w-5 h-5 text-yellow-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Identity verification required</p>
              <p className="text-xs text-muted-foreground">You can browse ads, but you must verify to buy or sell.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => window.location.href = "/profile"} className="gap-1 shrink-0">
              <ShieldCheck className="w-4 h-4" /> Verify
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="marketplace" className="flex-1 text-xs">Marketplace</TabsTrigger>
          <TabsTrigger value="orders" className="flex-1 text-xs">My Trades</TabsTrigger>
          <TabsTrigger value="my-ads" className="flex-1 text-xs">My Ads</TabsTrigger>
          <TabsTrigger value="seller-settings" className="flex-1 text-xs">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="marketplace">
          <MarketplaceTab currentUserId={user?.id} isKycVerified={isKycVerified} />
        </TabsContent>

        <TabsContent value="orders">
          <MyOrdersTab currentUserId={user?.id} />
        </TabsContent>

        <TabsContent value="my-ads">
          <MyAdsTab />
        </TabsContent>

        <TabsContent value="seller-settings">
          <SellerSettingsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------------------------- Marketplace ---------------------------------- */

function MarketplaceTab({ currentUserId, isKycVerified }: { currentUserId?: number; isKycVerified: boolean }) {
  const { data: ads, isLoading, refetch } = useQuery<any[]>({ queryKey: ["/api/p2p/ads"], refetchInterval: 20000 });

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3 mt-2">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => refetch()} className="gap-1 text-xs text-muted-foreground">
          <RefreshCcw className="w-3 h-3" /> Refresh
        </Button>
      </div>
      {(!ads || ads.length === 0) && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No active ads right now.</CardContent></Card>
      )}
      {ads?.map((ad) => (
        <AdCard
          key={ad.id}
          ad={ad}
          isMine={(ad.seller_id ?? ad.sellerId) === currentUserId}
          isKycVerified={isKycVerified}
        />
      ))}
    </div>
  );
}
function AdCard({ ad, isMine, isKycVerified }: { ad: any; isMine: boolean; isKycVerified: boolean }) {
  const [buyOpen, setBuyOpen] = useState(false);
  const rate = num(ad.rate_htg ?? ad.rateHtg);
  const avail = num(ad.available_usdt ?? ad.availableUsdt);
  const min = num(ad.min_order_usdt ?? ad.minOrderUsdt);
  const max = num(ad.max_order_usdt ?? ad.maxOrderUsdt) || avail;
  const currency = ad.currency || "HTG";

  return (
    <Card className="border-border hover:border-primary/40 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-semibold text-sm truncate">{ad.seller_name ?? "Seller"}</span>
              <PresenceIndicator lastActivity={ad.seller_last_activity} />
              {isMine && <Badge variant="outline" className="text-[10px] py-0">You</Badge>}
            </div>
            <div className="text-2xl font-bold text-primary">{rate.toFixed(2)} {currency}/USDT</div>
            <div className="text-xs text-muted-foreground mt-1">Available: {avail.toFixed(2)} USDT</div>
            <div className="text-xs text-muted-foreground">
              Limits: {min.toFixed(2)} – {max.toFixed(2)} USDT
            </div>
            {ad.terms_note && (
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2 italic">{ad.terms_note}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <StatusBadge status={ad.status} />
            {!isMine && (
              <Button
                size="sm"
                className="gap-1"
                data-testid={`button-buy-ad-${ad.id}`}
                onClick={() => setBuyOpen(true)}
              >
                <ShoppingCart className="w-4 h-4" /> BUY
              </Button>
            )}
          </div>
        </div>

        {buyOpen && (
          <BuyDialog
            ad={ad}
            open={buyOpen}
            onOpenChange={setBuyOpen}
            isKycVerified={isKycVerified}
          />
        )}
      </CardContent>
    </Card>
  );
}

function BuyDialog({ ad, open, onOpenChange, isKycVerified }: {
  ad: any; open: boolean; onOpenChange: (v: boolean) => void; isKycVerified: boolean;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const rate = num(ad.rate_htg ?? ad.rateHtg);
  const avail = num(ad.available_usdt ?? ad.availableUsdt);
  const min = num(ad.min_order_usdt ?? ad.minOrderUsdt);
  const max = num(ad.max_order_usdt ?? ad.maxOrderUsdt) || avail;
  const currency = ad.currency || "HTG";

  const { data: pm } = useQuery<any>({ queryKey: ["/api/p2p/payment-methods"] });
  const adMethods: string[] = Array.isArray(ad.payment_methods)
    ? ad.payment_methods
    : (() => { try { return JSON.parse(ad.payment_methods ?? "[]"); } catch { return []; } })();
  const methods: string[] = (adMethods.length ? adMethods : (pm?.methods ?? [])).map((m: any) =>
    typeof m === "string" ? m : (m?.id ?? m?.name ?? String(m))
  );

  const [amount, setAmount] = useState(min ? String(min) : "");
  const [method, setMethod] = useState<string>("");

  useEffect(() => {
    if (!method && methods.length) setMethod(methods[0]);
  }, [methods.join("|")]);

  const amt = num(amount);
  const total = amt * rate;
  const invalid =
    !isKycVerified || !method || amt <= 0 || amt < min || amt > max || amt > avail;

  const buyMut = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", "/api/p2p/orders", {
        adId: ad.id,
        amountUsdt: amt,
        paymentMethod: method,
      })).json(),
    onSuccess: () => {
      toast({ title: "Order created", description: "Funds are locked in escrow. Open My Trades to pay and chat." });
      qc.invalidateQueries({ queryKey: ["/api/p2p/ads"] });
      qc.invalidateQueries({ queryKey: ["/api/p2p/orders"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Could not create order", description: e?.message ?? "Try again", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Buy USDT from {ad.seller_name ?? "Seller"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Rate</span><span className="font-semibold">{rate.toFixed(2)} {currency}/USDT</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Available</span><span>{avail.toFixed(2)} USDT</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Limits</span><span>{min.toFixed(2)} – {max.toFixed(2)} USDT</span></div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Amount (USDT)</label>
            <Input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Min ${min}`}
              data-testid="input-buy-amount"
            />
            <p className="text-xs text-muted-foreground">
              You pay: <span className="font-semibold text-foreground">{total.toFixed(2)} {currency}</span>
            </p>
          </div>

          {methods.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Payment method</label>
              <div className="flex flex-wrap gap-2">
                {methods.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${
                      method === m ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <Lock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              The seller's USDT is locked in escrow for 60 minutes. Pay, then mark as paid — the seller releases the USDT to your balance.
            </p>
          </div>

          {!isKycVerified && (
            <p className="text-xs text-yellow-500">Verify your identity before trading.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => buyMut.mutate()}
            disabled={invalid || buyMut.isPending}
            data-testid="button-confirm-buy"
            className="gap-1"
          >
            {buyMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
            Confirm Buy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------- Post Ad ---------------------------------- */

function PostAdButton({ isKycVerified }: { isKycVerified: boolean }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: pm } = useQuery<any>({ queryKey: ["/api/p2p/payment-methods"] });

  const [amountUsdt, setAmountUsdt] = useState("");
  const [rateHtg, setRateHtg] = useState("");
  const [minOrderUsdt, setMinOrderUsdt] = useState("10");
  const [maxOrderUsdt, setMaxOrderUsdt] = useState("");
  const [termsNote, setTermsNote] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const methods: string[] = (pm?.methods ?? []).map((m: any) => (typeof m === "string" ? m : (m?.id ?? m?.name ?? String(m))));
  const currency = pm?.currency || "HTG";

  const createMut = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", "/api/p2p/ads", {
        amountUsdt: num(amountUsdt),
        rateHtg: num(rateHtg),
        currency,
        paymentMethods: selected,
        minOrderUsdt: num(minOrderUsdt),
        maxOrderUsdt: maxOrderUsdt ? num(maxOrderUsdt) : undefined,
        termsNote: termsNote || undefined,
      })).json(),
    onSuccess: () => {
      toast({ title: "Ad posted", description: "Your USDT is locked and listed on the marketplace." });
      qc.invalidateQueries({ queryKey: ["/api/p2p/ads"] });
      qc.invalidateQueries({ queryKey: ["/api/p2p/ads/my"] });
      setOpen(false);
      setAmountUsdt(""); setRateHtg(""); setTermsNote("");
    },
    onError: (e: any) => toast({ title: "Could not post ad", description: e?.message ?? "Try again", variant: "destructive" }),
  });

  const invalid = !isKycVerified || num(amountUsdt) < 10 || num(rateHtg) <= 0 || selected.length === 0;

  return (
    <>
      <Button size="sm" className="gap-2" onClick={() => setOpen(true)} data-testid="button-post-ad">
        <Plus className="w-4 h-4" /> Post Ad
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Sell USDT — Post an Ad</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Amount (USDT)</label>
                <Input type="number" inputMode="decimal" value={amountUsdt} onChange={(e) => setAmountUsdt(e.target.value)} placeholder="Min 10" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Rate ({currency}/USDT)</label>
                <Input type="number" inputMode="decimal" value={rateHtg} onChange={(e) => setRateHtg(e.target.value)} placeholder="e.g. 140" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Min order</label>
                <Input type="number" inputMode="decimal" value={minOrderUsdt} onChange={(e) => setMinOrderUsdt(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Max order</label>
                <Input type="number" inputMode="decimal" value={maxOrderUsdt} onChange={(e) => setMaxOrderUsdt(e.target.value)} placeholder="Optional" />
              </div>
            </div>

            {methods.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Payment methods you accept</label>
                <div className="flex flex-wrap gap-2">
                  {methods.map((m) => {
                    const on = selected.includes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setSelected(on ? selected.filter((x) => x !== m) : [...selected, m])}
                        className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${
                          on ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground"
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Terms (optional)</label>
              <Textarea rows={2} value={termsNote} onChange={(e) => setTermsNote(e.target.value)} placeholder="e.g. MonCash only, send within 15 min." />
            </div>
            {!isKycVerified && <p className="text-xs text-yellow-500">Verify your identity before selling.</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => createMut.mutate()} disabled={invalid || createMut.isPending}>
              {createMut.isPending ? "Posting..." : "Post Ad"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ---------------------------------- My Ads ---------------------------------- */

function MyAdsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: ads, isLoading } = useQuery<any[]>({ queryKey: ["/api/p2p/ads/my"] });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/api/p2p/ads/my"] });
    qc.invalidateQueries({ queryKey: ["/api/p2p/ads"] });
  };

  const pauseMut = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/p2p/ads/${id}/toggle-pause`),
    onSuccess: () => { toast({ title: "Ad updated" }); invalidate(); },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const cancelMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/p2p/ads/${id}`),
    onSuccess: () => { toast({ title: "Ad cancelled", description: "Locked USDT refunded to your balance." }); invalidate(); },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!ads?.length) return <Card className="mt-3"><CardContent className="py-10 text-center text-sm text-muted-foreground">You have no ads yet.</CardContent></Card>;

  return (
    <div className="space-y-3 mt-3">
      {ads.map((ad) => (
        <Card key={ad.id}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-lg font-bold text-primary">{num(ad.rate_htg).toFixed(2)} {ad.currency || "HTG"}/USDT</div>
                <div className="text-xs text-muted-foreground">Available: {num(ad.available_usdt).toFixed(2)} USDT</div>
              </div>
              <StatusBadge status={ad.status} />
            </div>
            {ad.status !== "cancelled" && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-1" onClick={() => pauseMut.mutate(ad.id)}>
                  {ad.status === "active" ? <><Pause className="w-3 h-3" /> Pause</> : <><Play className="w-3 h-3" /> Resume</>}
                </Button>
                <Button size="sm" variant="outline" className="gap-1 text-red-500" onClick={() => cancelMut.mutate(ad.id)}>
                  <Trash2 className="w-3 h-3" /> Cancel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
/* ---------------------------------- My Orders ---------------------------------- */

function MyOrdersTab({ currentUserId }: { currentUserId?: number }) {
  const { data: orders, isLoading } = useQuery<any[]>({ queryKey: ["/api/p2p/orders"], refetchInterval: 15000 });
  const [openOrder, setOpenOrder] = useState<any | null>(null);

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!orders?.length) return <Card className="mt-3"><CardContent className="py-10 text-center text-sm text-muted-foreground">No trades yet. Buy USDT from the marketplace.</CardContent></Card>;

  return (
    <div className="space-y-3 mt-3">
      {orders.map((o) => {
        const isBuyer = o.buyer_id === currentUserId;
        return (
          <Card key={o.id} className="cursor-pointer hover:border-primary/40" onClick={() => setOpenOrder(o)}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] py-0">{isBuyer ? "Buying" : "Selling"}</Badge>
                    <span className="text-xs text-muted-foreground">#{o.order_id}</span>
                  </div>
                  <div className="text-lg font-bold mt-1">{num(o.amount_usdt).toFixed(2)} USDT</div>
                  <div className="text-xs text-muted-foreground">
                    {num(o.amount_local ?? o.total_htg).toFixed(2)} {o.currency || "HTG"} · {o.payment_method}
                  </div>
                </div>
                <StatusBadge status={o.status} />
              </div>
            </CardContent>
          </Card>
        );
      })}
      {openOrder && (
        <OrderDialog
          order={openOrder}
          isBuyer={openOrder.buyer_id === currentUserId}
          currentUserId={currentUserId}
          onClose={() => setOpenOrder(null)}
        />
      )}
    </div>
  );
}

function OrderDialog({ order, isBuyer, currentUserId, onClose }: {
  order: any; isBuyer: boolean; currentUserId?: number; onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [pin, setPin] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState("");
  const [chatText, setChatText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const { data: live } = useQuery<any[]>({ queryKey: ["/api/p2p/orders"], refetchInterval: 10000 });
  const current = live?.find((o) => o.id === order.id) ?? order;

  const { data: messages } = useQuery<any[]>({
    queryKey: [`/api/p2p/orders/${order.id}/chat`],
    refetchInterval: 5000,
  });

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages?.length]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/api/p2p/orders"] });
    qc.invalidateQueries({ queryKey: [`/api/p2p/orders/${order.id}/chat`] });
  };
  const fail = (e: any) => toast({ title: "Action failed", description: e?.message ?? "Try again", variant: "destructive" });

  const payMut = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/p2p/orders/${order.id}/pay`, {}),
    onSuccess: () => { toast({ title: "Marked as paid", description: "The seller has been notified." }); invalidate(); },
    onError: fail,
  });

  const releaseMut = useMutation({
    mutationFn: () =>
      pin
        ? apiRequest("POST", `/api/p2p/orders/${order.id}/release-pin`, { pin })
        : apiRequest("PATCH", `/api/p2p/orders/${order.id}/release`, { confirmedReceipt: true }),
    onSuccess: () => { toast({ title: "USDT released", description: "Escrow released to the buyer." }); setPin(""); invalidate(); },
    onError: fail,
  });

  const cancelMut = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/p2p/orders/${order.id}/cancel`, { reason: reason || "Cancelled by user" }),
    onSuccess: () => { toast({ title: "Trade cancelled" }); invalidate(); onClose(); },
    onError: fail,
  });

  const disputeMut = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/p2p/orders/${order.id}/dispute`, { reason: reason || "Payment issue" }),
    onSuccess: () => { toast({ title: "Dispute opened", description: "Support has been notified." }); invalidate(); },
    onError: fail,
  });

  const chatMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/p2p/orders/${order.id}/chat`, { message: chatText }),
    onSuccess: () => { setChatText(""); qc.invalidateQueries({ queryKey: [`/api/p2p/orders/${order.id}/chat`] }); },
    onError: fail,
  });

  const status = current.status;
  const closed = ["released", "cancelled", "completed"].includes(status);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            Trade #{current.order_id} <StatusBadge status={status} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-semibold">{num(current.amount_usdt).toFixed(2)} USDT</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total to pay</span><span className="font-semibold">{num(current.amount_local ?? current.total_htg).toFixed(2)} {current.currency || "HTG"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Rate</span><span>{num(current.rate ?? current.rate_htg).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Payment</span><span>{current.payment_method}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{isBuyer ? "Seller" : "Buyer"}</span><span>{isBuyer ? current.seller_name : current.buyer_name}</span></div>
          </div>

          {/* Escrow chat */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium"><MessageCircle className="w-3.5 h-3.5 text-primary" /> Escrow chat</div>
            <div className="max-h-52 overflow-y-auto space-y-2 rounded-lg border border-border p-2">
              {messages?.length ? messages.map((m) => (
                <div key={m.id} className={`text-xs ${m.sender_id === currentUserId ? "text-right" : "text-left"}`}>
                  <div className={`inline-block rounded-lg px-2.5 py-1.5 ${m.sender_id === currentUserId ? "bg-primary/15" : "bg-muted"}`}>
                    {m.message}
                  </div>
                </div>
              )) : <p className="text-xs text-muted-foreground text-center py-4">No messages yet.</p>}
              <div ref={endRef} />
            </div>
            {!closed && (
              <div className="flex gap-2">
                <Input value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="Write a message..." />
                <Button size="sm" onClick={() => chatMut.mutate()} disabled={!chatText.trim() || chatMut.isPending}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Actions */}
          {!closed && (
            <div className="space-y-2 border-t border-border pt-3">
              {isBuyer && status === "pending" && (
                <Button className="w-full" onClick={() => payMut.mutate()} disabled={payMut.isPending} data-testid="button-mark-paid">
                  {payMut.isPending ? "Saving..." : "I have paid"}
                </Button>
              )}

              {!isBuyer && status === "paid" && (
                <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <div className="flex items-start gap-2">
                    <Checkbox id="confirm-receipt" checked={confirmed} onCheckedChange={(v) => setConfirmed(!!v)} />
                    <label htmlFor="confirm-receipt" className="text-xs text-muted-foreground">
                      I confirm I received {num(current.amount_local ?? current.total_htg).toFixed(2)} {current.currency || "HTG"}.
                    </label>
                  </div>
                  <Input
                    type="password"
                    inputMode="numeric"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="Withdrawal PIN (if set)"
                  />
                  <Button className="w-full gap-1" onClick={() => releaseMut.mutate()} disabled={!confirmed || releaseMut.isPending}>
                    <Lock className="w-4 h-4" /> {releaseMut.isPending ? "Releasing..." : "Release USDT"}
                  </Button>
                </div>
              )}

              <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (for cancel or dispute)" />
              <div className="flex gap-2">
                {status === "pending" && (
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending}>
                    Cancel trade
                  </Button>
                )}
                {status !== "disputed" && (
                  <Button variant="outline" size="sm" className="flex-1 gap-1 text-orange-500" onClick={() => disputeMut.mutate()} disabled={disputeMut.isPending}>
                    <AlertTriangle className="w-3 h-3" /> Dispute
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
/* ---------------------------------- Seller settings ---------------------------------- */

function SellerSettingsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: settings } = useQuery<any>({ queryKey: ["/api/p2p/settings"] });

  const [msg, setMsg] = useState("");
  const [merchantInput, setMerchantInput] = useState("");
  const [merchantAgreed, setMerchantAgreed] = useState(false);
  const [showMerchantForm, setShowMerchantForm] = useState(false);

  useEffect(() => {
    if (settings?.welcomeMessage) setMsg(settings.welcomeMessage);
  }, [settings?.welcomeMessage]);

  const saveMut = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/p2p/settings", { welcomeMessage: msg }),
    onSuccess: () => toast({ title: "Settings saved", description: "Welcome message updated." }),
  });

  const merchantMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/p2p/merchant-name", { merchantName: merchantInput }),
    onSuccess: () => {
      toast({ title: "Merchant name set!" });
      qc.invalidateQueries({ queryKey: ["/api/p2p/settings"] });
      setShowMerchantForm(false);
    },
  });

  return (
    <Card className="border-primary/20 bg-primary/5 mt-3">
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
              <span className="text-sm font-semibold text-foreground">{settings.merchantName}</span>
            </div>
          ) : showMerchantForm ? (
            <div className="space-y-2.5">
              <Input
                value={merchantInput}
                onChange={e => setMerchantInput(e.target.value.slice(0, 60))}
                placeholder="Merchant name..."
              />
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="merchant-agree"
                  checked={merchantAgreed}
                  onCheckedChange={(v) => setMerchantAgreed(!!v)}
                />
                <label htmlFor="merchant-agree" className="text-xs text-muted-foreground">
                  I understand this is permanent.
                </label>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowMerchantForm(false)}>Cancel</Button>
                <Button size="sm" onClick={() => merchantMut.mutate()} disabled={!merchantInput.trim() || !merchantAgreed}>
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowMerchantForm(true)}>+ Add merchant name</Button>
          )}
        </div>

        <div className="border-t border-border" />

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Buyer Welcome Message</span>
          </div>
          <Textarea
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="e.g. Welcome! Transfer via MonCash..."
            rows={3}
          />
          <Button
            size="sm"
            className="w-full mt-2"
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
          >
            {saveMut.isPending ? "Saving..." : "Save Welcome Message"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}