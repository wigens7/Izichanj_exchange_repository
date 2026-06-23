import { useUser } from "@/hooks/use-auth";
import { useDeposits, useWithdrawals } from "@/hooks/use-transactions";
import { useLanguage } from "@/lib/i18n";
import { formatHtg, formatUsdt } from "@shared/constants";
import { useRates } from "@/hooks/use-rates";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownLeft, Wallet, TrendingUp, TrendingDown, ArrowRightLeft, FileText, Copy, CheckCheck, Store } from "lucide-react";
import { useState } from "react";
import { formatDateTime } from "@/lib/dateUtils";
import { StatusBadge } from "@/components/status-badge";
import { ReceiptDialog } from "@/components/receipt-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const { data: user } = useUser();
  const { data: deposits, isLoading: isDepositsLoading } = useDeposits();
  const { data: withdrawals, isLoading: isWithdrawalsLoading } = useWithdrawals();
  const { t } = useLanguage();
  const { depositRate } = useRates();

  const totalDepositedUsdt = deposits 
    ?.filter(d => d.status === 'approved')
    .reduce((acc, curr) => acc + Number(curr.amountUsdt), 0) || 0;

  const totalWithdrawnUsdt = withdrawals
    ?.filter(w => w.status === 'approved')
    .reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;


  const balanceHtg = Number(user?.balance || 0) * depositRate;
  const totalDepositedHtg = totalDepositedUsdt * depositRate;
  const totalWithdrawnHtg = totalWithdrawnUsdt * depositRate;

  const { data: apiPaymentsData, isLoading: isApiPaymentsLoading } = useQuery<{ payments: any[] }>({
    queryKey: ["/api/profile/api-payments"],
  });
  const apiPayments = apiPaymentsData?.payments || [];

  const allTransactions = [
    ...(deposits?.map(d => ({ ...d, type: 'deposit' as const })) || []),
    ...(withdrawals?.map(w => ({ ...w, type: 'withdrawal' as const })) || []),
    ...apiPayments.map(p => ({ ...p, type: p.kind === 'api_purchase' ? 'api_purchase' as const : 'merchant_payment' as const })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const depositTransactions = allTransactions.filter(
    (txn) => txn.type === 'deposit' || txn.type === 'merchant_payment'
  );
  const withdrawalTransactions = allTransactions.filter(
    (txn) => txn.type === 'withdrawal' || txn.type === 'api_purchase'
  );

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
        <span className="font-semibold">1 USDT = {depositRate.toFixed(2)} HTG</span>
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
            <p className="text-2xl font-display font-bold text-foreground" data-testid="text-balance-htg">
              {formatHtg(balanceHtg)} <span className="text-sm font-normal text-muted-foreground">HTG</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatUsdt(Number(user.balance))} USDT
            </p>
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
              {isDepositsLoading || isWithdrawalsLoading || isApiPaymentsLoading ? (
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

            <TabsContent value="deposits" className="space-y-2">
              {isDepositsLoading || isApiPaymentsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-md" />
                ))
              ) : depositTransactions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">{t.dashboard.noTransactions}</div>
              ) : (
                depositTransactions.map((txn) => (
                  <TransactionRow key={`${txn.type}-${txn.id}`} txn={txn} />
                ))
              )}
            </TabsContent>

            <TabsContent value="withdrawals" className="space-y-2">
              {isWithdrawalsLoading || isApiPaymentsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-md" />
                ))
              ) : withdrawalTransactions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">{t.dashboard.noTransactions}</div>
              ) : (
                withdrawalTransactions.map((txn) => (
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
    const isWithdrawal = txn.type === 'withdrawal';
    const isApiPurchase = txn.type === 'api_purchase';
    const isMerchantPayment = txn.type === 'merchant_payment';
    const isApiTxn = isApiPurchase || isMerchantPayment;
    const isIncoming = isDeposit || isMerchantPayment;
    const { t } = useLanguage();
    const { depositRate } = useRates();
    const amountUsdt = isDeposit
      ? Number(txn.amountUsdt)
      : isApiTxn
        ? (isApiPurchase ? Number(txn.amountUsdt) : Number(txn.netUsdt))
        : Number(txn.amount);
    const amountHtg = amountUsdt * depositRate;
    const [copied, setCopied] = useState(false);
    const [showReceipt, setShowReceipt] = useState(false);

    if (isApiTxn) {
      return (
        <div className="rounded-md border border-border bg-card hover:bg-muted/30 transition-colors" data-testid={`txn-${txn.type}-${txn.id}`}>
          <div className="flex items-center justify-between gap-4 p-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 ${isIncoming ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'}`}>
                <Store className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-foreground truncate" data-testid={`label-api-txn-${txn.id}`}>
                    {isApiPurchase ? "API Purchase" : "Merchant Payment"}
                  </p>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-indigo-400/40 text-indigo-600 dark:text-indigo-400">
                    Izichanj Pay
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {isApiPurchase ? `Paid to ${txn.merchantBusinessName}` : `From buyer · ${txn.merchantBusinessName}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(txn.createdAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="text-right">
                <p className={`text-sm font-semibold ${isIncoming ? 'text-emerald-600 dark:text-emerald-400' : 'text-purple-600 dark:text-purple-400'}`}>
                  {isIncoming ? '+' : '-'}{formatHtg(amountHtg)} HTG
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {formatUsdt(amountUsdt)} USDT{isMerchantPayment && txn.feeUsdt ? ` (fee ${Number(txn.feeUsdt).toFixed(4)})` : ''}
                </p>
                <StatusBadge status={txn.status} className="mt-1 text-[10px]" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3.5 pb-2.5 pt-0 border-t border-border/40 mt-0">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Order ID</span>
            <span className="font-mono text-[10px] text-foreground truncate" data-testid={`text-order-id-${txn.id}`}>
              {txn.orderId}
            </span>
            <span className="text-muted-foreground text-[10px]">·</span>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Payment</span>
            <span className="font-mono text-[10px] text-foreground truncate" title={txn.paymentId}>
              {txn.paymentId}
            </span>
          </div>
        </div>
      );
    }

    const hasReceipt = txn.status === "approved" && !!txn.receiptId;
    const receiptUrl = isDeposit
        ? `/api/receipts/deposit/${txn.id}`
        : `/api/receipts/withdrawal/${txn.id}`;

    const copyTxHash = () => {
        navigator.clipboard.writeText(txn.txHash).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <>
        <div className="rounded-md border border-border bg-card hover:bg-muted/30 transition-colors" data-testid={`txn-${txn.type}-${txn.id}`}>
            <div className="flex items-center justify-between gap-4 p-3.5">
            <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 ${isDeposit ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                    {isDeposit ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                        {isDeposit ? t.dashboard.usdtDeposit : `${txn.currency} ${t.dashboard.withdrawal}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {formatDateTime(txn.createdAt)}
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
                        onClick={() => setShowReceipt(true)}
                        data-testid={`button-view-receipt-${txn.type}-${txn.id}`}
                        title={t.receipt.view}
                        className="h-8 px-2.5 gap-1.5 text-xs border-indigo-500/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                    >
                        <FileText className="w-3 h-3" />
                        {t.receipt.view}
                    </Button>
                )}
            </div>
            </div>
            {isDeposit && txn.txHash && (
                <div className="flex items-center gap-2 px-3.5 pb-2.5 pt-0 border-t border-border/40 mt-0">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">TxtID</span>
                    <span
                        className="font-mono text-[10px] text-foreground flex-1 truncate"
                        title={txn.txHash}
                        data-testid={`text-txhash-${txn.id}`}
                    >
                        {txn.txHash}
                    </span>
                    <button
                        type="button"
                        onClick={copyTxHash}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground flex-shrink-0"
                        title="Copy Transaction ID"
                        data-testid={`button-copy-txhash-user-${txn.id}`}
                    >
                        {copied
                            ? <CheckCheck className="w-3 h-3 text-emerald-500" />
                            : <Copy className="w-3 h-3" />
                        }
                    </button>
                </div>
            )}
        </div>
        <ReceiptDialog url={showReceipt ? receiptUrl : null} onClose={() => setShowReceipt(false)} />
        </>
    )
}
