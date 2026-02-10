import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateDeposit } from "@/hooks/use-transactions";
import { useUser } from "@/hooks/use-auth";
import { useLanguage } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy, Loader2, QrCode, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

const depositSchema = z.object({
  amountUsdt: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Amount must be greater than 0"),
  txHash: z.string().min(10, "Transaction hash invalid"),
});

export default function DepositPage() {
  const { data: user } = useUser();
  const { mutate: createDeposit, isPending } = useCreateDeposit();
  const { toast } = useToast();
  const { t } = useLanguage();
  const kycVerified = user?.kycStatus === "verified";

  const form = useForm<z.infer<typeof depositSchema>>({
    resolver: zodResolver(depositSchema),
    defaultValues: { amountUsdt: "", txHash: "" },
  });

  const onSubmit = (data: z.infer<typeof depositSchema>) => {
    createDeposit({
        amountUsdt: data.amountUsdt,
        txHash: data.txHash
    }, {
        onSuccess: () => form.reset()
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: t.deposit.copied, description: t.deposit.copiedDescription });
  };

  const AddressCard = ({ network, address }: { network: string, address: string }) => (
    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-border space-y-2">
        <div className="flex items-center justify-between">
            <span className="font-bold text-sm bg-primary/10 text-primary px-2 py-0.5 rounded">{network}</span>
            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(address)} className="h-6 w-6 p-0">
                <Copy className="w-3 h-3" />
            </Button>
        </div>
        <p className="font-mono text-xs break-all text-muted-foreground">{address}</p>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
        <div>
            <h1 className="text-3xl font-display font-bold">{t.deposit.title}</h1>
            <p className="text-muted-foreground">{t.deposit.subtitle}</p>
        </div>

        {!kycVerified && (
            <Alert className="bg-amber-500/10 border-amber-200 text-amber-800 dark:text-amber-300" data-testid="alert-kyc-required-deposit">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>{t.kyc.required}</AlertTitle>
                <AlertDescription>
                    {t.kyc.depositMessage}{" "}
                    <Link href="/profile" className="underline font-medium">{t.kyc.goToProfile}</Link>
                </AlertDescription>
            </Alert>
        )}

        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-primary" />
                    {t.deposit.walletAddresses}
                </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
                <AddressCard network="TRC20" address="TRydVikZb957Y298cKsFL81aajz3sfaUmq" />
                <AddressCard network="BEP20" address="0xbd1a6e9f3bcb8179883799585ef9d6dc06b8a974" />
            </CardContent>
        </Card>

        <Card className={!kycVerified ? "opacity-50 pointer-events-none" : ""}>
            <CardHeader>
                <CardTitle>{t.deposit.submitTransaction}</CardTitle>
                <CardDescription>{t.deposit.verifyDescription}</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="amountUsdt"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t.deposit.amountSent}</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" placeholder="100.00" {...field} data-testid="input-deposit-amount" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="txHash"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t.deposit.txHash}</FormLabel>
                                    <FormControl>
                                        <Input placeholder={t.deposit.txHashPlaceholder} {...field} data-testid="input-deposit-txhash" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full primary-gradient h-11" disabled={isPending || !kycVerified} data-testid="button-submit-deposit">
                            {isPending ? <Loader2 className="animate-spin mr-2" /> : t.deposit.verifyDeposit}
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    </div>
  );
}
