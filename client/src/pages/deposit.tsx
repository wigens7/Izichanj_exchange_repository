import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateDeposit } from "@/hooks/use-transactions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy, Loader2, QrCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const depositSchema = z.object({
  amountUsdt: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Amount must be greater than 0"),
  txHash: z.string().min(10, "Transaction hash invalid"),
});

export default function DepositPage() {
  const { mutate: createDeposit, isPending } = useCreateDeposit();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof depositSchema>>({
    resolver: zodResolver(depositSchema),
    defaultValues: { amountUsdt: "", txHash: "" },
  });

  const onSubmit = (data: z.infer<typeof depositSchema>) => {
    createDeposit({
        amountUsdt: Number(data.amountUsdt),
        txHash: data.txHash
    }, {
        onSuccess: () => form.reset()
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Address copied to clipboard" });
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
            <h1 className="text-3xl font-display font-bold">Deposit USDT</h1>
            <p className="text-muted-foreground">Send USDT to one of the addresses below, then submit proof.</p>
        </div>

        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-primary" />
                    Wallet Addresses
                </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
                <AddressCard network="TRC20" address="TRydVikZb957Y298cKsFL81aajz3sfaUmq" />
                <AddressCard network="BEP20" address="0xbd1a6e9f3bcb8179883799585ef9d6dc06b8a974" />
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Submit Transaction</CardTitle>
                <CardDescription>We will verify your deposit within minutes.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="amountUsdt"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Amount Sent (USDT)</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" placeholder="100.00" {...field} />
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
                                    <FormLabel>Transaction Hash (TXID)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Enter transaction hash..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full primary-gradient h-11" disabled={isPending}>
                            {isPending ? <Loader2 className="animate-spin mr-2" /> : "Verify Deposit"}
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    </div>
  );
}
