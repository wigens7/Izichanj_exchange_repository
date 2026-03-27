import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useCreateWithdrawal, useRequestWithdrawalOtp } from "@/hooks/use-transactions";
import { useUser } from "@/hooks/use-auth";
import { useUpload } from "@/hooks/use-upload";
import { useLanguage } from "@/lib/i18n";
import {
  formatUsdt, formatHtg,
  WITHDRAWAL_MIN_USDT, WITHDRAWAL_MAX_USDT,
  WITHDRAWAL_FEE_USDT, WITHDRAWAL_EXCHANGE_RATE_USDT_HTG,
  usdtToHtgWithdrawal,
} from "@shared/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, ShieldAlert, Ban, Lock, AlertTriangle,
  Phone, QrCode, UploadCloud, CheckCircle2, Info, ArrowRight,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link } from "wouter";

// ── Schemas ──────────────────────────────────────────────────────────────────

const mobileMoneySchema = z.object({
  currency: z.enum(["MonCash", "NatCash"]),
  amount: z.string()
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Amount must be greater than 0")
    .refine((v) => Number(v) >= WITHDRAWAL_MIN_USDT, `Minimum is ${WITHDRAWAL_MIN_USDT} USDT`)
    .refine((v) => Number(v) <= WITHDRAWAL_MAX_USDT, `Maximum is ${WITHDRAWAL_MAX_USDT.toLocaleString()} USDT/day`),
  withdrawMethod: z.enum(["phone", "qrcode"]),
  phoneNumber: z.string().optional(),
  qrCodeUrl: z.string().optional(),
  otp: z.string().length(6, "OTP must be 6 digits"),
}).refine((d) => d.withdrawMethod !== "phone" || (!!d.phoneNumber && d.phoneNumber.length >= 8), {
  message: "Phone number required (min 8 digits)",
  path: ["phoneNumber"],
}).refine((d) => d.withdrawMethod !== "qrcode" || !!d.qrCodeUrl, {
  message: "QR code image required",
  path: ["qrCodeUrl"],
});

const usdtTrc20Schema = z.object({
  amount: z.string()
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Amount must be greater than 0")
    .refine((v) => Number(v) >= WITHDRAWAL_MIN_USDT, `Minimum is ${WITHDRAWAL_MIN_USDT} USDT`)
    .refine((v) => Number(v) <= WITHDRAWAL_MAX_USDT, `Maximum is ${WITHDRAWAL_MAX_USDT.toLocaleString()} USDT/day`),
  trcAddress: z.string().min(25, "Please enter a valid TRC-20 wallet address"),
  pin: z.string().length(6, "Withdrawal PIN must be exactly 6 digits").regex(/^\d{6}$/, "PIN must contain only digits"),
  tosAgreed: z.boolean().refine((v) => v === true, "You must agree to the Terms of Service"),
});

// ── Component ─────────────────────────────────────────────────────────────────

type Tab = "mobile" | "trc20";

