import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/lib/i18n";
import { useUser } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  CreditCard,
  Plus,
  DollarSign,
  Loader2,
  Eye,
  EyeOff,
  Snowflake,
  PlayCircle,
  Copy,
  CheckCircle,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import type { VirtualCard } from "@shared/schema";

export default function VirtualCardsPage() {
  const { t } = useLanguage();
  const { data: user } = useUser();
  const vc = t.virtualCard;

  const { data: cards, isLoading } = useQuery<VirtualCard[]>({
    queryKey: ["/api/cards"],
  });

  const kycVerified = user?.kycStatus === "verified";

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold" data-testid="text-virtual-cards-title">{vc.title}</h1>
        <p className="text-muted-foreground mt-1">{vc.subtitle}</p>
      </div>

      {!kycVerified && (
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-muted-foreground">{vc.kycRequired}</p>
          </CardContent>
        </Card>
      )}

      {kycVerified && <ApplyCardSection />}

      <div>
        <h2 className="text-lg font-semibold mb-3">{vc.myCards}</h2>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-md" />
            ))}
          </div>
        ) : cards && cards.length > 0 ? (
          <div className="space-y-4">
            {cards.map((card) => (
              <CardItem key={card.id} card={card} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CreditCard className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">{vc.noCards}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function ApplyCardSection() {
  const { t } = useLanguage();
  const vc = t.virtualCard;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");

  const createMutation = useMutation({
    mutationFn: async (amt: string) => {
      const res = await apiRequest("POST", "/api/cards/create", { amount: amt });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: vc.cardCreated });
      qc.invalidateQueries({ queryKey: ["/api/cards"] });
      qc.invalidateQueries({ queryKey: ["/api/user"] });
      setAmount("");
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="w-5 h-5" />
          {vc.applyTitle}
        </CardTitle>
        <CardDescription>{vc.applyDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-end gap-3">
          <div className="w-full sm:w-auto flex-1">
            <Label htmlFor="fundAmount">{vc.initialFunding}</Label>
            <div className="relative mt-1.5">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="fundAmount"
                type="number"
                min="1"
                step="0.01"
                placeholder="5.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-9"
                data-testid="input-card-amount"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{vc.minFunding}</p>
          </div>
          <Button
            onClick={() => createMutation.mutate(amount)}
            disabled={createMutation.isPending || !amount || parseFloat(amount) < 1}
            data-testid="button-apply-card"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                {vc.applying}
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4 mr-2" />
                {vc.applyButton}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CardItem({ card }: { card: VirtualCard }) {
  const { t } = useLanguage();
  const vc = t.virtualCard;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showDetails, setShowDetails] = useState(false);
  const [showFund, setShowFund] = useState(false);
  const [fundAmount, setFundAmount] = useState("");
  const [showTransactions, setShowTransactions] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const isFrozen = card.status === "frozen";
  const isActive = card.status === "active";

  const detailsQuery = useQuery<any>({
    queryKey: ["/api/cards", card.id, "details"],
    queryFn: async () => {
      const res = await fetch(`/api/cards/${card.id}/details`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch details");
      return res.json();
    },
    enabled: showDetails,
  });

  const transactionsQuery = useQuery<any[]>({
    queryKey: ["/api/cards", card.id, "transactions"],
    queryFn: async () => {
      const res = await fetch(`/api/cards/${card.id}/transactions`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return res.json();
    },
    enabled: showTransactions,
  });

  const fundMutation = useMutation({
    mutationFn: async (amt: string) => {
      const res = await apiRequest("POST", `/api/cards/${card.id}/fund`, { amount: amt });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: vc.cardFunded });
      qc.invalidateQueries({ queryKey: ["/api/cards"] });
      qc.invalidateQueries({ queryKey: ["/api/user"] });
      setFundAmount("");
      setShowFund(false);
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const toggleFreezeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/cards/${card.id}/toggle-freeze`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/cards"] });
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const cardDetails = detailsQuery.data;

  return (
    <Card data-testid={`card-virtual-${card.id}`}>
      <CardContent className="p-0">
        <div className={`relative overflow-hidden rounded-t-md p-5 ${isFrozen ? "bg-blue-900/20" : "bg-gradient-to-br from-indigo-600 to-purple-700"}`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-white/80" />
              <span className="text-white/80 text-sm font-medium">{card.brand} {card.cardType?.toUpperCase()}</span>
            </div>
            <Badge variant={isFrozen ? "secondary" : "default"} className={isFrozen ? "" : "bg-emerald-500/20 text-emerald-200 border-emerald-500/30"}>
              {isFrozen ? vc.frozen : vc.active}
            </Badge>
          </div>

          <div className="mb-4">
            <p className="text-white/50 text-xs mb-0.5">{vc.cardNumber}</p>
            <p className="text-white font-mono text-lg tracking-widest">
              {showDetails && cardDetails?.card_number
                ? cardDetails.card_number.replace(/(.{4})/g, "$1 ").trim()
                : `•••• •••• •••• ${card.last4 || "••••"}`}
            </p>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <p className="text-white/50 text-xs">{card.nameOnCard}</p>
            </div>
            <div className="text-right">
              <p className="text-white/50 text-xs">{vc.cardBalance}</p>
              <p className="text-white text-xl font-bold font-display">${Number(card.balance).toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {showDetails && cardDetails && (
            <div className="bg-muted/30 rounded-md p-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{vc.cardNumber}</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono" data-testid={`text-card-number-${card.id}`}>{cardDetails.card_number || "N/A"}</span>
                  {cardDetails.card_number && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(cardDetails.card_number, "number")} data-testid={`button-copy-number-${card.id}`}>
                      {copied === "number" ? <CheckCircle className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{vc.expiry}</span>
                <span className="font-mono">{cardDetails.expiry_month}/{cardDetails.expiry_year}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{vc.cvv}</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono">{cardDetails.cvv || "•••"}</span>
                  {cardDetails.cvv && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(cardDetails.cvv, "cvv")} data-testid={`button-copy-cvv-${card.id}`}>
                      {copied === "cvv" ? <CheckCircle className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {showFund && (
            <div className="bg-muted/30 rounded-md p-3 space-y-2">
              <Label>{vc.fundAmount}</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="number"
                    min="1"
                    step="0.01"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    className="pl-9"
                    data-testid={`input-fund-amount-${card.id}`}
                  />
                </div>
                <Button
                  onClick={() => fundMutation.mutate(fundAmount)}
                  disabled={fundMutation.isPending || !fundAmount || parseFloat(fundAmount) < 1}
                  data-testid={`button-fund-card-${card.id}`}
                >
                  {fundMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : vc.fundButton}
                </Button>
              </div>
            </div>
          )}

          {showTransactions && (
            <div className="bg-muted/30 rounded-md p-3 space-y-2">
              <p className="text-sm font-medium mb-2">{vc.transactions}</p>
              {transactionsQuery.isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : transactionsQuery.data && transactionsQuery.data.length > 0 ? (
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {transactionsQuery.data.map((tx: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                      <div className="flex items-center gap-2">
                        {tx.type === "credit" ? (
                          <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5 text-red-500" />
                        )}
                        <span className="truncate max-w-[150px]">{tx.description || tx.merchant || tx.type}</span>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <span className={`font-medium ${tx.type === "credit" ? "text-emerald-600" : ""}`}>
                          {tx.type === "credit" ? "+" : "-"}${Number(tx.amount).toFixed(2)}
                        </span>
                        {tx.date && (
                          <span className="text-xs text-muted-foreground">
                            <Clock className="w-3 h-3 inline mr-0.5" />
                            {format(new Date(tx.date), "MM/dd")}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-3">{vc.noTransactions}</p>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowDetails(!showDetails); if (showFund) setShowFund(false); if (showTransactions) setShowTransactions(false); }}
              data-testid={`button-view-details-${card.id}`}
            >
              {showDetails ? <EyeOff className="w-3.5 h-3.5 mr-1.5" /> : <Eye className="w-3.5 h-3.5 mr-1.5" />}
              {vc.viewDetails}
            </Button>

            {isActive && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setShowFund(!showFund); if (showDetails) setShowDetails(false); if (showTransactions) setShowTransactions(false); }}
                data-testid={`button-toggle-fund-${card.id}`}
              >
                <DollarSign className="w-3.5 h-3.5 mr-1.5" />
                {vc.fundCard}
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowTransactions(!showTransactions); if (showDetails) setShowDetails(false); if (showFund) setShowFund(false); }}
              data-testid={`button-transactions-${card.id}`}
            >
              <Clock className="w-3.5 h-3.5 mr-1.5" />
              {vc.transactions}
            </Button>

            <Button
              variant={isFrozen ? "default" : "outline"}
              size="sm"
              onClick={() => toggleFreezeMutation.mutate()}
              disabled={toggleFreezeMutation.isPending}
              data-testid={`button-freeze-${card.id}`}
            >
              {toggleFreezeMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : isFrozen ? (
                <PlayCircle className="w-3.5 h-3.5 mr-1.5" />
              ) : (
                <Snowflake className="w-3.5 h-3.5 mr-1.5" />
              )}
              {isFrozen ? vc.unfreezeCard : vc.freezeCard}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
