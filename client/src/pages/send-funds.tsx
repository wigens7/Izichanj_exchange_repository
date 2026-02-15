import { useState } from "react";
import { useUser } from "@/hooks/use-auth";
import { useLanguage } from "@/lib/i18n";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatUsdt, usdtToHtg, formatHtg } from "@shared/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Send, ArrowUpRight, ArrowDownLeft, ShieldAlert, CheckCircle2, User } from "lucide-react";

interface RecipientInfo {
  id: number;
  fullName: string;
  referenceId: string;
  email: string;
}

interface TransferRecord {
  id: number;
  senderProfileId: number;
  receiverProfileId: number;
  amount: string;
  note: string | null;
  createdAt: string;
  senderName: string;
  receiverName: string;
  direction: "sent" | "received";
}

export default function SendFundsPage() {
  const { data: user } = useUser();
  const { t } = useLanguage();
  const { toast } = useToast();

  const [identifier, setIdentifier] = useState("");
  const [recipient, setRecipient] = useState<RecipientInfo | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const { data: transfers = [], isLoading: loadingHistory } = useQuery<TransferRecord[]>({
    queryKey: ["/api/transfers"],
  });

  const lookupMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", "/api/transfers/lookup", { identifier: id });
      return res.json();
    },
    onSuccess: (data: RecipientInfo) => {
      setRecipient(data);
    },
    onError: () => {
      setRecipient(null);
      toast({ title: t.transfer.userNotFound, variant: "destructive" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/transfers/send", {
        recipientId: recipient!.id,
        amount: parseFloat(amount).toFixed(2),
        note: note || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t.transfer.success, description: t.transfer.successDesc });
      setRecipient(null);
      setIdentifier("");
      setAmount("");
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (err: any) => {
      let msg = "Error";
      try {
        const jsonPart = err.message?.split(": ").slice(1).join(": ");
        const parsed = JSON.parse(jsonPart);
        msg = parsed.message || msg;
      } catch {
        msg = err.message || msg;
      }
      toast({ title: msg, variant: "destructive" });
    },
  });

  if (!user) return null;

  const isKycVerified = user.kycStatus === "verified";
  const balance = parseFloat(user.balance);
  const parsedAmount = parseFloat(amount);
  const isValidAmount = !isNaN(parsedAmount) && parsedAmount >= 1 && parsedAmount <= balance;

  if (!isKycVerified) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div>
          <h1 className="text-2xl font-display font-bold">{t.transfer.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t.transfer.subtitle}</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-10">
              <div className="w-14 h-14 rounded-md bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-7 h-7 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-bold text-amber-700 dark:text-amber-400">{t.transfer.kycRequired}</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">{t.transfer.kycRequiredDesc}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-display font-bold">{t.transfer.title}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t.transfer.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-primary" />
                <CardTitle className="text-base">{t.transfer.title}</CardTitle>
              </div>
              <CardDescription className="text-xs">{t.transfer.subtitle}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label className="text-sm">{t.transfer.recipientLabel}</Label>
                <div className="flex gap-2">
                  <Input
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      if (recipient) setRecipient(null);
                    }}
                    placeholder={t.transfer.recipientPlaceholder}
                    data-testid="input-transfer-identifier"
                  />
                  <Button
                    onClick={() => lookupMutation.mutate(identifier.trim())}
                    disabled={!identifier.trim() || lookupMutation.isPending}
                    data-testid="button-lookup-recipient"
                  >
                    {lookupMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {recipient && (
                <div className="rounded-md bg-emerald-500/5 border border-emerald-200 dark:border-emerald-800/50 p-4" data-testid="recipient-found-card">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-md bg-emerald-500/10 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{t.transfer.recipientFound}</p>
                      <p className="text-sm" data-testid="text-recipient-name">{recipient.fullName}</p>
                      <p className="text-xs text-muted-foreground" data-testid="text-recipient-email">{recipient.email}</p>
                    </div>
                  </div>
                </div>
              )}

              {recipient && (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm">{t.transfer.amount}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder={t.transfer.amountPlaceholder}
                      data-testid="input-transfer-amount"
                    />
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <p className="text-xs text-muted-foreground">{t.transfer.minAmount}</p>
                      {parsedAmount > 0 && (
                        <p className="text-xs text-muted-foreground">
                          ~ {formatHtg(usdtToHtg(parsedAmount))} HTG
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">{t.transfer.note}</Label>
                    <Input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder={t.transfer.notePlaceholder}
                      maxLength={200}
                      data-testid="input-transfer-note"
                    />
                  </div>

                  <Button
                    className="w-full primary-gradient"
                    disabled={!isValidAmount || sendMutation.isPending}
                    onClick={() => sendMutation.mutate()}
                    data-testid="button-send-funds"
                  >
                    {sendMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t.transfer.sending}
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        {t.transfer.sendButton}
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{t.transfer.yourBalance}</p>
                <p className="text-2xl font-display font-bold" data-testid="text-transfer-balance">{formatUsdt(balance)} <span className="text-sm font-normal text-muted-foreground">USDT</span></p>
                <p className="text-sm text-muted-foreground mt-0.5">{formatHtg(usdtToHtg(balance))} HTG</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.transfer.history}</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : transfers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm" data-testid="text-no-transfers">
              {t.transfer.noTransfers}
            </div>
          ) : (
            <div className="space-y-2">
              {transfers.map((tr) => (
                <div
                  key={tr.id}
                  className="flex items-center gap-3 p-3 rounded-md border border-border"
                  data-testid={`transfer-row-${tr.id}`}
                >
                  <div className={`w-9 h-9 rounded-md flex items-center justify-center ${
                    tr.direction === "sent"
                      ? "bg-red-500/10 text-red-600 dark:text-red-400"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  }`}>
                    {tr.direction === "sent" ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownLeft className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={tr.direction === "sent" ? "destructive" : "default"}>
                        {tr.direction === "sent" ? t.transfer.sent : t.transfer.received}
                      </Badge>
                      <span className="text-sm">
                        {tr.direction === "sent"
                          ? `${t.transfer.to} ${tr.receiverName}`
                          : `${t.transfer.from} ${tr.senderName}`}
                      </span>
                    </div>
                    {tr.note && <p className="text-xs text-muted-foreground mt-0.5 truncate">{tr.note}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${
                      tr.direction === "sent"
                        ? "text-red-600 dark:text-red-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}>
                      {tr.direction === "sent" ? "-" : "+"}{formatUsdt(parseFloat(tr.amount))} USDT
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(tr.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