export default function WithdrawPage() {
  const { data: user } = useUser();
  const { mutate: createWithdrawal, isPending: isWithdrawPending } = useCreateWithdrawal();
  const { mutate: requestOtp, isPending: isOtpPending } = useRequestWithdrawalOtp();
  const { uploadFile, isUploading } = useUpload();
  const { t } = useLanguage();
  const kycVerified = user?.kycStatus === "verified";
  const userBalance = parseFloat(user?.balance || "0");

  const [activeTab, setActiveTab] = useState<Tab>("mobile");
  const [otpSent, setOtpSent] = useState(false);
  const [qrUploaded, setQrUploaded] = useState(false);

  const { data: pinStatus } = useQuery<{ hasWithdrawalPin: boolean }>({
    queryKey: ["/api/security/withdrawal-pin/status"],
    enabled: !!user && kycVerified,
  });

  // ── Mobile Money form ──
  const mobileForm = useForm<z.infer<typeof mobileMoneySchema>>({
    resolver: zodResolver(mobileMoneySchema),
    defaultValues: { currency: "MonCash", amount: "", withdrawMethod: "phone", phoneNumber: "", qrCodeUrl: "", otp: "" },
  });
  const mCurrency = mobileForm.watch("currency");
  const mMethod = mobileForm.watch("withdrawMethod");
  const mAmount = parseFloat(mobileForm.watch("amount") || "0");
  const mHtg = usdtToHtgWithdrawal(mAmount);
  const mExceedsBalance = mAmount > 0 && mAmount > userBalance;

  // ── TRC-20 form ──
  const trcForm = useForm<z.infer<typeof usdtTrc20Schema>>({
    resolver: zodResolver(usdtTrc20Schema),
    defaultValues: { amount: "", trcAddress: "", pin: "", tosAgreed: false },
  });
  const tAmount = parseFloat(trcForm.watch("amount") || "0");
  const tTotal = tAmount + WITHDRAWAL_FEE_USDT;
  const tExceedsBalance = tAmount > 0 && tTotal > userBalance;

  // ── Handlers ──
  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await uploadFile(file);
    if (res) {
      mobileForm.setValue("qrCodeUrl", res.objectPath);
      setQrUploaded(true);
    }
  };

  const handleRequestOtp = () => {
    requestOtp(undefined, { onSuccess: () => setOtpSent(true) });
  };

  const onMobileSubmit = (data: z.infer<typeof mobileMoneySchema>) => {
    createWithdrawal({
      amount: data.amount,
      currency: data.currency,
      withdrawMethod: data.withdrawMethod,
      phoneNumber: data.withdrawMethod === "phone" ? data.phoneNumber : undefined,
      qrCodeUrl: data.withdrawMethod === "qrcode" ? data.qrCodeUrl : undefined,
      otp: data.otp,
    }, {
      onSuccess: () => {
        mobileForm.reset();
        setOtpSent(false);
        setQrUploaded(false);
      },
    });
  };

  const onTrcSubmit = (data: z.infer<typeof usdtTrc20Schema>) => {
    createWithdrawal({
      amount: data.amount,
      currency: "USDT_TRC20",
      trcAddress: data.trcAddress,
      pin: data.pin,
    }, {
      onSuccess: () => trcForm.reset(),
    });
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-display font-bold" data-testid="text-withdraw-title">{t.withdraw.title}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t.withdraw.subtitle}</p>
      </div>

      {/* Banned alert */}
      {user?.isBanned && (
        <Alert variant="destructive" data-testid="alert-banned-withdraw">
          <Ban className="h-4 w-4" />
          <AlertTitle>Account Disabled</AlertTitle>
          <AlertDescription>Your account is banned. Contact customer support.</AlertDescription>
        </Alert>
      )}

      {/* KYC alert */}
      {!kycVerified && !user?.isBanned && (
        <Alert className="bg-amber-500/8 border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300" data-testid="alert-kyc-required-withdraw">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>{t.kyc.required}</AlertTitle>
          <AlertDescription>
            {t.kyc.withdrawMessage}{" "}
            <Link href="/profile" className="underline font-medium">{t.kyc.goToProfile}</Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Security notice (only when KYC passed) */}
      {kycVerified && (
        <Alert className="bg-blue-500/8 border-blue-200 dark:border-blue-800/50 text-blue-800 dark:text-blue-300">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>{t.withdraw.securityVerification}</AlertTitle>
          <AlertDescription>{t.withdraw.securityDescription}</AlertDescription>
        </Alert>
      )}

      {/* No withdrawal PIN alert (TRC-20 tab only) */}
      {kycVerified && activeTab === "trc20" && pinStatus && !pinStatus.hasWithdrawalPin && (
        <Alert className="bg-orange-500/8 border-orange-300 dark:border-orange-800/50 text-orange-900 dark:text-orange-300" data-testid="alert-no-withdrawal-pin">
          <Lock className="h-4 w-4" />
          <AlertTitle>{t.withdraw.noPinSet}</AlertTitle>
          <AlertDescription>
            {t.withdraw.noPinAction}{" "}
            <Link href="/security" className="underline font-medium">{t.withdraw.goToSecurity}</Link>
          </AlertDescription>
        </Alert>
      )}

      {/* ── Tab switcher ── */}
      <div className="flex rounded-lg border border-border overflow-hidden" data-testid="withdraw-tabs">
        <button
          type="button"
          onClick={() => setActiveTab("mobile")}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === "mobile"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-muted"
          }`}
          data-testid="tab-mobile-money"
        >
          <Phone className="w-4 h-4" />
          {t.withdraw.tabMobileMoney}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("trc20")}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === "trc20"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-muted"
          }`}
          data-testid="tab-usdt-trc20"
        >
          <ArrowRight className="w-4 h-4" />
          {t.withdraw.tabUsdtTrc20}
        </button>
      </div>

      {/* ══════════════════════════════════════════════════
          TAB: Mobile Money (MonCash / NatCash)
      ══════════════════════════════════════════════════ */}
      {activeTab === "mobile" && (
        <Card className={!kycVerified || user?.isBanned ? "opacity-50 pointer-events-none" : ""}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary" />
              {t.withdraw.tabMobileMoney}
            </CardTitle>
            <CardDescription className="text-xs">
              {t.withdraw.exchangeRate}: 1 USDT = {WITHDRAWAL_EXCHANGE_RATE_USDT_HTG} HTG &nbsp;·&nbsp;
              {t.withdraw.minLimit}: {WITHDRAWAL_MIN_USDT} USDT &nbsp;·&nbsp;
              {t.withdraw.maxLimit}: {WITHDRAWAL_MAX_USDT.toLocaleString()} USDT
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...mobileForm}>
              <form onSubmit={mobileForm.handleSubmit(onMobileSubmit)} className="space-y-4">

                {/* Currency + Amount row */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={mobileForm.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.withdraw.walletType}</FormLabel>
                        <div className="flex gap-2">
                          {(["MonCash", "NatCash"] as const).map((w) => (
                            <button
                              key={w}
                              type="button"
                              onClick={() => field.onChange(w)}
                              className={`flex-1 py-2 rounded-md border-2 text-sm font-medium transition-colors ${
                                field.value === w
                                  ? "border-primary bg-primary/5 text-primary"
                                  : "border-border text-muted-foreground"
                              }`}
                              data-testid={`button-currency-${w.toLowerCase()}`}
                            >
                              {w}
                            </button>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={mobileForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.withdraw.amountUsdt}</FormLabel>
                        <FormControl>
                          <Input
                            type="number" step="0.01"
                            min={WITHDRAWAL_MIN_USDT} max={WITHDRAWAL_MAX_USDT}
                            placeholder={`${WITHDRAWAL_MIN_USDT}.00`}
                            data-testid="input-amount-mobile"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* HTG conversion */}
                {mAmount > 0 && (
                  <div className="p-3 bg-emerald-500/5 dark:bg-emerald-500/8 rounded-md border border-emerald-200 dark:border-emerald-800/40" data-testid="htg-preview">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{t.withdraw.exchangeRate}</span>
                      <span className="font-medium">1 USDT = {WITHDRAWAL_EXCHANGE_RATE_USDT_HTG} HTG</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{t.withdraw.youWillReceive}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold" data-testid="text-usdt-amount">{formatUsdt(mAmount)} USDT</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        <span className="font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-htg-amount">{formatHtg(mHtg)} HTG</span>
                      </div>
                    </div>
                    {mExceedsBalance && (
                      <p className="text-xs text-destructive mt-1" data-testid="alert-insufficient-balance-mobile">
                        Insufficient balance. Your balance: {formatUsdt(userBalance)} USDT
                      </p>
                    )}
                  </div>
                )}

                {/* Withdrawal method */}
                <div className="space-y-2">
                  <Label className="text-sm">{t.withdraw.withdrawMethod}</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => { mobileForm.setValue("withdrawMethod", "phone"); setQrUploaded(false); mobileForm.setValue("qrCodeUrl", ""); }}
                      className={`flex items-center gap-2.5 p-3 rounded-md border-2 transition-colors text-left ${mMethod === "phone" ? "border-primary bg-primary/5" : "border-border"}`}
                      data-testid="button-method-phone"
                    >
                      <Phone className={`w-4 h-4 ${mMethod === "phone" ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`text-sm font-medium ${mMethod === "phone" ? "text-primary" : "text-muted-foreground"}`}>{t.withdraw.phoneMethod}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { mobileForm.setValue("withdrawMethod", "qrcode"); mobileForm.setValue("phoneNumber", ""); }}
                      className={`flex items-center gap-2.5 p-3 rounded-md border-2 transition-colors text-left ${mMethod === "qrcode" ? "border-primary bg-primary/5" : "border-border"}`}
                      data-testid="button-method-qrcode"
                    >
                      <QrCode className={`w-4 h-4 ${mMethod === "qrcode" ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`text-sm font-medium ${mMethod === "qrcode" ? "text-primary" : "text-muted-foreground"}`}>{t.withdraw.qrCodeMethod}</span>
                    </button>
                  </div>
                </div>

                {/* Phone input */}
                {mMethod === "phone" && (
                  <FormField
                    control={mobileForm.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.withdraw.phoneNumber} ({mCurrency})</FormLabel>
                        <FormControl>
                          <Input placeholder="3700-0000" data-testid="input-phone" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* QR code upload */}
                {mMethod === "qrcode" && (
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
                          <Input type="file" accept="image/*" className="hidden" id="qr-upload" data-testid="input-qr-upload" onChange={handleQrUpload} disabled={isUploading} />
                          <label htmlFor="qr-upload" className="cursor-pointer block">
                            {isUploading ? <Loader2 className="w-6 h-6 mx-auto text-muted-foreground mb-1.5 animate-spin" /> : <UploadCloud className="w-6 h-6 mx-auto text-muted-foreground mb-1.5" />}
                            <span className="text-sm text-primary font-medium">{isUploading ? "Uploading..." : t.withdraw.clickToUploadQr}</span>
                          </label>
                        </>
                      )}
                    </div>
                    {mobileForm.formState.errors.qrCodeUrl && (
                      <p className="text-sm text-destructive">{mobileForm.formState.errors.qrCodeUrl.message}</p>
                    )}
                  </div>
                )}

                {/* OTP section */}
                <div className="p-3.5 bg-muted/50 rounded-md space-y-3 border border-border">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-sm font-medium">{t.withdraw.verification}</span>
                    {!otpSent && (
                      <Button type="button" variant="outline" size="sm" onClick={handleRequestOtp} disabled={isOtpPending} data-testid="button-send-otp">
                        {isOtpPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        {t.withdraw.sendOtp}
                      </Button>
                    )}
                  </div>
                  {otpSent && (
                    <FormField
                      control={mobileForm.control}
                      name="otp"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.withdraw.enterCode}</FormLabel>
                          <FormControl>
                            <Input placeholder="123456" maxLength={6} className="tracking-widest" data-testid="input-otp" {...field} />
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
                  disabled={isWithdrawPending || !otpSent || mExceedsBalance || (mMethod === "qrcode" && !qrUploaded)}
                  data-testid="button-confirm-withdrawal"
                >
                  {isWithdrawPending ? <><Loader2 className="animate-spin mr-2 w-4 h-4" /> Processing...</> : t.withdraw.confirmWithdrawal}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: USDT TRC-20
      ══════════════════════════════════════════════════ */}
      {activeTab === "trc20" && (
        <Card className={!kycVerified || user?.isBanned ? "opacity-50 pointer-events-none" : ""}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-primary" />
              {t.withdraw.tabUsdtTrc20}
            </CardTitle>
            <CardDescription className="text-xs">
              {t.withdraw.minLimit}: {WITHDRAWAL_MIN_USDT} USDT &nbsp;·&nbsp;
              {t.withdraw.maxLimit}: {WITHDRAWAL_MAX_USDT.toLocaleString()} USDT &nbsp;·&nbsp;
              {t.withdraw.fee}: {WITHDRAWAL_FEE_USDT} USDT
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...trcForm}>
              <form onSubmit={trcForm.handleSubmit(onTrcSubmit)} className="space-y-5">

                {/* Amount */}
                <FormField
                  control={trcForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.withdraw.amountUsdt}</FormLabel>
                      <FormControl>
                        <Input
                          type="number" step="0.01"
                          min={WITHDRAWAL_MIN_USDT} max={WITHDRAWAL_MAX_USDT}
                          placeholder={`${WITHDRAWAL_MIN_USDT}.00`}
                          data-testid="input-amount-trc20"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Fee / Total summary */}
                {tAmount > 0 && (
                  <div className="p-3 bg-muted/40 rounded-md border border-border space-y-2 text-sm" data-testid="withdrawal-summary">
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t.withdraw.amountUsdt}</span>
                      <span className="font-medium text-foreground">{formatUsdt(tAmount)} USDT</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t.withdraw.fee}</span>
                      <span className="font-medium text-orange-600 dark:text-orange-400">− {WITHDRAWAL_FEE_USDT.toFixed(2)} USDT</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>{t.withdraw.totalDeducted}</span>
                      <span className={tExceedsBalance ? "text-destructive" : "text-primary"} data-testid="text-total-deducted">
                        {formatUsdt(tTotal)} USDT
                      </span>
                    </div>
                    {tExceedsBalance && (
                      <p className="text-xs text-destructive" data-testid="alert-insufficient-balance-trc20">
                        Insufficient balance. Your balance: {formatUsdt(userBalance)} USDT
                      </p>
                    )}
                  </div>
                )}

                {/* TRC-20 Address */}
                <FormField
                  control={trcForm.control}
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

                {/* ToS */}
                <div className="p-3.5 rounded-md border border-border bg-muted/30 space-y-2">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-muted-foreground" />
                    {t.withdraw.tosTitle}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed" data-testid="text-tos">
                    {t.withdraw.tosText}
                  </p>
                  <FormField
                    control={trcForm.control}
                    name="tosAgreed"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0 mt-2">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-tos" />
                        </FormControl>
                        <Label className="text-xs font-normal cursor-pointer">{t.withdraw.tosAgree}</Label>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* 6-digit withdrawal PIN */}
                <FormField
                  control={trcForm.control}
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
                  disabled={isWithdrawPending || tExceedsBalance || (pinStatus !== undefined && !pinStatus.hasWithdrawalPin)}
                  data-testid="button-confirm-withdrawal-trc20"
                >
                  {isWithdrawPending
                    ? <><Loader2 className="animate-spin mr-2 w-4 h-4" /> Processing...</>
                    : t.withdraw.confirmWithdrawal}
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
      )}
    </div>
  );
}
