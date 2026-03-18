import { useUser } from "@/hooks/use-auth";
import { useDeposits, useWithdrawals } from "@/hooks/use-transactions";
import { useLanguage } from "@/lib/i18n";
import { EXCHANGE_RATE_USDT_HTG, usdtToHtg, formatHtg, formatUsdt } from "@shared/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownLeft, Wallet, TrendingUp, TrendingDown, ArrowRightLeft, Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { StatusBadge } from "@/components/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";

export default function DashboardPage() {
  const { data: user } = useUser();
  const { data: deposits, isLoading: isDepositsLoading } = useDeposits();
  const { data: withdrawals, isLoading: isWithdrawalsLoading } = useWithdrawals();
  const { t } = useLanguage();

  const totalDepositedUsdt = deposits 
    ?.filter(d => d.status === 'approved')
    .reduce((acc, curr) => acc + Number(curr.amountUsdt), 0) || 0;

  const totalWithdrawnUsdt = withdrawals
    ?.filter(w => w.status === 'approved')
    .reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

  const balanceHtg = usdtToHtg(Number(user?.balance || 0));
  const totalDepositedHtg = usdtToHtg(totalDepositedUsdt);
  const totalWithdrawnHtg = usdtToHtg(totalWithdrawnUsdt);

  const allTransactions = [
    ...(deposits?.map(d => ({ ...d, type: 'deposit' as const })) || []),
    ...(withdrawals?.map(w => ({ ...w, type: 'withdrawal' as const })) || [])
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (!user) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-display font-bold">{t.dashboard.title}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t.dashboard.welcomeBack} {user.fullName}</p>
      </div>

      <div className="p-3.5 rounded-md bg-muted/60 border border-border flex items-center gap-2 text-sm" data-testid="banner-exchange-rate">
        <ArrowRightLeft className="w-4 h-4 text-primary flex-shrink-0" />
        <span className="text-muted-foreground">{t.withdraw.exchangeRate}:</span>
        <span className="font-semibold">1 USDT = {EXCHANGE_RATE_USDT_HTG.toFixed(2)} HTG</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="stat-card text-blue-600 dark:text-blue-400">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-sm font-medium text-muted-foreground">{t.dashboard.currentBalance}</p>
              <div className="w-9 h-9 rounded-md bg-blue-500/10 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-display font-bold text-foreground" data-testid="text-balance-htg">{formatHtg(balanceHtg)} <span className="text-sm font-normal text-muted-foreground">HTG</span></p>
            <p className="text-xs text-muted-foreground mt-1">{formatUsdt(Number(user.balance))} USDT</p>
          </CardContent>
        </Card>

        <Card className="stat-card text-emerald-600 dark:text-emerald-400">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-sm font-medium text-muted-foreground">{t.dashboard.totalDeposited}</p>
              <div className="w-9 h-9 rounded-md bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-display font-bold text-foreground" data-testid="text-deposited-usdt">{formatUsdt(totalDepositedUsdt)} <span className="text-sm font-normal text-muted-foreground">USDT</span></p>
            <p className="text-xs text-muted-foreground mt-1">{formatHtg(totalDepositedHtg)} HTG</p>
          </CardContent>
        </Card>

        <Card className="stat-card text-amber-600 dark:text-amber-400">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-sm font-medium text-muted-foreground">{t.dashboard.totalWithdrawn}</p>
              <div className="w-9 h-9 rounded-md bg-amber-500/10 flex items-center justify-center">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-display font-bold text-foreground" data-testid="text-withdrawn-htg">{formatHtg(totalWithdrawnHtg)} <span className="text-sm font-normal text-muted-foreground">HTG</span></p>
            <p className="text-xs text-muted-foreground mt-1">{formatUsdt(totalWithdrawnUsdt)} USDT</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.dashboard.transactionHistory}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="all">{t.dashboard.all}</TabsTrigger>
              <TabsTrigger value="deposits">{t.dashboard.deposits}</TabsTrigger>
              <TabsTrigger value="withdrawals">{t.dashboard.withdrawals}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="space-y-2">
              {isDepositsLoading || isWithdrawalsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-md" />
                ))
              ) : allTransactions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">{t.dashboard.noTransactions}</div>
              ) : (
                allTransactions.map((txn) => (
                  <TransactionRow key={`${txn.type}-${txn.id}`} txn={txn} />
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function TransactionRow({ txn }: { txn: any }) {
    const isDeposit = txn.type === 'deposit';
    const { t } = useLanguage();
    const amountUsdt = isDeposit ? Number(txn.amountUsdt) : Number(txn.amount);
    const amountHtg = usdtToHtg(amountUsdt);
    const [downloading, setDownloading] = useState(false);

    const hasReceipt = txn.status === "approved" && !!txn.receiptId;

    async function downloadReceipt() {
        if (!hasReceipt) return;
        setDownloading(true);
        try {
            const url = isDeposit
                ? `/api/receipts/deposit/${txn.id}`
                : `/api/receipts/withdrawal/${txn.id}`;
            const res = await fetch(url, { credentials: "include" });
            if (!res.ok) throw new Error("Receipt not available");
            const blob = await res.blob();
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `izichanj-receipt-${txn.receiptId?.slice(0, 8) || txn.id}.pdf`;
            link.click();
            URL.revokeObjectURL(link.href);
        } catch (e) {
            console.error("Receipt download failed", e);
        } finally {
            setDownloading(false);
        }
    }

    return (
        <div className="flex items-center justify-between gap-4 p-3.5 rounded-md border border-border bg-card hover:bg-muted/30 transition-colors" data-testid={`txn-${txn.type}-${txn.id}`}>
            <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 ${isDeposit ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                    {isDeposit ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                        {isDeposit ? t.dashboard.usdtDeposit : `${txn.currency} ${t.dashboard.withdrawal}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {format(new Date(txn.createdAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right">
                    <p className={`text-sm font-semibold ${isDeposit ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {isDeposit ? '+' : '-'}{formatHtg(amountHtg)} HTG
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                        {formatUsdt(amountUsdt)} USDT
                    </p>
                    <StatusBadge status={txn.status} className="mt-1 text-[10px]" />
                </div>
                {hasReceipt && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={downloadReceipt}
                        disabled={downloading}
                        className="h-8 px-2 text-xs border-indigo-500/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                        data-testid={`button-download-receipt-${txn.type}-${txn.id}`}
                        title="Download Receipt"
                    >
                        {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                    </Button>
                )}
            </div>
        </div>
    )
}
