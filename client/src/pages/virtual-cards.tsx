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
import cardTemplateBg from "@assets/file_00000000b34c71fdb30e83cdfb484f8a_1770937069013.png";

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

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 mx-auto bg-amber-500/10 rounded-xl flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold mb-2" data-testid="text-virtual-cards-maintenance">{vc.maintenanceTitle}</h2>
          <p className="text-muted-foreground max-w-md">{vc.maintenanceDesc}</p>
        </CardContent>
      </Card>

    </div>
  );
}

function ApplyCardSection() {
  const { t } = useLanguage();
  const vc = t.virtualCard;
  const { data: user } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();

  const CARD_COST = 20;
  const userBalance = parseFloat(user?.balance || "0");
  const hasEnoughBalance = userBalance >= CARD_COST;

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cards/create", { amount: String(CARD_COST) });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: vc.cardCreated });
      qc.invalidateQueries({ queryKey: ["/api/cards"] });
      qc.invalidateQueries({ queryKey: ["/api/user"] });
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
      <CardContent className="space-y-4">
        <div className="bg-muted/30 rounded-md p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm text-muted-foreground">{vc.cardCost}</p>
            <p className="text-2xl font-bold font-display" data-testid="text-card-cost">$20.00 <span className="text-sm font-normal text-muted-foreground">USD</span></p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">{vc.yourBalance}</p>
            <p className={`text-lg font-semibold ${hasEnoughBalance ? "text-emerald-600" : "text-red-500"}`} data-testid="text-your-balance">
              ${userBalance.toFixed(2)} USDT
            </p>
          </div>
        </div>

        {!hasEnoughBalance && (
          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-md p-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p>{vc.insufficientBalance}</p>
          </div>
        )}

        <Button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending || !hasEnoughBalance}
          className="w-full sm:w-auto"
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
              {vc.applyButton} — $20.00
            </>
          )}
        </Button>
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
        <div className="relative overflow-hidden rounded-t-md" style={{ aspectRatio: "1.586" }}>
          <img
            src={cardTemplateBg}
            alt="Virtual Card"
            className={`absolute inset-0 w-full h-full object-cover ${isFrozen ? "opacity-40 grayscale" : ""}`}
          />
          <div className="absolute inset-0 flex flex-col justify-between p-5">
            <div className="flex items-center justify-between">
              <div />
              <div className="flex items-center gap-2">
                <Badge variant={isFrozen ? "secondary" : "default"} className={isFrozen ? "" : "bg-emerald-500/20 text-emerald-200 border-emerald-500/30"}>
                  {isFrozen ? vc.frozen : vc.active}
                </Badge>
                <Badge variant="outline" className="text-white/80 border-white/20 bg-white/10">
                  ${Number(card.balance).toFixed(2)}
                </Badge>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-white font-mono text-xl sm:text-2xl tracking-[0.2em] drop-shadow-lg">
                {showDetails && cardDetails?.card_number
                  ? cardDetails.card_number.replace(/(.{4})/g, "$1 ").trim()
                  : `•••• •••• •••• ${card.last4 || "••••"}`}
              </p>

              <div className="flex items-end justify-between gap-2">
                <p className="text-white text-sm font-medium uppercase tracking-wider drop-shadow">{card.nameOnCard}</p>
                <div className="text-right text-white text-sm drop-shadow">
                  {showDetails && cardDetails ? (
                    <div className="flex items-center gap-3">
                      <span>Exp: {cardDetails.expiry_month}/{cardDetails.expiry_year}</span>
                      <span>CVV: {cardDetails.cvv || "•••"}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span>Exp: ••/••</span>
                      <span>CVV: •••</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {showDetails && cardDetails && (
            <div className="bg-muted/30 rounded-md p-3 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                {cardDetails.card_number && (
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(cardDetails.card_number, "number")} data-testid={`button-copy-number-${card.id}`}>
                    {copied === "number" ? <CheckCircle className="w-3 h-3 text-emerald-500 mr-1.5" /> : <Copy className="w-3 h-3 mr-1.5" />}
                    {vc.cardNumber}
                  </Button>
                )}
                {cardDetails.cvv && (
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(cardDetails.cvv, "cvv")} data-testid={`button-copy-cvv-${card.id}`}>
                    {copied === "cvv" ? <CheckCircle className="w-3 h-3 text-emerald-500 mr-1.5" /> : <Copy className="w-3 h-3 mr-1.5" />}
                    {vc.cvv}
                  </Button>
                )}
              </div>
            </div>
          )}

          {showFund && (
            <div className="bg-muted/30 rounded-md p-3 space-y-2">
              <Label>{vc.fundAmount}</Label>
              <p className="text-xs text-muted-foreground">{vc.minFunding}</p>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="number"
                    min="19.99"
                    step="0.01"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    className="pl-9"
                    data-testid={`input-fund-amount-${card.id}`}
                  />
                </div>
                <Button
                  onClick={() => fundMutation.mutate(fundAmount)}
                  disabled={fundMutation.isPending || !fundAmount || parseFloat(fundAmount) < 19.99}
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
