import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useUser } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  NFC_CARD_TOTAL_PRICE_USD,
  NFC_CARD_LOAD_AMOUNT_USD,
  NFC_TOPUP_MIN_USD,
  NFC_WITHDRAW_MIN_USD,
  NFC_WITHDRAW_FEE_USD,
  calcNfcCardTopUpCost,
  calcNfcCardWithdrawCost,
} from "@shared/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Nfc, Smartphone, Plus, DollarSign, Loader2, Eye, EyeOff, Copy, CheckCircle,
  ArrowDownLeft, ArrowUpRight, Clock, ShieldCheck, RefreshCw, Sparkles, Wallet,
  AlertTriangle, ShieldAlert,
} from "lucide-react";
import { SiApplepay, SiGooglepay } from "react-icons/si";
import { formatDateTime } from "@/lib/dateUtils";
import type { NfcCard } from "@shared/schema";

type NfcDetail = {
  card_number?: string;
  cvv?: string;
  expiry?: string;
  expiry_date?: string;
  balance?: string | number;
  card_status?: string;
  [k: string]: any;
};

type NfcTxn = {
  id: string;
  type: string;
  amount: string | number;
  currency?: string;
  description?: string;
  date?: string;
  source?: string;
};

export default function NfcCardsPage() {
  const { data: user } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const kycVerified = user?.kycStatus === "verified";

  // Pre-flight: check that profile + KYC fields needed by Strowallet are present
  const { data: readiness } = useQuery<{ ready: boolean; kycVerified: boolean; missingFields: string[] }>({
    queryKey: ["/api/nfc-cards/readiness"],
    enabled: kycVerified,
  });
  const profileReady = readiness?.ready ?? false;
  const missingFields = readiness?.missingFields ?? [];

  const [revealId, setRevealId] = useState<number | null>(null);
  // Best-effort screenshot mitigation: hide sensitive values when the
  // page loses focus (Android often hides web content briefly during a screenshot).
  const [hideSensitive, setHideSensitive] = useState(false);
  useEffect(() => {
    if (revealId === null) return;
    const onVis = () => setHideSensitive(document.visibilityState !== "visible");
    const onBlur = () => setHideSensitive(true);
    const onFocus = () => setHideSensitive(false);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      setHideSensitive(false);
    };
  }, [revealId]);
  const [fundOpen, setFundOpen] = useState<NfcCard | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState<NfcCard | null>(null);
  const [txnsOpen, setTxnsOpen] = useState<NfcCard | null>(null);
  const [confirmCreate, setConfirmCreate] = useState(false);
  const [fundAmt, setFundAmt] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");

  const { data: cards, isLoading } = useQuery<NfcCard[]>({ queryKey: ["/api/nfc-cards"] });

  const { data: detailsResp, isLoading: detailsLoading, isFetching: detailsFetching, refetch: refetchDetails } = useQuery<{ card: NfcCard; remoteDetail: NfcDetail | null; reason?: string; message?: string }>({
    queryKey: ["/api/nfc-cards", revealId, "details"],
    enabled: revealId !== null,
  });

  const { data: txns, isLoading: txnsLoading } = useQuery<NfcTxn[]>({
    queryKey: ["/api/nfc-cards", txnsOpen?.id, "transactions"],
    enabled: !!txnsOpen,
    // Always pull fresh data when the dialog opens, and poll every 15s while
    // it's open so newly settled spend transactions appear without manual reload.
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: txnsOpen ? 15000 : false,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/nfc-cards/create", {});
      return r.json();
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/nfc-cards"] });
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      qc.invalidateQueries({ queryKey: ["/api/me"] });
      setConfirmCreate(false);
      toast({
        title: data?.pending ? "NFC Card Pending" : "NFC Card Issued",
        description: data?.message || "Your contactless virtual card is ready.",
      });
    },
    onError: (e: any) => toast({ title: "Failed to create NFC card", description: e?.message || "Please try again.", variant: "destructive" }),
  });

  const fundMut = useMutation({
    mutationFn: async ({ id, amount }: { id: number; amount: number }) => {
      const r = await apiRequest("POST", `/api/nfc-cards/${id}/fund`, { amount });
      return r.json();
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/nfc-cards"] });
      qc.invalidateQueries({ queryKey: ["/api/nfc-cards", vars.id, "transactions"] });
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      qc.invalidateQueries({ queryKey: ["/api/me"] });
      setFundOpen(null);
      setFundAmt("");
      toast({ title: "Card funded", description: "Your NFC card balance has been updated." });
    },
    onError: (e: any) => toast({ title: "Funding failed", description: e?.message || "Please try again.", variant: "destructive" }),
  });

  const withdrawMut = useMutation({
    mutationFn: async ({ id, amount }: { id: number; amount: number }) => {
      const r = await apiRequest("POST", `/api/nfc-cards/${id}/withdraw`, { amount });
      return r.json();
    },
    onSuccess: (d: any, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/nfc-cards"] });
      qc.invalidateQueries({ queryKey: ["/api/nfc-cards", vars.id, "transactions"] });
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      qc.invalidateQueries({ queryKey: ["/api/me"] });
      setWithdrawOpen(null);
      setWithdrawAmt("");
      toast({
        title: "Withdrawal complete",
        description: d?.credited ? `$${Number(d.credited).toFixed(2)} credited to your wallet (fee $${Number(d.fee).toFixed(2)}).` : "Funds returned to your wallet.",
      });
    },
    onError: (e: any) => toast({ title: "Withdrawal failed", description: e?.message || "Please try again.", variant: "destructive" }),
  });

  // Standalone "refresh balance" used from the card list (shows its own toasts).
  const refreshMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest("POST", `/api/nfc-cards/${id}/refresh-balance`, {});
      return r.json();
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/nfc-cards"] });
      if (data?.synced) {
        toast({ title: "Balance refreshed" });
      } else {
        toast({
          title: "Couldn't sync right now",
          description: data?.message || "The card provider didn't respond. Please try again shortly.",
          variant: "destructive",
        });
      }
    },
    onError: (e: any) => toast({ title: "Refresh failed", description: e?.message || "Please try again.", variant: "destructive" }),
  });

  // Silent variant used by the details dialog — no toast spam (the dialog UI
  // already shows the empty state). Still refreshes the cards list balance.
  const [silentBalanceLoading, setSilentBalanceLoading] = useState(false);
  const silentRefreshBalance = async (id: number) => {
    try {
      setSilentBalanceLoading(true);
      const r = await apiRequest("POST", `/api/nfc-cards/${id}/refresh-balance`, {});
      const data = await r.json().catch(() => ({}));
      if (data?.synced) qc.invalidateQueries({ queryKey: ["/api/nfc-cards"] });
    } catch {
      // ignored — the details refetch result drives the dialog UI
    } finally {
      setSilentBalanceLoading(false);
    }
  };

  // Refresh button inside the Card details dialog —
  // re-runs the details query AND a quiet balance sync, with smart toast logic.
  const refreshDetails = async () => {
    if (revealId == null) return;
    const [detailsRes] = await Promise.all([
      refetchDetails(),
      silentRefreshBalance(revealId),
    ]);
    const got = !!detailsRes?.data?.remoteDetail;
    if (got) {
      toast({ title: "Card details refreshed" });
    } else {
      toast({
        title: "Couldn't sync right now",
        description: detailsRes?.data?.message || "The card provider didn't respond. Please try again shortly.",
        variant: "destructive",
      });
    }
  };

  const copy = (txt: string, label: string) => {
    navigator.clipboard.writeText(txt);
    toast({ title: `${label} copied` });
  };

  const fundBreakdown = fundAmt && !isNaN(parseFloat(fundAmt)) ? calcNfcCardTopUpCost(parseFloat(fundAmt)) : null;
  const withdrawBreakdown = withdrawAmt && !isNaN(parseFloat(withdrawAmt)) ? calcNfcCardWithdrawCost(parseFloat(withdrawAmt)) : null;

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-5xl space-y-6" data-testid="page-nfc-cards">
      {/* Hero */}
      <div className="rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600 p-6 md:p-8 text-white shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30">
              <Sparkles className="w-3 h-3 mr-1" /> New
            </Badge>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Nfc className="w-7 h-7" /> NFC Virtual Card
            </h1>
            <p className="text-white/90 text-sm md:text-base max-w-md">
              Contactless Visa card you can add to your phone wallet. Tap to pay anywhere NFC is accepted.
            </p>
            <div className="flex items-center gap-3 pt-2 text-white">
              <SiApplepay className="w-12 h-7" />
              <SiGooglepay className="w-12 h-7" />
              <Smartphone className="w-5 h-5 opacity-80" />
            </div>
          </div>
        </div>
      </div>

      {/* KYC gate */}
      {!kycVerified && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
          <CardContent className="p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-200">KYC verification required</p>
              <p className="text-sm text-amber-800 dark:text-amber-300/80">
                Verify your identity in Settings → KYC before applying for an NFC card.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Profile completeness gate (KYC verified but missing fields) */}
      {kycVerified && readiness && !profileReady && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800" data-testid="card-nfc-profile-incomplete">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-amber-900 dark:text-amber-200">Complete your Profile & KYC</p>
              <p className="text-sm text-amber-800 dark:text-amber-300/80">
                Please complete your Profile & KYC first to enable NFC Card creation.
              </p>
              {missingFields.length > 0 && (
                <ul className="text-sm text-amber-800 dark:text-amber-300/80 mt-2 list-disc list-inside" data-testid="list-nfc-missing-fields">
                  {missingFields.map((f) => <li key={f}>{f}</li>)}
                </ul>
              )}
              <Button
                size="sm"
                variant="outline"
                className="mt-3 border-amber-400 text-amber-900 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/40"
                onClick={() => { window.location.href = "/profile"; }}
                data-testid="button-go-to-profile"
              >
                Go to Profile & KYC
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cards list / empty state */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : !cards || cards.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 md:p-12 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Nfc className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold" data-testid="text-no-nfc-cards">No NFC card yet</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Get a contactless Visa for ${NFC_CARD_TOTAL_PRICE_USD.toFixed(2)} — ${NFC_CARD_LOAD_AMOUNT_USD.toFixed(2)} loaded instantly.
              </p>
            </div>
            <Button
              size="lg"
              disabled={!kycVerified || !profileReady}
              onClick={() => setConfirmCreate(true)}
              data-testid="button-create-nfc-card"
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" /> Get my NFC card
            </Button>
            {kycVerified && !profileReady && readiness && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2" data-testid="text-nfc-button-disabled-reason">
                Complete your Profile & KYC to enable this button.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {cards.map((card) => (
            <Card key={card.id} className="overflow-hidden" data-testid={`card-nfc-${card.id}`}>
              <CardContent className="p-0">
                {/* Visual card */}
                <div className="relative bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 text-white p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-white/60">NFC Visa</p>
                      <p className="text-lg font-semibold mt-1" data-testid={`text-nfc-name-${card.id}`}>{card.nameOnCard}</p>
                    </div>
                    <Nfc className="w-8 h-8 text-white/80" />
                  </div>
                  <p className="font-mono text-xl tracking-wider mt-6" data-testid={`text-nfc-last4-${card.id}`}>
                    •••• •••• •••• {card.last4 || "????"}
                  </p>
                  <div className="flex justify-between items-end mt-4">
                    <div>
                      <p className="text-xs text-white/60">Balance</p>
                      <p className="text-2xl font-bold" data-testid={`text-nfc-balance-${card.id}`}>
                        ${parseFloat(card.balance).toFixed(2)}
                      </p>
                    </div>
                    <Badge className={
                      card.status === "active" ? "bg-emerald-500 hover:bg-emerald-500" :
                      card.status === "pending" ? "bg-amber-500 hover:bg-amber-500" :
                      "bg-slate-500 hover:bg-slate-500"
                    } data-testid={`badge-nfc-status-${card.id}`}>
                      {card.status}
                    </Badge>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={card.status !== "active"}
                    onClick={() => setRevealId(card.id)}
                    data-testid={`button-nfc-reveal-${card.id}`}
                  >
                    <Eye className="w-4 h-4 mr-1" /> View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={card.status !== "active"}
                    onClick={() => { setFundOpen(card); setFundAmt(""); }}
                    data-testid={`button-nfc-fund-${card.id}`}
                  >
                    <ArrowDownLeft className="w-4 h-4 mr-1" /> Top-up
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={card.status !== "active" || parseFloat(card.balance) < NFC_WITHDRAW_MIN_USD}
                    onClick={() => { setWithdrawOpen(card); setWithdrawAmt(""); }}
                    data-testid={`button-nfc-withdraw-${card.id}`}
                  >
                    <ArrowUpRight className="w-4 h-4 mr-1" /> Withdraw
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTxnsOpen(card)}
                    data-testid={`button-nfc-txns-${card.id}`}
                  >
                    <Clock className="w-4 h-4 mr-1" /> History
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How NFC payments work</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 font-semibold">1</div>
            <div>
              <p className="font-medium">Add to wallet</p>
              <p className="text-muted-foreground text-xs">Save your NFC card to Apple Pay or Google Pay.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 font-semibold">2</div>
            <div>
              <p className="font-medium">Tap to pay</p>
              <p className="text-muted-foreground text-xs">Use your phone or watch on any contactless reader.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 font-semibold">3</div>
            <div>
              <p className="font-medium">Manage balance</p>
              <p className="text-muted-foreground text-xs">Top up from your USDT wallet anytime.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CREATE confirm dialog */}
      <Dialog open={confirmCreate} onOpenChange={(o) => !createMut.isPending && setConfirmCreate(o)}>
        <DialogContent data-testid="dialog-confirm-create-nfc">
          <DialogHeader>
            <DialogTitle>Issue your NFC Visa card</DialogTitle>
            <DialogDescription>
              A flat ${NFC_CARD_TOTAL_PRICE_USD.toFixed(2)} USDT will be charged from your wallet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Loaded to card</span><span>${NFC_CARD_LOAD_AMOUNT_USD.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Issuance & processing</span><span>${(NFC_CARD_TOTAL_PRICE_USD - NFC_CARD_LOAD_AMOUNT_USD).toFixed(2)}</span></div>
            <Separator />
            <div className="flex justify-between font-semibold"><span>Total</span><span>${NFC_CARD_TOTAL_PRICE_USD.toFixed(2)} USDT</span></div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={createMut.isPending} onClick={() => setConfirmCreate(false)} data-testid="button-cancel-create-nfc">Cancel</Button>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending} data-testid="button-confirm-create-nfc" className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
              {createMut.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Issuing…</> : <>Pay ${NFC_CARD_TOTAL_PRICE_USD.toFixed(2)}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DETAILS dialog */}
      <Dialog open={revealId !== null} onOpenChange={(o) => !o && setRevealId(null)}>
        <DialogContent
          data-testid="dialog-nfc-details"
          className="select-none"
          onContextMenu={(e) => e.preventDefault()}
          style={{
            WebkitUserSelect: "none",
            WebkitTouchCallout: "none",
          }}
        >
          <DialogHeader>
            <DialogTitle>Card details</DialogTitle>
            <DialogDescription className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
              <ShieldAlert className="w-3.5 h-3.5" /> Sensitive — do not screenshot or share.
            </DialogDescription>
          </DialogHeader>
          {hideSensitive && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/95 backdrop-blur-md text-center p-6" data-testid="text-nfc-screenshot-block">
              <div className="space-y-2">
                <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto" />
                <p className="text-sm font-semibold">Card details hidden</p>
                <p className="text-xs text-muted-foreground max-w-xs">For your security, sensitive information is hidden when the app is in the background. Tap the screen to view again.</p>
              </div>
            </div>
          )}
          {detailsLoading ? (
            <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
          ) : detailsResp?.remoteDetail ? (
            <div className="space-y-3 text-sm">
              <DetailRow label="Card number" value={detailsResp.remoteDetail.card_number || `•••• •••• •••• ${detailsResp.card.last4 || "????"}`} onCopy={(v) => copy(v, "Card number")} testId="text-nfc-pan" />
              <DetailRow label="CVV" value={detailsResp.remoteDetail.cvv || "—"} onCopy={(v) => copy(v, "CVV")} testId="text-nfc-cvv" />
              <DetailRow label="Expiry" value={detailsResp.remoteDetail.expiry || detailsResp.remoteDetail.expiry_date || "—"} testId="text-nfc-expiry" />
              <DetailRow label="Name" value={detailsResp.card.nameOnCard} testId="text-nfc-name" />
            </div>
          ) : (
            <div className="text-sm text-muted-foreground flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30" data-testid="text-nfc-details-empty">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <span>{detailsResp?.message || "Card details aren't available right now. Please try again shortly."}</span>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={refreshDetails}
              disabled={detailsFetching || silentBalanceLoading}
              data-testid="button-nfc-refresh"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${(detailsFetching || silentBalanceLoading) ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button onClick={() => setRevealId(null)} data-testid="button-close-nfc-details">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FUND dialog */}
      <Dialog open={!!fundOpen} onOpenChange={(o) => !o && setFundOpen(null)}>
        <DialogContent data-testid="dialog-nfc-fund">
          <DialogHeader>
            <DialogTitle>Top up NFC card</DialogTitle>
            <DialogDescription>Funds are pulled from your USDT wallet.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="fund-amt">Amount (USD)</Label>
              <Input
                id="fund-amt"
                type="number"
                min={NFC_TOPUP_MIN_USD}
                step="0.01"
                value={fundAmt}
                onChange={(e) => setFundAmt(e.target.value)}
                placeholder={`Min $${NFC_TOPUP_MIN_USD}`}
                data-testid="input-nfc-fund-amount"
              />
            </div>
            {fundBreakdown && (
              <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">To card</span><span>${fundBreakdown.loadAmount.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Fixed fee</span><span>${fundBreakdown.fixedFee.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Variable fee (1.9%)</span><span>${fundBreakdown.variableFee.toFixed(2)}</span></div>
                <Separator className="my-1" />
                <div className="flex justify-between font-semibold"><span>Total charged</span><span data-testid="text-nfc-fund-total">${fundBreakdown.total.toFixed(2)} USDT</span></div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFundOpen(null)} disabled={fundMut.isPending} data-testid="button-cancel-nfc-fund">Cancel</Button>
            <Button
              disabled={!fundOpen || !fundBreakdown || fundBreakdown.loadAmount < NFC_TOPUP_MIN_USD || fundMut.isPending}
              onClick={() => fundOpen && fundBreakdown && fundMut.mutate({ id: fundOpen.id, amount: fundBreakdown.loadAmount })}
              data-testid="button-confirm-nfc-fund"
              className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
            >
              {fundMut.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Funding…</> : <>Fund card</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WITHDRAW dialog */}
      <Dialog open={!!withdrawOpen} onOpenChange={(o) => !o && setWithdrawOpen(null)}>
        <DialogContent data-testid="dialog-nfc-withdraw">
          <DialogHeader>
            <DialogTitle>Withdraw to wallet</DialogTitle>
            <DialogDescription>Pull funds off your NFC card back to your Izichanj USDT balance.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="wd-amt">Amount on card (USD)</Label>
              <Input
                id="wd-amt"
                type="number"
                min={NFC_WITHDRAW_MIN_USD}
                step="0.01"
                value={withdrawAmt}
                onChange={(e) => setWithdrawAmt(e.target.value)}
                placeholder={`Min $${NFC_WITHDRAW_MIN_USD}`}
                data-testid="input-nfc-withdraw-amount"
              />
              {withdrawOpen && (
                <p className="text-xs text-muted-foreground mt-1">Card balance: ${parseFloat(withdrawOpen.balance).toFixed(2)}</p>
              )}
            </div>
            {withdrawBreakdown && (
              <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">From card</span><span>${withdrawBreakdown.amount.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Service fee</span><span>− ${withdrawBreakdown.fee.toFixed(2)}</span></div>
                <Separator className="my-1" />
                <div className="flex justify-between font-semibold"><span>Credited to wallet</span><span data-testid="text-nfc-withdraw-net">${withdrawBreakdown.netToWallet.toFixed(2)} USDT</span></div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawOpen(null)} disabled={withdrawMut.isPending} data-testid="button-cancel-nfc-withdraw">Cancel</Button>
            <Button
              disabled={
                !withdrawOpen ||
                !withdrawBreakdown ||
                withdrawBreakdown.amount < NFC_WITHDRAW_MIN_USD ||
                withdrawBreakdown.amount > parseFloat(withdrawOpen.balance) ||
                withdrawBreakdown.netToWallet <= 0 ||
                withdrawMut.isPending
              }
              onClick={() => withdrawOpen && withdrawBreakdown && withdrawMut.mutate({ id: withdrawOpen.id, amount: withdrawBreakdown.amount })}
              data-testid="button-confirm-nfc-withdraw"
              className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
            >
              {withdrawMut.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing…</> : <>Withdraw</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* TRANSACTIONS dialog */}
      <Dialog open={!!txnsOpen} onOpenChange={(o) => !o && setTxnsOpen(null)}>
        <DialogContent className="max-w-lg" data-testid="dialog-nfc-txns">
          <DialogHeader>
            <DialogTitle>NFC card history</DialogTitle>
            <DialogDescription>Combined fund / withdraw / spend activity.</DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {txnsLoading ? (
              <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
            ) : !txns || txns.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-nfc-txns">No transactions yet.</p>
            ) : (
              txns.map((tx) => {
                const inflow = tx.type === "fund" || tx.type === "creation";
                return (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border" data-testid={`row-nfc-tx-${tx.id}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${inflow ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"}`}>
                        {inflow ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium capitalize truncate">{tx.description || tx.type}</p>
                        <p className="text-xs text-muted-foreground">{tx.date ? formatDateTime(tx.date) : "—"}</p>
                      </div>
                    </div>
                    <div className={`text-sm font-semibold ${inflow ? "text-emerald-600" : "text-rose-600"}`}>
                      {inflow ? "+" : "−"}${Math.abs(parseFloat(String(tx.amount || "0"))).toFixed(2)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setTxnsOpen(null)} data-testid="button-close-nfc-txns">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value, onCopy, testId }: { label: string; value: string; onCopy?: (v: string) => void; testId?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-mono text-sm truncate" data-testid={testId}>{value}</p>
      </div>
      {onCopy && (
        <Button size="sm" variant="ghost" onClick={() => onCopy(value)} data-testid={`button-copy-${label.toLowerCase().replace(/\s+/g, "-")}`}>
          <Copy className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
