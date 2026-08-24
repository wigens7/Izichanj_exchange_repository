import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useUser } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  KeyRound, Webhook, BarChart3, Plus, Copy, Trash2, Loader2, BookOpen,
  ShieldAlert, CheckCircle2, FlaskConical, WalletCards, Landmark, CircleDollarSign,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

/**
 * Merchant Tools — developer console for Izichanj merchants.
 * API keys, webhook configuration, sandbox credentials and usage stats.
 * NOTE: the P2P Market lives in pages/p2p-market.tsx and is routed at /p2p-market.
 */
export default function MerchantToolsPage() {
  const { data: user } = useUser();
  const [tab, setTab] = useState("keys");

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound className="w-6 h-6 text-amber-500" />
          <h1 className="text-2xl font-bold text-white">Merchant Tools</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => (window.location.href = "/developers")}
          className="gap-1.5 border-[#353d4c] text-gray-300"
        >
          <BookOpen className="w-4 h-4" /> API Docs
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Integrate Izichanj payments into your app: manage API keys, receive webhooks and
        monitor request volume.
      </p>

      {!user?.merchantApproved && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-200 flex-1">
              Live keys unlock after merchant approval. Sandbox keys work right now.
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
         <TabsList className="w-full bg-[#1e232a] border border-border flex-wrap h-auto">
           <TabsTrigger value="overview" className="flex-1 data-[state=active]:bg-amber-500 data-[state=active]:text-black font-medium">Overview</TabsTrigger>
           <TabsTrigger value="account" className="flex-1 data-[state=active]:bg-amber-500 data-[state=active]:text-black font-medium">Account</TabsTrigger>
           <TabsTrigger value="payouts" className="flex-1 data-[state=active]:bg-amber-500 data-[state=active]:text-black font-medium">Payout</TabsTrigger>
          <TabsTrigger value="keys" className="flex-1 data-[state=active]:bg-amber-500 data-[state=active]:text-black font-medium">API Keys</TabsTrigger>
          <TabsTrigger value="webhooks" className="flex-1 data-[state=active]:bg-amber-500 data-[state=active]:text-black font-medium">Webhooks</TabsTrigger>
          <TabsTrigger value="sandbox" className="flex-1 data-[state=active]:bg-amber-500 data-[state=active]:text-black font-medium">Sandbox</TabsTrigger>
          <TabsTrigger value="usage" className="flex-1 data-[state=active]:bg-amber-500 data-[state=active]:text-black font-medium">Usage</TabsTrigger>
        </TabsList>

         <TabsContent value="overview"><OverviewTab /></TabsContent>
         <TabsContent value="account"><AccountTab /></TabsContent>
         <TabsContent value="payouts"><PayoutTab /></TabsContent>
         <TabsContent value="keys"><ApiKeysTab /></TabsContent>
        <TabsContent value="webhooks"><WebhooksTab /></TabsContent>
        <TabsContent value="sandbox"><SandboxTab /></TabsContent>
        <TabsContent value="usage"><UsageTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function useMerchantApi(path: string) {
  return useQuery<any>({ queryKey: [path], queryFn: async () => {
    const response = await fetch(path);
    if (!response.ok) throw new Error("Unable to load merchant data");
    return response.json();
  }, staleTime: 15_000 });
}

function OverviewTab() {
  const { data: balance, isLoading } = useMerchantApi("/api/merchant/balance");
  const { data: txns } = useMerchantApi("/api/merchant/transactions");
  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>;
  const stats = [
    ["Available balance", balance?.availableBalance],
    ["Pending balance", balance?.pendingBalance],
    ["Total received", balance?.totalReceived],
    ["Total payouts", balance?.totalPayouts],
  ];
  return <div className="space-y-3 mt-3">
    <div className="grid grid-cols-2 gap-3">
      {stats.map(([label, value]) => <Card key={String(label)} className="bg-[#181c23] border-[#2b313a]"><CardContent className="p-4">
        <p className="text-xs text-gray-400">{label}</p><p className="text-xl font-bold text-amber-400 mt-1">{Number(value || 0).toFixed(2)} <span className="text-xs font-normal">USDT</span></p>
      </CardContent></Card>)}
    </div>
    <Card className="bg-[#181c23] border-[#2b313a]"><CardContent className="p-4">
      <div className="flex items-center gap-2 mb-3"><CircleDollarSign className="w-4 h-4 text-amber-500" /><span className="text-sm font-medium text-white">Recent transactions</span></div>
      {(txns?.transactions || []).slice(0, 6).map((t: any) => <div key={t.id} className="flex justify-between border-t border-[#2b313a] py-2 text-xs">
        <span className="text-gray-300">{t.orderId || t.paymentId}</span><span className={t.status === "completed" ? "text-emerald-400" : "text-gray-400"}>{t.status} · {Number(t.netUsdt || 0).toFixed(2)} USDT</span>
      </div>)}
      {(txns?.transactions || []).length === 0 && <p className="text-xs text-gray-400 text-center py-4">No merchant payments yet.</p>}
    </CardContent></Card>
  </div>;
}

function AccountTab() {
  const { data, isLoading } = useMerchantApi("/api/merchant/account");
  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>;
  const m = data?.merchant;
  if (!m) return <Card className="mt-3 bg-[#181c23] border-[#2b313a]"><CardContent className="p-6 text-sm text-gray-400">Merchant account not found.</CardContent></Card>;
  const rows = [["Merchant ID", m.merchantId], ["Business name", m.businessName], ["Email", m.email], ["Country", m.country || "—"]];
  return <Card className="mt-3 bg-[#181c23] border-[#2b313a] text-white"><CardContent className="p-4 space-y-4">
    <div className="flex items-center gap-2"><Landmark className="w-4 h-4 text-amber-500" /><span className="font-medium">Merchant account</span></div>
    {rows.map(([label, value]) => <div key={String(label)} className="flex justify-between gap-4 border-t border-[#2b313a] pt-3 text-sm"><span className="text-gray-400">{label}</span><span className="text-right">{value || "—"}</span></div>)}
    <div className="grid grid-cols-2 gap-2 pt-1">
      {[
        ["Account", m.accountStatus],
        ["KYC", m.kycStatus],
        ["Payments", m.paymentEnabled ? "Enabled" : "Disabled"],
        ["Payouts", m.payoutEnabled ? "Enabled" : "Disabled"],
      ].map(([label, value]) => <div key={String(label)} className="rounded border border-[#353d4c] bg-[#252b36] p-3"><p className="text-[11px] text-gray-400">{label}</p><p className="text-sm font-semibold mt-1">{value}</p></div>)}
    </div>
  </CardContent></Card>;
}

function PayoutTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: methods } = useMerchantApi("/api/merchant/payout-methods");
  const { data: payouts } = useMerchantApi("/api/merchant/payouts");
  const { data: balance } = useMerchantApi("/api/merchant/balance");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("moncash");
  const [destination, setDestination] = useState("");
  const [network, setNetwork] = useState("TRC20");
  const [saving, setSaving] = useState(false);
  const [useSaved, setUseSaved] = useState("");

  async function requestPayout() {
    setSaving(true);
    try {
      const selected = (methods?.methods || []).find((m: any) => String(m.id) === useSaved);
      const body: any = { amount, method: selected?.method || method, acknowledged: true, idempotencyKey: crypto.randomUUID(), payoutMethodId: selected?.id };
      if (!selected) {
        if (method === "usdt") { body.walletAddress = destination; body.network = network; }
        else if (method === "zelle") body.email = destination;
        else if (method === "cashapp") body.cashtag = destination;
        else body.phoneNumber = destination;
      }
      const r = await apiRequest("POST", "/api/merchant/payouts", body);
      const result = await r.json();
      toast({ title: "Payout requested", description: `Request #${result?.payout?.id || ""} is pending review.` });
      setAmount(""); setDestination(""); setUseSaved("");
      qc.invalidateQueries({ queryKey: ["/api/merchant/balance"] });
      qc.invalidateQueries({ queryKey: ["/api/merchant/payouts"] });
    } catch (e: any) { toast({ title: "Payout unavailable", description: e?.message || "Please check your details.", variant: "destructive" }); }
    finally { setSaving(false); }
  }
  return <div className="space-y-3 mt-3">
    <Card className="bg-[#181c23] border-[#2b313a] text-white"><CardContent className="p-4 space-y-4">
      <div className="flex items-center justify-between"><div className="flex items-center gap-2"><WalletCards className="w-4 h-4 text-amber-500" /><span className="font-medium">Request a payout</span></div><span className="text-xs text-gray-400">Available: {Number(balance?.availableBalance || 0).toFixed(2)} USDT</span></div>
      <div className="space-y-2"><Label className="text-gray-300">Amount (USDT)</Label><Input value={amount} onChange={e => setAmount(e.target.value)} type="number" min="5" step="0.01" className="bg-[#252b36] border-[#353d4c] text-white" /></div>
      {(methods?.methods || []).length > 0 && <div className="space-y-2"><Label className="text-gray-300">Saved destination</Label><select value={useSaved} onChange={e => setUseSaved(e.target.value)} className="w-full h-10 rounded bg-[#252b36] border border-[#353d4c] px-3 text-sm"><option value="">Enter a new destination</option>{methods.methods.map((m: any) => <option key={m.id} value={m.id}>{m.method.toUpperCase()} · {m.maskedDetails}</option>)}</select></div>}
      {!useSaved && <><div className="space-y-2"><Label className="text-gray-300">Payout method</Label><select value={method} onChange={e => setMethod(e.target.value)} className="w-full h-10 rounded bg-[#252b36] border border-[#353d4c] px-3 text-sm"><option value="moncash">MonCash</option><option value="natcash">NatCash</option><option value="usdt">USDT</option><option value="zelle">Zelle</option><option value="cashapp">Cash App</option></select></div>
      {method === "usdt" && <div className="space-y-2"><Label className="text-gray-300">Network</Label><select value={network} onChange={e => setNetwork(e.target.value)} className="w-full h-10 rounded bg-[#252b36] border border-[#353d4c] px-3 text-sm"><option>TRC20</option><option>BEP20</option><option>ERC20</option></select></div>}
      <div className="space-y-2"><Label className="text-gray-300">{method === "usdt" ? "Wallet address" : method === "zelle" ? "Email or phone" : method === "cashapp" ? "Cashtag" : "Phone number"}</Label><Input value={destination} onChange={e => setDestination(e.target.value)} className="bg-[#252b36] border-[#353d4c] text-white" /></div></>}
      <p className="text-xs text-gray-400">Fee: 0.00 USDT · You receive: {Number(amount || 0).toFixed(2)} USDT. Processing usually takes 24–48 hours.</p>
      <Button onClick={requestPayout} disabled={saving || !amount || (!destination && !useSaved)} className="bg-amber-500 hover:bg-amber-600 text-black font-bold w-full">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm payout"}</Button>
    </CardContent></Card>
    <Card className="bg-[#181c23] border-[#2b313a] text-white"><CardContent className="p-4"><div className="text-sm font-medium mb-3">Payout history</div>{(payouts?.payouts || []).map((p: any) => <div key={p.id} className="flex justify-between border-t border-[#2b313a] py-2 text-xs"><span>{new Date(p.createdAt).toLocaleDateString()} · {p.method}</span><span>{Number(p.amount).toFixed(2)} USDT · {p.status}</span></div>)}{(payouts?.payouts || []).length === 0 && <p className="text-xs text-gray-400 text-center py-4">No payouts yet.</p>}</CardContent></Card>
  </div>;
}

