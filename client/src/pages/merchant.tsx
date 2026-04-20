import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useUser } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Copy, Check, Eye, EyeOff, RefreshCw, Webhook, KeyRound, Store, BookOpen, AlertTriangle, ExternalLink, Wallet } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

const PAYOUT_METHODS = [
  { value: "moncash", label: "MonCash", colorName: "Red", hex: "#EF4444" },
  { value: "natcash", label: "NatCash", colorName: "Lemon Yellow (Citron)", hex: "#E3FF00" },
  { value: "zelle", label: "Zelle", colorName: "Navy Blue", hex: "#1A237E" },
  { value: "cashapp", label: "CashApp", colorName: "Green", hex: "#22C55E" },
] as const;
type PayoutMethod = typeof PAYOUT_METHODS[number]["value"];
type PayoutReq = {
  id: number; amount: string; method: PayoutMethod;
  details: any; status: "pending" | "approved" | "rejected";
  adminNote: string | null; createdAt: string; processedAt: string | null;
};

type Merchant = {
  id: number;
  businessName: string;
  webhookUrl: string | null;
  apiPublicKey: string;
  apiSecretKey: string;
  isVerified: boolean;
  createdAt: string;
};
type Txn = {
  id: number;
  paymentId: string;
  orderId: string;
  amount: string;
  currency: string;
  amountUsdt: string;
  amountHtg: string;
  netUsdt: string;
  feeUsdt: string;
  status: "pending" | "completed" | "expired" | "failed";
  webhookDelivered: boolean;
  webhookAttempts: number;
  createdAt: string;
  paidAt: string | null;
  expiresAt: string;
};

function CopyBtn({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Button size="sm" variant="outline" onClick={copy} data-testid={`button-copy-${label}`}>
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
    </Button>
  );
}

