import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect } from "react";
import { useCreateDeposit } from "@/hooks/use-transactions";
import { useUser } from "@/hooks/use-auth";
import { useLanguage } from "@/lib/i18n";
import { EXCHANGE_RATE_USDT_HTG, usdtToHtg, htgToUsdt, formatHtg, formatUsdt } from "@shared/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy, Loader2, ShieldAlert, ArrowRight, Smartphone, Bitcoin, CheckCircle2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";

const depositSchema = z.object({
  amountUsdt: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Amount must be greater than 0"),
  txHash: z.string().min(10, "Transaction hash invalid"),
});

export default function DepositPage() {
  const { data: user } = useUser();
  const { mutate: createDeposit, isPending } = useCreateDeposit();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const kycVerified = user?.kycStatus === "verified";
  const [depositMethod, setDepositMethod] = useState<"usdt" | "moncash">("usdt");
  const [moncashAmount, setMoncashAmount] = useState("");
  const [moncashLoading, setMoncashLoading] = useState(false);
  const [moncashVerifying, setMoncashVerifying] = useState(false);
  const [moncashResult, setMoncashResult] = useState<"success" | "error" | null>(null);

  const form = useForm<z.infer<typeof depositSchema>>({
    resolver: zodResolver(depositSchema),
    defaultValues: { amountUsdt: "", txHash: "" },
  });

  const watchedAmount = form.watch("amountUsdt");
  const amountUsdt = parseFloat(watchedAmount) || 0;
  const amountHtg = usdtToHtg(amountUsdt);

  const moncashHtg = parseFloat(moncashAmount) || 0;
  const moncashUsdt = htgToUsdt(moncashHtg);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const txnId = params.get("moncash_txn");
    if (txnId) {
      setDepositMethod("moncash");
      setMoncashVerifying(true);
      fetch(`/api/moncash/verify?transactionId=${encodeURIComponent(txnId)}`, { credentials: "include" })
        .then(res => res.json())
        .then(data => {
          if (data.status === "approved" || data.status === "already_processed") {
            setMoncashResult("success");
            queryClient.invalidateQueries({ queryKey: ["/api/deposits"] });
            queryClient.invalidateQueries({ queryKey: ["/api/user"] });
          } else {
            setMoncashResult("error");
          }
        })
        .catch(() => setMoncashResult("error"))
        .finally(() => setMoncashVerifying(false));
      window.history.replaceState({}, "", "/deposit");
    }
  }, []);

  const onSubmit = (data: z.infer<typeof depositSchema>) => {
    createDeposit({
      amountUsdt: data.amountUsdt,
      txHash: data.txHash
    }, {
      onSuccess: () => form.reset()
    });
  };

  const handleMoncashPayment = async () => {
    if (moncashHtg < 100) {
      toast({ title: "Error", description: t.deposit.moncashMinimum, variant: "destructive" });
      return;
    }
    setMoncashLoading(true);
    try {
      const res = await apiRequest("POST", "/api/moncash/create-payment", { amountHtg: moncashAmount });
      const data = await res.json();
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        toast({ title: "Error", description: data.message || "Failed to create payment", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to create payment", variant: "destructive" });
    } finally {
      setMoncashLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: t.deposit.copied, description: t.deposit.copiedDescription });
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

      {moncashVerifying && (
        <Alert className="border-blue-200 dark:border-blue-800/50 text-blue-800 dark:text-blue-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertTitle>{t.deposit.moncashVerifying}</AlertTitle>
        </Alert>
      )}

      {moncashResult === "success" && (
        <Alert className="bg-emerald-500/8 border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300" data-testid="alert-moncash-success">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>{t.deposit.moncashSuccess}</AlertTitle>
          <AlertDescription>{t.deposit.moncashSuccessDesc}</AlertDescription>
        </Alert>
      )}

      {moncashResult === "error" && (
        <Alert className="bg-red-500/8 border-red-200 dark:border-red-800/50 text-red-800 dark:text-red-300" data-testid="alert-moncash-error">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t.deposit.moncashError}</AlertTitle>
        </Alert>
      )}

      <div className="flex gap-2" data-testid="deposit-method-tabs">
        <Button
          variant={depositMethod === "usdt" ? "default" : "outline"}
          onClick={() => setDepositMethod("usdt")}
          className="flex-1"
          data-testid="button-method-usdt"
        >
          <Bitcoin className="w-4 h-4 mr-2" />
          {t.deposit.methodUsdt}
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

      {depositMethod === "usdt" && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t.deposit.walletAddresses}</CardTitle>
              <CardDescription className="text-xs">{t.deposit.subtitle}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <AddressCard network="TRC20" address="TRydVikZb957Y298cKsFL81aajz3sfaUmq" onCopy={copyToClipboard} />
              <AddressCard network="BEP20" address="0xbd1a6e9f3bcb8179883799585ef9d6dc06b8a974" onCopy={copyToClipboard} />
            </CardContent>
          </Card>

          <Card className={!kycVerified ? "opacity-50 pointer-events-none" : ""}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t.deposit.submitTransaction}</CardTitle>
              <CardDescription className="text-xs">{t.deposit.verifyDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="amountUsdt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.deposit.amountSent}</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="100.00" {...field} data-testid="input-deposit-amount" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {amountUsdt > 0 && (
                    <div className="p-3 bg-muted/50 rounded-md border border-border" data-testid="deposit-conversion-preview">
                      <div className="flex items-center justify-between flex-wrap gap-2 text-sm">
                        <span className="text-muted-foreground">1 USDT = {EXCHANGE_RATE_USDT_HTG.toFixed(2)} HTG</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{amountUsdt.toFixed(2)} USDT</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <span className="font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-deposit-htg">{formatHtg(amountHtg)} HTG</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="txHash"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.deposit.txHash}</FormLabel>
                        <FormControl>
                          <Input placeholder={t.deposit.txHashPlaceholder} {...field} data-testid="input-deposit-txhash" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full primary-gradient" disabled={isPending || !kycVerified} data-testid="button-submit-deposit">
                    {isPending ? <Loader2 className="animate-spin mr-2" /> : t.deposit.verifyDeposit}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </>
      )}

      {depositMethod === "moncash" && (
        <Card className={!kycVerified ? "opacity-50 pointer-events-none" : ""}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t.deposit.moncashTitle}</CardTitle>
            <CardDescription className="text-xs">{t.deposit.moncashSubtitle}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t.deposit.moncashAmount}</label>
              <Input
                type="number"
                step="1"
                min="100"
                placeholder={t.deposit.moncashAmountPlaceholder}
                value={moncashAmount}
                onChange={(e) => setMoncashAmount(e.target.value)}
                className="mt-1.5"
                data-testid="input-moncash-amount"
              />
              <p className="text-xs text-muted-foreground mt-1">{t.deposit.moncashMinimum}</p>
            </div>

            {moncashHtg >= 100 && (
              <div className="p-3 bg-muted/50 rounded-md border border-border" data-testid="moncash-conversion-preview">
                <div className="flex items-center justify-between flex-wrap gap-2 text-sm">
                  <span className="text-muted-foreground">1 USDT = {EXCHANGE_RATE_USDT_HTG.toFixed(2)} HTG</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatHtg(moncashHtg)} HTG</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    <span className="font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-moncash-usdt">{formatUsdt(moncashUsdt)} USDT</span>
                  </div>
                </div>
              </div>
            )}

            <Button
              className="w-full primary-gradient"
              disabled={moncashLoading || !kycVerified || moncashHtg < 100}
              onClick={handleMoncashPayment}
              data-testid="button-moncash-pay"
            >
              {moncashLoading ? (
                <>
                  <Loader2 className="animate-spin mr-2 w-4 h-4" />
                  {t.deposit.moncashProcessing}
                </>
              ) : (
                <>
                  <Smartphone className="w-4 h-4 mr-2" />
                  {t.deposit.moncashPayButton}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AddressCard({ network, address, onCopy }: { network: string; address: string; onCopy: (text: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-md border border-border bg-muted/30">
      <div className="min-w-0 flex-1">
        <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded mb-1.5">{network}</span>
        <p className="font-mono text-xs break-all text-muted-foreground leading-relaxed">{address}</p>
      </div>
      <Button variant="ghost" size="icon" onClick={() => onCopy(address)} className="flex-shrink-0" data-testid={`button-copy-${network.toLowerCase()}`}>
        <Copy className="w-4 h-4" />
      </Button>
    </div>
  );
}
