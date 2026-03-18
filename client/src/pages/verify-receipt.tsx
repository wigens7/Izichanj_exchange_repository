import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, XCircle, Loader2, ArrowDownLeft, ArrowUpRight, Shield } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function VerifyReceiptPage() {
  const params = useParams<{ receiptId: string }>();
  const receiptId = params.receiptId;

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/verify", receiptId],
    queryFn: async () => {
      const res = await fetch(`/api/verify/${receiptId}`);
      return res.json();
    },
    enabled: !!receiptId,
  });

  return (
    <div className="min-h-screen bg-[#0A0F1E] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <img src="/favicon.png" alt="Izichanj" className="h-10 w-10 rounded-lg" onError={(e) => (e.currentTarget.style.display = "none")} />
            <span className="text-2xl font-bold text-white tracking-tight">IZICHANJ</span>
          </div>
          <p className="text-slate-400 text-sm">Transaction Verification Portal</p>
        </div>

        <Card className="bg-[#111827] border-slate-800 text-white">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-400" />
              <span className="font-semibold text-slate-200">Verify Receipt</span>
            </div>
            <p className="text-xs text-slate-500 font-mono break-all mt-1">{receiptId}</p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <p className="text-slate-400 text-sm">Verifying receipt...</p>
              </div>
            ) : !data?.found ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <XCircle className="w-12 h-12 text-red-500" />
                <div>
                  <p className="font-semibold text-white">Receipt Not Found</p>
                  <p className="text-slate-400 text-sm mt-1">
                    This receipt ID does not exist in our system. It may be invalid or the transaction has not been approved yet.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Status */}
                <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle className="w-8 h-8 text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-emerald-400">Authentic Transaction</p>
                    <p className="text-slate-400 text-xs mt-0.5">This receipt has been verified on the Izichanj platform.</p>
                  </div>
                </div>

                {/* Transaction type */}
                <div className="flex items-center gap-2 pt-1">
                  <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${data.type === "deposit" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                    {data.type === "deposit" ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white capitalize">
                      {data.type === "deposit" ? `USDT Deposit${data.network ? ` (${data.network})` : ""}` : `${data.currency} Withdrawal`}
                    </p>
                    <p className="text-xs text-slate-500">
                      {data.createdAt ? format(new Date(data.createdAt), "MMMM d, yyyy 'at' h:mm a") : "N/A"}
                    </p>
                  </div>
                </div>

                {/* Details */}
                <div className="divide-y divide-slate-800 rounded-lg border border-slate-800 overflow-hidden">
                  {[
                    ["Type", data.type === "deposit" ? "Crypto Deposit" : "Mobile Money Withdrawal"],
                    ["Amount", data.type === "deposit" ? `${Number(data.amountUsdt).toFixed(2)} USDT` : `${Number(data.amount).toFixed(2)} USDT`],
                    ["Status", data.status],
                    ["Account Holder", data.userName || "—"],
                    ["Receipt ID", receiptId?.slice(0, 16) + "..."],
                  ].map(([label, value], i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5 bg-slate-900/40">
                      <span className="text-xs text-slate-500">{label}</span>
                      <span className={`text-xs font-medium ${label === "Status" ? "text-emerald-400 uppercase" : "text-slate-200"}`}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                <Badge className="w-full justify-center bg-indigo-600/20 text-indigo-300 border-indigo-500/30 py-1.5 text-xs">
                  Verified by Izichanj · izichanj.com
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-slate-600 text-xs">
          This is a read-only verification page. Izichanj is not responsible for any fraudulent use of this portal.
        </p>
      </div>
    </div>
  );
}
