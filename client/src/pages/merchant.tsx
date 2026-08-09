limport { useState, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Store, ShieldOff, Ban, Plus,
  ShieldCheck, Loader2, RefreshCcw, Lock, MessageCircle, ShoppingCart, ShieldAlert, CheckCircle2, Clock
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const ONLINE_WINDOW_MS = 2 * 60 * 1000;

function PresenceIndicator({ lastActivity }: { lastActivity?: string | Date | null }) {
  if (!lastActivity) return <span className="text-[11px] text-muted-foreground">Offline</span>;
  const last = new Date(lastActivity);
  if (isNaN(last.getTime())) return <span className="text-[11px] text-muted-foreground">Offline</span>;
  const isOnline = Date.now() - last.getTime() < ONLINE_WINDOW_MS;
  
  if (isOnline) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        Online
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
      Last seen {formatDistanceToNow(last, { addSuffix: true })}
    </span>
  );
}

export default function P2PMarketPage() {
  const { data: user } = useUser();
  const { toast } = useToast();

  const { data: banData } = useQuery<any>({ queryKey: ["/api/p2p/ban"] });
  const [activeTab, setActiveTab] = useState("marketplace");
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
    return (
      <div className="p-4 space-y-4 max-w-lg mx-auto mt-8">
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="pt-6 text-center space-y-4">
            <Ban className="w-12 h-12 text-red-500 mx-auto" />
            <div>
              <h2 className="text-lg font-semibold text-white">Temporarily Banned</h2>
              <p className="text-sm text-muted-foreground mt-1">{banData?.reason ?? "Account restricted."}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Store className="w-6 h-6 text-amber-500" />
          <h1 className="text-2xl font-bold text-white">P2P Market</h1>
        </div>
        <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-black font-semibold gap-1">
          <Plus className="w-4 h-4" /> Post Ad
        </Button>
      </div>

      {!isKycVerified && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <ShieldOff className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-200">Identity verification required</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => window.location.href = "/profile"} className="gap-1 shrink-0 border-amber-500 text-amber-400">
              <ShieldCheck className="w-4 h-4" /> Verify
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full bg-[#1e232a] border border-border">
          <TabsTrigger value="marketplace" className="flex-1 data-[state=active]:bg-amber-500 data-[state=active]:text-black font-medium">Marketplace</TabsTrigger>
          <TabsTrigger value="my-orders" className="flex-1 data-[state=active]:bg-amber-500 data-[state=active]:text-black font-medium">Escrow Orders</TabsTrigger>
          <TabsTrigger value="seller-settings" className="flex-1 data-[state=active]:bg-amber-500 data-[state=active]:text-black font-medium">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="marketplace">
          <MarketplaceTab
            onBuy={(ad) => isKycVerified ? setShowBuyDialog(ad) : requireKyc("buy USDT")}
            currentUserId={user?.id}
          />
        </TabsContent>

        <TabsContent value="my-orders">
          <EscrowOrdersTab currentUserId={user?.id} />
        </TabsContent>

        <TabsContent value="seller-settings">
          <SellerSettingsPanel />
        </TabsContent>
      </Tabs>

      {showBuyDialog && (
        <PlaceOrderDialog
          open={!!showBuyDialog}
          ad={showBuyDialog}
          onClose={() => setShowBuyDialog(null)}
          onOrderCreated={() => setActiveTab("my-orders")}
        />
      )}
    </div>
  );
}

function MarketplaceTab({ onBuy, currentUserId }: { onBuy: (ad: any) => void; currentUserId?: number }) {
  const { data: ads, isLoading, refetch } = useQuery<any[]>({ queryKey: ["/api/p2p/ads"] });

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>;

  return (
    <div className="space-y-3 mt-3">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => refetch()} className="gap-1 text-xs text-muted-foreground hover:text-white">
          <RefreshCcw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>
      {ads?.map((ad) => (
        <AdCard
          key={ad.id}
          ad={ad}
          onBuy={onBuy}
          isMine={(ad.seller_id ?? ad.sellerId) === currentUserId}
        />
      ))}
    </div>
  );
}

function AdCard({ ad, onBuy, isMine }: { ad: any; onBuy: (ad: any) => void; isMine: boolean }) {
  const rate = parseFloat(ad.rate_htg ?? ad.rateHtg ?? 0);
  const avail = parseFloat(ad.available_usdt ?? ad.availableUsdt ?? 0);
  const minOrd = parseFloat(ad.min_order_usdt ?? ad.minOrderUsdt ?? 0);
  const maxOrd = parseFloat(ad.max_order_usdt ?? ad.maxOrderUsdt ?? 0);
  const methods: string[] = ad.payment_methods ?? ad.paymentMethods ?? ["MonCash"];
  const sellerName = ad.merchant_name || ad.seller_name || ad.sellerName || "Merchant";

  return (
    <Card className="bg-[#181c23] border-[#2b313a] hover:border-amber-500/40 transition-all">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-base text-white">{sellerName}</span>
            <PresenceIndicator lastActivity={ad.seller_last_activity} />
            {isMine && <Badge variant="outline" className="text-[10px] py-0 border-amber-500 text-amber-400">You</Badge>}
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {ad.status || "active"}
          </span>
        </div>

        <div>
          <div className="text-2xl font-black text-amber-400">
            {rate.toFixed(2)} <span className="text-sm font-medium text-amber-400/80">HTG/USDT</span>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Available: <span className="text-gray-200 font-medium">{avail.toFixed(2)} USDT</span>
            {minOrd > 0 && <span> · Limit: {minOrd.toFixed(0)} - {maxOrd.toFixed(0)} USDT</span>}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[#2b313a]">
          <div className="flex flex-wrap gap-1.5">
            {methods.map((m: string) => (
              <span key={m} className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#252b36] border border-[#353d4c] text-gray-300">
                {m}
              </span>
            ))}
          </div>

          {!isMine && ad.status === "active" && avail > 0 && (
            <Button
              size="sm"
              onClick={() => onBuy(ad)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 gap-1.5 shadow-md"
            >
              <ShoppingCart className="w-4 h-4" /> Buy
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PlaceOrderDialog({ open, ad, onClose, onOrderCreated }: { open: boolean; ad: any; onClose: () => void; onOrderCreated: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [amountUsdt, setAmountUsdt] = useState("");

  const rate = parseFloat(ad?.rate_htg ?? ad?.rateHtg ?? 0);
  const minUsdt = parseFloat(ad?.min_order_usdt ?? ad?.minOrderUsdt ?? 0) || 1;
  const maxUsdt = Math.min(
    parseFloat(ad?.max_order_usdt ?? ad?.maxOrderUsdt ?? 0) || 9999,
    parseFloat(ad?.available_usdt ?? ad?.availableUsdt ?? 0)
  );

  const parsedUsdt = parseFloat(amountUsdt) || 0;
  const totalHtg = parsedUsdt * rate;

  const orderMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/p2p/orders", {
      adId: ad.id,
      amountUsdt: parsedUsdt,
    }),
    onSuccess: () => {
      toast({ title: "Escrow Order Created!", description: "USDT is now locked in Escrow. Complete payment." });
      qc.invalidateQueries({ queryKey: ["/api/p2p/ads"] });
      qc.invalidateQueries({ queryKey: ["/api/p2p/orders"] });
      onClose();
      onOrderCreated();
    },
    onError: (err: any) => toast({ title: "Error", description: err?.message || "Failed to place order", variant: "destructive" })
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-[#181c23] border-[#2b313a] text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Escrow Order: {ad?.merchant_name || ad?.seller_name || "Merchant"}</DialogTitle>
          <DialogDescription className="text-gray-400">
            Funds will be held safely in <strong className="text-amber-400">Escrow</strong> until payment is confirmed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-gray-300">Amount (USDT)</Label>
            <Input
              type="number"
              placeholder={`Min ${minUsdt} - Max ${maxUsdt}`}
              value={amountUsdt}
              onChange={(e) => setAmountUsdt(e.target.value)}
              className="bg-[#252b36] border-[#353d4c] text-white"
            />
          </div>

          <div className="p-3 bg-[#252b36] rounded-lg space-y-1 text-sm border border-[#353d4c]">
            <div className="flex justify-between text-gray-400">
              <span>Total Pay (HTG):</span>
              <span className="font-bold text-amber-400 text-base">{totalHtg.toLocaleString(undefined, { minimumFractionDigits: 2 })} HTG</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} className="border-[#353d4c] text-gray-300">Cancel</Button>
          <Button
            onClick={() => orderMut.mutate()}
            disabled={parsedUsdt < minUsdt || parsedUsdt > maxUsdt || orderMut.isPending}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
          >
            {orderMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Lock & Buy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EscrowOrdersTab({ currentUserId }: { currentUserId?: number }) {
  const { data: orders, isLoading, refetch } = useQuery<any[]>({ queryKey: ["/api/p2p/orders"] });
  const { toast } = useToast();
  const qc = useQueryClient();

  const markPaidMut = useMutation({
    mutationFn: (orderId: number) => apiRequest("POST", `/api/p2p/orders/${orderId}/mark-paid`),
    onSuccess: () => {
      toast({ title: "Payment Marked", description: "Seller notified to release crypto." });
      qc.invalidateQueries({ queryKey: ["/api/p2p/orders"] });
    }
  });

  const releaseMut = useMutation({
    mutationFn: (orderId: number) => apiRequest("POST", `/api/p2p/orders/${orderId}/release`),
    onSuccess: () => {
      toast({ title: "Crypto Released!", description: "Escrow funds deposited to buyer." });
      qc.invalidateQueries({ queryKey: ["/api/p2p/orders"] });
    }
  });

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>;

  return (
    <div className="space-y-3 mt-3">
      {orders?.length === 0 && <p className="text-center text-sm text-gray-400 py-8">No active P2P Escrow orders.</p>}
      {orders?.map((order) => {
        const isBuyer = order.buyer_id === currentUserId;
        return (
          <Card key={order.id} className="bg-[#181c23] border-[#2b313a] text-white">
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-amber-400 font-bold">Order #{order.id}</span>
                <Badge variant="outline" className="border-amber-500 text-amber-400">{order.status}</Badge>
              </div>

              <div className="text-lg font-bold">
                {order.amount_usdt} USDT <span className="text-sm font-normal text-gray-400">({order.amount_htg} HTG)</span>
              </div>

              <div className="flex gap-2 pt-2">
                {isBuyer && order.status === "pending" && (
                  <Button size="sm" onClick={() => markPaidMut.mutate(order.id)} disabled={markPaidMut.isPending} className="bg-amber-500 text-black font-bold">
                    I Have Paid
                  </Button>
                )}

                {!isBuyer && order.status === "paid" && (
                  <Button size="sm" onClick={() => releaseMut.mutate(order.id)} disabled={releaseMut.isPending} className="bg-emerald-600 text-white font-bold">
                    Release Crypto (Escrow)
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

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
    <Card className="bg-[#181c23] border-[#2b313a] text-white mt-3">
      <CardContent className="p-4 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium">Merchant Display Name</span>
            {settings?.merchantName && (
              <Badge className="text-[10px] py-0 px-1.5 bg-emerald-500/20 text-emerald-400 border-emerald-500/30 ml-auto">
                <Lock className="w-2.5 h-2.5 mr-1" /> Locked
              </Badge>
            )}
          </div>

          {settings?.merchantName ? (
            <div className="flex items-center gap-2 bg-[#252b36] border border-[#353d4c] rounded-lg px-3 py-2.5">
              <span className="text-sm font-semibold text-white">{settings.merchantName}</span>
            </div>
          ) : showMerchantForm ? (
            <div className="space-y-2.5">
              <Input
                value={merchantInput}
                onChange={e => setMerchantInput(e.target.value.slice(0, 60))}
                placeholder="Merchant name..."
                className="bg-[#252b36] border-[#353d4c] text-white"
              />
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="merchant-agree"
                  checked={merchantAgreed}
                  onCheckedChange={(v) => setMerchantAgreed(!!v)}
                />
                <label htmlFor="merchant-agree" className="text-xs text-gray-400 cursor-pointer">
                  I understand this is permanent and cannot be changed.
                </label>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowMerchantForm(false)}>Cancel</Button>
                <Button size="sm" onClick={() => merchantMut.mutate()} disabled={!merchantInput.trim() || !merchantAgreed} className="bg-amber-500 text-black hover:bg-amber-600">
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowMerchantForm(true)} className="border-[#353d4c] text-gray-300">
              + Add merchant name
            </Button>
          )}
        </div>

        <div className="border-t border-[#2b313a]" />

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium">Buyer Welcome Message</span>
          </div>
          <Textarea
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="e.g. Welcome! Transfer via MonCash..."
            rows={3}
            className="bg-[#252b36] border-[#353d4c] text-white placeholder:text-gray-500"
          />
          <Button
            size="sm"
            className="w-full mt-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
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