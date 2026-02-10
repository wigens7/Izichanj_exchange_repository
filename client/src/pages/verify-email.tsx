import { useUser, useVerifyEmail, useResendOtp } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, Mail, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

export default function VerifyEmailPage() {
  const { data: user, isLoading } = useUser();
  const [, setLocation] = useLocation();
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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="loader-verify" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-slate-950">
      <div className="absolute inset-0 overflow-hidden z-0">
        <div className="absolute -top-[30%] -left-[10%] w-[70%] h-[70%] rounded-full bg-blue-400/10 blur-[100px]" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-emerald-400/10 blur-[100px]" />
      </div>

      <div className="w-full max-w-md z-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-display font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">
            EASYCHANGE
          </h1>
          <p className="text-muted-foreground mt-2">Secure Crypto to Cash Exchange</p>
        </div>

        <Card className="glass-card border-none shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl" data-testid="text-verify-title">Verify Your Email</CardTitle>
            <CardDescription>
              We sent a 6-digit code to <span className="font-medium text-foreground">{user?.email}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
              Verify Email
            </Button>

            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Didn't receive the code?</p>
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
                {countdown > 0 ? `Resend in ${countdown}s` : "Resend Code"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
