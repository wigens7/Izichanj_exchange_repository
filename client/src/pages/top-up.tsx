import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useUser } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Smartphone, CheckCircle2, AlertCircle, Loader2, ChevronDown } from "lucide-react";

const PRESET_AMOUNTS = [2, 5, 10, 15, 20, 25];

export default function TopUpPage() {
  const { data: user } = useUser();
  const { toast } = useToast();

  const [phone, setPhone] = useState("");
  const [selectedOperator, setSelectedOperator] = useState<any>(null);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [result, setResult] = useState<{ success: boolean; message: string; transactionId?: string } | null>(null);

  const { data: operators, isLoading: loadingOps, error: opsError } = useQuery<any[]>({
    queryKey: ["/api/topup/operators"],
    queryFn: async () => {
      const res = await fetch("/api/topup/operators?countryCode=HT", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load operators");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const amount = selectedAmount ?? (customAmount ? Number(customAmount) : null);
  const balance = Number(user?.balance || 0);

  const topupMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOperator) throw new Error("Please select an operator");
      if (!phone.trim()) throw new Error("Please enter a phone number");
      if (!amount || amount <= 0) throw new Error("Please select or enter an amount");

      const rawPhone = phone.replace(/\D/g, "");
      if (rawPhone.length < 7) throw new Error("Phone number is too short");

      if (amount > balance) throw new Error("Insufficient balance. Please deposit first.");

      const res = await apiRequest("POST", "/api/topup", {
        phoneNumber: rawPhone,
        operatorId: selectedOperator.id,
        amount,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Top-up failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setResult({ success: true, message: data.message, transactionId: data.transactionId });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
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

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="space-y-1">
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Smartphone className="w-6 h-6 text-primary" />
          Mobile Top-Up
        </h1>
        <p className="text-muted-foreground text-sm">Recharge any Haitian mobile number instantly using your USDT balance.</p>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Available Balance</CardTitle>
            <Badge variant="secondary" className="text-base font-mono font-semibold">
              ${balance.toFixed(2)} USD
            </Badge>
          </div>
        </CardHeader>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">1. Phone Number</CardTitle>
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
          <p className="text-xs text-muted-foreground mt-1.5">Enter 8-digit number (e.g. 34712345)</p>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">2. Select Operator</CardTitle>
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
              <p className="text-sm">Could not load operators. Check your Reloadly credentials.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {operators.map((op: any) => (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => setSelectedOperator(op)}
                  data-testid={`button-operator-${op.id}`}
                  className={`flex flex-col items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all text-sm font-medium ${
                    selectedOperator?.id === op.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/40"
                  }`}
                >
                  {op.logoUrls?.[0] ? (
                    <img src={op.logoUrls[0]} alt={op.name} className="h-8 w-auto object-contain" />
                  ) : (
                    <Smartphone className="w-6 h-6 text-muted-foreground" />
                  )}
                  <span className="text-center leading-tight">{op.name}</span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">3. Top-Up Amount (USD)</CardTitle>
          <CardDescription>Select a preset or enter a custom amount</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {PRESET_AMOUNTS.map(a => (
              <button
                key={a}
                type="button"
                onClick={() => { setSelectedAmount(a); setCustomAmount(""); }}
                data-testid={`button-amount-${a}`}
                className={`py-2.5 rounded-lg border-2 font-semibold text-sm transition-all ${
                  selectedAmount === a && !customAmount
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                ${a}
              </button>
            ))}
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
            <Input
              type="number"
              min="1"
              max="100"
              placeholder="Custom amount"
              value={customAmount}
              onChange={e => { setCustomAmount(e.target.value); setSelectedAmount(null); }}
              className="pl-7"
              data-testid="input-topup-custom-amount"
            />
          </div>
          {amount !== null && amount > 0 && (
            <p className="text-xs text-muted-foreground">
              You will be charged <span className="font-semibold text-foreground">${amount.toFixed(2)} USD</span> from your balance.
              {amount > balance && (
                <span className="text-destructive ml-1">Insufficient balance.</span>
              )}
            </p>
          )}
        </CardContent>
      </Card>

      {result && (
        <div className={`flex items-start gap-3 p-4 rounded-lg border ${
          result.success ? "border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800" : "border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800"
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

      <Button
        onClick={handleSubmit}
        disabled={topupMutation.isPending || !selectedOperator || !phone || !amount || amount <= 0 || amount > balance}
        className="w-full primary-gradient"
        data-testid="button-send-topup"
        size="lg"
      >
        {topupMutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Smartphone className="w-4 h-4 mr-2" />
            Send Top-Up{amount ? ` · $${Number(amount).toFixed(2)}` : ""}
          </>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground pb-4">
        Powered by Reloadly · Instant delivery · Requires verified KYC
      </p>
    </div>
  );
}