function CopyField({ label, value, masked }: { label: string; value: string; masked?: boolean }) {
  const { toast } = useToast();
  return (
    <div className="space-y-1.5">
      <Label className="text-gray-300 text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate bg-[#252b36] border border-[#353d4c] rounded px-3 py-2 text-xs text-gray-200 font-mono">
          {masked ? `${value.slice(0, 12)}${"•".repeat(12)}` : value}
        </code>
        <Button
          size="sm"
          variant="outline"
          className="border-[#353d4c] text-gray-300 shrink-0"
          onClick={() => {
            navigator.clipboard.writeText(value);
            toast({ title: "Copied", description: `${label} copied to clipboard.` });
          }}
        >
          <Copy className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------- API keys ------------------------------- */

function ApiKeysTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: keys, isLoading } = useQuery<any[]>({ queryKey: ["/api/merchant/keys"] });
  const [showCreate, setShowCreate] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [freshKey, setFreshKey] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/merchant/keys", { name: keyName.trim() }),
    onSuccess: (res: any) => {
      setFreshKey(res?.secret ?? res?.key ?? null);
      setKeyName("");
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ["/api/merchant/keys"] });
    },
    onError: (err: any) =>
      toast({ title: "Error", description: err?.message || "Failed to create key", variant: "destructive" }),
  });

  const revokeMut = useMutation({
    mutationFn: (id: number | string) => apiRequest("DELETE", `/api/merchant/keys/${id}`),
    onSuccess: () => {
      toast({ title: "Key revoked", description: "Requests using this key will now fail." });
      qc.invalidateQueries({ queryKey: ["/api/merchant/keys"] });
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>;
  }

  return (
    <div className="space-y-3 mt-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowCreate(true)} className="bg-amber-500 hover:bg-amber-600 text-black font-semibold gap-1">
          <Plus className="w-4 h-4" /> Create key
        </Button>
      </div>

      {keys?.length === 0 && (
        <p className="text-center text-sm text-gray-400 py-8">No API keys yet. Create one to start integrating.</p>
      )}

      {keys?.map((k) => (
        <Card key={k.id} className="bg-[#181c23] border-[#2b313a]">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white truncate">{k.name || "Untitled key"}</span>
                <Badge variant="outline" className={k.mode === "live" ? "border-emerald-500 text-emerald-400 text-[10px] py-0" : "border-amber-500 text-amber-400 text-[10px] py-0"}>
                  {k.mode || "live"}
                </Badge>
                {k.revoked_at && <Badge variant="outline" className="border-red-500 text-red-400 text-[10px] py-0">revoked</Badge>}
              </div>
              <code className="text-xs text-gray-400 font-mono">{k.prefix || k.masked_key || "izk_live_••••"}</code>
              <div className="text-[11px] text-muted-foreground mt-1">
                {k.last_used_at
                  ? `Last used ${formatDistanceToNow(new Date(k.last_used_at), { addSuffix: true })}`
                  : "Never used"}
              </div>
            </div>

            {!k.revoked_at && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => revokeMut.mutate(k.id)}
                disabled={revokeMut.isPending}
                className="border-red-500/40 text-red-400 hover:bg-red-500/10 gap-1.5 shrink-0"
              >
                <Trash2 className="w-4 h-4" /> Revoke
              </Button>
            )}
          </CardContent>
        </Card>
      ))}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md bg-[#181c23] border-[#2b313a] text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Create API key</DialogTitle>
            <DialogDescription className="text-gray-400">
              Name it after the app or environment that will use it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-gray-300">Key name</Label>
            <Input
              value={keyName}
              onChange={(e) => setKeyName(e.target.value.slice(0, 60))}
              placeholder="Checkout backend"
              className="bg-[#252b36] border-[#353d4c] text-white"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowCreate(false)} className="border-[#353d4c] text-gray-300">Cancel</Button>
            <Button
              onClick={() => createMut.mutate()}
              disabled={!keyName.trim() || createMut.isPending}
              className="bg-amber-500 hover:bg-amber-600 text-black font-bold"
            >
              {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!freshKey} onOpenChange={() => setFreshKey(null)}>
        <DialogContent className="sm:max-w-md bg-[#181c23] border-[#2b313a] text-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Key created
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Copy it now — the full secret is shown only once.
            </DialogDescription>
          </DialogHeader>
          {freshKey && <CopyField label="Secret key" value={freshKey} />}
          <DialogFooter>
            <Button onClick={() => setFreshKey(null)} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------- Webhooks ------------------------------- */

function WebhooksTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: config } = useQuery<any>({ queryKey: ["/api/merchant/webhook"] });
  const [url, setUrl] = useState<string | null>(null);

  const value = url ?? config?.url ?? "";

  const saveMut = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/merchant/webhook", { url: value.trim() }),
    onSuccess: () => {
      toast({ title: "Webhook saved", description: "Events will be delivered to this URL." });
      qc.invalidateQueries({ queryKey: ["/api/merchant/webhook"] });
    },
    onError: (err: any) =>
      toast({ title: "Error", description: err?.message || "Failed to save webhook", variant: "destructive" }),
  });

  const testMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/merchant/webhook/test"),
    onSuccess: () => toast({ title: "Test event sent", description: "Check your endpoint logs." }),
  });

  return (
    <Card className="bg-[#181c23] border-[#2b313a] text-white mt-3">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Webhook className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium">Webhook endpoint</span>
        </div>

        <div className="space-y-2">
          <Label className="text-gray-300 text-xs">Callback URL</Label>
          <Input
            value={value}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://yourapp.com/webhooks/izichanj"
            className="bg-[#252b36] border-[#353d4c] text-white"
          />
          <p className="text-[11px] text-muted-foreground">
            We POST JSON for <code className="text-gray-300">payment.completed</code>,{" "}
            <code className="text-gray-300">payment.failed</code> and{" "}
            <code className="text-gray-300">payout.settled</code>.
          </p>
        </div>

        {config?.signingSecret && (
          <CopyField label="Signing secret" value={config.signingSecret} masked />
        )}

        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            onClick={() => saveMut.mutate()}
            disabled={!value.trim() || saveMut.isPending}
            className="bg-amber-500 hover:bg-amber-600 text-black font-bold"
          >
            {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => testMut.mutate()}
            disabled={!config?.url || testMut.isPending}
            className="border-[#353d4c] text-gray-300"
          >
            Send test event
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------- Sandbox ------------------------------- */

function SandboxTab() {
  const { data: sandbox, isLoading } = useQuery<any>({ queryKey: ["/api/merchant/sandbox"] });

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>;
  }

  return (
    <Card className="bg-[#181c23] border-[#2b313a] text-white mt-3">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium">Sandbox credentials</span>
          <Badge variant="outline" className="border-amber-500 text-amber-400 text-[10px] py-0 ml-auto">test mode</Badge>
        </div>

        <p className="text-xs text-muted-foreground">
          Sandbox requests never move real funds. Use them to build and test your integration.
        </p>

        <CopyField label="Publishable key" value={sandbox?.publishableKey || "izk_test_pk_••••"} />
        <CopyField label="Secret key" value={sandbox?.secretKey || "izk_test_sk_••••"} masked />
        <CopyField label="Base URL" value={sandbox?.baseUrl || "https://sandbox.izichanj.com/v1"} />
      </CardContent>
    </Card>
  );
}

