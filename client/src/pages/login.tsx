import { useUser, useLogin, useRegister } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, LogIn, UserPlus, Eye, EyeOff, Shield, Fingerprint } from "lucide-react";
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
    <div className="space-y-4 text-center">
      <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
        <Shield className="w-8 h-8 text-primary" />
      </div>
      <h3 className="text-lg font-bold" data-testid="text-2fa-title">{t.security.twoFARequired}</h3>
      <p className="text-sm text-muted-foreground">{t.security.enter2FACode}</p>
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
    defaultValues: { email: "", password: "" },
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
    const email = form.getValues("email");
    if (!email) {
      toast({ title: "Error", description: "Enter your email first", variant: "destructive" });
      return;
    }
    setIsFingerprintLoading(true);
    try {
      const optionsRes = await apiRequest("POST", "/api/security/webauthn/auth-options", { email });
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
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.login.email}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  data-testid="input-login-email"
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

        <div className="relative">
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
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
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
                <Input
                  placeholder="John Doe"
                  data-testid="input-register-fullname"
                  {...field}
                />
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
                <Input
                  type="email"
                  placeholder="you@example.com"
                  data-testid="input-register-email"
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
                    placeholder="At least 6 characters"
                    data-testid="input-register-password"
                    {...field}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
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
                    type="button"
                    variant="ghost"
                    size="icon"
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

export default function LoginPage() {
  const { data: user, isLoading } = useUser();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  useEffect(() => {
    if (user) {
      if (!user.emailVerified) {
        setLocation("/verify-email");
      } else {
        setLocation("/");
      }
    }
  }, [user, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="loader-auth" />
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
            {t.login.appTitle}
          </h1>
          <p className="text-muted-foreground mt-2">{t.login.appSubtitle}</p>
        </div>

        <Card className="glass-card border-none shadow-2xl">
          <Tabs defaultValue="signin" className="w-full">
            <CardHeader className="pb-2">
              <TabsList className="grid w-full grid-cols-2" data-testid="tabs-auth">
                <TabsTrigger value="signin" data-testid="tab-signin">{t.login.signIn}</TabsTrigger>
                <TabsTrigger value="signup" data-testid="tab-signup">{t.login.signUp}</TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent>
              <TabsContent value="signin" className="mt-0">
                <div className="text-center mb-4">
                  <CardTitle className="text-xl" data-testid="text-signin-title">{t.login.welcomeBack}</CardTitle>
                  <CardDescription>{t.login.signInDescription}</CardDescription>
                </div>
                <SignInForm />
              </TabsContent>

              <TabsContent value="signup" className="mt-0">
                <div className="text-center mb-4">
                  <CardTitle className="text-xl" data-testid="text-signup-title">{t.login.createAccount}</CardTitle>
                  <CardDescription>{t.login.signUpDescription}</CardDescription>
                </div>
                <SignUpForm />
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
