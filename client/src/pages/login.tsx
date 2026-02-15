import { useUser, useLogin, useRegister } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, LogIn, UserPlus, Eye, EyeOff, Shield, Fingerprint, Wallet, ArrowRightLeft, ShieldCheck, Zap, Phone, KeyRound } from "lucide-react";
import logoImg from "@/assets/logo.png";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { startAuthentication } from "@simplewebauthn/browser";

function TwoFAStep({ onSuccess }: { onSuccess: (profile: any) => void }) {
  const [code, setCode] = useState("");
  const [isPending, setIsPending] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setIsPending(true);
    try {
      const res = await apiRequest("POST", "/api/auth/verify-2fa", { code });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      const profile = await res.json();
      queryClient.setQueryData(["/api/user"], profile);
      onSuccess(profile);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="space-y-5 text-center">
      <div className="w-14 h-14 mx-auto bg-primary/10 rounded-xl flex items-center justify-center">
        <Shield className="w-7 h-7 text-primary" />
      </div>
      <div>
        <h3 className="text-lg font-bold" data-testid="text-2fa-title">{t.security.twoFARequired}</h3>
        <p className="text-sm text-muted-foreground mt-1">{t.security.enter2FACode}</p>
      </div>
      <Input
        placeholder="000000"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        className="text-center text-2xl tracking-[0.5em] font-mono"
        data-testid="input-2fa-login-code"
      />
      <Button
        className="w-full primary-gradient"
        onClick={handleVerify}
        disabled={code.length !== 6 || isPending}
        data-testid="button-verify-2fa-login"
      >
        {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
        {t.security.verifyLogin}
      </Button>
    </div>
  );
}

function ForgotPinForm({ email, onBack }: { email: string; onBack: () => void }) {
  const [step, setStep] = useState<"phone" | "reset" | "success">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isPending, setIsPending] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

  const handleSendCode = async () => {
    if (!phone || phone.length < 8) return;
    setIsPending(true);
    try {
      const res = await apiRequest("POST", "/api/auth/forgot-pin", { phone });
      const data = await res.json();
      toast({ title: t.security.forgotPinCodeSent });
      setStep("reset");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  const handleResetPin = async () => {
    if (code.length !== 6 || newPin.length !== 4 || newPin !== confirmPin) return;
    setIsPending(true);
    try {
      const res = await apiRequest("POST", "/api/auth/reset-pin", {
        phone,
        code,
        newPin,
        confirmPin,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      toast({ title: t.security.forgotPinSuccess, description: t.security.forgotPinSuccessDesc });
      setStep("success");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  if (step === "success") {
    return (
      <div className="space-y-5 text-center">
        <div className="w-14 h-14 mx-auto bg-green-500/10 rounded-xl flex items-center justify-center">
          <ShieldCheck className="w-7 h-7 text-green-500" />
        </div>
        <div>
          <h3 className="text-lg font-bold" data-testid="text-pin-reset-success">{t.security.forgotPinSuccess}</h3>
          <p className="text-sm text-muted-foreground mt-1">{t.security.forgotPinSuccessDesc}</p>
        </div>
        <Button className="w-full primary-gradient" onClick={onBack} data-testid="button-back-to-login">
          <LogIn className="w-4 h-4 mr-2" />
          {t.security.forgotPinBackToLogin}
        </Button>
      </div>
    );
  }

  if (step === "reset") {
    return (
      <div className="space-y-5">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto bg-primary/10 rounded-xl flex items-center justify-center">
            <KeyRound className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-lg font-bold mt-3" data-testid="text-reset-pin-title">{t.security.forgotPinTitle}</h3>
          <p className="text-xs text-muted-foreground mt-1">{t.security.forgotPinCodeSent}</p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">{t.security.forgotPinEnterCode}</label>
            <Input
              placeholder="000000"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="text-center text-xl tracking-[0.3em] font-mono mt-1"
              data-testid="input-reset-pin-code"
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t.security.forgotPinNewPin}</label>
            <Input
              type="password"
              inputMode="numeric"
              placeholder="----"
              maxLength={4}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
              className="text-center text-xl tracking-[0.3em] font-mono mt-1"
              data-testid="input-reset-pin-new"
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t.security.forgotPinConfirmPin}</label>
            <Input
              type="password"
              inputMode="numeric"
              placeholder="----"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
              className="text-center text-xl tracking-[0.3em] font-mono mt-1"
              data-testid="input-reset-pin-confirm"
            />
          </div>
        </div>
        <Button
          className="w-full primary-gradient"
          onClick={handleResetPin}
          disabled={code.length !== 6 || newPin.length !== 4 || newPin !== confirmPin || isPending}
          data-testid="button-reset-pin-submit"
        >
          {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
          {t.security.forgotPinResetButton}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={onBack} data-testid="button-forgot-pin-back">
          {t.security.forgotPinBackToLogin}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="w-14 h-14 mx-auto bg-primary/10 rounded-xl flex items-center justify-center">
          <KeyRound className="w-7 h-7 text-primary" />
        </div>
        <h3 className="text-lg font-bold mt-3" data-testid="text-forgot-pin-title">{t.security.forgotPinTitle}</h3>
        <p className="text-sm text-muted-foreground mt-1">{t.security.forgotPinSubtitle}</p>
      </div>
      <div>
        <label className="text-sm font-medium">{t.security.forgotPinPhone}</label>
        <div className="relative mt-1">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="+509XXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="pl-10"
            data-testid="input-forgot-pin-phone"
          />
        </div>
      </div>
      <Button
        className="w-full primary-gradient"
        onClick={handleSendCode}
        disabled={phone.length < 8 || isPending}
        data-testid="button-forgot-pin-send"
      >
        {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
        {t.security.forgotPinSendCode}
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={onBack} data-testid="button-forgot-pin-cancel">
        {t.security.forgotPinBackToLogin}
      </Button>
    </div>
  );
}

function PinLoginForm({ email, onSwitchToPassword, onForgotPin }: { email: string; onSwitchToPassword: () => void; onForgotPin: () => void }) {
  const [pinDigits, setPinDigits] = useState(["", "", "", ""]);
  const [isPending, setIsPending] = useState(false);
  const [needs2FA, setNeeds2FA] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();

  const handlePinLogin = async () => {
    const pin = pinDigits.join("");
    if (pin.length !== 4) return;
    setIsPending(true);
    try {
      const res = await apiRequest("POST", "/api/auth/pin-login", { email, pin });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      const profile = await res.json();
      if (profile.needs2fa || profile.needs2FA) {
        setNeeds2FA(true);
        return;
      }
      queryClient.setQueryData(["/api/user"], profile);
      toast({ title: "Welcome back!", description: `Signed in as ${profile.fullName}` });
      setLocation("/");
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "PIN login failed", variant: "destructive" });
      setPinDigits(["", "", "", ""]);
    } finally {
      setIsPending(false);
    }
  };

  if (needs2FA) {
    return (
      <TwoFAStep
        onSuccess={(profile) => {
          toast({ title: "Welcome back!", description: `Signed in as ${profile.fullName}` });
          setLocation("/");
        }}
      />
    );
  }

  return (
    <div className="space-y-5 text-center">
      <div className="w-14 h-14 mx-auto bg-primary/10 rounded-xl flex items-center justify-center">
        <KeyRound className="w-7 h-7 text-primary" />
      </div>
      <div>
        <h3 className="text-lg font-bold" data-testid="text-pin-title">{t.security.pinWelcome || "Welcome back"}</h3>
        <p className="text-sm text-muted-foreground mt-1">{t.security.enterYourPin || "Enter your 4-digit PIN to sign in"}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{email}</p>
      </div>
      <div className="flex gap-3 justify-center">
        {pinDigits.map((digit, i) => (
          <Input
            key={i}
            type="password"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            className="w-14 h-14 text-center text-2xl font-bold"
            data-testid={`input-pin-login-${i}`}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "");
              const newDigits = [...pinDigits];
              newDigits[i] = val;
              setPinDigits(newDigits);
              if (val && i < 3) {
                const next = e.target.parentElement?.querySelector(`[data-testid="input-pin-login-${i + 1}"]`) as HTMLInputElement;
                next?.focus();
              }
              if (val && i === 3) {
                const fullPin = [...newDigits];
                fullPin[3] = val;
                if (fullPin.join("").length === 4) {
                  setTimeout(() => {
                    const btn = document.querySelector('[data-testid="button-pin-submit"]') as HTMLButtonElement;
                    btn?.click();
                  }, 100);
                }
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !pinDigits[i] && i > 0) {
                const prev = (e.target as HTMLElement).parentElement?.querySelector(`[data-testid="input-pin-login-${i - 1}"]`) as HTMLInputElement;
                prev?.focus();
              }
            }}
          />
        ))}
      </div>
      <Button
        className="w-full primary-gradient"
        onClick={handlePinLogin}
        disabled={pinDigits.join("").length !== 4 || isPending}
        data-testid="button-pin-submit"
      >
        {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
        {t.security.signInWithPin || "Sign in with PIN"}
      </Button>
      <div className="flex items-center justify-center">
        <button
          type="button"
          className="text-xs text-primary hover:underline"
          onClick={onForgotPin}
          data-testid="link-forgot-pin"
        >
          {t.security.forgotPin}
        </button>
      </div>
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={onSwitchToPassword}
        data-testid="button-use-password"
      >
        {t.security.usePassword || "Use password instead"}
      </Button>
    </div>
  );
}

function SignInForm() {
  const loginMutation = useLogin();
  const [showPassword, setShowPassword] = useState(false);
  const [needs2FA, setNeeds2FA] = useState(false);
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [isFingerprintLoading, setIsFingerprintLoading] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  const onSubmit = (data: LoginInput) => {
    loginMutation.mutate(data, {
      onSuccess: (profile) => {
        if (profile.needs2FA) {
          setNeeds2FA(true);
        } else if (profile.needsVerification || !profile.emailVerified) {
          setLocation("/verify-email");
        } else {
          setLocation("/");
        }
      },
    });
  };

  const handleFingerprintLogin = async () => {
    const identifier = form.getValues("identifier");
    if (!identifier) {
      toast({ title: "Error", description: "Enter your email or phone first", variant: "destructive" });
      return;
    }
    setIsFingerprintLoading(true);
    try {
      const optionsRes = await apiRequest("POST", "/api/security/webauthn/auth-options", { identifier });
      if (!optionsRes.ok) {
        const err = await optionsRes.json();
        throw new Error(err.message);
      }
      const options = await optionsRes.json();
      const credential = await startAuthentication({ optionsJSON: options });
      const verifyRes = await apiRequest("POST", "/api/security/webauthn/auth-verify", credential);
      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        throw new Error(err.message);
      }
      const profile = await verifyRes.json();
      queryClient.setQueryData(["/api/user"], profile);
      toast({ title: "Welcome back!", description: `Signed in as ${profile.fullName}` });
      setLocation("/");
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Fingerprint login failed", variant: "destructive" });
    } finally {
      setIsFingerprintLoading(false);
    }
  };

  if (needs2FA) {
    return (
      <TwoFAStep
        onSuccess={(profile) => {
          toast({ title: "Welcome back!", description: `Signed in as ${profile.fullName}` });
          setLocation("/");
        }}
      />
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="identifier"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.login.emailOrPhone || "Email or Phone Number"}</FormLabel>
              <FormControl>
                <Input
                  placeholder="you@example.com or +509..."
                  data-testid="input-login-identifier"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.login.password}</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    data-testid="input-login-password"
                    {...field}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0"
                    onClick={() => setShowPassword(!showPassword)}
                    data-testid="button-toggle-login-password"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <a
            href="/forgot-password"
            className="text-xs text-primary hover:underline"
            data-testid="link-forgot-password"
          >
            {t.login.forgotPassword || "Forgot Password?"}
          </a>
        </div>

        <Button
          type="submit"
          className="w-full primary-gradient"
          disabled={loginMutation.isPending}
          data-testid="button-submit-login"
        >
          {loginMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <LogIn className="w-4 h-4 mr-2" />
          )}
          {t.login.signIn}
        </Button>

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleFingerprintLogin}
          disabled={isFingerprintLoading}
          data-testid="button-fingerprint-login"
        >
          {isFingerprintLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Fingerprint className="w-4 h-4 mr-2" />
          )}
          {t.security.fingerprintLogin}
        </Button>
      </form>
    </Form>
  );
}

