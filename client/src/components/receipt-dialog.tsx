import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { formatUsdt, formatHtg } from "@shared/constants";
import { formatDateTime } from "@/lib/dateUtils";

interface ReceiptData {
  type: "deposit" | "withdrawal";
  transactionRef: string;
  createdAt: string;
  amountUsdt: number;
  fee: number;
  exchangeRate: number;
  finalAmountHtg: number;
  destination?: string | null;
  walletAddress?: string | null;
  currency?: string;
  network?: string;
  userName: string;
  status: string;
  receiptId: string;
}

interface ReceiptDialogProps {
  url: string | null;
  onClose: () => void;
}

export function ReceiptDialog({ url, onClose }: ReceiptDialogProps) {
  const { t } = useLanguage();

  const { data, isLoading, isError } = useQuery<ReceiptData>({
    queryKey: [url],
    enabled: !!url,
  });

  const isDeposit = data?.type === "deposit";

  const rows: [string, string][] = data
    ? ([
        [t.receipt.type, isDeposit ? t.receipt.deposit : t.receipt.withdrawal],
        [t.receipt.amount, `${formatUsdt(Number(data.amountUsdt))} USDT`],
        ...(Number(data.fee) > 0
          ? ([[t.receipt.fee, `${formatUsdt(Number(data.fee))} USDT`]] as [string, string][])
          : []),
        [t.receipt.rate, `1 USDT = ${formatHtg(Number(data.exchangeRate))} HTG`],
        [t.receipt.amountHtg, `${formatHtg(Number(data.finalAmountHtg))} HTG`],
        ...(data.network ? ([[t.receipt.network, data.network]] as [string, string][]) : []),
        ...(data.currency ? ([[t.receipt.currency, data.currency]] as [string, string][]) : []),
        ...(isDeposit && data.walletAddress
          ? ([[t.receipt.walletAddress, data.walletAddress]] as [string, string][])
          : []),
        ...(!isDeposit && data.destination
          ? ([[t.receipt.destination, data.destination]] as [string, string][])
          : []),
        [t.receipt.name, data.userName],
        [t.receipt.date, formatDateTime(data.createdAt)],
        [t.receipt.transactionId, data.transactionRef],
        [t.receipt.receiptId, data.receiptId],
      ] as [string, string][])
    : [];

  return (
    <Dialog open={url !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm" data-testid="dialog-receipt">
        <DialogHeader>
          <DialogTitle className="sr-only">{t.receipt.title}</DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm">{t.receipt.loading}</p>
          </div>
        )}

        {isError && !isLoading && (
          <div className="py-10 text-center text-sm text-red-600 dark:text-red-400" data-testid="text-receipt-error">
            {t.receipt.error}
          </div>
        )}

        {data && !isLoading && (
          <div className="space-y-5">
            <div className="flex flex-col items-center text-center gap-2 pt-1">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <p
                className={`text-2xl font-bold ${
                  isDeposit
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
                }`}
                data-testid="text-receipt-amount"
              >
                {isDeposit ? "+" : "-"}
                {formatUsdt(Number(data.amountUsdt))} USDT
              </p>
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/15">
                {t.receipt.completed}
              </Badge>
            </div>

            <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
              {rows.map(([label, value], i) => (
                <div key={i} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
                  <span className="text-muted-foreground shrink-0">{label}</span>
                  <span className="font-medium text-right break-all" data-testid={`text-receipt-${i}`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={onClose}
              data-testid="button-close-receipt"
            >
              {t.receipt.close}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
