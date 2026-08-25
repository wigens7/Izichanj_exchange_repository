import { useState, useRef, useCallback } from "react";
import { useUser } from "@/hooks/use-auth";
import { useLanguage } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { formatHtg, formatUsdt, NETWORK_FEE_CONFIG, MANUAL_DEPOSIT_MIN_HTG, type NetworkCurrency } from "@shared/constants";
import { useRates } from "@/hooks/use-rates";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy, Loader2, ShieldAlert, Bitcoin, CheckCircle2, AlertCircle, Clock, Network, Smartphone, Upload, AlertTriangle, X, ImageIcon, CreditCard } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";

// Static business wallets (mirrors backend STATIC_CRYPTO_WALLETS)
const STATIC_WALLETS: Record<"trc20" | "bep20", { address: string; label: string }> = {
  trc20: { address: "TMo8fkUp5ma5UhRAKLkF6dRbXYs9euq2sc", label: "TRC20" },
  bep20: { address: "0x8312a3f6cb9040ff61d154482a14649fe815a1ba", label: "BEP20" },
};

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
  const { depositRate } = useRates();
  const kycVerified = user?.kycStatus === "verified";
  const [depositMethod, setDepositMethod] = useState<"crypto" | "moncash" | "paypal">("crypto");
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkKey>("trc20");

  // ── Crypto (manual static wallet) state ─────────────────
  const [cryptoAmount, setCryptoAmount] = useState("");
  const [generating, setGenerating] = useState(false);
  const [addressGenerated, setAddressGenerated] = useState(false);
  const [cryptoTxid, setCryptoTxid] = useState("");
  const [cryptoSubmitting, setCryptoSubmitting] = useState(false);
  const [cryptoSuccess, setCryptoSuccess] = useState(false);

  // ── Manual deposit state ───────────────────────
  const [mobileWallet, setMobileWallet] = useState<MobileWallet>("moncash");
  const [amountHtg, setAmountHtg] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [_proofFile, setProofFile] = useState<File | null>(null);
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
  const creditedHtg = creditedUsdt * depositRate;
  const belowMinimum = cryptoUsdt > 0 && cryptoUsdt < networkConfig.minAmount;
  const aboveMaximum = cryptoUsdt > networkConfig.maxAmount;
  const canSubmit = cryptoUsdt >= networkConfig.minAmount && cryptoUsdt <= networkConfig.maxAmount && kycVerified;

  const htgAmount = parseFloat(amountHtg) || 0;
  const usdtEquiv = htgAmount > 0 ? (htgAmount / depositRate) : 0;
  const belowManualMin = htgAmount > 0 && htgAmount < MANUAL_DEPOSIT_MIN_HTG;
  const companyPhone = mobileWallet === "moncash"
    ? (paymentInfoData?.moncash || "...")
    : (paymentInfoData?.natcash || "...");

  const handleGenerateAddress = () => {
    if (!canSubmit) return;
    setGenerating(true);
    // Smooth loading animation, then reveal static address
    setTimeout(() => {
      setGenerating(false);
      setAddressGenerated(true);
    }, 1500);
  };

  const handleResetCrypto = () => {
    setCryptoAmount("");
    setCryptoTxid("");
    setAddressGenerated(false);
    setCryptoSuccess(false);
  };

  const handleSubmitCryptoDeposit = async () => {
    if (!cryptoTxid.trim()) {
      toast({ title: "TXID required", description: "Please paste the transaction hash from your wallet before submitting.", variant: "destructive" });
      return;
    }
    setCryptoSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/deposits/crypto/submit", {
        amountSent: cryptoAmount,
        network: selectedNetwork.toUpperCase(), // "TRC20" | "BEP20"
        txid: cryptoTxid.trim(),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Submission failed", description: data.message || "Failed to submit deposit", variant: "destructive" });
        return;
      }
      setCryptoSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["/api/deposits"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to submit deposit", variant: "destructive" });
    } finally {
      setCryptoSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: t.deposit.copied, description: t.deposit.copiedDescription });
  };

  // Upload proof screenshot to ImgBB via server proxy
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

    setUploadingProof(true);
    try {
      // Convert file to base64 for ImgBB upload (strip the data:…;base64, prefix)
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = (e) => {
          const dataUrl = (e.target?.result as string) || "";
          resolve(dataUrl.replace(/^data:[^;,]*;base64,/i, ""));
        };
        r.onerror = reject;
        r.readAsDataURL(file);
      });

      // POST to /api/files/upload — image stored directly in the database (no external service)
      const uploadRes = await apiRequest("POST", "/api/files/upload", { image: base64, purpose: "deposit_proof" });
      if (!uploadRes.ok) {
        const errData = await uploadRes.json().catch(() => ({}));
        throw new Error((errData as any).error || "Upload failed");
      }
      const data = await uploadRes.json() as { url?: string; imageUrl?: string; fileUrl?: string };
      const imageUrl = data.url || data.imageUrl || data.fileUrl;
      if (!imageUrl) throw new Error("No image URL returned from upload");

      setProofObjectPath(imageUrl);
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
      <div className="grid grid-cols-3 gap-2" data-testid="deposit-method-tabs">
        <Button
          variant={depositMethod === "crypto" ? "default" : "outline"}
          onClick={() => setDepositMethod("crypto")}
          className="w-full"
          data-testid="button-method-crypto"
        >
          <Bitcoin className="w-4 h-4 mr-2" />
          {t.deposit.methodCrypto}
        </Button>
        <Button
          variant={depositMethod === "moncash" ? "default" : "outline"}
          onClick={() => setDepositMethod("moncash")}
          className="w-full relative"
          data-testid="button-method-moncash"
        >
          <Smartphone className="w-4 h-4 mr-2" />
          {t.deposit.methodMoncash}
          <Badge variant="secondary" className="absolute -top-2 -right-2 text-[10px] px-1.5 h-5 flex items-center" data-testid="badge-manual-deposit">
            Manual
          </Badge>
        </Button>
        <Button
          variant={depositMethod === "paypal" ? "default" : "outline"}
          onClick={() => setDepositMethod("paypal")}
          className="w-full"
          data-testid="button-method-paypal"
        >
          <CreditCard className="w-4 h-4 mr-2" />
          PayPal
        </Button>
      </div>

      {depositMethod === "paypal" && (
        <PaypalDepositSection kycVerified={kycVerified} depositRate={depositRate} />
      )}

      {/* ── Crypto Manual Deposit (Static Wallet + TXID) ──────────────────── */}
      {depositMethod === "crypto" && cryptoSuccess && (
        <Card className="border-emerald-200 dark:border-emerald-800/50 bg-emerald-500/5">
          <CardContent className="pt-8 pb-6 text-center space-y-3">
            <div className="flex justify-center">
              <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 p-4">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-emerald-700 dark:text-emerald-400" data-testid="text-crypto-success">Deposit Submitted</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Your deposit is now pending admin verification. Your balance will be credited once the transaction is confirmed on the blockchain.
            </p>
            <Button variant="outline" onClick={handleResetCrypto} className="mt-2" data-testid="button-new-crypto-deposit">
              Submit Another Deposit
            </Button>
          </CardContent>
        </Card>
      )}

      {depositMethod === "crypto" && !cryptoSuccess && !addressGenerated && (
        <Card>
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
                  <span className="text-xs opacity-70">TRON · Min $10.00 · Fee $2.50</span>
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
                  <span className="text-xs opacity-70">BSC · Min $10.00 · Fee $0.25</span>
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
                  className={`pr-16 ${(belowMinimum || aboveMaximum) ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                  data-testid="input-crypto-amount"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">USDT</span>
              </div>
              {belowMinimum && (
                <p className="text-xs text-red-500 mt-1" data-testid="text-below-minimum">
                  Minimum for {networkConfig.label}: ${networkConfig.minAmount.toFixed(2)} USDT
                </p>
              )}
              {aboveMaximum && (
                <p className="text-xs text-red-500 mt-1" data-testid="text-above-maximum">
                  Maximum deposit is ${networkConfig.maxAmount.toLocaleString()} USDT
                </p>
              )}
            </div>

            {cryptoUsdt >= networkConfig.minAmount && !aboveMaximum && (
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
              disabled={generating || !canSubmit}
              onClick={handleGenerateAddress}
              data-testid="button-create-crypto-payment"
            >
              {generating ? (
                <><Loader2 className="animate-spin mr-2 w-4 h-4" />Generating secure {networkConfig.label} address…</>
              ) : (
                <><Network className="w-4 h-4 mr-2" />Generate {networkConfig.label} Address</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {depositMethod === "crypto" && !cryptoSuccess && addressGenerated && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">{t.deposit.npPaymentCreated}</CardTitle>
              <Badge variant="outline" className="text-amber-600 dark:text-amber-400" data-testid="badge-payment-status">
                <Clock className="w-3 h-3 mr-1" />
                Awaiting Your Transfer
              </Badge>
            </div>
            <CardDescription className="text-xs">{t.deposit.npSendToAddress}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-blue-500/8 border-blue-200 dark:border-blue-800/50 text-blue-800 dark:text-blue-300" data-testid="alert-manual-instructions">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Send & Submit TXID</AlertTitle>
              <AlertDescription className="text-xs">
                Send exactly <strong>${formatUsdt(cryptoUsdt)} USDT ({STATIC_WALLETS[selectedNetwork].label})</strong> to the address below.
                After your transfer, paste the Transaction ID (TXID) and click Submit. Admin will manually confirm the deposit.
              </AlertDescription>
            </Alert>

            <div>
              <p className="text-xs text-muted-foreground mb-1">{t.deposit.npPayAddress} — {STATIC_WALLETS[selectedNetwork].label}</p>
              <div className="flex items-center gap-2 p-3 rounded-md border border-border bg-muted/30">
                <p className="font-mono text-xs break-all flex-1" data-testid="text-pay-address">{STATIC_WALLETS[selectedNetwork].address}</p>
                <Button variant="ghost" size="icon" onClick={() => copyToClipboard(STATIC_WALLETS[selectedNetwork].address)} className="flex-shrink-0" data-testid="button-copy-address">
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 divide-y divide-border overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-muted-foreground">Send Exactly</span>
                <span className="font-mono font-bold" data-testid="text-pay-amount">{formatUsdt(cryptoUsdt)} USDT</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-muted-foreground">Network</span>
                <Badge variant="outline" className="text-xs">{networkConfig.label}</Badge>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5 text-sm bg-emerald-500/5">
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">You Will Receive</span>
                <p className="font-bold text-emerald-700 dark:text-emerald-400" data-testid="text-receive-amount">
                  ${formatUsdt(creditedUsdt)} USDT
                </p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium" htmlFor="input-crypto-txid">
                Transaction ID (TXID) <span className="text-red-500">*</span>
              </label>
              <Input
                id="input-crypto-txid"
                className="mt-1.5 font-mono text-xs"
                placeholder="Paste your TXID / transaction hash here"
                value={cryptoTxid}
                onChange={(e) => setCryptoTxid(e.target.value)}
                data-testid="input-crypto-txid"
              />
              <p className="text-xs text-muted-foreground mt-1">
                The TXID is required for admin to verify your transfer on the blockchain.
              </p>
            </div>

            <Alert className="bg-amber-500/8 border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300" data-testid="alert-crypto-warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Only send USDT on the <strong>{networkConfig.label}</strong> network. Sending other tokens or using the wrong network will result in permanent loss of funds.
              </AlertDescription>
            </Alert>

            <Button
              className="w-full primary-gradient"
              disabled={cryptoSubmitting || !cryptoTxid.trim()}
              onClick={handleSubmitCryptoDeposit}
              data-testid="button-submit-crypto-deposit"
            >
              {cryptoSubmitting ? (
                <><Loader2 className="animate-spin mr-2 w-4 h-4" />Submitting…</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" />Submit Deposit</>
              )}
            </Button>

            <Button variant="outline" className="w-full" onClick={handleResetCrypto} data-testid="button-new-payment">
              Cancel & Start Over
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
                    inputMode="numeric"
                    pattern="[0-9]*"
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, "");
                      setTransactionId(digitsOnly);
                    }}
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

// ─────────────────────────────────────────────────────────────────────────────
// PayPal deposit section — separate component so the SDK only loads when the
// user actually opens the PayPal tab. Uses the standard PayPal Buttons JS SDK
// on the client; the server (server/paypal.ts + /api/paypal/*) handles order
// creation, capture, balance crediting, and the $10 flat fee.
// ─────────────────────────────────────────────────────────────────────────────
interface PaypalConfig {
  clientId: string;
  environment: "sandbox" | "live";
  minDeposit: number;
  fee: number;
  maxDeposit: number;
}

function PaypalDepositSection({ kycVerified, depositRate }: { kycVerified: boolean; depositRate: number }) {
  const { toast } = useToast();
  const [amount, setAmount] = useState<string>("");
  const [success, setSuccess] = useState<{ creditedUsdt: number; creditedHtg: number; totalCharged: number; fee: number } | null>(null);
  const buttonsContainerRef = useRef<HTMLDivElement>(null);
  const renderedButtonsRef = useRef<any>(null);
  const sdkLoadedRef = useRef(false);
  const amountRef = useRef<string>("");
  amountRef.current = amount;

  const { data: config, isLoading: configLoading } = useQuery<PaypalConfig>({
    queryKey: ["/api/paypal/client-id"],
    enabled: kycVerified,
  });

  const depositAmt = parseFloat(amount) || 0;
  const minDeposit = config?.minDeposit ?? 20;
  const fee = config?.fee ?? 10;
  const maxDeposit = config?.maxDeposit ?? 10000;
  const totalCharge = depositAmt > 0 ? depositAmt + fee : 0;
  const creditedHtg = depositAmt * depositRate;
  const belowMin = depositAmt > 0 && depositAmt < minDeposit;
  const aboveMax = depositAmt > maxDeposit;
  const validAmount = depositAmt >= minDeposit && depositAmt <= maxDeposit;

  // Load PayPal SDK once we have client-id
  useEffect(() => {
    if (!config?.clientId || sdkLoadedRef.current) return;
    if ((window as any).paypal) { sdkLoadedRef.current = true; return; }
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(config.clientId)}&currency=USD&intent=capture`;
    script.async = true;
    script.onload = () => { sdkLoadedRef.current = true; setTimeout(() => renderButtons(), 0); };
    script.onerror = () => toast({ title: "PayPal SDK failed to load", description: "Check your internet connection and retry.", variant: "destructive" });
    document.body.appendChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.clientId]);

  // (Re)render PayPal Buttons when amount becomes valid
  useEffect(() => {
    if (!sdkLoadedRef.current || !validAmount || success) return;
    renderButtons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validAmount, success]);

  const renderButtons = () => {
    const paypal = (window as any).paypal;
    const container = buttonsContainerRef.current;
    if (!paypal || !container) return;
    container.innerHTML = "";
    renderedButtonsRef.current = paypal.Buttons({
      style: { layout: "vertical", color: "blue", shape: "rect", label: "paypal" },
      onClick: (_data: any, actions: any) => {
        const amt = parseFloat(amountRef.current);
        if (!amt || amt < minDeposit) {
          toast({ title: "Invalid amount", description: `Minimum PayPal deposit is $${minDeposit.toFixed(2)} USD.`, variant: "destructive" });
          return actions.reject();
        }
        if (amt > maxDeposit) {
          toast({ title: "Amount too large", description: `Maximum PayPal deposit is $${maxDeposit.toLocaleString()} USD.`, variant: "destructive" });
          return actions.reject();
        }
        return actions.resolve();
      },
      createOrder: async () => {
        const res = await apiRequest("POST", "/api/paypal/create-order", { amount: parseFloat(amountRef.current) });
        const data = await res.json();
        if (!res.ok) {
          toast({ title: "Failed to create order", description: data.message || "Please try again", variant: "destructive" });
          throw new Error(data.message || "Create order failed");
        }
        return data.id;
      },
      onApprove: async (data: any) => {
        try {
          const res = await apiRequest("POST", "/api/paypal/capture-order", { orderID: data.orderID });
          const result = await res.json();
          if (!res.ok || result.status !== "COMPLETED") {
            toast({ title: "Payment not completed", description: result.message || "Please contact support.", variant: "destructive" });
            return;
          }
          setSuccess({
            creditedUsdt: result.amountCreditedUsdt,
            creditedHtg: result.amountCreditedHtg,
            totalCharged: result.totalChargedUsd,
            fee: result.feeUsd,
          });
          queryClient.invalidateQueries({ queryKey: ["/api/deposits"] });
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
          queryClient.invalidateQueries({ queryKey: ["/api/user"] });
          toast({
            title: result.alreadyProcessed ? "Deposit already credited" : "Deposit successful",
            description: `$${result.amountCreditedUsdt.toFixed(2)} USDT credited to your balance.`,
          });
        } catch (e: any) {
          toast({ title: "Capture failed", description: e?.message || "Failed to capture payment", variant: "destructive" });
        }
      },
      onError: (err: any) => {
        console.error("[PayPal] onError", err);
        toast({ title: "PayPal error", description: "Payment could not be completed. Please try again.", variant: "destructive" });
      },
      onCancel: () => {
        toast({ title: "Payment cancelled", description: "You cancelled the PayPal payment." });
      },
    });
    try { renderedButtonsRef.current.render(container); } catch (e) { console.error("[PayPal] render error:", e); }
  };

  const reset = () => {
    setSuccess(null);
    setAmount("");
  };

  if (!kycVerified) {
    return (
      <Card className="opacity-60">
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Complete KYC verification to enable PayPal deposits.
        </CardContent>
      </Card>
    );
  }

  if (success) {
    return (
      <Card data-testid="card-paypal-success">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            PayPal Deposit Successful
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border border-border bg-emerald-500/5 divide-y divide-border overflow-hidden text-sm">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-muted-foreground">Total Charged</span>
              <span className="font-medium">${success.totalCharged.toFixed(2)} USD</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-muted-foreground">Processing Fee</span>
              <span className="font-medium text-red-500">−${success.fee.toFixed(2)} USD</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-500/10">
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">Credited to Balance</span>
              <div className="text-right">
                <p className="font-bold text-emerald-700 dark:text-emerald-400" data-testid="text-paypal-credited-usdt">${success.creditedUsdt.toFixed(2)} USDT</p>
                <p className="text-xs text-muted-foreground">{formatHtg(success.creditedHtg)} HTG</p>
              </div>
            </div>
          </div>
          <Button className="w-full" variant="outline" onClick={reset} data-testid="button-paypal-new-deposit">
            Make Another PayPal Deposit
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">PayPal Deposit</CardTitle>
        <CardDescription className="text-xs">
          Pay with PayPal balance or card. Minimum ${minDeposit.toFixed(2)} USD · Flat fee ${fee.toFixed(2)} USD
          {config?.environment === "sandbox" && (
            <Badge variant="outline" className="ml-2 text-[10px]">Sandbox</Badge>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium">Deposit Amount</label>
          <div className="relative mt-1.5">
            <Input
              type="number"
              step="0.01"
              min={minDeposit}
              placeholder={minDeposit.toFixed(2)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`pr-16 ${(belowMin || aboveMax) ? "border-red-400 focus-visible:ring-red-400" : ""}`}
              data-testid="input-paypal-amount"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">USD</span>
          </div>
          {belowMin && (
            <p className="text-xs text-red-500 mt-1" data-testid="text-paypal-below-min">
              Minimum PayPal deposit is ${minDeposit.toFixed(2)} USD
            </p>
          )}
          {aboveMax && (
            <p className="text-xs text-red-500 mt-1" data-testid="text-paypal-above-max">
              Maximum PayPal deposit is ${maxDeposit.toLocaleString()} USD
            </p>
          )}
        </div>

        {validAmount && (
          <div className="rounded-lg border border-border bg-muted/30 divide-y divide-border overflow-hidden" data-testid="paypal-fee-summary">
            <div className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-muted-foreground">Deposit Amount</span>
              <span className="font-medium">${depositAmt.toFixed(2)} USD</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-muted-foreground">PayPal Processing Fee</span>
              <span className="font-medium text-red-500">+${fee.toFixed(2)} USD</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 text-sm bg-blue-500/5">
              <span className="font-semibold text-blue-700 dark:text-blue-400">Total Charged on PayPal</span>
              <span className="font-bold text-blue-700 dark:text-blue-400" data-testid="text-paypal-total-charge">${totalCharge.toFixed(2)} USD</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 text-sm bg-emerald-500/5">
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">Credited to Balance</span>
              <div className="text-right">
                <p className="font-bold text-emerald-700 dark:text-emerald-400">${depositAmt.toFixed(2)} USDT</p>
                <p className="text-xs text-muted-foreground">{formatHtg(creditedHtg)} HTG</p>
              </div>
            </div>
          </div>
        )}

        {configLoading && (
          <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading PayPal…
          </div>
        )}

        <div
          ref={buttonsContainerRef}
          className={`min-h-[50px] ${!validAmount ? "opacity-40 pointer-events-none" : ""}`}
          data-testid="paypal-button-container"
        />

        {!validAmount && (
          <p className="text-xs text-muted-foreground text-center">
            Enter at least ${minDeposit.toFixed(2)} USD to activate the PayPal button.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
