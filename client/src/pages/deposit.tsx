import { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "@/hooks/use-auth";
import { useLanguage } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { EXCHANGE_RATE_USDT_HTG, usdtToHtg, formatHtg, formatUsdt, NETWORK_FEE_CONFIG, MANUAL_DEPOSIT_MIN_HTG, MANUAL_DEPOSIT_EXCHANGE_RATE, type NetworkCurrency } from "@shared/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy, Loader2, ShieldAlert, Bitcoin, CheckCircle2, AlertCircle, Clock, RefreshCw, Network, Smartphone, Upload, AlertTriangle, X, ImageIcon, CreditCard } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";

interface NowPaymentInfo {
  depositId: number;
  paymentId: string;
  payAddress: string;
  payAmount: number;
  payCurrency: string;
  expirationDate: string;
  expiresAt: string;
}

type NetworkKey = "trc20" | "bep20";
type MobileWallet = "moncash" | "natcash";

const NETWORK_MAP: Record<NetworkKey, NetworkCurrency> = {
  trc20: "usdttrc20",
  bep20: "usdtbsc",
};

interface ManualPaymentInfo {
  moncash: string;
  natcash: string;
  exchangeRate: number;
  minHtg: number;
  minUsdt: number;
}

export default function DepositPage() {
  const { data: user } = useUser();
  const { toast } = useToast();
  const { t } = useLanguage();
  const kycVerified = user?.kycStatus === "verified";
  const [depositMethod, setDepositMethod] = useState<"crypto" | "moncash">("crypto");
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkKey>("trc20");

  // ── Crypto (NowPayments) state ─────────────────
  const [cryptoAmount, setCryptoAmount] = useState("");
  const [cryptoLoading, setCryptoLoading] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<NowPaymentInfo | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string>("waiting");
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [isLocallyExpired, setIsLocallyExpired] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Manual deposit state ───────────────────────
  const [mobileWallet, setMobileWallet] = useState<MobileWallet>("moncash");
  const [amountHtg, setAmountHtg] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [proofObjectPath, setProofObjectPath] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualSuccess, setManualSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: paymentInfoData } = useQuery<ManualPaymentInfo>({
    queryKey: ["/api/deposits/manual/payment-info"],
    enabled: depositMethod === "moncash",
  });

  const networkCurrency = NETWORK_MAP[selectedNetwork];
  const networkConfig = NETWORK_FEE_CONFIG[networkCurrency];
  const cryptoUsdt = parseFloat(cryptoAmount) || 0;
  const networkFee = networkConfig.fee;
  const creditedUsdt = Math.max(0, cryptoUsdt - networkFee);
  const creditedHtg = usdtToHtg(creditedUsdt);
  const belowMinimum = cryptoUsdt > 0 && cryptoUsdt < networkConfig.minAmount;
  const canSubmit = cryptoUsdt >= networkConfig.minAmount && kycVerified;

  const htgAmount = parseFloat(amountHtg) || 0;
  const usdtEquiv = htgAmount > 0 ? (htgAmount / MANUAL_DEPOSIT_EXCHANGE_RATE) : 0;
  const belowManualMin = htgAmount > 0 && htgAmount < MANUAL_DEPOSIT_MIN_HTG;
  const companyPhone = mobileWallet === "moncash"
    ? (paymentInfoData?.moncash || "...")
    : (paymentInfoData?.natcash || "...");

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!paymentInfo?.expiresAt) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setIsLocallyExpired(false);
    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(paymentInfo.expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        setIsLocallyExpired(true);
        if (timerRef.current) clearInterval(timerRef.current);
        queryClient.invalidateQueries({ queryKey: ["/api/deposits"] });
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paymentInfo?.expiresAt]);

  const startPolling = (paymentId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/nowpayments/payment-status/${paymentId}`, { credentials: "include" });
        const data = await res.json();
        setPaymentStatus(data.paymentStatus || "waiting");
        if (data.paymentStatus === "finished" || data.paymentStatus === "confirmed") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          queryClient.invalidateQueries({ queryKey: ["/api/deposits"] });
          queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        }
        if (data.paymentStatus === "failed" || data.paymentStatus === "expired") {
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      } catch {}
    }, 15000);
  };

  const handleCreatePayment = async () => {
    if (!canSubmit) return;
    setCryptoLoading(true);
    try {
      const res = await apiRequest("POST", "/api/nowpayments/create-payment", {
        amountUsdt: cryptoAmount,
        payCurrency: networkCurrency,
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: data.message || "Failed to create payment", variant: "destructive" });
        return;
      }
      if (data.payAddress) {
        setPaymentInfo(data);
        setPaymentStatus("waiting");
        startPolling(String(data.paymentId));
      } else {
        toast({ title: "Error", description: data.message || "Failed to create payment", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to create payment", variant: "destructive" });
    } finally {
      setCryptoLoading(false);
    }
  };

  const handleNewPayment = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    setPaymentInfo(null);
    setPaymentStatus("waiting");
    setCryptoAmount("");
    setSecondsLeft(0);
    setIsLocallyExpired(false);
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: t.deposit.copied, description: t.deposit.copiedDescription });
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "waiting": return { label: t.deposit.npStatusWaiting, color: "text-amber-600 dark:text-amber-400", icon: Clock };
      case "confirming": return { label: t.deposit.npStatusConfirming, color: "text-blue-600 dark:text-blue-400", icon: RefreshCw };
      case "confirmed":
      case "sending": return { label: t.deposit.npStatusConfirmed, color: "text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 };
      case "finished": return { label: t.deposit.npStatusFinished, color: "text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 };
      case "failed": return { label: t.deposit.npStatusFailed, color: "text-red-600 dark:text-red-400", icon: AlertCircle };
      case "expired": return { label: t.deposit.npStatusExpired, color: "text-red-600 dark:text-red-400", icon: AlertCircle };
      default: return { label: status, color: "text-muted-foreground", icon: Clock };
    }
  };

  // Upload proof screenshot to object storage
  const handleProofFileChange = useCallback(async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file (JPG, PNG, etc.)", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Image must be less than 10MB", variant: "destructive" });
      return;
    }

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (e) => setProofPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setProofFile(file);
    setProofObjectPath(null);

    // Upload to object storage
    setUploadingProof(true);
    try {
      const urlRes = await apiRequest("POST", "/api/deposits/manual/upload-url", {
        name: file.name,
        contentType: file.type,
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();

      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!uploadRes.ok) throw new Error("Upload failed");

      setProofObjectPath(objectPath);
      toast({ title: "Screenshot uploaded", description: "Proof image uploaded successfully" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message || "Failed to upload screenshot", variant: "destructive" });
      setProofPreview(null);
      setProofFile(null);
    } finally {
      setUploadingProof(false);
    }
  }, [toast]);

  const handleManualSubmit = async () => {
    if (!amountHtg || htgAmount < MANUAL_DEPOSIT_MIN_HTG) {
      toast({ title: "Invalid amount", description: `Minimum deposit is ${MANUAL_DEPOSIT_MIN_HTG.toLocaleString()} HTG`, variant: "destructive" });
      return;
    }
    if (!transactionId.trim()) {
      toast({ title: "Transaction ID required", description: "Please enter the transaction ID from your receipt", variant: "destructive" });
      return;
    }
    if (!proofObjectPath) {
      toast({ title: "Screenshot required", description: "Please upload a screenshot of your payment", variant: "destructive" });
      return;
    }

    setManualSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/deposits/manual", {
        amountHtg: htgAmount,
        mobileWallet,
        transactionId: transactionId.trim(),
        proofImageUrl: proofObjectPath,
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Submission failed", description: data.message || "Failed to submit deposit", variant: "destructive" });
        return;
      }
      setManualSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["/api/deposits"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to submit deposit", variant: "destructive" });
    } finally {
      setManualSubmitting(false);
    }
  };

  const resetManualForm = () => {
    setAmountHtg("");
    setTransactionId("");
    setProofFile(null);
    setProofPreview(null);
    setProofObjectPath(null);
    setManualSuccess(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-display font-bold" data-testid="text-deposit-title">{t.deposit.title}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t.deposit.subtitle}</p>
      </div>

      {!kycVerified && (
        <Alert className="bg-amber-500/8 border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300" data-testid="alert-kyc-required-deposit">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>{t.kyc.required}</AlertTitle>
          <AlertDescription>
            {t.kyc.depositMessage}{" "}
            <Link href="/profile" className="underline font-medium">{t.kyc.goToProfile}</Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Method selector */}
      <div className="flex gap-2" data-testid="deposit-method-tabs">
        <Button
          variant={depositMethod === "crypto" ? "default" : "outline"}
          onClick={() => setDepositMethod("crypto")}
          className="flex-1"
          data-testid="button-method-crypto"
        >
          <Bitcoin className="w-4 h-4 mr-2" />
          {t.deposit.methodCrypto}
        </Button>
        <Button
          variant={depositMethod === "moncash" ? "default" : "outline"}
          onClick={() => setDepositMethod("moncash")}
          className="flex-1 relative"
          data-testid="button-method-moncash"
        >
          <Smartphone className="w-4 h-4 mr-2" />
          {t.deposit.methodMoncash}
          <Badge variant="secondary" className="absolute -top-2 -right-2 text-[10px] px-1.5 h-5 flex items-center" data-testid="badge-manual-deposit">
            Manual
          </Badge>
        </Button>
      </div>

      {/* ── Crypto (NowPayments) ─────────────────────────── */}
      {depositMethod === "crypto" && !paymentInfo && (
        <Card className={!kycVerified ? "opacity-50 pointer-events-none" : ""}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t.deposit.npTitle}</CardTitle>
            <CardDescription className="text-xs">{t.deposit.npSubtitle}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Network</label>
              <div className="grid grid-cols-2 gap-2" data-testid="network-selector">
                <button
                  type="button"
                  onClick={() => { setSelectedNetwork("trc20"); setCryptoAmount(""); }}
                  data-testid="button-network-trc20"
                  className={`flex flex-col items-center gap-1 py-3 px-4 rounded-lg border text-sm font-medium transition-all ${
                    selectedNetwork === "trc20"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <span className="font-bold">TRC20</span>
                  <span className="text-xs opacity-70">TRON · Min $12.00 · Fee $1.50</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedNetwork("bep20"); setCryptoAmount(""); }}
                  data-testid="button-network-bep20"
                  className={`flex flex-col items-center gap-1 py-3 px-4 rounded-lg border text-sm font-medium transition-all ${
                    selectedNetwork === "bep20"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <span className="font-bold">BEP20</span>
                  <span className="text-xs opacity-70">BSC · Min $10.25 · Fee $0.25</span>
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">{t.deposit.npAmount}</label>
              <div className="relative mt-1.5">
                <Input
                  type="number"
                  step="0.01"
                  min={networkConfig.minAmount}
                  placeholder={networkConfig.minAmount.toFixed(2)}
                  value={cryptoAmount}
                  onChange={(e) => setCryptoAmount(e.target.value)}
                  className={`pr-16 ${belowMinimum ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                  data-testid="input-crypto-amount"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">USDT</span>
              </div>
              {belowMinimum && (
                <p className="text-xs text-red-500 mt-1" data-testid="text-below-minimum">
                  Minimum for {networkConfig.label}: ${networkConfig.minAmount.toFixed(2)} USDT
                </p>
              )}
            </div>

            {cryptoUsdt >= networkConfig.minAmount && (
              <div className="rounded-lg border border-border bg-muted/30 divide-y divide-border overflow-hidden" data-testid="fee-summary">
                <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">Amount to Send</span>
                  <span className="font-medium">${formatUsdt(cryptoUsdt)} USDT</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">Network Fee ({networkConfig.label})</span>
                  <span className="font-medium text-red-500">−${networkFee.toFixed(2)} USDT</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5 text-sm bg-emerald-500/5">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">Total to be Credited</span>
                  <div className="text-right">
                    <p className="font-bold text-emerald-700 dark:text-emerald-400">${formatUsdt(creditedUsdt)} USDT</p>
                    <p className="text-xs text-muted-foreground">{formatHtg(creditedHtg)} HTG</p>
                  </div>
                </div>
              </div>
            )}

            <Button
              className="w-full primary-gradient"
              disabled={cryptoLoading || !canSubmit}
              onClick={handleCreatePayment}
              data-testid="button-create-crypto-payment"
            >
              {cryptoLoading ? (
                <><Loader2 className="animate-spin mr-2 w-4 h-4" />{t.deposit.npCreating}</>
              ) : (
                <><Network className="w-4 h-4 mr-2" />Generate {networkConfig.label} Address</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {depositMethod === "crypto" && paymentInfo && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">{t.deposit.npPaymentCreated}</CardTitle>
              {(() => {
                const info = getStatusInfo(paymentStatus);
                const StatusIcon = info.icon;
                return (
                  <Badge variant="outline" className={info.color} data-testid="badge-payment-status">
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {info.label}
                  </Badge>
                );
              })()}
            </div>
            <CardDescription className="text-xs">{t.deposit.npSendToAddress}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isLocallyExpired && paymentInfo.expiresAt && paymentStatus === "waiting" && (
              <Alert className={`${secondsLeft <= 60 ? "bg-red-500/8 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300" : "bg-amber-500/8 border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300"}`} data-testid="alert-deposit-timer">
                <Clock className="h-4 w-4" />
                <AlertTitle className="flex items-center justify-between">
                  <span>Address valid for 15 minutes only</span>
                  <span className="font-mono text-lg font-bold tracking-widest" data-testid="text-countdown">{formatCountdown(secondsLeft)}</span>
                </AlertTitle>
                <AlertDescription className="text-xs">
                  Please complete your transfer within this timeframe. The address will expire automatically.
                </AlertDescription>
              </Alert>
            )}

            {isLocallyExpired && (
              <Alert className="bg-red-500/8 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300" data-testid="alert-deposit-expired">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Transaction Expired</AlertTitle>
                <AlertDescription>This deposit address has expired. Please generate a new deposit request.</AlertDescription>
              </Alert>
            )}

            {(paymentStatus === "finished" || paymentStatus === "confirmed") && (
              <Alert className="bg-emerald-500/8 border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300" data-testid="alert-crypto-success">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>{t.deposit.npSuccess}</AlertTitle>
                <AlertDescription>{t.deposit.npSuccessDesc}</AlertDescription>
              </Alert>
            )}

            {(paymentStatus === "failed" || paymentStatus === "expired") && !isLocallyExpired && (
              <Alert className="bg-red-500/8 border-red-200 dark:border-red-800/50 text-red-800 dark:text-red-300" data-testid="alert-crypto-failed">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{paymentStatus === "expired" ? t.deposit.npStatusExpired : t.deposit.npStatusFailed}</AlertTitle>
              </Alert>
            )}

            {!isLocallyExpired && paymentStatus !== "failed" && paymentStatus !== "expired" && (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t.deposit.npPayAddress}</p>
                  <div className="flex items-center gap-2 p-3 rounded-md border border-border bg-muted/30">
                    <p className="font-mono text-xs break-all flex-1" data-testid="text-pay-address">{paymentInfo.payAddress}</p>
                    <Button variant="ghost" size="icon" onClick={() => copyToClipboard(paymentInfo.payAddress)} className="flex-shrink-0" data-testid="button-copy-address">
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/30 divide-y divide-border overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-muted-foreground">Send Exactly</span>
                    <span className="font-mono font-bold" data-testid="text-pay-amount">{paymentInfo.payAmount} {paymentInfo.payCurrency.toUpperCase()}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-muted-foreground">Network</span>
                    <Badge variant="outline" className="text-xs">
                      {NETWORK_FEE_CONFIG[paymentInfo.payCurrency as NetworkCurrency]?.label ?? paymentInfo.payCurrency.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5 text-sm bg-emerald-500/5">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">You Will Receive</span>
                    <p className="font-bold text-emerald-700 dark:text-emerald-400" data-testid="text-receive-amount">{formatHtg(creditedHtg)} HTG</p>
                  </div>
                </div>
              </div>
            )}

            {paymentStatus === "waiting" && !isLocallyExpired && (
              <p className="text-xs text-muted-foreground text-center">{t.deposit.npWaitingNote}</p>
            )}

            <Button variant="outline" className="w-full" onClick={handleNewPayment} data-testid="button-new-payment">
              {isLocallyExpired ? "Generate New Deposit Request" : t.deposit.npNewPayment}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── MonCash / NatCash Manual Deposit ────────────────── */}
      {depositMethod === "moncash" && (
        <div className={!kycVerified ? "opacity-50 pointer-events-none" : ""}>
          {manualSuccess ? (
            <Card className="border-emerald-200 dark:border-emerald-800/50 bg-emerald-500/5">
              <CardContent className="pt-8 pb-6 text-center space-y-3">
                <div className="flex justify-center">
                  <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 p-4">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-emerald-700 dark:text-emerald-400" data-testid="text-manual-success">{t.deposit.manualSuccess}</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">{t.deposit.manualSuccessDesc}</p>
                <Button variant="outline" onClick={resetManualForm} className="mt-2" data-testid="button-new-manual-deposit">
                  Submit Another Deposit
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-primary" />
                  {t.deposit.moncashTitle}
                </CardTitle>
                <CardDescription className="text-xs">{t.deposit.moncashSubtitle}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">

                {/* Step 1: Mobile wallet selector */}
                <div>
                  <label className="text-sm font-medium mb-2 block">{t.deposit.manualWalletLabel}</label>
                  <div className="grid grid-cols-2 gap-2" data-testid="mobile-wallet-selector">
                    <button
                      type="button"
                      onClick={() => setMobileWallet("moncash")}
                      data-testid="button-wallet-moncash"
                      className={`flex flex-col items-center gap-1.5 py-3 px-4 rounded-lg border text-sm font-medium transition-all ${
                        mobileWallet === "moncash"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      <CreditCard className="w-5 h-5" />
                      <span className="font-bold">MonCash</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMobileWallet("natcash")}
                      data-testid="button-wallet-natcash"
                      className={`flex flex-col items-center gap-1.5 py-3 px-4 rounded-lg border text-sm font-medium transition-all ${
                        mobileWallet === "natcash"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      <CreditCard className="w-5 h-5" />
                      <span className="font-bold">{t.deposit.methodNatcash}</span>
                    </button>
                  </div>
                </div>

                {/* Step 2: Amount */}
                <div>
                  <label className="text-sm font-medium">{t.deposit.moncashAmount}</label>
                  <div className="relative mt-1.5">
                    <Input
                      type="number"
                      step="10"
                      min={MANUAL_DEPOSIT_MIN_HTG}
                      placeholder={t.deposit.moncashAmountPlaceholder}
                      value={amountHtg}
                      onChange={(e) => setAmountHtg(e.target.value)}
                      className={`pr-12 ${belowManualMin ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                      data-testid="input-manual-amount-htg"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">HTG</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{t.deposit.moncashMinimum}</p>
                  {belowManualMin && (
                    <p className="text-xs text-red-500 mt-0.5" data-testid="text-below-manual-min">
                      Minimum deposit: {MANUAL_DEPOSIT_MIN_HTG.toLocaleString()} HTG
                    </p>
                  )}
                  {htgAmount >= MANUAL_DEPOSIT_MIN_HTG && (
                    <div className="mt-2 rounded-lg border border-border bg-emerald-500/5 px-4 py-2.5 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t.deposit.manualUsdtEquiv}</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">{formatUsdt(usdtEquiv)} USDT</span>
                    </div>
                  )}
                </div>

                {/* Step 3: Company account to pay */}
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide">{t.deposit.manualSendTo}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 font-mono text-sm font-bold tracking-wide" data-testid="text-company-phone">{companyPhone}</div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => copyToClipboard(companyPhone)}
                      data-testid="button-copy-company-phone"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {mobileWallet === "moncash" ? "MonCash" : "NatCash"} — Send the exact amount, then fill in the details below.
                  </p>
                </div>

                {/* Step 4: Transaction ID */}
                <div>
                  <label className="text-sm font-medium">{t.deposit.manualTxId}</label>
                  <Input
                    className="mt-1.5"
                    placeholder={t.deposit.manualTxIdPlaceholder}
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    data-testid="input-manual-tx-id"
                  />
                </div>

                {/* Step 5: Screenshot upload */}
                <div>
                  <label className="text-sm font-medium mb-1.5 block">{t.deposit.manualProof}</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    data-testid="input-proof-file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleProofFileChange(file);
                    }}
                  />

                  {proofPreview ? (
                    <div className="relative rounded-lg border border-border overflow-hidden">
                      <img
                        src={proofPreview}
                        alt="Payment proof"
                        className="w-full max-h-48 object-contain bg-muted/20"
                        data-testid="img-proof-preview"
                      />
                      <div className="absolute top-2 right-2 flex gap-1.5">
                        {uploadingProof && (
                          <div className="bg-background/90 rounded-full px-2 py-1 flex items-center gap-1 text-xs">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {t.deposit.manualProofUploading}
                          </div>
                        )}
                        {proofObjectPath && !uploadingProof && (
                          <div className="bg-emerald-600 text-white rounded-full px-2 py-1 flex items-center gap-1 text-xs">
                            <CheckCircle2 className="w-3 h-3" />
                            {t.deposit.manualProofUploaded}
                          </div>
                        )}
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-6 w-6 rounded-full"
                          onClick={() => {
                            setProofFile(null);
                            setProofPreview(null);
                            setProofObjectPath(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          data-testid="button-remove-proof"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="button-upload-proof"
                      className="w-full rounded-lg border-2 border-dashed border-border hover:border-primary/40 bg-muted/20 hover:bg-muted/40 transition-colors py-8 flex flex-col items-center gap-2 text-muted-foreground"
                    >
                      <ImageIcon className="w-8 h-8 opacity-50" />
                      <span className="text-sm font-medium">{t.deposit.manualProofDesc}</span>
                      <span className="text-xs opacity-60">JPG, PNG — max 10MB</span>
                    </button>
                  )}
                </div>

                {/* Anti-fraud warning */}
                <Alert className="bg-red-500/8 border-red-200 dark:border-red-800/50 text-red-800 dark:text-red-300" data-testid="alert-fraud-warning">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">{t.deposit.manualWarning}</AlertDescription>
                </Alert>

                {/* Submit */}
                <Button
                  className="w-full primary-gradient"
                  disabled={
                    manualSubmitting ||
                    !amountHtg ||
                    htgAmount < MANUAL_DEPOSIT_MIN_HTG ||
                    !transactionId.trim() ||
                    !proofObjectPath ||
                    uploadingProof
                  }
                  onClick={handleManualSubmit}
                  data-testid="button-submit-manual-deposit"
                >
                  {manualSubmitting ? (
                    <><Loader2 className="animate-spin mr-2 w-4 h-4" />{t.deposit.manualSubmitting}</>
                  ) : uploadingProof ? (
                    <><Loader2 className="animate-spin mr-2 w-4 h-4" />{t.deposit.manualProofUploading}</>
                  ) : (
                    <><Upload className="w-4 h-4 mr-2" />{t.deposit.moncashPayButton}</>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
