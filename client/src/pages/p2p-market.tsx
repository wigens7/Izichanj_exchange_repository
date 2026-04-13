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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Store, ShieldOff, AlertTriangle, Ban, Plus, Pause, Play, Trash2,
  Send, Paperclip, MessageSquare, AlertCircle, CheckCircle2, ChevronRight,
  ShieldCheck, Loader2, RefreshCcw, X, Image as ImageIcon, Clock, Check
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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
  return <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(date), { addSuffix: true })}</span>;
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

  if (!isKycVerified) {
    return (
      <div className="p-4 space-y-4 max-w-lg mx-auto mt-8">
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="pt-6 text-center space-y-4">
            <ShieldOff className="w-12 h-12 text-yellow-500 mx-auto" />
            <div>
              <h2 className="text-lg font-semibold">KYC Required</h2>
              <p className="text-sm text-muted-foreground mt-1">
                You must complete identity verification to access the P2P Market.
                Go to your Profile to submit KYC documents.
              </p>
            </div>
            <Button variant="outline" onClick={() => window.location.href = "/profile"} className="gap-2">
              <ShieldCheck className="w-4 h-4" /> Go to Profile
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
        <Button size="sm" onClick={() => setShowPostAd(true)} className="gap-2" data-testid="button-post-ad">
          <Plus className="w-4 h-4" /> Post Ad
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full" data-testid="p2p-tabs">
          <TabsTrigger value="marketplace" className="flex-1" data-testid="tab-marketplace">Marketplace</TabsTrigger>
          <TabsTrigger value="my-ads" className="flex-1" data-testid="tab-my-ads">My Ads</TabsTrigger>
          <TabsTrigger value="my-orders" className="flex-1" data-testid="tab-my-orders">My Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="marketplace">
          <MarketplaceTab onBuy={(ad) => setShowBuyDialog(ad)} currentUserId={user?.id} />
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
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm truncate">{sellerName}</span>
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

// ─── My Ads Tab ────────────────────────────────────────────────────────────
function MyAdsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: ads, isLoading } = useQuery<any[]>({ queryKey: ["/api/p2p/ads/my"] });

  const pauseMut = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/p2p/ads/${id}/toggle-pause`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/p2p/ads/my"] }); toast({ title: "Ad updated" }); },
    onError: () => toast({ title: "Error", description: "Failed to update ad.", variant: "destructive" }),
  });

  const cancelMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/p2p/ads/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/p2p/ads/my"] }); toast({ title: "Ad cancelled", description: "Funds returned to your balance." }); },
    onError: (e: any) => toast({ title: "Error", description: e?.message ?? "Failed to cancel ad.", variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!ads?.length) return <EmptyState icon={Plus} message="You have no ads yet. Post one to start selling USDT." />;

  return (
    <div className="space-y-3 mt-2">
      {ads.map((ad) => (
        <Card key={ad.id} className="border-border" data-testid={`my-ad-${ad.id}`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-lg font-bold text-primary">{parseFloat(ad.rate_htg ?? ad.rateHtg ?? 0).toFixed(2)} HTG/USDT</div>
                <div className="text-xs text-muted-foreground">
                  Total: {parseFloat(ad.total_usdt ?? ad.totalUsdt ?? 0).toFixed(2)} · Available: {parseFloat(ad.available_usdt ?? ad.availableUsdt ?? 0).toFixed(2)} USDT
                </div>
                <div className="text-xs text-muted-foreground">Min {parseFloat(ad.min_order_usdt ?? ad.minOrderUsdt ?? 0).toFixed(0)} – Max {parseFloat(ad.max_order_usdt ?? ad.maxOrderUsdt ?? 0).toFixed(0)} USDT</div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {((ad.payment_methods ?? ad.paymentMethods) ?? []).map((m: string) => (
                    <span key={m} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] border border-border text-muted-foreground">{m}</span>
                  ))}
                </div>
                <TimeAgo date={ad.created_at ?? ad.createdAt} />
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <StatusBadge status={ad.status} />
                <div className="flex gap-1.5">
                  {(ad.status === "active" || ad.status === "paused") && (
                    <>
                      <Button
                        variant="outline" size="icon" className="h-7 w-7"
                        onClick={() => pauseMut.mutate(ad.id)}
                        disabled={pauseMut.isPending}
                        title={ad.status === "active" ? "Pause" : "Resume"}
                        data-testid={`button-pause-${ad.id}`}
                      >
                        {ad.status === "active" ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                      </Button>
                      <Button
                        variant="outline" size="icon" className="h-7 w-7 hover:border-destructive hover:text-destructive"
                        onClick={() => cancelMut.mutate(ad.id)}
                        disabled={cancelMut.isPending}
                        title="Cancel ad"
                        data-testid={`button-cancel-ad-${ad.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── My Orders Tab ─────────────────────────────────────────────────────────
function MyOrdersTab({ onOpen, currentUserId }: { onOpen: (order: any) => void; currentUserId?: number }) {
  const { data: orders, isLoading } = useQuery<any[]>({ queryKey: ["/api/p2p/orders"] });

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!orders?.length) return <EmptyState icon={MessageSquare} message="No orders yet. Buy USDT from the Marketplace." />;

  return (
    <div className="space-y-3 mt-2">
      {orders.map((order) => {
        const isBuyer = (order.buyer_id ?? order.buyerId) === currentUserId;
        const currency = order.currency ?? "HTG";
        const expiresAt = order.expires_at ?? order.expiresAt;
        const isPending = order.status === "pending";
        return (
          <Card key={order.id} className="border-border hover:border-primary/30 transition-colors cursor-pointer" onClick={() => onOpen(order)} data-testid={`order-card-${order.id}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold">{parseFloat(order.amount_usdt ?? order.amountUsdt ?? 0).toFixed(2)} USDT</span>
                    <Badge variant="outline" className="text-[10px] py-0">{isBuyer ? "Buying" : "Selling"}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Rate: {parseFloat(order.rate_htg ?? order.rateHtg ?? 0).toFixed(2)} {currency} · Total: {parseFloat(order.total_htg ?? order.totalHtg ?? 0).toFixed(2)} {currency}
                  </div>
                  <div className="text-xs text-muted-foreground">via {order.payment_method ?? order.paymentMethod}</div>
                  {isPending && expiresAt && <ExpiryCountdown expiresAt={expiresAt} />}
                  {!isPending && <TimeAgo date={order.created_at ?? order.createdAt} />}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={order.status} />
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Post Ad Dialog ─────────────────────────────────────────────────────────
function PostAdDialog({ open, onClose, paymentMethodsData, userBalance }: {
  open: boolean; onClose: () => void;
  paymentMethodsData: { methods: string[]; currency: string; group: string };
  userBalance: number;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [rateHtg, setRateHtg] = useState("139.50");
  const [totalUsdt, setTotalUsdt] = useState("");
  const [minOrder, setMinOrder] = useState("10");
  const [maxOrder, setMaxOrder] = useState("500");
  const [selectedMethods, setSelectedMethods] = useState<string[]>([]);
  const [terms, setTerms] = useState("");

  const methods = paymentMethodsData.methods.length ? paymentMethodsData.methods : ["MonCash", "NatCash"];
  const currency = paymentMethodsData.currency ?? "HTG";
  const group = paymentMethodsData.group ?? "HT";
  const isHaiti = group === "HT";

  const createMut = useMutation({
    mutationFn: (body: any) => apiRequest("POST", "/api/p2p/ads", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/p2p/ads"] });
      qc.invalidateQueries({ queryKey: ["/api/p2p/ads/my"] });
      toast({ title: "Ad posted!", description: "Funds locked in escrow until orders complete." });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message ?? "Failed to post ad.", variant: "destructive" }),
  });

  const toggleMethod = (m: string) => {
    setSelectedMethods(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  const submit = () => {
    const amt = parseFloat(totalUsdt);
    const rate = parseFloat(rateHtg);
    const min = parseFloat(minOrder);
    const max = parseFloat(maxOrder);
    if (!amt || amt <= 0) return toast({ title: "Enter a valid amount.", variant: "destructive" });
    if (amt > userBalance) return toast({ title: "Insufficient balance.", description: `You have ${userBalance.toFixed(2)} USDT.`, variant: "destructive" });
    if (isHaiti && (!rate || rate < 130 || rate > 145)) return toast({ title: "Rate must be 130–145 HTG/USDT for Haiti.", variant: "destructive" });
    if (!isHaiti && !rate) return toast({ title: "Enter a rate.", variant: "destructive" });
    if (!selectedMethods.length) return toast({ title: "Select at least one payment method.", variant: "destructive" });
    if (!min || !max || min >= max) return toast({ title: "Min must be less than max.", variant: "destructive" });
    createMut.mutate({ rateHtg: rate, amountUsdt: amt, minOrderUsdt: min, maxOrderUsdt: max, paymentMethods: selectedMethods, termsNote: terms });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto" data-testid="dialog-post-ad">
        <DialogHeader>
          <DialogTitle>Post Sell Ad</DialogTitle>
          <DialogDescription>Lock USDT and sell at your preferred rate. Currency: {currency}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {isHaiti && (
            <Alert className="border-yellow-500/30 bg-yellow-500/5">
              <AlertCircle className="w-4 h-4 text-yellow-500" />
              <AlertDescription className="text-xs">Rate must be between 130–145 HTG/USDT for Haiti market.</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Rate ({currency}/USDT)</Label>
              <Input type="number" value={rateHtg} onChange={e => setRateHtg(e.target.value)} step="0.01" data-testid="input-rate-htg" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Total USDT to sell</Label>
              <Input type="number" value={totalUsdt} onChange={e => setTotalUsdt(e.target.value)} placeholder={`Max ${userBalance.toFixed(2)}`} data-testid="input-total-usdt" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Min order (USDT)</Label>
              <Input type="number" value={minOrder} onChange={e => setMinOrder(e.target.value)} data-testid="input-min-order" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Max order (USDT)</Label>
              <Input type="number" value={maxOrder} onChange={e => setMaxOrder(e.target.value)} data-testid="input-max-order" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Payment Methods <span className="text-muted-foreground font-normal">(for {currency} market)</span></Label>
            <div className="flex flex-wrap gap-2">
              {methods.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMethod(m)}
                  className={`px-2.5 py-1 rounded text-xs border transition-colors ${selectedMethods.includes(m) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-muted-foreground"}`}
                  data-testid={`method-${m.replace(/\s/g, "-").toLowerCase()}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Trade Terms (optional)</Label>
            <Textarea value={terms} onChange={e => setTerms(e.target.value)} placeholder="e.g. Payment within 15 minutes. No partial payments." rows={2} className="text-sm resize-none" data-testid="textarea-terms" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={createMut.isPending} data-testid="button-submit-ad">
            {createMut.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Posting…</> : "Post Ad"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Place Order Dialog ─────────────────────────────────────────────────────
function PlaceOrderDialog({ open, ad, onClose, onPlaced }: { open: boolean; ad: any; onClose: () => void; onPlaced: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const methods: string[] = ad.payment_methods ?? ad.paymentMethods ?? [];
  const rate = parseFloat(ad.rate_htg ?? ad.rateHtg ?? 0);
  const minOrd = parseFloat(ad.min_order_usdt ?? ad.minOrderUsdt ?? 10);
  const maxOrd = Math.min(parseFloat(ad.max_order_usdt ?? ad.maxOrderUsdt ?? 500), parseFloat(ad.available_usdt ?? ad.availableUsdt ?? 0));
  const sellerName = ad.seller_name ?? ad.sellerName ?? "Seller";
  const termsNote = ad.terms_note ?? ad.terms;

  const [amount, setAmount] = useState(String(minOrd));
  const [method, setMethod] = useState(methods[0] ?? "");

  const currency = ad.currency ?? "HTG";
  const amtNum = parseFloat(amount) || 0;
  const totalHtg = (amtNum * rate).toFixed(2);
  const min = minOrd;
  const max = maxOrd;

  const createMut = useMutation({
    mutationFn: (body: any) => apiRequest("POST", "/api/p2p/orders", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/p2p/orders"] });
      qc.invalidateQueries({ queryKey: ["/api/p2p/ads"] });
      toast({ title: "Order placed!", description: "Send payment and mark it paid in the trade chat." });
      onPlaced();
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message ?? "Failed to place order.", variant: "destructive" }),
  });

  const submit = () => {
    if (amtNum < min || amtNum > max) return toast({ title: `Amount must be ${min}–${max} USDT.`, variant: "destructive" });
    if (!method) return toast({ title: "Select a payment method.", variant: "destructive" });
    createMut.mutate({ adId: ad.id, amountUsdt: amtNum, paymentMethod: method });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm" data-testid="dialog-buy">
        <DialogHeader>
          <DialogTitle>Buy USDT</DialogTitle>
          <DialogDescription>Rate: {rate.toFixed(2)} HTG/USDT from {sellerName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Amount (USDT)</Label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={min} max={max} step="0.01" data-testid="input-buy-amount" />
            <p className="text-xs text-muted-foreground">Range: {min} – {max} USDT</p>
          </div>
          <div className="rounded-lg border border-border p-3 space-y-1.5">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">You pay</span><span className="font-semibold text-primary">{totalHtg} {currency}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">You receive</span><span className="font-semibold">{amtNum.toFixed(2)} USDT</span></div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Payment Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger data-testid="select-payment-method"><SelectValue placeholder="Select method" /></SelectTrigger>
              <SelectContent>
                {methods.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {termsNote && (
            <Alert className="border-blue-500/30 bg-blue-500/5">
              <AlertCircle className="w-4 h-4 text-blue-400" />
              <AlertDescription className="text-xs italic">"{termsNote}"</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={createMut.isPending} data-testid="button-confirm-buy">
            {createMut.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Placing…</> : "Place Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Trade Dialog ──────────────────────────────────────────────────────────
function TradeDialog({ open, order, currentUserId, onClose }: { open: boolean; order: any; currentUserId?: number; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [chatMsg, setChatMsg] = useState("");
  const [releaseChecked, setReleaseChecked] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [showDispute, setShowDispute] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isBuyer = (order.buyer_id ?? order.buyerId) === currentUserId;
  const isSeller = (order.seller_id ?? order.sellerId) === currentUserId;
  const orderId = order.id;
  const currency = order.currency ?? "HTG";
  const expiresAt = order.expires_at ?? order.expiresAt;

  const { data: chat, refetch: refetchChat } = useQuery<any[]>({
    queryKey: ["/api/p2p/orders", orderId, "chat"],
    queryFn: () => fetch(`/api/p2p/orders/${orderId}/chat`, { credentials: "include" }).then(r => r.json()),
    refetchInterval: 4000,
  });

  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  const sendMsg = useMutation({
    mutationFn: (body: any) => apiRequest("POST", `/api/p2p/orders/${orderId}/chat`, body),
    onSuccess: () => { setChatMsg(""); refetchChat(); },
    onError: () => toast({ title: "Failed to send message.", variant: "destructive" }),
  });

  const markPaidMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/p2p/orders/${orderId}/pay`),
    onSuccess: () => { toast({ title: "Marked as paid!" }); qc.invalidateQueries({ queryKey: ["/api/p2p/orders"] }); onClose(); },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const releaseMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/p2p/orders/${orderId}/release`, { confirmedReceipt: true }),
    onSuccess: () => { toast({ title: "Funds released!", description: "Trade complete." }); qc.invalidateQueries({ queryKey: ["/api/p2p/orders"] }); onClose(); },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const cancelMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/p2p/orders/${orderId}/cancel`),
    onSuccess: () => { toast({ title: "Order cancelled." }); qc.invalidateQueries({ queryKey: ["/api/p2p/orders"] }); onClose(); },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const disputeMut = useMutation({
    mutationFn: (body: any) => apiRequest("POST", `/api/p2p/orders/${orderId}/dispute`, body),
    onSuccess: () => { toast({ title: "Dispute opened.", description: "Admin has been notified." }); qc.invalidateQueries({ queryKey: ["/api/p2p/orders"] }); onClose(); },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const handleSend = () => {
    const msg = chatMsg.trim();
    if (!msg) return;
    sendMsg.mutate({ message: msg });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData, credentials: "include" });
      const data = await res.json();
      if (data.url) sendMsg.mutate({ message: "", fileUrl: data.url });
    } catch {
      toast({ title: "Upload failed.", variant: "destructive" });
    }
    e.target.value = "";
  };

  const isActive = ["pending", "paid"].includes(order.status);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm max-h-[90vh] flex flex-col p-0" data-testid="dialog-trade">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h3 className="font-semibold text-sm">Trade #{order.id}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusBadge status={order.status} />
              <span className="text-xs text-muted-foreground">{isBuyer ? "Buying" : "Selling"}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        {/* Trade details */}
        <div className="px-4 py-2 bg-muted/20 border-b border-border">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Amount</p>
              <p className="font-semibold text-sm">{parseFloat(order.amount_usdt ?? order.amountUsdt ?? 0).toFixed(2)} USDT</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rate</p>
              <p className="font-semibold text-sm">{parseFloat(order.rate_htg ?? order.rateHtg ?? 0).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="font-semibold text-sm text-primary">{parseFloat(order.total_htg ?? order.totalHtg ?? order.amount_local ?? 0).toFixed(2)} {currency}</p>
            </div>
          </div>
          <p className="text-xs text-center text-muted-foreground mt-1">via {order.payment_method ?? order.paymentMethod}</p>
          {order.status === "pending" && expiresAt && (
            <div className="flex justify-center mt-1.5">
              <ExpiryCountdown expiresAt={expiresAt} />
            </div>
          )}
        </div>

        {/* Chat */}
        <ScrollArea className="flex-1 min-h-0 px-4 py-2" style={{ maxHeight: "240px" }}>
          <div className="space-y-2">
            {(!chat || chat.length === 0) && (
              <p className="text-xs text-center text-muted-foreground py-4">No messages yet. Coordinate your payment here.</p>
            )}
            {chat?.map((msg: any) => {
              const isMe = (msg.sender_id ?? msg.senderId) === currentUserId;
              const fileUrl = msg.file_url ?? msg.fileUrl;
              const msgDate = msg.created_at ?? msg.createdAt;
              const readAt = msg.read_at ?? msg.readAt;
              return (
                <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${isMe ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    {msg.message && <p className="break-words">{msg.message}</p>}
                    {fileUrl && (
                      <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs underline mt-1">
                        <ImageIcon className="w-3 h-3" /> View attachment
                      </a>
                    )}
                    <div className={`flex items-center gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
                      <span className={`text-[10px] ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {msgDate ? formatDistanceToNow(new Date(msgDate), { addSuffix: true }) : ""}
                      </span>
                      {isMe && (
                        readAt
                          ? <span className="inline-flex text-[10px] text-primary-foreground/80" title={`Read ${formatDistanceToNow(new Date(readAt), { addSuffix: true })}`}>
                              <Check className="w-2.5 h-2.5" /><Check className="w-2.5 h-2.5 -ml-1.5" />
                            </span>
                          : <Check className="w-2.5 h-2.5 text-primary-foreground/50" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={chatBottomRef} />
          </div>
        </ScrollArea>

        {/* Chat input */}
        {isActive && (
          <div className="flex gap-2 px-4 py-2 border-t border-border">
            <input type="file" ref={fileRef} accept="image/*" className="hidden" onChange={handleFileUpload} />
            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => fileRef.current?.click()} data-testid="button-attach-file">
              <Paperclip className="w-4 h-4 text-muted-foreground" />
            </Button>
            <Input
              value={chatMsg}
              onChange={e => setChatMsg(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSend()}
              placeholder="Type a message…"
              className="h-8 text-sm"
              data-testid="input-chat-message"
            />
            <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleSend} disabled={sendMsg.isPending} data-testid="button-send-message">
              {sendMsg.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            </Button>
          </div>
        )}

        {/* Action buttons */}
        <div className="p-4 border-t border-border space-y-3">
          {/* Buyer actions */}
          {isBuyer && order.status === "pending" && (
            <Button className="w-full" onClick={() => markPaidMut.mutate()} disabled={markPaidMut.isPending} data-testid="button-mark-paid">
              {markPaidMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              I've Sent Payment
            </Button>
          )}
          {isBuyer && order.status === "paid" && (
            <p className="text-xs text-center text-muted-foreground">Waiting for seller to confirm receipt and release funds…</p>
          )}

          {/* Seller actions */}
          {isSeller && order.status === "pending" && (
            <p className="text-xs text-center text-muted-foreground">Waiting for buyer to send payment…</p>
          )}
          {isSeller && order.status === "paid" && (
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Checkbox id="release-confirm" checked={releaseChecked} onCheckedChange={(v) => setReleaseChecked(!!v)} data-testid="checkbox-release" />
                <label htmlFor="release-confirm" className="text-xs text-muted-foreground cursor-pointer leading-relaxed">
                  I confirm that I have manually verified the receipt of <strong>{parseFloat(order.total_htg ?? order.totalHtg ?? order.amount_local ?? 0).toFixed(2)} {currency}</strong> in my <strong>{order.payment_method ?? order.paymentMethod}</strong> account.
                </label>
              </div>
              <Button className="w-full" onClick={() => releaseMut.mutate()} disabled={!releaseChecked || releaseMut.isPending} data-testid="button-release-funds">
                {releaseMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                Release USDT to Buyer
              </Button>
            </div>
          )}

          {/* Cancel + Dispute */}
          {isActive && (
            <div className="flex gap-2">
              <Button
                variant="outline" size="sm" className="flex-1 text-xs"
                onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending}
                data-testid="button-cancel-order"
              >
                {cancelMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Cancel Order"}
              </Button>
              <Button
                variant="outline" size="sm" className="flex-1 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                onClick={() => setShowDispute(true)}
                data-testid="button-dispute-order"
              >
                <AlertTriangle className="w-3 h-3 mr-1" /> Dispute
              </Button>
            </div>
          )}

          {order.status === "released" && (
            <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm">
              <CheckCircle2 className="w-4 h-4" /> Trade completed
            </div>
          )}
          {order.status === "disputed" && (
            <div className="flex items-center justify-center gap-2 text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4" /> Under dispute – admin reviewing
            </div>
          )}
          {order.status === "cancelled" && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
              <X className="w-4 h-4" /> Order cancelled
            </div>
          )}
        </div>

        {/* Dispute sub-dialog (in-place) */}
        {showDispute && (
          <div className="absolute inset-0 bg-background/95 backdrop-blur-sm rounded-lg flex flex-col p-6 gap-4 z-10">
            <div>
              <h4 className="font-semibold">Open Dispute</h4>
              <p className="text-xs text-muted-foreground mt-1">Describe the issue. Admin will review and resolve.</p>
            </div>
            <Textarea
              value={disputeReason}
              onChange={e => setDisputeReason(e.target.value)}
              placeholder="Explain what went wrong…"
              rows={4}
              className="text-sm resize-none"
              data-testid="textarea-dispute-reason"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowDispute(false)}>Back</Button>
              <Button
                variant="destructive" className="flex-1"
                onClick={() => disputeMut.mutate({ reason: disputeReason })}
                disabled={!disputeReason.trim() || disputeMut.isPending}
                data-testid="button-confirm-dispute"
              >
                {disputeMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Dispute"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
      <Icon className="w-10 h-10 opacity-30" />
      <p className="text-sm text-center max-w-xs">{message}</p>
    </div>
  );
}
