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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tv, CreditCard, RefreshCw, CheckCircle2, XCircle, Clock, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { formatDateTime } from "@/lib/dateUtils";
import { formatHtg, formatUsdt } from "@shared/constants";
import { useRates } from "@/hooks/use-rates";

const PLAN_COLORS: Record<string, string> = {
  "ToutCanal+": "text-yellow-500",
  "Evasion+":   "text-purple-500",
  "Evasion":    "text-blue-500",
  "Acces":      "text-emerald-500",
};

function StatusBadge({ status }: { status: string }) {
  if (status === "success")
    return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1"><CheckCircle2 className="w-3 h-3" />Activé</Badge>;
  if (status === "failed")
    return <Badge className="bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30 gap-1"><XCircle className="w-3 h-3" />Refusé</Badge>;
  return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1"><Clock className="w-3 h-3" />En attente</Badge>;
}

export default function CanalPlusPage() {
  const { data: user } = useUser();
  const { toast } = useToast();
  const { depositRate } = useRates();

  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [cardNumber, setCardNumber] = useState("");
  const [autoRenew, setAutoRenew] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const balance = Number(user?.balance || 0);

  const { data: plans, isLoading: plansLoading } = useQuery<any[]>({
    queryKey: ["/api/canalplus/plans"],
  });

  const { data: history, isLoading: historyLoading } = useQuery<any[]>({
    queryKey: ["/api/canalplus/my"],
  });

  const subscribeMut = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/canalplus/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ planName: selectedPlan?.name, cardNumber, autoRenew }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Échec de la souscription");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Demande soumise ✅", description: "Votre abonnement Canal+ est en cours de traitement." });
      setSelectedPlan(null);
      setCardNumber("");
      setAutoRenew(false);
      queryClient.invalidateQueries({ queryKey: ["/api/canalplus/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const cardValid = /^\d{14}$/.test(cardNumber);
  const enoughBalance = selectedPlan ? balance >= selectedPlan.priceUsdt : false;
  const canSubmit = selectedPlan && cardValid && enoughBalance && !subscribeMut.isPending;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-lg">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Tv className="w-6 h-6 text-primary" />
          Canal+ Abonnement
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Payez votre abonnement Canal+ directement depuis votre solde USDT</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            Nouvelle Souscription
          </CardTitle>
          <CardDescription>Sélectionnez votre plan et entrez votre numéro de carte</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Plan Selector */}
          <div className="space-y-2">
            <Label>Plan Canal+</Label>
            {plansLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select
                value={selectedPlan?.name || ""}
                onValueChange={(val) => {
                  const plan = plans?.find((p) => p.name === val);
                  setSelectedPlan(plan || null);
                }}
              >
                <SelectTrigger data-testid="select-canalplus-plan">
                  <SelectValue placeholder="Choisir un plan…" />
                </SelectTrigger>
                <SelectContent>
                  {plans?.map((plan) => (
                    <SelectItem key={plan.name} value={plan.name}>
                      <div className="flex items-center justify-between gap-4 w-full">
                        <span className={`font-semibold ${PLAN_COLORS[plan.name]}`}>{plan.name}</span>
                        <span className="text-muted-foreground text-xs">{plan.channels} chaînes · {formatHtg(plan.priceHtg)} HTG</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Selected Plan Summary */}
          {selectedPlan && (
            <div className="rounded-md border border-primary/20 bg-primary/5 p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className={`font-bold text-sm ${PLAN_COLORS[selectedPlan.name]}`}>{selectedPlan.name}</span>
                <Badge variant="outline" className="text-xs">{selectedPlan.channels} chaînes</Badge>
              </div>
              <div className="text-sm text-muted-foreground space-y-0.5">
                <p>Montant: <strong className="text-foreground">{formatHtg(selectedPlan.priceHtg)} HTG</strong></p>
                <p>Déduction: <strong className="text-foreground">{formatUsdt(selectedPlan.priceUsdt)} USDT</strong></p>
                <p>Taux: <span className="font-mono">1 USDT = {depositRate.toFixed(2)} HTG</span></p>
              </div>
              {!enoughBalance && (
                <div className="flex items-center gap-1.5 text-xs text-red-500 mt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Solde insuffisant. Vous avez {formatUsdt(balance)} USDT, il faut {formatUsdt(selectedPlan.priceUsdt)} USDT.
                </div>
              )}
            </div>
          )}

          {/* Card Number */}
          <div className="space-y-2">
            <Label htmlFor="card-number">Numéro de carte Canal+ <span className="text-muted-foreground text-xs">(14 chiffres)</span></Label>
            <Input
              id="card-number"
              type="text"
              inputMode="numeric"
              maxLength={14}
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, "").slice(0, 14))}
              placeholder="Ex: 12345678901234"
              className="font-mono tracking-widest"
              data-testid="input-card-number"
            />
            {cardNumber.length > 0 && !cardValid && (
              <p className="text-xs text-red-500">Le numéro de carte doit avoir exactement 14 chiffres ({cardNumber.length}/14)</p>
            )}
            {cardValid && (
              <p className="text-xs text-emerald-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Numéro valide</p>
            )}
          </div>

          {/* Auto-Renew Toggle */}
          <div className="flex items-center justify-between rounded-md border p-3.5">
            <div className="space-y-0.5">
              <Label htmlFor="auto-renew" className="text-sm font-medium cursor-pointer">Renouvellement automatique</Label>
              <p className="text-xs text-muted-foreground">Renouveler automatiquement chaque mois</p>
            </div>
            <Switch
              id="auto-renew"
              checked={autoRenew}
              onCheckedChange={setAutoRenew}
              data-testid="switch-auto-renew"
            />
          </div>

          {/* Payment Summary Box */}
          {selectedPlan && cardValid && (
            <div className="rounded-md bg-muted/60 border p-3.5 text-sm space-y-1">
              <p className="font-medium">Résumé du paiement</p>
              <p className="text-muted-foreground">
                Vous payez <strong className="text-foreground">{formatHtg(selectedPlan.priceHtg)} Gourdes</strong> pour le plan <strong className="text-foreground">{selectedPlan.name}</strong>.
              </p>
              <p className="text-muted-foreground">
                Cela déduira <strong className="text-foreground">{formatUsdt(selectedPlan.priceUsdt)} USDT</strong> de votre solde.
              </p>
              <p className="text-muted-foreground">Carte: <strong className="text-foreground font-mono">{cardNumber}</strong></p>
              {autoRenew && <p className="text-xs text-amber-500">⚡ Renouvellement automatique activé</p>}
            </div>
          )}

          <Button
            onClick={() => subscribeMut.mutate()}
            disabled={!canSubmit}
            className="w-full"
            data-testid="button-subscribe-canalplus"
          >
            {subscribeMut.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Tv className="w-4 h-4 mr-2" />
            )}
            {subscribeMut.isPending ? "Traitement en cours…" : "Payer l'abonnement"}
          </Button>
        </CardContent>
      </Card>

      {/* Subscription History */}
      <Card>
        <CardHeader
          className="pb-3 cursor-pointer"
          onClick={() => setShowHistory((v) => !v)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-primary" />
              Historique des abonnements
              {history && history.length > 0 && (
                <Badge variant="secondary" className="text-xs">{history.length}</Badge>
              )}
            </CardTitle>
            {showHistory ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </CardHeader>
        {showHistory && (
          <CardContent className="pt-0">
            {historyLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-md" />)}
              </div>
            ) : !history || history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Aucun abonnement pour l'instant</p>
            ) : (
              <div className="space-y-2">
                {history.map((sub: any) => (
                  <div key={sub.id} className="rounded-md border p-3 flex items-start justify-between gap-3" data-testid={`row-canalplus-${sub.id}`}>
                    <div className="min-w-0">
                      <p className={`font-semibold text-sm ${PLAN_COLORS[sub.plan_name]}`}>{sub.plan_name}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">Carte: {sub.card_number}</p>
                      <p className="text-xs text-muted-foreground">{formatHtg(Number(sub.plan_price_htg))} HTG · {formatUsdt(Number(sub.plan_price_usdt))} USDT</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">{formatDateTime(sub.created_at)}</p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <StatusBadge status={sub.status} />
                      {sub.auto_renew && <Badge variant="outline" className="text-[10px]">Auto-renouvellement</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
