import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateWithdrawal, useRequestWithdrawalOtp } from "@/hooks/use-transactions";
import { useUser } from "@/hooks/use-auth";
import { useUpload } from "@/hooks/use-upload";
import { useLanguage } from "@/lib/i18n";
import { EXCHANGE_RATE_USDT_HTG, usdtToHtg, formatHtg, formatUsdt } from "@shared/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldAlert, Phone, QrCode, UploadCloud, CheckCircle2, ArrowRight } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link } from "wouter";

const withdrawSchema = z.object({
  currency: z.enum(["MonCash", "NatCash"]),
  amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Amount must be greater than 0"),
  withdrawMethod: z.enum(["phone", "qrcode"]),
  phoneNumber: z.string().optional(),
  qrCodeUrl: z.string().optional(),
  otp: z.string().length(6, "OTP must be 6 digits"),
}).refine((data) => {
  if (data.withdrawMethod === "phone") return data.phoneNumber && data.phoneNumber.length >= 8;
  return true;
}, { message: "Phone number required (min 8 digits)", path: ["phoneNumber"] })
.refine((data) => {
  if (data.withdrawMethod === "qrcode") return !!data.qrCodeUrl;
  return true;
}, { message: "QR code image required", path: ["qrCodeUrl"] });

export default function WithdrawPage() {
  const { data: user } = useUser();
  const { mutate: createWithdrawal, isPending: isWithdrawPending } = useCreateWithdrawal();
  const { mutate: requestOtp, isPending: isOtpPending } = useRequestWithdrawalOtp();
  const { uploadFile, isUploading } = useUpload();
  const [otpSent, setOtpSent] = useState(false);
  const [qrUploaded, setQrUploaded] = useState(false);
  const { t } = useLanguage();
  const kycVerified = user?.kycStatus === "verified";

  const form = useForm<z.infer<typeof withdrawSchema>>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: { currency: "MonCash", amount: "", withdrawMethod: "phone", phoneNumber: "", qrCodeUrl: "", otp: "" },
  });

  const withdrawMethod = form.watch("withdrawMethod");
  const watchedAmount = form.watch("amount");
  const amountUsdt = parseFloat(watchedAmount) || 0;
  const amountHtg = usdtToHtg(amountUsdt);

  const handleRequestOtp = () => {
    requestOtp(undefined, {
        onSuccess: () => setOtpSent(true)
    });
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await uploadFile(file);
    if (res) {
      form.setValue("qrCodeUrl", res.objectPath);
      setQrUploaded(true);
    }
  };

  const onSubmit = (data: z.infer<typeof withdrawSchema>) => {
    createWithdrawal({
        amount: data.amount,
        currency: data.currency,
        withdrawMethod: data.withdrawMethod,
        phoneNumber: data.withdrawMethod === "phone" ? data.phoneNumber : undefined,
        qrCodeUrl: data.withdrawMethod === "qrcode" ? data.qrCodeUrl : undefined,
        otp: data.otp
    }, {
        onSuccess: () => {
            form.reset();
            setOtpSent(false);
            setQrUploaded(false);
        }
    });
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-display font-bold" data-testid="text-withdraw-title">{t.withdraw.title}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t.withdraw.subtitle}</p>
      </div>

      {!kycVerified ? (
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

      <Card className={!kycVerified ? "opacity-50 pointer-events-none" : ""}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.withdraw.title}</CardTitle>
          <CardDescription className="text-xs">{t.withdraw.subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
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
                          <SelectTrigger data-testid="select-currency">
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
                      <FormLabel>{t.withdraw.amountUsdt}</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="10.00" data-testid="input-amount" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {amountUsdt > 0 && (
                <div className="p-3 bg-emerald-500/5 dark:bg-emerald-500/8 rounded-md border border-emerald-200 dark:border-emerald-800/40" data-testid="conversion-preview">
                  <div className="flex items-center justify-between flex-wrap gap-2 text-sm mb-1">
                    <span className="text-muted-foreground">{t.withdraw.exchangeRate}</span>
                    <span className="font-medium text-xs">1 USDT = {EXCHANGE_RATE_USDT_HTG.toFixed(2)} HTG</span>
                  </div>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-sm text-muted-foreground">{t.withdraw.youWillReceive}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold" data-testid="text-usdt-amount">{formatUsdt(amountUsdt)} USDT</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className="font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-htg-amount">{formatHtg(amountHtg)} HTG</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2.5">
                <Label className="text-sm">{t.withdraw.withdrawMethod}</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => { form.setValue("withdrawMethod", "phone"); setQrUploaded(false); form.setValue("qrCodeUrl", ""); }}
                    className={`flex items-center gap-2.5 p-3 rounded-md border-2 transition-colors text-left ${
                      withdrawMethod === "phone"
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    }`}
                    data-testid="button-method-phone"
                  >
                    <Phone className={`w-4 h-4 ${withdrawMethod === "phone" ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`text-sm font-medium ${withdrawMethod === "phone" ? "text-primary" : "text-muted-foreground"}`}>
                      {t.withdraw.phoneMethod}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { form.setValue("withdrawMethod", "qrcode"); form.setValue("phoneNumber", ""); }}
                    className={`flex items-center gap-2.5 p-3 rounded-md border-2 transition-colors text-left ${
                      withdrawMethod === "qrcode"
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    }`}
                    data-testid="button-method-qrcode"
                  >
                    <QrCode className={`w-4 h-4 ${withdrawMethod === "qrcode" ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`text-sm font-medium ${withdrawMethod === "qrcode" ? "text-primary" : "text-muted-foreground"}`}>
                      {t.withdraw.qrCodeMethod}
                    </span>
                  </button>
                </div>
              </div>

              {withdrawMethod === "phone" && (
                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.withdraw.phoneNumber}</FormLabel>
                      <FormControl>
                        <Input placeholder="3700-0000" data-testid="input-phone" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {withdrawMethod === "qrcode" && (
                <div className="space-y-2">
                  <Label>{t.withdraw.qrCodeUpload}</Label>
                  <p className="text-xs text-muted-foreground">{t.withdraw.qrCodeDescription}</p>
                  <div className="border-2 border-dashed border-border rounded-md p-5 text-center">
                    {qrUploaded ? (
                      <div className="flex items-center justify-center gap-2 text-sm text-emerald-600 dark:text-emerald-400" data-testid="status-qr-uploaded">
                        <CheckCircle2 className="w-4 h-4" />
                        {t.withdraw.qrCodeUploaded}
                      </div>
                    ) : (
                      <>
                        <Input
                          type="file" accept="image/*" className="hidden" id="qr-upload"
                          data-testid="input-qr-upload"
                          onChange={handleQrUpload}
                          disabled={isUploading}
                        />
                        <label htmlFor="qr-upload" className="cursor-pointer block">
                          {isUploading ? (
                            <Loader2 className="w-6 h-6 mx-auto text-muted-foreground mb-1.5 animate-spin" />
                          ) : (
                            <UploadCloud className="w-6 h-6 mx-auto text-muted-foreground mb-1.5" />
                          )}
                          <span className="text-sm text-primary font-medium">
                            {isUploading ? t.profile.uploading : t.withdraw.clickToUploadQr}
                          </span>
                        </label>
                      </>
                    )}
                  </div>
                  {form.formState.errors.qrCodeUrl && (
                    <p className="text-sm text-destructive">{form.formState.errors.qrCodeUrl.message}</p>
                  )}
                </div>
              )}

              <div className="p-3.5 bg-muted/50 rounded-md space-y-3 border border-border">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-sm font-medium">{t.withdraw.verification}</span>
                  {!otpSent && (
                    <Button 
                      type="button" variant="outline" size="sm"
                      onClick={handleRequestOtp}
                      disabled={isOtpPending}
                      data-testid="button-send-otp"
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
                            placeholder="123456" maxLength={6} 
                            className="tracking-widest"
                            data-testid="input-otp"
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
                className="w-full primary-gradient" 
                disabled={isWithdrawPending || !otpSent || (withdrawMethod === "qrcode" && !qrUploaded)}
                data-testid="button-confirm-withdrawal"
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
