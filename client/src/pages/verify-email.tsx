import { useUser, useVerifyEmail, useResendOtp } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, MessageCircle, RefreshCw, Wallet } from "lucide-react";
import logoImg from "@/assets/logo.png";
import { useEffect, useState } from "react";

export default function VerifyEmailPage() {
  const { data: user, isLoading } = useUser();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const verifyMutation = useVerifyEmail();
  const resendMutation = useResendOtp();
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
    if (user?.emailVerified) {
      setLocation("/");
    }
  }, [user, isLoading, setLocation]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleVerify = () => {
    if (code.length === 6) {
      verifyMutation.mutate(code);
    }
  };

  const handleResend = () => {
    resendMutation.mutate(undefined, {
      onSuccess: () => setCountdown(60),
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="loader-verify" />
      </div>
    );
  }

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
              <MessageCircle className="w-7 h-7 text-primary" />
            </div>
            <CardTitle className="text-xl" data-testid="text-verify-title">{t.verifyEmail.title}</CardTitle>
            <CardDescription className="mt-1">
              {t.verifyEmail.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={setCode}
                data-testid="input-otp-code"
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} data-testid="input-otp-0" />
                  <InputOTPSlot index={1} data-testid="input-otp-1" />
                  <InputOTPSlot index={2} data-testid="input-otp-2" />
                  <InputOTPSlot index={3} data-testid="input-otp-3" />
                  <InputOTPSlot index={4} data-testid="input-otp-4" />
                  <InputOTPSlot index={5} data-testid="input-otp-5" />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              className="w-full primary-gradient"
              onClick={handleVerify}
              disabled={code.length !== 6 || verifyMutation.isPending}
              data-testid="button-verify"
            >
              {verifyMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              {t.verifyEmail.verifyButton}
            </Button>

            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">{t.verifyEmail.didntReceive}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResend}
                disabled={countdown > 0 || resendMutation.isPending}
                data-testid="button-resend-otp"
              >
                {resendMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                {countdown > 0 ? `${t.verifyEmail.resendIn} ${countdown}s` : t.verifyEmail.resendCode}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
