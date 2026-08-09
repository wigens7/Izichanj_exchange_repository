import { useState, useEffect } from "react";
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
  Store, ShieldOff, Ban, Plus,
  ShieldCheck, Loader2, RefreshCcw, Lock, Save, Settings, MessageCircle
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
  pending: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${STATUS_COLORS[status] ?? "text-muted-foreground bg-muted border-border"}`}>
      {status}
    </span>
  );
}

export default function P2PMarketPage() {
  const { data: user } = useUser();
  const { toast } = useToast();

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
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Post Ad
        </Button>
      </div>

      {!isKycVerified && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <ShieldOff className="w-5 h-5 text-yellow-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Identity verification required</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => window.location.href = "/profile"} className="gap-1 shrink-0">
              <ShieldCheck className="w-4 h-4" /> Verify
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="marketplace" className="flex-1">Marketplace</TabsTrigger>
          <TabsTrigger value="seller-settings" className="flex-1">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="marketplace">
          <MarketplaceTab currentUserId={user?.id} />
        </TabsContent>

        <TabsContent value="seller-settings">
          <SellerSettingsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MarketplaceTab({ currentUserId }: { currentUserId?: number }) {
  const { data: ads, isLoading, refetch } = useQuery<any[]>({ queryKey: ["/api/p2p/ads"] });

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3 mt-2">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => refetch()} className="gap-1 text-xs text-muted-foreground">
          <RefreshCcw className="w-3 h-3" /> Refresh
        </Button>
      </div>
      {ads?.map((ad) => (
        <AdCard key={ad.id} ad={ad} isMine={(ad.seller_id ?? ad.sellerId) === currentUserId} />
      ))}
    </div>
  );
}

function AdCard({ ad, isMine }: { ad: any; isMine: boolean }) {
  const rate = parseFloat(ad.rate_htg ?? ad.rateHtg ?? 0);
  const avail = parseFloat(ad.available_usdt ?? ad.availableUsdt ?? 0);

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
            <div className="text-2xl font-bold text-primary">{rate.toFixed(2)} HTG/USDT</div>
            <div className="text-xs text-muted-foreground mt-1">Available: {avail.toFixed(2)} USDT</div>
          </div>
          <StatusBadge status={ad.status} />
        </div>
      </CardContent>
    </Card>
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
            <MessageCircle className="w-4 h-4 text-primary" />
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
