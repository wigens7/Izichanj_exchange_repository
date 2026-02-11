import { useUser } from "@/hooks/use-auth";
import { useDeposits, useWithdrawals } from "@/hooks/use-transactions";
import { useLanguage } from "@/lib/i18n";
import { usdtToHtg, formatHtg, formatUsdt } from "@shared/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownLeft, Wallet, Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { StatusBadge } from "@/components/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

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

  const StatCard = ({ title, value, icon: Icon, colorClass }: any) => (
    <Card className="border-none shadow-md overflow-hidden relative">
      <div className={`absolute top-0 right-0 p-4 opacity-10 ${colorClass}`}>
        <Icon className="w-24 h-24" />
      </div>
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${colorClass.replace('text-', 'bg-').replace('600', '100')} ${colorClass}`}>
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <p className="text-sm font-medium text-muted-foreground">{title}</p>
                <h3 className="text-2xl font-display font-bold">{value}</h3>
            </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-display font-bold">{t.dashboard.title}</h1>
        <p className="text-muted-foreground">{t.dashboard.welcomeBack} {user.fullName}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
            title={t.dashboard.currentBalance}
            value={`${formatHtg(balanceHtg)} HTG`} 
            icon={Wallet} 
            colorClass="text-blue-600" 
        />
        <StatCard 
            title={t.dashboard.totalDeposited}
            value={`${formatHtg(totalDepositedHtg)} HTG`} 
            icon={ArrowDownLeft} 
            colorClass="text-emerald-600" 
        />
        <StatCard 
            title={t.dashboard.totalWithdrawn}
            value={`${formatHtg(totalWithdrawnHtg)} HTG`} 
            icon={ArrowUpRight} 
            colorClass="text-amber-600" 
        />
      </div>

      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle>{t.dashboard.transactionHistory}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="all">{t.dashboard.all}</TabsTrigger>
              <TabsTrigger value="deposits">{t.dashboard.deposits}</TabsTrigger>
              <TabsTrigger value="withdrawals">{t.dashboard.withdrawals}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="space-y-4">
              {isDepositsLoading || isWithdrawalsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))
              ) : allTransactions.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">{t.dashboard.noTransactions}</div>
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
    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-card border border-border hover:shadow-md transition-shadow"
        >
            <div className="flex items-center gap-4">
                <div className={`p-2 rounded-full ${isDeposit ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                    {isDeposit ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                </div>
                <div>
                    <p className="font-semibold text-foreground">
                        {isDeposit ? t.dashboard.usdtDeposit : `${txn.currency} ${t.dashboard.withdrawal}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {format(new Date(txn.createdAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                </div>
            </div>
            <div className="text-right">
                <p className={`font-bold ${isDeposit ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {isDeposit ? '+' : '-'}{formatHtg(amountHtg)} HTG
                </p>
                <p className="text-xs text-muted-foreground">
                    {isDeposit ? '+' : '-'}{formatUsdt(amountUsdt)} USDT
                </p>
                <StatusBadge status={txn.status} className="ml-auto mt-1 text-[10px]" />
            </div>
        </motion.div>
    )
}
