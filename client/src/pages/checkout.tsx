import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useUser } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Clock, ShieldCheck, Wallet, ArrowRight } from "lucide-react";

type CheckoutData = {
  payment_id: string;
  order_id: string;
  status: "pending" | "completed" | "expired" | "failed";
  amount: number;
  currency: string;
  amount_usdt: number;
  amount_htg: number;
  exchange_rate: number;
  description: string | null;
  success_url: string | null;
  cancel_url: string | null;
  expires_at: string;
  paid_at: string | null;
  merchant: { business_name: string; is_verified: boolean } | null;
  payer: { logged_in: boolean; balance_usdt: number | null };
};

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  const ms = Math.max(0, new Date(expiresAt).getTime() - now);
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return <span data-testid="text-countdown">{m}:{s.toString().padStart(2, "0")}</span>;
}

export default function CheckoutPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const [, navigate] = useLocation();
  const { data: user } = useUser();
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery<CheckoutData>({
    queryKey: [`/api/checkout/${paymentId}`],
    refetchInterval: 5000,
  });

  const pay = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/checkout/${paymentId}/pay`, {});
      return r.json();
    },
    onSuccess: (res) => {
      toast({ title: "Payment successful 🎉", description: "Redirecting to merchant..." });
      queryClient.invalidateQueries({ queryKey: [`/api/checkout/${paymentId}`] });
      setTimeout(() => {
        if (res.success_url) window.location.href = res.success_url;
        else refetch();
      }, 1500);
    },
    onError: (e: any) => toast({ title: "Payment failed", description: e?.message || "Try again", variant: "destructive" }),
  });

  if (isLoading || !data) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  const isCompleted = data.status === "completed";
  const isExpired = data.status === "expired";
  const isPending = data.status === "pending";
  const insufficient = data.payer.logged_in && (data.payer.balance_usdt ?? 0) < data.amount_usdt;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-950 to-purple-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-lg bg-white text-indigo-600 flex items-center justify-center font-bold text-xl">i</div>
            <span className="text-white font-bold text-lg">Izichanj Pay</span>
          </div>
          <p className="text-xs text-white/60">Secure checkout · End-to-end encrypted</p>
        </div>

        <Card className="shadow-2xl">
          <CardContent className="p-6 space-y-5">
            <div className="text-center pb-4 border-b">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Pay</p>
              <p className="text-3xl font-bold mt-1" data-testid="text-amount-htg">
                {data.amount_htg.toFixed(2)} <span className="text-base font-normal text-muted-foreground">HTG</span>
              </p>
              <p className="text-sm text-muted-foreground mt-1" data-testid="text-amount-usdt">
                ≈ {data.amount_usdt.toFixed(2)} USDT
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">Rate: 1 USDT = {data.exchange_rate} HTG</p>
            </div>

            {data.merchant && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Merchant</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium" data-testid="text-merchant">{data.merchant.business_name}</span>
                  {data.merchant.is_verified && <ShieldCheck className="w-4 h-4 text-green-600" />}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Order ID</span>
              <span className="font-mono text-xs" data-testid="text-order-id">{data.order_id}</span>
            </div>
            {data.description && (
              <div className="text-sm">
                <span className="text-muted-foreground">Description: </span>
                <span data-testid="text-description">{data.description}</span>
              </div>
            )}

            {isPending && (
              <div className="flex items-center justify-between text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 px-3 py-2 rounded-md">
                <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Expires in</span>
                <Countdown expiresAt={data.expires_at} />
              </div>
            )}

            {isCompleted && (
              <div className="text-center py-4 space-y-2" data-testid="status-completed">
                <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
                <p className="font-bold text-lg">Payment Successful</p>
                <p className="text-sm text-muted-foreground">Paid at {new Date(data.paid_at!).toLocaleString()}</p>
                {data.success_url && (
                  <Button onClick={() => (window.location.href = data.success_url!)} className="w-full mt-2" data-testid="button-back-merchant">
                    Return to merchant <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            )}

            {isExpired && (
              <div className="text-center py-4 space-y-2" data-testid="status-expired">
                <XCircle className="w-12 h-12 text-destructive mx-auto" />
                <p className="font-bold text-lg">Payment Expired</p>
                <p className="text-sm text-muted-foreground">This checkout session has expired. Please ask the merchant for a new payment link.</p>
                {data.cancel_url && (
                  <Button variant="outline" onClick={() => (window.location.href = data.cancel_url!)} className="w-full">
                    Return to merchant
                  </Button>
                )}
              </div>
            )}

            {isPending && (
              <>
                {!data.payer.logged_in ? (
                  <div className="space-y-3">
                    <p className="text-sm text-center text-muted-foreground">Sign in to your Izichanj account to pay from your wallet balance.</p>
                    <Button asChild className="w-full" data-testid="button-login-to-pay">
                      <Link href={`/login?redirect=/checkout/${paymentId}`}>Sign in to pay</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm bg-muted/40 px-3 py-2 rounded-md">
                      <span className="flex items-center gap-1.5"><Wallet className="w-4 h-4" />Your balance</span>
                      <span className="font-bold" data-testid="text-balance">{(data.payer.balance_usdt ?? 0).toFixed(2)} USDT</span>
                    </div>
                    {insufficient && (
                      <div className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                        Insufficient balance. <Link href="/deposit" className="underline">Deposit funds</Link> first.
                      </div>
                    )}
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={() => pay.mutate()}
                      disabled={pay.isPending || insufficient}
                      data-testid="button-pay"
                    >
                      {pay.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Pay {data.amount_usdt.toFixed(2)} USDT
                    </Button>
                  </div>
                )}
              </>
            )}

            <p className="text-[10px] text-center text-muted-foreground pt-2">
              Powered by Izichanj Pay · 1.5% fee deducted from merchant
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