export default function MerchantPage() {
  const { data: user } = useUser();
  const { toast } = useToast();
  const [businessName, setBusinessName] = useState("");
  const [webhookInput, setWebhookInput] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod | "">("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutPhone, setPayoutPhone] = useState("");
  const [payoutEmail, setPayoutEmail] = useState("");
  const [payoutCashtag, setPayoutCashtag] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  const { data, isLoading } = useQuery<{ merchant: Merchant | null }>({ queryKey: ["/api/merchant/me"] });
  const merchant = data?.merchant;

  const { data: txnData } = useQuery<{ transactions: Txn[] }>({
    queryKey: ["/api/merchant/transactions"],
    enabled: !!merchant,
    refetchInterval: 15000,
  });

  const enroll = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/merchant/enroll", { businessName });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/me"] });
      toast({ title: "Merchant account created", description: "You can now generate API keys and accept payments." });
    },
    onError: (e: any) => toast({ title: "Could not enroll", description: e?.message || "Try again", variant: "destructive" }),
  });

  const updateWebhook = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("PATCH", "/api/merchant/me", { webhookUrl: webhookInput });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/me"] });
      toast({ title: "Webhook saved" });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e?.message, variant: "destructive" }),
  });

  const rotate = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/merchant/rotate-keys", {});
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/me"] });
      toast({ title: "API keys rotated", description: "Your old keys are now invalid. Update your integrations." });
    },
  });

  const { data: payoutData } = useQuery<{ payouts: PayoutReq[] }>({
    queryKey: ["/api/merchant/payouts"],
    enabled: !!data?.merchant,
    refetchInterval: 20000,
  });
  const payouts = payoutData?.payouts || [];

  const submitPayout = useMutation({
    mutationFn: async () => {
      const body: any = { amount: Number(payoutAmount), method: payoutMethod, acknowledged: true };
      if (payoutMethod === "moncash" || payoutMethod === "natcash") body.phoneNumber = payoutPhone;
      else if (payoutMethod === "zelle") body.email = payoutEmail;
      else if (payoutMethod === "cashapp") body.cashtag = payoutCashtag;
      const r = await apiRequest("POST", "/api/merchant/payouts", body);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/payouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: "Payout request submitted", description: "Admin will process it within 24-48 hours." });
      setPayoutAmount(""); setPayoutPhone(""); setPayoutEmail(""); setPayoutCashtag("");
      setPayoutMethod(""); setAcknowledged(false);
    },
    onError: (e: any) => toast({ title: "Payout failed", description: e?.message || "Please try again", variant: "destructive" }),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  // KYC gate
  if (user && user.kycStatus !== "verified") {
    return (
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <Alert variant="destructive" data-testid="alert-kyc-required">
          <AlertTriangle className="w-5 h-5" />
          <AlertTitle>KYC Verification Required</AlertTitle>
          <AlertDescription>
            You must complete KYC verification before enrolling as an Izichanj Pay merchant. Please verify your identity in your profile, then return here.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Enrollment screen
  if (!merchant) {
    return (
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-3 text-primary"><Store className="w-6 h-6" /></div>
          <div>
            <h1 className="text-2xl font-bold">Izichanj Pay — Merchant Tools</h1>
            <p className="text-sm text-muted-foreground">Accept HTG/USDT payments on your e-commerce site.</p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Become a Merchant</CardTitle>
            <CardDescription>Activate your merchant account to generate API keys and start accepting payments. A 1.5% fee applies on each successful payment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="businessName">Business name</Label>
              <Input
                id="businessName"
                placeholder="My Awesome Store"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                data-testid="input-business-name"
              />
            </div>
            <Button
              onClick={() => enroll.mutate()}
              disabled={enroll.isPending || businessName.trim().length < 2}
              data-testid="button-enroll-merchant"
            >
              {enroll.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Activate merchant account
            </Button>
            <Link href="/developers" className="block text-sm text-primary hover:underline">
              Read the developer documentation →
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Merchant dashboard
  const txns = txnData?.transactions || [];
  const totalCompleted = txns.filter((t) => t.status === "completed").reduce((s, t) => s + Number(t.netUsdt), 0);
  const totalCount = txns.filter((t) => t.status === "completed").length;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-3 text-primary"><Store className="w-6 h-6" /></div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-merchant-name">{merchant.businessName}</h1>
            <p className="text-xs text-muted-foreground">
              {merchant.isVerified ? <Badge variant="default">Verified Merchant</Badge> : <Badge variant="secondary">Active</Badge>}
              <span className="ml-2">Member since {new Date(merchant.createdAt).toLocaleDateString()}</span>
            </p>
          </div>
        </div>
        <Link href="/developers">
          <Button variant="outline" data-testid="link-developers">
            <BookOpen className="w-4 h-4 mr-2" />Documentation
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total received (net)</p><p className="text-2xl font-bold" data-testid="text-total-received">{totalCompleted.toFixed(2)} USDT</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Successful payments</p><p className="text-2xl font-bold" data-testid="text-payment-count">{totalCount}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Transaction fee</p><p className="text-2xl font-bold">1.5%</p></CardContent></Card>
      </div>

      <Card data-testid="card-payout">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wallet className="w-5 h-5" />Withdraw Earnings</CardTitle>
          <CardDescription>
            Request a payout to MonCash, NatCash, Zelle, or CashApp. Minimum 5 USDT. Admin processes within 24-48 hours.
            Available balance: <span className="font-bold text-foreground" data-testid="text-balance">{Number(user?.balance || 0).toFixed(2)} USDT</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Payout method</Label>
              <Select value={payoutMethod} onValueChange={(v) => setPayoutMethod(v as PayoutMethod)}>
                <SelectTrigger data-testid="select-payout-method">
                  <SelectValue placeholder="Select a method" />
                </SelectTrigger>
                <SelectContent>
                  {PAYOUT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value} data-testid={`option-${m.value}`}>
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-full border" style={{ backgroundColor: m.hex }} />
                        <span>{m.label}</span>
                        <span className="text-[11px] text-muted-foreground">({m.colorName})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="payout-amount">Amount (USDT)</Label>
              <Input
                id="payout-amount"
                type="number"
                min="5"
                step="0.01"
                placeholder="Min 5 USDT"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                data-testid="input-payout-amount"
              />
            </div>
          </div>

          {(payoutMethod === "moncash" || payoutMethod === "natcash") && (
            <div>
              <Label htmlFor="payout-phone">{payoutMethod === "moncash" ? "MonCash" : "NatCash"} phone number</Label>
              <Input
                id="payout-phone"
                placeholder="+509 1234-5678"
                value={payoutPhone}
                onChange={(e) => setPayoutPhone(e.target.value)}
                data-testid="input-payout-phone"
              />
            </div>
          )}
          {payoutMethod === "zelle" && (
            <div>
              <Label htmlFor="payout-email">Zelle email address</Label>
              <Input
                id="payout-email"
                type="email"
                placeholder="you@example.com"
                value={payoutEmail}
                onChange={(e) => setPayoutEmail(e.target.value)}
                data-testid="input-payout-email"
              />
            </div>
          )}
          {payoutMethod === "cashapp" && (
            <div>
              <Label htmlFor="payout-cashtag">CashApp $cashtag</Label>
              <Input
                id="payout-cashtag"
                placeholder="$yourtag"
                value={payoutCashtag}
                onChange={(e) => setPayoutCashtag(e.target.value)}
                data-testid="input-payout-cashtag"
              />
            </div>
          )}

          <div className="flex items-start gap-2 p-3 rounded-lg border bg-muted/30">
            <Checkbox
              id="acknowledge"
              checked={acknowledged}
              onCheckedChange={(c) => setAcknowledged(!!c)}
              data-testid="checkbox-acknowledge"
            />
            <Label htmlFor="acknowledge" className="text-xs leading-snug cursor-pointer">
              I understand that my balance will be debited <span className="font-semibold">immediately</span> upon submission, and that the payout will be processed manually by Izichanj admin within <span className="font-semibold">24-48 hours</span>. If rejected, the funds will be refunded to my balance.
            </Label>
          </div>

          <Button
            className="w-full"
            onClick={() => submitPayout.mutate()}
            disabled={
              submitPayout.isPending ||
              !acknowledged ||
              !payoutMethod ||
              Number(payoutAmount) < 5 ||
              Number(payoutAmount) > Number(user?.balance || 0) ||
              ((payoutMethod === "moncash" || payoutMethod === "natcash") && payoutPhone.trim().length < 6) ||
              (payoutMethod === "zelle" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payoutEmail.trim())) ||
              (payoutMethod === "cashapp" && payoutCashtag.trim().length < 1)
            }
            data-testid="button-submit-payout"
          >
            {submitPayout.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Request payout
          </Button>

          {payouts.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-semibold text-muted-foreground">Recent payout requests</p>
              {payouts.slice(0, 8).map((p) => {
                const meta = PAYOUT_METHODS.find((m) => m.value === p.method)!;
                const detail = p.details?.phoneNumber || p.details?.email || p.details?.cashtag || "";
                return (
                  <div key={p.id} className="flex items-center justify-between gap-3 p-2 rounded-md border" data-testid={`row-payout-${p.id}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-block w-3 h-3 rounded-full border shrink-0" style={{ backgroundColor: meta.hex }} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{meta.label}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{detail}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-sm">{Number(p.amount).toFixed(2)} USDT</p>
                      <Badge
                        variant={p.status === "approved" ? "default" : p.status === "rejected" ? "destructive" : "secondary"}
                        className="text-[10px]"
                        data-testid={`badge-status-${p.id}`}
                      >
                        {p.status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="w-5 h-5" />API Keys</CardTitle>
          <CardDescription>Use these keys to authenticate API requests. Keep your secret key safe — never expose it in browser code.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Public key (safe to embed)</Label>
            <div className="flex gap-2">
              <Input readOnly value={merchant.apiPublicKey} data-testid="input-public-key" className="font-mono text-xs" />
              <CopyBtn value={merchant.apiPublicKey} label="public-key" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Secret key — KEEP PRIVATE</Label>
            <div className="flex gap-2">
              <Input readOnly type={showSecret ? "text" : "password"} value={merchant.apiSecretKey} data-testid="input-secret-key" className="font-mono text-xs" />
              <Button size="sm" variant="outline" onClick={() => setShowSecret((s) => !s)} data-testid="button-toggle-secret">
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <CopyBtn value={merchant.apiSecretKey} label="secret-key" />
            </div>
          </div>
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription className="text-xs">
              Rotating keys will immediately invalidate the current ones. Make sure to update all your servers before rotating.
            </AlertDescription>
          </Alert>
          <Button variant="outline" onClick={() => rotate.mutate()} disabled={rotate.isPending} data-testid="button-rotate-keys">
            <RefreshCw className={`w-4 h-4 mr-2 ${rotate.isPending ? "animate-spin" : ""}`} />Rotate API keys
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Webhook className="w-5 h-5" />Webhook URL</CardTitle>
          <CardDescription>We will POST a JSON payload to this URL after a payment is completed. Verify the <code>X-Izichanj-Signature</code> header (HMAC-SHA256 of the body using your secret key).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="https://yourstore.com/api/izichanj-webhook"
            defaultValue={merchant.webhookUrl || ""}
            onChange={(e) => setWebhookInput(e.target.value)}
            data-testid="input-webhook-url"
          />
          <Button onClick={() => updateWebhook.mutate()} disabled={updateWebhook.isPending} data-testid="button-save-webhook">
            {updateWebhook.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save webhook
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent API Transactions</CardTitle>
          <CardDescription>Latest 200 payments. Auto-refreshes every 15s.</CardDescription>
        </CardHeader>
        <CardContent>
          {txns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-transactions">No transactions yet. Create your first checkout via <code>/api/v1/checkout</code>.</p>
          ) : (
            <div className="space-y-2">
              {txns.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border hover:bg-muted/30" data-testid={`row-txn-${t.id}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-xs truncate">{t.orderId}</p>
                      <StatusPill status={t.status} />
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">{t.paymentId}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold" data-testid={`text-amount-${t.id}`}>{Number(t.amountUsdt).toFixed(2)} USDT</p>
                    <p className="text-[11px] text-muted-foreground">net: {Number(t.netUsdt).toFixed(2)} • {t.currency === "HTG" ? `${Number(t.amountHtg).toFixed(0)} HTG` : ""}</p>
                  </div>
                  <a
                    href={`/checkout/${t.paymentId}`}
                    target="_blank"
                    rel="noopener"
                    className="text-primary hover:text-primary/80 shrink-0"
                    data-testid={`link-checkout-${t.id}`}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { v: any; label: string }> = {
    completed: { v: "default", label: "Completed" },
    pending: { v: "secondary", label: "Pending" },
    expired: { v: "outline", label: "Expired" },
    failed: { v: "destructive", label: "Failed" },
  };
  const c = map[status] || { v: "outline", label: status };
  return <Badge variant={c.v}>{c.label}</Badge>;
}
