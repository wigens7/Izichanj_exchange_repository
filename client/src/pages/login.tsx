import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin, useVerifyOtp } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Fingerprint, Loader2, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const otpSchema = z.object({
  otp: z.string().length(6, "OTP must be 6 digits"),
});

export default function LoginPage() {
  const [step, setStep] = useState<"login" | "otp">("login");
  const [email, setEmail] = useState("");
  const [, setLocation] = useLocation();
  
  const { mutate: login, isPending: isLoginPending } = useLogin();
  const { mutate: verifyOtp, isPending: isVerifyPending } = useVerifyOtp();

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const otpForm = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
  });

  const onLoginSubmit = (data: z.infer<typeof loginSchema>) => {
    setEmail(data.email);
    login(data, {
      onSuccess: (res) => {
        if (res.requiresOtp) {
          setStep("otp");
        } else {
            // Should be handled by useUser query invalidation, 
            // but explicit redirect is safer for UX perceived speed
            setLocation("/"); 
        }
      },
    });
  };

  const onOtpSubmit = (data: z.infer<typeof otpSchema>) => {
    verifyOtp({ email, otp: data.otp }, {
        onSuccess: () => setLocation("/")
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-slate-950">
      <div className="absolute inset-0 overflow-hidden z-0">
        <div className="absolute -top-[30%] -left-[10%] w-[70%] h-[70%] rounded-full bg-blue-400/10 blur-[100px]" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-emerald-400/10 blur-[100px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md z-10"
      >
        <div className="text-center mb-8">
            <h1 className="text-4xl font-display font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">
            EASYCHANGE
            </h1>
            <p className="text-muted-foreground mt-2">Secure Crypto to Cash Exchange</p>
        </div>

        <Card className="glass-card border-none shadow-2xl">
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              {step === "login" ? "Welcome Back" : "Security Verification"}
            </CardTitle>
            <CardDescription className="text-center">
              {step === "login" 
                ? "Sign in to manage your exchanges" 
                : `Enter the code sent to ${email}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              {step === "login" ? (
                <motion.div
                    key="login-form"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                >
                    <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                        <FormField
                        control={loginForm.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                                <Input placeholder="you@example.com" {...field} className="h-11 bg-white/50" />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                                <Input type="password" placeholder="••••••••" {...field} className="h-11 bg-white/50" />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        
                        <Button 
                            type="submit" 
                            className="w-full h-11 text-base primary-gradient" 
                            disabled={isLoginPending}
                        >
                        {isLoginPending ? <Loader2 className="animate-spin" /> : "Sign In"}
                        </Button>
                    </form>
                    </Form>
                    
                    <div className="mt-6 flex items-center justify-between">
                        <div className="h-px bg-border flex-1" />
                        <span className="px-4 text-xs text-muted-foreground uppercase">Or use biometrics</span>
                        <div className="h-px bg-border flex-1" />
                    </div>

                    <Button variant="outline" className="w-full mt-4 h-11 border-dashed" onClick={() => alert("Simulated Biometric Auth")}>
                        <Fingerprint className="w-5 h-5 mr-2 text-primary" />
                        Unlock with Fingerprint
                    </Button>
                </motion.div>
              ) : (
                <motion.div
                    key="otp-form"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                >
                     <Form {...otpForm}>
                        <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-6">
                            <FormField
                            control={otpForm.control}
                            name="otp"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>One-Time Password</FormLabel>
                                <FormControl>
                                    <Input 
                                        placeholder="123456" 
                                        className="h-14 text-center text-2xl tracking-[0.5em] font-mono" 
                                        maxLength={6}
                                        {...field} 
                                    />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            
                            <Button 
                                type="submit" 
                                className="w-full h-11 text-base secondary-gradient" 
                                disabled={isVerifyPending}
                            >
                            {isVerifyPending ? <Loader2 className="animate-spin" /> : "Verify Identity"}
                            </Button>
                            
                            <Button 
                                type="button" 
                                variant="ghost" 
                                className="w-full"
                                onClick={() => setStep("login")}
                            >
                                Back to Login
                            </Button>
                        </form>
                    </Form>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
          <CardFooter className="justify-center border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link href="/register" className="text-primary hover:underline font-medium">
                    Create Account
                </Link>
            </p>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
