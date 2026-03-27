import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useCreateWithdrawal } from "@/hooks/use-transactions";
import { useUser } from "@/hooks/use-auth";
import { useLanguage } from "@/lib/i18n";
import { formatUsdt, WITHDRAWAL_MIN_USDT, WITHDRAWAL_MAX_USDT, WITHDRAWAL_FEE_USDT } from "@shared/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldAlert, AlertTriangle, Ban, Lock, ArrowRight, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";

const withdrawSchema = z.object({
  amount: z.string()
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Amount must be greater than 0")
    .refine((val) => Number(val) >= WITHDRAWAL_MIN_USDT, `Minimum withdrawal is ${WITHDRAWAL_MIN_USDT} USDT`)
    .refine((val) => Number(val) <= WITHDRAWAL_MAX_USDT, `Maximum is ${WITHDRAWAL_MAX_USDT.toLocaleString()} USDT per day`),
  trcAddress: z.string().min(25, "Please enter a valid TRC-20 wallet address (min 25 characters)"),
  pin: z.string().length(6, "Withdrawal PIN must be exactly 6 digits").regex(/^\d{6}$/, "PIN must contain only digits"),
  tosAgreed: z.boolean().refine((v) => v === true, "You must agree to the Terms of Service"),
});

export default function WithdrawPage() {
  const { data: user } = useUser();
  const { mutate: createWithdrawal, isPending: isWithdrawPending } = useCreateWithdrawal();
  const { t } = useLanguage();
  const kycVerified = user?.kycStatus === "verified";
  const userBalance = parseFloat(user?.balance || "0");

  const { data: pinStatus } = useQuery<{ hasWithdrawalPin: boolean }>({
    queryKey: ["/api/security/withdrawal-pin/status"],
    enabled: !!user && kycVerified,
  });

  const form = useForm<z.infer<typeof withdrawSchema>>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: { amount: "", trcAddress: "", pin: "", tosAgreed: false },
  });

  const watchedAmount = form.watch("amount");
  const amountUsdt = parseFloat(watchedAmount) || 0;
  const totalDeducted = amountUsdt + WITHDRAWAL_FEE_USDT;
  const exceedsBalance = amountUsdt > 0 && totalDeducted > userBalance;

  const onSubmit = (data: z.infer<typeof withdrawSchema>) => {
    createWithdrawal({
      amount: data.amount,
      trcAddress: data.trcAddress,
      pin: data.pin,
    } as any, {
      onSuccess: () => {
        form.reset();
      },
    });
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-display font-bold" data-testid="text-withdraw-title">{t.withdraw.title}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t.withdraw.subtitle}</p>
      </div>

      {user?.isBanned ? (
        <Alert variant="destructive" data-testid="alert-banned-withdraw">
          <Ban className="h-4 w-4" />
          <AlertTitle>Account Disabled</AlertTitle>
          <AlertDescription>
            Your account is temporarily banned or disabled. Please contact customer support.
          </AlertDescription>
        </Alert>
      ) : !kycVerified ? (
        <Alert className="bg-amber-500/8 border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300" data-testid="alert-kyc-required-withdraw">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>{t.kyc.required}</AlertTitle>
          <AlertDescription>
            {t.kyc.withdrawMessage}{" "}
            <Link href="/profile" className="underline font-medium">{t.kyc.goToProfile}</Link>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="bg-blue-500/8 border-blue-200 dark:border-blue-800/50 text-blue-800 dark:text-blue-300">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>{t.withdraw.securityVerification}</AlertTitle>
          <AlertDescription>{t.withdraw.securityDescription}</AlertDescription>
        </Alert>
      )}

      {kycVerified && pinStatus && !pinStatus.hasWithdrawalPin && (
        <Alert className="bg-orange-500/8 border-orange-300 dark:border-orange-800/50 text-orange-900 dark:text-orange-300" data-testid="alert-no-withdrawal-pin">
          <Lock className="h-4 w-4" />
          <AlertTitle>{t.withdraw.noPinSet}</AlertTitle>
          <AlertDescription>
            {t.withdraw.noPinAction}{" "}
            <Link href="/security" className="underline font-medium">{t.withdraw.goToSecurity}</Link>
          </AlertDescription>
        </Alert>
      )}

      <Card className={!kycVerified ? "opacity-50 pointer-events-none" : ""}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-primary" />
            {t.withdraw.title}
          </CardTitle>
          <CardDescription className="text-xs">
            {t.withdraw.minLimit}: {WITHDRAWAL_MIN_USDT} USDT &nbsp;·&nbsp; {t.withdraw.maxLimit}: {WITHDRAWAL_MAX_USDT.toLocaleString()} USDT &nbsp;·&nbsp; {t.withdraw.fee}: {WITHDRAWAL_FEE_USDT} USDT
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

              {/* Amount */}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.withdraw.amountUsdt}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min={WITHDRAWAL_MIN_USDT}
                        max={WITHDRAWAL_MAX_USDT}
                        placeholder={`${WITHDRAWAL_MIN_USDT}.00`}
                        data-testid="input-amount"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Fee / Total summary */}
              {amountUsdt > 0 && (
                <div className="p-3 bg-muted/40 rounded-md border border-border space-y-2 text-sm" data-testid="withdrawal-summary">
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t.withdraw.amountUsdt}</span>
                    <span className="font-medium text-foreground">{formatUsdt(amountUsdt)} USDT</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t.withdraw.fee}</span>
                    <span className="font-medium text-orange-600 dark:text-orange-400">− {WITHDRAWAL_FEE_USDT.toFixed(2)} USDT</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>{t.withdraw.totalDeducted}</span>
                    <span className={exceedsBalance ? "text-destructive" : "text-primary"} data-testid="text-total-deducted">
                      {formatUsdt(totalDeducted)} USDT
                    </span>
                  </div>
                  {exceedsBalance && (
                    <p className="text-xs text-destructive" data-testid="alert-insufficient-balance">
                      Insufficient balance. Your balance: {formatUsdt(userBalance)} USDT
                    </p>
                  )}
                </div>
              )}

              {/* TRC-20 Address */}
              <FormField
                control={form.control}
                name="trcAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.withdraw.trcAddress}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t.withdraw.trcAddressPlaceholder}
                        className="font-mono text-sm"
                        data-testid="input-trc-address"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1 mt-1">
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                      {t.withdraw.trcAddressHint}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ToS (Haitian Creole) */}
              <div className="p-3.5 rounded-md border border-border bg-muted/30 space-y-2">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-muted-foreground" />
                  {t.withdraw.tosTitle}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed" data-testid="text-tos">
                  {t.withdraw.tosText}
                </p>
                <FormField
                  control={form.control}
                  name="tosAgreed"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0 mt-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-tos"
                        />
                      </FormControl>
                      <Label className="text-xs font-normal cursor-pointer">{t.withdraw.tosAgree}</Label>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Withdrawal PIN */}
              <FormField
                control={form.control}
                name="pin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                      {t.withdraw.withdrawalPin}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        inputMode="numeric"
                        placeholder={t.withdraw.withdrawalPinPlaceholder}
                        maxLength={6}
                        className="tracking-widest text-center text-lg"
                        data-testid="input-withdrawal-pin"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">{t.withdraw.withdrawalPinHint}</p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full primary-gradient"
                disabled={isWithdrawPending || exceedsBalance || (pinStatus !== undefined && !pinStatus.hasWithdrawalPin)}
                data-testid="button-confirm-withdrawal"
              >
                {isWithdrawPending ? (
                  <><Loader2 className="animate-spin mr-2 w-4 h-4" /> Processing...</>
                ) : (
                  t.withdraw.confirmWithdrawal
                )}
              </Button>

              {pinStatus !== undefined && !pinStatus.hasWithdrawalPin && (
                <p className="text-xs text-center text-muted-foreground">
                  {t.withdraw.noPinSet}{" "}
                  <Link href="/security" className="text-primary underline">{t.withdraw.goToSecurity}</Link>
                </p>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
