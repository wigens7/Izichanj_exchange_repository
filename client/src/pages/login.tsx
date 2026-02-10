import { useUser } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect } from "react";

export default function LoginPage() {
  const { data: user, isLoading } = useUser();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user) {
      setLocation("/");
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
            <CardTitle className="text-2xl text-center" data-testid="text-login-title">Welcome</CardTitle>
            <CardDescription className="text-center">
              Sign in to manage your crypto exchanges securely
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              className="w-full h-11 text-base primary-gradient"
              onClick={() => { window.location.href = "/api/login"; }}
              data-testid="button-sign-in"
            >
              <LogIn className="w-5 h-5 mr-2" />
              Sign In
            </Button>

            <div className="flex items-center gap-3">
              <div className="h-px bg-border flex-1" />
              <span className="text-xs text-muted-foreground uppercase">or</span>
              <div className="h-px bg-border flex-1" />
            </div>

            <Button
              variant="outline"
              className="w-full h-11 text-base"
              onClick={() => { window.location.href = "/api/login"; }}
              data-testid="button-sign-up"
            >
              <UserPlus className="w-5 h-5 mr-2" />
              Sign Up
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Continue with Google, GitHub, Apple, email & more
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
