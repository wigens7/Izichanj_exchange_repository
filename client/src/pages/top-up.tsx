import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useUser } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Smartphone, CheckCircle2, AlertCircle, Loader2, ShieldAlert, History, Phone, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link } from "wouter";
import { format } from "date-fns";
import { TOPUP_FEE_USD } from "@shared/constants";

export default function TopUpPage() {
  const { data: user } = useUser();
  const { toast } = useToast();

  const [phone, setPhone] = useState("");
  const [selectedOperator, setSelectedOperator] = useState<any>(null);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [result, setResult] = useState<{ success: boolean; message: string; transactionId?: string } | null>(null);

  const balance = Number(user?.balance || 0);
  const kycVerified = user?.kycStatus === "verified";

  const { data: operators, isLoading: loadingOps, error: opsError, refetch: refetchOps } = useQuery<any[]>({
    queryKey: ["/api/topup/operators"],
    queryFn: async () => {
      const res = await fetch("/api/topup/operators?countryCode=HT", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load operators");
      const data = await res.json();
      return Array.isArray(data) ? data : (data.content || []);
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: history, isLoading: loadingHistory } = useQuery<any[]>({
    queryKey: ["/api/topup/history"],
    queryFn: async () => {
      const res = await fetch("/api/topup/history", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load history");
      return res.json();
    },
    staleTime: 0,
  });

  // Compute valid amounts for the selected operator
  const validAmounts: number[] = (() => {
    if (!selectedOperator) return [];
    if (selectedOperator.denominationType === "FIXED") {
      const fixed: number[] = selectedOperator.fixedAmounts || [];
      if (fixed.length) return fixed;
      const mapKeys = Object.keys(selectedOperator.suggestedAmountsMap || {}).map(Number).filter(Boolean);
      return mapKeys.sort((a, b) => a - b);
    }
    const suggested: number[] = selectedOperator.suggestedAmounts || [];
    if (suggested.length) return suggested.slice(0, 12);
    return [];
  })();

  const isRange = selectedOperator?.denominationType === "RANGE";
  const minAmt = selectedOperator?.minAmount ?? 1;
  const maxAmt = selectedOperator?.maxAmount ?? 100;

  const amount = selectedAmount ?? (customAmount ? Number(customAmount) : null);

  const amountError = (() => {
    if (!amount || !selectedOperator) return null;
    if (amount + TOPUP_FEE_USD > balance) return `Insufficient balance. You need $${(amount + TOPUP_FEE_USD).toFixed(2)} (amount + $${TOPUP_FEE_USD.toFixed(2)} fee).`;
    if (selectedOperator.denominationType === "FIXED" && validAmounts.length && !validAmounts.includes(amount)) {
      return `This operator only accepts: $${validAmounts.join(", $")}`;
    }
    if (isRange && amount < minAmt) return `Minimum is $${minAmt}`;
    if (isRange && amount > maxAmt) return `Maximum is $${maxAmt}`;
    return null;
  })();

  const topupMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOperator) throw new Error("Please select an operator");
      if (!phone.trim()) throw new Error("Please enter a phone number");
      if (!amount || amount <= 0) throw new Error("Please select or enter an amount");

      const rawPhone = phone.replace(/\D/g, "");
      if (rawPhone.length < 7) throw new Error("Phone number is too short");
      if (amount + TOPUP_FEE_USD > balance) throw new Error(`Insufficient balance. You need $${(amount + TOPUP_FEE_USD).toFixed(2)} (amount + $${TOPUP_FEE_USD.toFixed(2)} fee).`);
      if (amountError) throw new Error(amountError);

      // Use raw fetch so we can parse and surface only the clean message, not the full HTTP payload
      const res = await fetch("/api/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: rawPhone, operatorId: selectedOperator.id, amount }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Top-up failed. Please try again.");
      return data;
    },
    onSuccess: (data) => {
      setResult({ success: true, message: data.message, transactionId: data.transactionId });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/topup/history"] });
      setPhone("");
      setSelectedAmount(null);
      setCustomAmount("");
    },
    onError: (err: Error) => {
      setResult({ success: false, message: err.message });
    },
  });

  const handleSubmit = () => {
    setResult(null);
    topupMutation.mutate();
  };

  const handleSelectOperator = (op: any) => {
    setSelectedOperator(op);
    setSelectedAmount(null);
    setCustomAmount("");
    setResult(null);
  };

  return (
    <div className="max-w-xl mx-auto space-y-5 animate-in fade-in duration-300">
      <div className="space-y-1">
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Smartphone className="w-6 h-6 text-primary" />
          Mobile Top-Up
        </h1>
        <p className="text-muted-foreground text-sm">Recharge any Haitian mobile number instantly using your USDT balance.</p>
      </div>

      {!kycVerified && (
        <Alert className="bg-amber-500/8 border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300" data-testid="alert-kyc-required-topup">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>KYC Verification Required</AlertTitle>
          <AlertDescription>
            You must complete identity verification before using Mobile Top-Up.{" "}
            <Link href="/profile" className="underline font-medium">Go to Profile</Link>
          </AlertDescription>
        </Alert>
      )}

      <div className={!kycVerified ? "opacity-50 pointer-events-none select-none" : ""}>

        {/* Balance */}
        <Card className="border-none shadow-sm">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Available Balance</span>
              <Badge variant="secondary" className="text-base font-mono font-semibold" data-testid="text-balance-topup">
                ${balance.toFixed(2)} USD
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Step 1 — Phone */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">1</span>
              Phone Number
            </CardTitle>
            <CardDescription>Enter the Haitian number to recharge</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-md border bg-muted/50 text-sm font-medium shrink-0">
                🇭🇹 +509
              </div>
              <Input
                type="tel"
                placeholder="XXXXXXXX"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                maxLength={15}
                data-testid="input-topup-phone"
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">Enter 8-digit number without country code (e.g. 34712345)</p>
          </CardContent>
        </Card>

        {/* Step 2 — Operator */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">2</span>
              Select Operator
            </CardTitle>
            <CardDescription>Choose the mobile network</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingOps ? (
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
              </div>
            ) : opsError || !operators?.length ? (
              <div className="text-center py-6 text-muted-foreground">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                <p className="text-sm mb-3">Could not load operators.</p>
                <Button variant="outline" size="sm" onClick={() => refetchOps()}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {operators.map((op: any) => (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => handleSelectOperator(op)}
                    data-testid={`button-operator-${op.id}`}
                    className={`flex flex-col items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all text-sm font-medium text-left ${
                      selectedOperator?.id === op.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border hover:border-primary/50 hover:bg-muted/40"
                    }`}
                  >
                    {op.logoUrls?.[0] ? (
                      <img src={op.logoUrls[0]} alt={op.name} className="h-8 w-auto object-contain" />
                    ) : (
                      <Smartphone className="w-6 h-6 text-muted-foreground" />
                    )}
                    <span className="text-center leading-tight text-xs">{op.name}</span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 3 — Amount (shown after operator selected) */}
        {selectedOperator && (
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">3</span>
                Top-Up Amount (USD)
              </CardTitle>
              <CardDescription>
                {selectedOperator.denominationType === "FIXED"
                  ? "Select one of the available amounts for this operator"
                  : `Custom amount between $${minAmt} – $${maxAmt}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {validAmounts.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {validAmounts.map(a => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => { setSelectedAmount(a); setCustomAmount(""); }}
                      data-testid={`button-amount-${a}`}
                      className={`py-2.5 rounded-lg border-2 font-semibold text-sm transition-all ${
                        selectedAmount === a && !customAmount
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:border-primary/50 hover:bg-muted/40"
                      }`}
                    >
                      ${a}
                    </button>
                  ))}
                </div>
              )}

              {isRange && (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                  <Input
                    type="number"
                    min={minAmt}
                    max={maxAmt}
                    step="0.01"
                    placeholder={`${minAmt} – ${maxAmt}`}
                    value={customAmount}
                    onChange={e => { setCustomAmount(e.target.value); setSelectedAmount(null); }}
                    className="pl-7"
                    data-testid="input-topup-custom-amount"
                  />
                </div>
              )}

              {amount !== null && amount > 0 && (
                <div className={`text-xs rounded-md px-3 py-2 ${amountError ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800" : "bg-muted/50 text-muted-foreground"}`}>
                  {amountError ? (
                    <span className="flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5 shrink-0" />{amountError}</span>
                  ) : (
                    <span>
                      Top-up: <strong className="text-foreground">${amount.toFixed(2)}</strong>
                      {" + "}
                      Fee: <strong className="text-foreground">${TOPUP_FEE_USD.toFixed(2)}</strong>
                      {" = "}
                      Total: <strong className="text-foreground">${(amount + TOPUP_FEE_USD).toFixed(2)} USD</strong>
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Result */}
        {result && (
          <div className={`flex items-start gap-3 p-4 rounded-lg border ${
            result.success
              ? "border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800"
              : "border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800"
          }`} data-testid="topup-result">
            {result.success
              ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              : <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />}
            <div>
              <p className={`font-medium text-sm ${result.success ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300"}`}>
                {result.success ? "Top-Up Successful!" : "Top-Up Failed"}
              </p>
              <p className="text-xs mt-0.5 text-muted-foreground">{result.message}</p>
              {result.transactionId && (
                <p className="text-xs mt-1 font-mono text-muted-foreground">Transaction ID: {result.transactionId}</p>
              )}
            </div>
          </div>
        )}

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={
            topupMutation.isPending ||
            !selectedOperator ||
            !phone.trim() ||
            !amount ||
            amount <= 0 ||
            !!amountError
          }
          className="w-full primary-gradient"
          data-testid="button-send-topup"
          size="lg"
        >
          {topupMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing…
            </>
          ) : (
            <>
              <Smartphone className="w-4 h-4 mr-2" />
              Send Top-Up{amount ? ` · $${(Number(amount) + TOPUP_FEE_USD).toFixed(2)}` : ""}
            </>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Powered by Reloadly · Instant delivery · Requires verified KYC
        </p>
      </div>

      {/* History */}
      <Separator />
      <div className="space-y-3 pb-6">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <History className="w-4 h-4 text-muted-foreground" />
          Recent Top-Ups
        </h2>
        {loadingHistory ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : !history?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            <Phone className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No top-ups yet</p>
            <p className="text-xs mt-1">Your recharge history will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((tx: any) => {
              const txDate = tx.createdAt ? (() => { try { return format(new Date(tx.createdAt), "MMM d, yyyy · h:mm a"); } catch { return ""; } })() : "";
              return (
                <div key={tx.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card" data-testid={`topup-history-${tx.id}`}>
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Smartphone className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tx.operatorName}</p>
                    <p className="text-xs text-muted-foreground">+509 {tx.phone} · {txDate}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-foreground">-${Number(tx.amountUsd).toFixed(2)}</p>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-emerald-300 text-emerald-600 dark:text-emerald-400 dark:border-emerald-700">
                      <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
                      {tx.status}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
