import { useUser, useLogin, useRegister } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, LogIn, UserPlus, Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

function SignInForm() {
  const loginMutation = useLogin();
  const [showPassword, setShowPassword] = useState(false);
  const [, setLocation] = useLocation();

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (data: LoginInput) => {
    loginMutation.mutate(data, {
      onSuccess: (profile) => {
        if (profile.needsVerification || !profile.emailVerified) {
          setLocation("/verify-email");
        } else {
          setLocation("/");
        }
      },
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
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
              <FormLabel>Password</FormLabel>
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
          Sign In
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
              <FormLabel>Full Name</FormLabel>
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
              <FormLabel>Email</FormLabel>
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
              <FormLabel>Password</FormLabel>
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
              <FormLabel>Confirm Password</FormLabel>
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
          Create Account
        </Button>
      </form>
    </Form>
  );
}

export default function LoginPage() {
  const { data: user, isLoading } = useUser();
  const [, setLocation] = useLocation();

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
            EASYCHANGE
          </h1>
          <p className="text-muted-foreground mt-2">Secure Crypto to Cash Exchange</p>
        </div>

        <Card className="glass-card border-none shadow-2xl">
          <Tabs defaultValue="signin" className="w-full">
            <CardHeader className="pb-2">
              <TabsList className="grid w-full grid-cols-2" data-testid="tabs-auth">
                <TabsTrigger value="signin" data-testid="tab-signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup" data-testid="tab-signup">Sign Up</TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent>
              <TabsContent value="signin" className="mt-0">
                <div className="text-center mb-4">
                  <CardTitle className="text-xl" data-testid="text-signin-title">Welcome Back</CardTitle>
                  <CardDescription>Sign in to your account</CardDescription>
                </div>
                <SignInForm />
              </TabsContent>

              <TabsContent value="signup" className="mt-0">
                <div className="text-center mb-4">
                  <CardTitle className="text-xl" data-testid="text-signup-title">Create Account</CardTitle>
                  <CardDescription>Start exchanging crypto securely</CardDescription>
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