function SignUpForm() {
  const registerMutation = useRegister();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", phone: "", password: "", confirmPassword: "" },
  });

  const onSubmit = (data: RegisterInput) => {
    registerMutation.mutate(data, {
      onSuccess: () => {
        setLocation("/verify-email");
      },
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.login.fullName}</FormLabel>
              <FormControl>
                <Input placeholder="John Doe" data-testid="input-register-fullname" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.login.email}</FormLabel>
              <FormControl>
                <Input type="email" placeholder="you@example.com" data-testid="input-register-email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.login.whatsappNumber || "WhatsApp Number"}</FormLabel>
              <FormControl>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="+509XXXXXXXX" className="pl-10" data-testid="input-register-phone" {...field} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.login.password}</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 6 characters"
                    data-testid="input-register-password"
                    {...field}
                  />
                  <Button
                    type="button" variant="ghost" size="icon"
                    className="absolute right-0 top-0"
                    onClick={() => setShowPassword(!showPassword)}
                    data-testid="button-toggle-register-password"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.login.confirmPassword}</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showConfirm ? "text" : "password"}
                    placeholder="Retype your password"
                    data-testid="input-register-confirm-password"
                    {...field}
                  />
                  <Button
                    type="button" variant="ghost" size="icon"
                    className="absolute right-0 top-0"
                    onClick={() => setShowConfirm(!showConfirm)}
                    data-testid="button-toggle-register-confirm"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full primary-gradient"
          disabled={registerMutation.isPending}
          data-testid="button-submit-register"
        >
          {registerMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <UserPlus className="w-4 h-4 mr-2" />
          )}
          {t.login.createAccount}
        </Button>
      </form>
    </Form>
  );
}