/* --------------------------------- Usage -------------------------------- */

function UsageTab() {
  const { data: usage, isLoading } = useQuery<any>({ queryKey: ["/api/merchant/usage"] });

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>;
  }

  const stats = [
    { label: "Requests (30d)", value: usage?.requests30d ?? 0 },
    { label: "Success rate", value: `${usage?.successRate ?? 100}%` },
    { label: "Errors (30d)", value: usage?.errors30d ?? 0 },
    { label: "Volume (HTG)", value: Number(usage?.volumeHtg ?? 0).toLocaleString() },
  ];

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-amber-500" />
        <span className="text-sm font-medium text-white">Last 30 days</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="bg-[#181c23] border-[#2b313a]">
            <CardContent className="p-4">
              <div className="text-xs text-gray-400">{s.label}</div>
              <div className="text-2xl font-black text-amber-400 mt-1">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-[#181c23] border-[#2b313a]">
        <CardContent className="p-4 space-y-2">
          <div className="text-sm font-medium text-white">Recent requests</div>
          {(usage?.recent ?? []).length === 0 && (
            <p className="text-xs text-gray-400 py-4 text-center">No API requests recorded yet.</p>
          )}
          {(usage?.recent ?? []).map((r: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-xs border-t border-[#2b313a] pt-2">
              <code className="text-gray-300 font-mono truncate">{r.method} {r.path}</code>
              <span className={r.status >= 400 ? "text-red-400" : "text-emerald-400"}>{r.status}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
