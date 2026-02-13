import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect, useRef } from "react";
import { useUser } from "@/hooks/use-auth";
import { useLanguage } from "@/lib/i18n";
import { EXCHANGE_RATE_USDT_HTG, usdtToHtg, formatHtg, formatUsdt } from "@shared/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy, Loader2, ShieldAlert, ArrowRight, Smartphone, Bitcoin, CheckCircle2, AlertCircle, Clock, RefreshCw } from "lucide-react";
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
}

export default function DepositPage() {
  const { data: user } = useUser();
  const { toast } = useToast();
  const { t } = useLanguage();
  const kycVerified = user?.kycStatus === "verified";
  const [depositMethod, setDepositMethod] = useState<"crypto" | "moncash">("crypto");

  const [cryptoAmount, setCryptoAmount] = useState("");
  const [cryptoLoading, setCryptoLoading] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<NowPaymentInfo | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string>("waiting");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cryptoUsdt = parseFloat(cryptoAmount) || 0;
  const cryptoHtg = usdtToHtg(cryptoUsdt);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

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
    if (cryptoUsdt <= 0) return;
    setCryptoLoading(true);
    try {
      const res = await apiRequest("POST", "/api/nowpayments/create-payment", {
        amountUsdt: cryptoAmount,
        payCurrency: "usdttrc20",
      });
      const data = await res.json();
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
    setPaymentInfo(null);
    setPaymentStatus("waiting");
    setCryptoAmount("");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: t.deposit.copied, description: t.deposit.copiedDescription });
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "waiting":
        return { label: t.deposit.npStatusWaiting, color: "text-amber-600 dark:text-amber-400", icon: Clock };
      case "confirming":
        return { label: t.deposit.npStatusConfirming, color: "text-blue-600 dark:text-blue-400", icon: RefreshCw };
      case "confirmed":
      case "sending":
        return { label: t.deposit.npStatusConfirmed, color: "text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 };
      case "finished":
        return { label: t.deposit.npStatusFinished, color: "text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 };
      case "failed":
        return { label: t.deposit.npStatusFailed, color: "text-red-600 dark:text-red-400", icon: AlertCircle };
      case "expired":
        return { label: t.deposit.npStatusExpired, color: "text-red-600 dark:text-red-400", icon: AlertCircle };
      default:
        return { label: status, color: "text-muted-foreground", icon: Clock };
    }
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
          className="flex-1"
          data-testid="button-method-moncash"
        >
          <Smartphone className="w-4 h-4 mr-2" />
          {t.deposit.methodMoncash}
        </Button>
      </div>

      {depositMethod === "crypto" && !paymentInfo && (
        <Card className={!kycVerified ? "opacity-50 pointer-events-none" : ""}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t.deposit.npTitle}</CardTitle>
            <CardDescription className="text-xs">{t.deposit.npSubtitle}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t.deposit.npAmount}</label>
              <Input
                type="number"
                step="0.01"
                min="1"
                placeholder="10.00"
                value={cryptoAmount}
                onChange={(e) => setCryptoAmount(e.target.value)}
                className="mt-1.5"
                data-testid="input-crypto-amount"
              />
              <p className="text-xs text-muted-foreground mt-1">{t.deposit.npCurrency}</p>
            </div>

            {cryptoUsdt > 0 && (
              <div className="p-3 bg-muted/50 rounded-md border border-border" data-testid="crypto-conversion-preview">
                <div className="flex items-center justify-between flex-wrap gap-2 text-sm">
                  <span className="text-muted-foreground">1 USDT = {EXCHANGE_RATE_USDT_HTG.toFixed(2)} HTG</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatUsdt(cryptoUsdt)} USDT</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    <span className="font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-crypto-htg">{formatHtg(cryptoHtg)} HTG</span>
                  </div>
                </div>
              </div>
            )}

            <Button
              className="w-full primary-gradient"
              disabled={cryptoLoading || !kycVerified || cryptoUsdt <= 0}
              onClick={handleCreatePayment}
              data-testid="button-create-crypto-payment"
            >
              {cryptoLoading ? (
                <>
                  <Loader2 className="animate-spin mr-2 w-4 h-4" />
                  {t.deposit.npCreating}
                </>
              ) : (
                <>
                  <Bitcoin className="w-4 h-4 mr-2" />
                  {t.deposit.npPayButton}
                </>
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
            {(paymentStatus === "finished" || paymentStatus === "confirmed") && (
              <Alert className="bg-emerald-500/8 border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300" data-testid="alert-crypto-success">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>{t.deposit.npSuccess}</AlertTitle>
                <AlertDescription>{t.deposit.npSuccessDesc}</AlertDescription>
              </Alert>
            )}

            {(paymentStatus === "failed" || paymentStatus === "expired") && (
              <Alert className="bg-red-500/8 border-red-200 dark:border-red-800/50 text-red-800 dark:text-red-300" data-testid="alert-crypto-failed">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{paymentStatus === "expired" ? t.deposit.npStatusExpired : t.deposit.npStatusFailed}</AlertTitle>
              </Alert>
            )}

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

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-md border border-border bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-0.5">{t.deposit.npAmountToSend}</p>
                  <p className="font-mono text-sm font-bold" data-testid="text-pay-amount">{paymentInfo.payAmount} {paymentInfo.payCurrency.toUpperCase()}</p>
                </div>
                <div className="p-3 rounded-md border border-border bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-0.5">{t.deposit.npYouReceive}</p>
                  <p className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-receive-amount">{formatHtg(usdtToHtg(parseFloat(String(cryptoAmount)) || 0))} HTG</p>
                </div>
              </div>
            </div>

            {paymentStatus === "waiting" && (
              <p className="text-xs text-muted-foreground text-center">{t.deposit.npWaitingNote}</p>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={handleNewPayment}
              data-testid="button-new-payment"
            >
              {t.deposit.npNewPayment}
            </Button>
          </CardContent>
        </Card>
      )}

      {depositMethod === "moncash" && (
        <Card className="relative overflow-visible">
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-md">
            <Smartphone className="w-10 h-10 text-primary mb-3" />
            <p className="text-lg font-bold" data-testid="text-moncash-coming-soon">{t.deposit.moncashComingSoon}</p>
            <p className="text-sm text-muted-foreground mt-1">{t.deposit.moncashComingSoonDesc}</p>
          </div>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t.deposit.moncashTitle}</CardTitle>
            <CardDescription className="text-xs">{t.deposit.moncashSubtitle}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 opacity-30 pointer-events-none select-none">
            <div>
              <label className="text-sm font-medium">{t.deposit.moncashAmount}</label>
              <Input type="number" disabled placeholder="1000" className="mt-1.5" data-testid="input-moncash-amount" />
              <p className="text-xs text-muted-foreground mt-1">{t.deposit.moncashMinimum}</p>
            </div>
            <Button className="w-full primary-gradient" disabled data-testid="button-moncash-pay">
              <Smartphone className="w-4 h-4 mr-2" />
              {t.deposit.moncashPayButton}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