function FeatureItem({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-md bg-white/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-white/80" />
      </div>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-white/50 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { data: user, isLoading } = useUser();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const [showPinLogin, setShowPinLogin] = useState(false);
  const [showForgotPin, setShowForgotPin] = useState(false);
  const [savedEmail, setSavedEmail] = useState("");

  useEffect(() => {
    if (user) {
      if (!user.emailVerified) {
        setLocation("/verify-email");
      } else {
        setLocation("/");
      }
    }
  }, [user, setLocation]);

  useEffect(() => {
    const lastEmail = localStorage.getItem("izichanj_last_email");
    if (lastEmail) {
      fetch(`/api/auth/has-pin?email=${encodeURIComponent(lastEmail)}`)
        .then(r => r.json())
        .then(data => {
          if (data.hasPin) {
            setSavedEmail(lastEmail);
            setShowPinLogin(true);
          }
        })
        .catch(() => {});
    }
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="loader-auth" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-[45%] bg-[hsl(228,33%,10%)] relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-[hsl(230,75%,57%)]/10 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[hsl(160,84%,39%)]/8 blur-[100px]" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-10 w-full">
          <div className="flex items-center gap-2.5">
            <img src={logoImg} alt="Izichanj Logo" className="h-10 w-auto" />
            <span className="text-xl font-display font-bold text-white uppercase tracking-wider">Izichanj</span>
          </div>

          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-display font-bold text-white leading-tight text-balance">
                Convert USDT to local cash instantly
              </h2>
              <p className="text-white/40 mt-3 text-sm max-w-sm">
                The fastest and most secure way to exchange cryptocurrency for MonCash and NatCash in Haiti.
              </p>
            </div>

            <div className="space-y-5">
              <FeatureItem icon={ArrowRightLeft} title="Instant Exchange" description="Convert USDT (TRC20/BEP20) to HTG at competitive rates" />
              <FeatureItem icon={ShieldCheck} title="Bank-Level Security" description="2FA, biometric login, and encrypted transactions" />
              <FeatureItem icon={Zap} title="Fast Withdrawals" description="Receive funds to MonCash or NatCash in 15-20 minutes" />
            </div>
          </div>

          <p className="text-white/20 text-xs">Secured by industry-standard encryption</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center gap-2.5 mb-2">
              <img src={logoImg} alt="Izichanj Logo" className="h-12 w-auto" />
            </div>
            <p className="text-sm text-muted-foreground mt-2">{t.login.appSubtitle}</p>
          </div>

          {showForgotPin ? (
            <Card className="border shadow-sm">
              <CardContent className="pt-6">
                <ForgotPinForm
                  email={savedEmail}
                  onBack={() => {
                    setShowForgotPin(false);
                    setShowPinLogin(true);
                  }}
                />
              </CardContent>
            </Card>
          ) : showPinLogin ? (
            <Card className="border shadow-sm">
              <CardContent className="pt-6">
                <PinLoginForm
                  email={savedEmail}
                  onSwitchToPassword={() => {
                    setShowPinLogin(false);
                    localStorage.removeItem("izichanj_last_email");
                  }}
                  onForgotPin={() => {
                    setShowPinLogin(false);
                    setShowForgotPin(true);
                  }}
                />
              </CardContent>
            </Card>
          ) : (
            <Card className="border shadow-sm">
              <Tabs defaultValue="signin" className="w-full">
                <CardHeader className="pb-3">
                  <TabsList className="grid w-full grid-cols-2" data-testid="tabs-auth">
                    <TabsTrigger value="signin" data-testid="tab-signin">{t.login.signIn}</TabsTrigger>
                    <TabsTrigger value="signup" data-testid="tab-signup">{t.login.signUp}</TabsTrigger>
                  </TabsList>
                </CardHeader>

                <CardContent>
                  <TabsContent value="signin" className="mt-0">
                    <div className="mb-5">
                      <CardTitle className="text-xl" data-testid="text-signin-title">{t.login.welcomeBack}</CardTitle>
                      <CardDescription className="mt-1">{t.login.signInDescription}</CardDescription>
                    </div>
                    <SignInForm />
                  </TabsContent>

                  <TabsContent value="signup" className="mt-0">
                    <div className="mb-5">
                      <CardTitle className="text-xl" data-testid="text-signup-title">{t.login.createAccount}</CardTitle>
                      <CardDescription className="mt-1">{t.login.signUpDescription}</CardDescription>
                    </div>
                    <SignUpForm />
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
