import { useUser, useVerifyEmail, useResendOtp } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MessageCircle, RefreshCw } from "lucide-react";
import logoImg from "@/assets/logo.png";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const OTP_LENGTH = 6;

export default function VerifyEmailPage() {
  const { data: user, isLoading } = useUser();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const verifyMutation = useVerifyEmail();
  const resendMutation = useResendOtp();
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [countdown, setCountdown] = useState(60);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const submittedCodeRef = useRef<string>("");

  const code = digits.join("");

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

  useEffect(() => {
    // Autofocus first box on mount
    inputRefs.current[0]?.focus();
  }, []);

  const updateDigit = (index: number, raw: string) => {
    // Keep only the last typed digit (handles overtype)
    const cleaned = raw.replace(/\D/g, "");
    const next = [...digits];
    next[index] = cleaned.slice(-1);
    setDigits(next);

    if (cleaned.length >= 1 && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace") {
      if (digits[index]) {
        // Clear current box; keep focus
        const next = [...digits];
        next[index] = "";
        setDigits(next);
        e.preventDefault();
      } else if (index > 0) {
        // Move focus back and clear previous
        const next = [...digits];
        next[index - 1] = "";
        setDigits(next);
        inputRefs.current[index - 1]?.focus();
        e.preventDefault();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
      e.preventDefault();
    } else if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
      e.preventDefault();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, startIndex: number) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!text) return;
    e.preventDefault();
    const next = [...digits];
    let cursor = startIndex;
    for (const ch of text) {
      if (cursor >= OTP_LENGTH) break;
      next[cursor] = ch;
      cursor++;
    }
    setDigits(next);
    const focusIdx = Math.min(cursor, OTP_LENGTH - 1);
    inputRefs.current[focusIdx]?.focus();
  };

  // Single-flight submission — guard against double-submit from auto-submit + manual click
  const submitCode = (value: string) => {
    if (value.length !== OTP_LENGTH) return;
    if (verifyMutation.isPending) return;
    if (submittedCodeRef.current === value) return;
    submittedCodeRef.current = value;
    verifyMutation.mutate(value);
  };

  const handleVerify = () => submitCode(code);

  // Auto-submit when all 6 digits filled
  useEffect(() => {
    if (code.length === OTP_LENGTH) submitCode(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const handleResend = () => {
    resendMutation.mutate(undefined, {
      onSuccess: () => {
        setCountdown(60);
        setDigits(Array(OTP_LENGTH).fill(""));
        submittedCodeRef.current = "";
        inputRefs.current[0]?.focus();
      },
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
            <CardDescription className="mt-1" data-testid="text-verify-description">
              {t.verifyEmail.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            <div
              className="flex justify-center gap-2"
              data-testid="otp-input-group"
              role="group"
              aria-label="6-digit verification code"
            >
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  maxLength={1}
                  value={digit}
                  onChange={(e) => updateDigit(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  onPaste={(e) => handlePaste(e, index)}
                  onFocus={(e) => e.target.select()}
                  disabled={verifyMutation.isPending}
                  aria-label={`Verification code digit ${index + 1} of ${OTP_LENGTH}`}
                  data-testid={`input-otp-${index}`}
                  className={cn(
                    "h-14 w-12 rounded-md border-2 text-center text-2xl font-bold shadow-sm transition-all",
                    "bg-white text-slate-900 border-slate-300",
                    "dark:bg-slate-800 dark:text-white dark:border-slate-600",
                    "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background focus:border-primary",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                  )}
                />
              ))}
            </div>

            <Button
              className="w-full primary-gradient"
              onClick={handleVerify}
              disabled={code.length !== OTP_LENGTH || verifyMutation.isPending}
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
