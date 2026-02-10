import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateWithdrawal, useRequestWithdrawalOtp } from "@/hooks/use-transactions";
import { useUser } from "@/hooks/use-auth";
import { useLanguage } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link } from "wouter";

const withdrawSchema = z.object({
  currency: z.enum(["MonCash", "NatCash"]),
  amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Amount must be greater than 0"),
  phoneNumber: z.string().min(8, "Phone number required"),
  otp: z.string().length(6, "OTP must be 6 digits"),
});

export default function WithdrawPage() {
  const { data: user } = useUser();
  const { mutate: createWithdrawal, isPending: isWithdrawPending } = useCreateWithdrawal();
  const { mutate: requestOtp, isPending: isOtpPending } = useRequestWithdrawalOtp();
  const [otpSent, setOtpSent] = useState(false);
  const { t } = useLanguage();
  const kycVerified = user?.kycStatus === "verified";

  const form = useForm<z.infer<typeof withdrawSchema>>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: { currency: "MonCash", amount: "", phoneNumber: "", otp: "" },
  });

  const handleRequestOtp = () => {
    requestOtp(undefined, {
        onSuccess: () => setOtpSent(true)
    });
  };

  const onSubmit = (data: z.infer<typeof withdrawSchema>) => {
    createWithdrawal({
        amount: data.amount,
        currency: data.currency,
        phoneNumber: data.phoneNumber,
        otp: data.otp
    }, {
        onSuccess: () => {
            form.reset();
            setOtpSent(false);
        }
    });
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-500">
        <div>
            <h1 className="text-3xl font-display font-bold">{t.withdraw.title}</h1>
            <p className="text-muted-foreground">{t.withdraw.subtitle}</p>
        </div>

        {!kycVerified ? (
            <Alert className="bg-amber-500/10 border-amber-200 text-amber-800 dark:text-amber-300" data-testid="alert-kyc-required-withdraw">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>{t.kyc.required}</AlertTitle>
                <AlertDescription>
                    {t.kyc.withdrawMessage}{" "}
                    <Link href="/profile" className="underline font-medium">{t.kyc.goToProfile}</Link>
                </AlertDescription>
            </Alert>
        ) : (
            <Alert className="bg-amber-500/10 border-amber-200 text-amber-800 dark:text-amber-300">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>{t.withdraw.securityVerification}</AlertTitle>
                <AlertDescription>
                    {t.withdraw.securityDescription}
                </AlertDescription>
            </Alert>
        )}

        <Card className={!kycVerified ? "opacity-50 pointer-events-none" : ""}>
            <CardContent className="pt-6">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="currency"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t.withdraw.walletType}</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t.withdraw.selectWallet} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="MonCash">MonCash</SelectItem>
                                                <SelectItem value="NatCash">NatCash</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t.withdraw.amountHtg}</FormLabel>
                                        <FormControl>
                                            <Input type="number" placeholder="500" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="phoneNumber"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t.withdraw.phoneNumber}</FormLabel>
                                    <FormControl>
                                        <Input placeholder="3700-0000" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="p-4 bg-muted/50 rounded-lg space-y-4 border border-border">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{t.withdraw.verification}</span>
                                {!otpSent && (
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        size="sm"
                                        onClick={handleRequestOtp}
                                        disabled={isOtpPending}
                                    >
                                        {isOtpPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                        {t.withdraw.sendOtp}
                                    </Button>
                                )}
                            </div>
                            
                            {otpSent && (
                                <FormField
                                    control={form.control}
                                    name="otp"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t.withdraw.enterCode}</FormLabel>
                                            <FormControl>
                                                <Input 
                                                    placeholder="123456" 
                                                    maxLength={6} 
                                                    className="tracking-widest"
                                                    {...field} 
                                                />
                                            </FormControl>
                                            <FormMessage />
                                            <p className="text-xs text-muted-foreground">{t.withdraw.codeSent}</p>
                                        </FormItem>
                                    )}
                                />
                            )}
                        </div>

                        <Button 
                            type="submit" 
                            className="w-full secondary-gradient h-11" 
                            disabled={isWithdrawPending || !otpSent}
                        >
                            {isWithdrawPending ? <Loader2 className="animate-spin mr-2" /> : t.withdraw.confirmWithdrawal}
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    </div>
  );
}
