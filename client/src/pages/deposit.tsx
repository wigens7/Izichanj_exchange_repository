import { useState, useRef, useCallback } from "react";
import { useUser } from "@/hooks/use-auth";
import { useLanguage } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { formatHtg, formatUsdt, NETWORK_FEE_CONFIG, MANUAL_DEPOSIT_MIN_HTG, type NetworkCurrency } from "@shared/constants";
import { useRates } from "@/hooks/use-rates";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy, Check, Loader2, ShieldAlert, Bitcoin, CheckCircle2, AlertCircle, Smartphone, Upload, AlertTriangle, X, ImageIcon, CreditCard, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { QRCodeSVG } from "qrcode.react";

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

interface DepositAddresses {
  trc20Address: string | null;
  bep20Address: string | null;
}

export default function DepositPage() {
  const { data: user } = useUser();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { depositRate } = useRates();
  const kycVerified = user?.kycStatus === "verified";
  const [depositMethod, setDepositMethod] = useState<"crypto" | "moncash">("crypto");
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkKey>("trc20");
  const [copiedTrc20, setCopiedTrc20] = useState(false);
  const [copiedBep20, setCopiedBep20] = useState(false);

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

  // Permanent deposit addresses
  const { data: addresses, isLoading: addressesLoading } = useQuery<DepositAddresses>({
    queryKey: ["/api/deposits/addresses"],
    enabled: depositMethod === "crypto" && kycVerified,
    staleTime: Infinity,
  });

  const networkCurrency = NETWORK_MAP[selectedNetwork];
  const networkConfig = NETWORK_FEE_CONFIG[networkCurrency];
  const htgAmount = parseFloat(amountHtg) || 0;
  const usdtEquiv = htgAmount > 0 ? (htgAmount / depositRate) : 0;
  const belowManualMin = htgAmount > 0 && htgAmount < MANUAL_DEPOSIT_MIN_HTG;
  const companyPhone = mobileWallet === "moncash"
    ? (paymentInfoData?.moncash || "...")
    : (paymentInfoData?.natcash || "...");

  const currentAddress = selectedNetwork === "trc20" ? addresses?.trc20Address : addresses?.bep20Address;

  const copyAddress = (address: string, network: NetworkKey) => {
    navigator.clipboard.writeText(address);
    if (network === "trc20") {
      setCopiedTrc20(true);
      setTimeout(() => setCopiedTrc20(false), 2000);
    } else {
      setCopiedBep20(true);
      setTimeout(() => setCopiedBep20(false), 2000);
    }
    toast({ title: t.deposit.copied, description: t.deposit.copiedDescription });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: t.deposit.copied, description: t.deposit.copiedDescription });
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
    const reader = new FileReader();
    reader.onload = (e) => setProofPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setProofFile(file);
    setProofObjectPath(null);
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

      {/* ── Crypto — Permanent Address ─────────────────────────── */}
      {depositMethod === "crypto" && (
        <div className={!kycVerified ? "opacity-50 pointer-events-none" : ""}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t.deposit.npTitle}</CardTitle>
              <CardDescription className="text-xs">
                Send USDT directly to your permanent address. Deposits are credited automatically after network confirmation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Network selector */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Select Network</label>
                <div className="grid grid-cols-2 gap-2" data-testid="network-selector">
                  <button
                    type="button"
                    onClick={() => setSelectedNetwork("trc20")}
                    data-testid="button-network-trc20"
                    className={`flex flex-col items-center gap-1 py-3 px-4 rounded-lg border text-sm font-medium transition-all ${
                      selectedNetwork === "trc20"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <span className="font-bold">TRC20</span>
                    <span className="text-xs opacity-70">TRON · Fee $2.50 · Min $5.00</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedNetwork("bep20")}
                    data-testid="button-network-bep20"
                    className={`flex flex-col items-center gap-1 py-3 px-4 rounded-lg border text-sm font-medium transition-all ${
                      selectedNetwork === "bep20"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <span className="font-bold">BEP20</span>
                    <span className="text-xs opacity-70">BSC · Fee $0.25 · Min $1.00</span>
                  </button>
                </div>
              </div>

              {/* Address + QR Code */}
              {addressesLoading ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Loading your deposit address…</p>
                </div>
              ) : currentAddress ? (
                <div className="space-y-4">
                  {/* QR Code */}
                  <div className="flex justify-center">
                    <div className="p-3 rounded-xl border border-border bg-white dark:bg-white shadow-sm" data-testid="qr-code-container">
                      <QRCodeSVG
                        value={currentAddress}
                        size={160}
                        bgColor="#ffffff"
                        fgColor="#1e1b4b"
                        level="M"
                      />
                    </div>
                  </div>

                  {/* Address copy row */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5 font-medium">
                      Your {selectedNetwork === "trc20" ? "TRC20 (TRON)" : "BEP20 (BSC)"} Deposit Address
                    </p>
                    <div className="flex items-center gap-2 p-3 rounded-md border border-border bg-muted/30" data-testid="address-box">
                      <p
                        className="font-mono text-xs break-all flex-1 select-all"
                        data-testid={`text-${selectedNetwork}-address`}
                      >
                        {currentAddress}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`flex-shrink-0 transition-colors ${(selectedNetwork === "trc20" ? copiedTrc20 : copiedBep20) ? "text-emerald-600" : ""}`}
                        onClick={() => copyAddress(currentAddress, selectedNetwork)}
                        data-testid={`button-copy-${selectedNetwork}-address`}
                      >
                        {(selectedNetwork === "trc20" ? copiedTrc20 : copiedBep20)
                          ? <Check className="w-4 h-4" />
                          : <Copy className="w-4 h-4" />
                        }
                      </Button>
                    </div>
                  </div>

                  {/* Fee breakdown */}
                  <div className="rounded-lg border border-border bg-muted/30 divide-y divide-border overflow-hidden" data-testid="fee-summary">
                    <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span className="text-muted-foreground">Network Fee ({networkConfig.label})</span>
                      <span className="font-medium text-red-500">−${networkConfig.fee.toFixed(2)} USDT</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span className="text-muted-foreground">Minimum Deposit</span>
                      <span className="font-medium">${networkConfig.minAmount.toFixed(2)} USDT</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5 text-sm bg-emerald-500/5">
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">Example: Send $10 USDT</span>
                      <div className="text-right">
                        <p className="font-bold text-emerald-700 dark:text-emerald-400">
                          ${formatUsdt(10 - networkConfig.fee)} USDT credited
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ≈ {formatHtg((10 - networkConfig.fee) * depositRate)} HTG
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Info note */}
                  <Alert className="bg-blue-500/8 border-blue-200 dark:border-blue-800/50 text-blue-800 dark:text-blue-300">
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      This is your permanent address — it never expires. Send only <strong>USDT ({selectedNetwork === "trc20" ? "TRC20" : "BEP20"})</strong> to this address. Other assets will be lost permanently.
                    </AlertDescription>
                  </Alert>
                </div>
              ) : (
                <Alert className="bg-amber-500/8 border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Address Unavailable</AlertTitle>
                  <AlertDescription className="text-xs">
                    Could not generate your deposit address at this time. Please try refreshing the page or contact support.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
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
