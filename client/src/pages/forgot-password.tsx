import { useLocation } from "wouter";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, ArrowLeft, Phone, Lock, Eye, EyeOff, Wallet, KeyRound } from "lucide-react";
import logoImg from "@/assets/logo.png";
import { PhoneInput } from "@/components/phone-input";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Step = "phone" | "code" | "success";

export default function ForgotPasswordPage() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const startCountdown = () => {
    setCountdown(60);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendCode = async () => {
    if (phone.length < 8) {
      toast({ title: "Error", description: t.login.phoneRequired || "Please enter a valid phone number", variant: "destructive" });
      return;
    }
    setIsPending(true);
    try {
      const res = await apiRequest("POST", "/api/auth/forgot-password", { phone });
      const data = await res.json();
      toast({ title: t.login.codeSentTitle || "Code Sent", description: t.login.codeSentWhatsApp || "Check your WhatsApp for the verification code." });
      setStep("code");
      startCountdown();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to send code", variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  const handleResetPassword = async () => {
    if (code.length !== 6) {
      toast({ title: "Error", description: t.withdraw.otpError || "Code must be 6 digits", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Error", description: t.login.passwordMinLength || "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: t.login.passwordsDoNotMatch || "Passwords do not match", variant: "destructive" });
      return;
    }
    setIsPending(true);
    try {
      const res = await apiRequest("POST", "/api/auth/reset-password", { phone, code, newPassword, confirmPassword });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      setStep("success");
      toast({ title: t.login.passwordResetSuccess || "Password Reset", description: t.login.passwordResetDescription || "Your password has been reset successfully." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to reset password", variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  const handleResend = async () => {
    setIsPending(true);
    try {
      await apiRequest("POST", "/api/auth/forgot-password", { phone });
      toast({ title: t.login.codeSentTitle || "Code Sent", description: t.login.codeSentWhatsApp || "A new code has been sent to your WhatsApp." });
      startCountdown();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <img src={logoImg} alt="Izichanj Logo" className="h-10 w-auto" />
          <span className="text-2xl font-display font-bold">Izichanj</span>
        </div>

        <Card className="border shadow-sm">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-3 w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
              <KeyRound className="w-7 h-7 text-primary" />
            </div>
            <CardTitle className="text-xl" data-testid="text-forgot-title">
              {t.login.forgotPassword || "Forgot Password?"}
            </CardTitle>
            <CardDescription className="mt-1">
              {step === "phone" && (t.login.forgotDescription || "Enter your WhatsApp number to receive a reset code.")}
              {step === "code" && (t.login.enterResetCode || "Enter the code and your new password.")}
              {step === "success" && (t.login.passwordResetDescription || "Your password has been reset successfully.")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {step === "phone" && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t.login.whatsappNumber || "WhatsApp Number"}</label>
                  <PhoneInput
                    value={phone}
                    onChange={setPhone}
                    data-testid="input-forgot-phone"
                  />
                </div>
                <Button
                  className="w-full primary-gradient"
                  onClick={handleSendCode}
                  disabled={isPending || !phone || phone.length < 8}
                  data-testid="button-send-reset-code"
                >
                  {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Phone className="w-4 h-4 mr-2" />}
                  {t.login.sendResetCode || "Send Reset Code"}
                </Button>
              </>
            )}

            {step === "code" && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t.withdraw.enterCode || "Verification Code"}</label>
                  <div className="flex justify-center">
                    <InputOTP maxLength={6} value={code} onChange={setCode} data-testid="input-reset-code">
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t.login.newPassword || "New Password"}</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder={t.login.passwordMinLength || "At least 6 characters"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      data-testid="input-new-password"
                    />
                    <Button
                      type="button" variant="ghost" size="icon"
                      className="absolute right-0 top-0"
                      onClick={() => setShowPassword(!showPassword)}
                      data-testid="button-toggle-new-password"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t.login.confirmPassword}</label>
                  <div className="relative">
                    <Input
                      type={showConfirm ? "text" : "password"}
                      placeholder={t.login.confirmPasswordPlaceholder || "Retype your new password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      data-testid="input-confirm-new-password"
                    />
                    <Button
                      type="button" variant="ghost" size="icon"
                      className="absolute right-0 top-0"
                      onClick={() => setShowConfirm(!showConfirm)}
                      data-testid="button-toggle-confirm-password"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <Button
                  className="w-full primary-gradient"
                  onClick={handleResetPassword}
                  disabled={isPending || code.length !== 6 || newPassword.length < 6}
                  data-testid="button-reset-password"
                >
                  {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
                  {t.login.resetPassword || "Reset Password"}
                </Button>

                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">{t.verifyEmail.didntReceive}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResend}
                    disabled={countdown > 0 || isPending}
                    data-testid="button-resend-reset-code"
                  >
                    {countdown > 0 ? `${t.verifyEmail.resendIn} ${countdown}s` : t.verifyEmail.resendCode}
                  </Button>
                </div>
              </>
            )}

            {step === "success" && (
              <Button
                className="w-full primary-gradient"
                onClick={() => setLocation("/login")}
                data-testid="button-back-to-login"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t.login.backToLogin || "Back to Login"}
              </Button>
            )}

            {step !== "success" && (
              <div className="text-center">
                <a
                  href="/login"
                  className="text-sm text-primary hover:underline"
                  data-testid="link-back-to-login"
                >
                  <ArrowLeft className="w-3 h-3 inline mr-1" />
                  {t.login.backToLogin || "Back to Login"}
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
