import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/lib/i18n";
import { useUser, useLogout } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useCallback } from "react";

import LoginPage from "@/pages/login";
import VerifyEmailPage from "@/pages/verify-email";
import ForgotPasswordPage from "@/pages/forgot-password";
import DashboardPage from "@/pages/dashboard";
import DepositPage from "@/pages/deposit";
import WithdrawPage from "@/pages/withdraw";
import ProfilePage from "@/pages/profile";
import SecurityPage from "@/pages/security";
import AdminPage from "@/pages/admin";
import VirtualCardsPage from "@/pages/virtual-cards";
import NfcCardsPage from "@/pages/nfc-cards";
import P2PMarketPage from "@/pages/p2p-market";
import SendFundsPage from "@/pages/send-funds";
import TopUpPage from "@/pages/top-up";
import ReportPage from "@/pages/report";
import CanalPlusPage from "@/pages/canal-plus";
import NotFound from "@/pages/not-found";
import VerifyReceiptPage from "@/pages/verify-receipt";
import MerchantPage from "@/pages/merchant";
import DevelopersPage from "@/pages/developers";
import CheckoutPage from "@/pages/checkout";
import { LayoutShell } from "@/components/layout-shell";
import { NotificationPermissionPrompt } from "@/components/notification-permission-prompt";
import { registerAppServiceWorker } from "@/lib/pwa";

const INACTIVITY_TIMEOUT = 5 * 60 * 1000;

function InactivityGuard({ children }: { children: React.ReactNode }) {
  const { data: user } = useUser();
  const logout = useLogout();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (user) {
      timerRef.current = setTimeout(() => {
        logout.mutate();
        window.location.href = "/login";
      }, INACTIVITY_TIMEOUT);
    }
  }, [user, logout]);

  useEffect(() => {
    if (!user) return;
    const events = ["mousedown", "keydown", "touchstart", "scroll", "mousemove"];
    const handler = () => resetTimer();
    events.forEach(e => window.addEventListener(e, handler, { passive: true }));
    resetTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [user, resetTimer]);

  return <>{children}</>;
}

function ProtectedRoute({ component: Component, adminOnly = false }: { component: any, adminOnly?: boolean }) {
  const { data: user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="loader-protected" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (!user.emailVerified) {
    return <Redirect to="/verify-email" />;
  }

  if (adminOnly && user.role !== "admin") {
    return <Redirect to="/" />;
  }

  return (
    <LayoutShell>
      <Component />
    </LayoutShell>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={LoginPage} />
      <Route path="/verify-email" component={VerifyEmailPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />

      <Route path="/">
        <ProtectedRoute component={DashboardPage} />
      </Route>
      <Route path="/deposit">
        <ProtectedRoute component={DepositPage} />
      </Route>
      <Route path="/withdraw">
        <ProtectedRoute component={WithdrawPage} />
      </Route>
      <Route path="/profile">
        <ProtectedRoute component={ProfilePage} />
      </Route>
      <Route path="/security">
        <ProtectedRoute component={SecurityPage} />
      </Route>
      <Route path="/admin">
        <ProtectedRoute component={AdminPage} adminOnly />
      </Route>
      <Route path="/faq">
        <Redirect to="/profile" />
      </Route>
      <Route path="/p2p">
        <ProtectedRoute component={P2PMarketPage} />
      </Route>
      <Route path="/send-funds">
        <ProtectedRoute component={SendFundsPage} />
      </Route>
      <Route path="/virtual-cards">
        <ProtectedRoute component={VirtualCardsPage} />
      </Route>
      <Route path="/nfc-cards">
        <ProtectedRoute component={NfcCardsPage} />
      </Route>
      <Route path="/top-up">
        <ProtectedRoute component={TopUpPage} />
      </Route>
      <Route path="/report">
        <ProtectedRoute component={ReportPage} />
      </Route>
      <Route path="/canal-plus">
        <ProtectedRoute component={CanalPlusPage} />
      </Route>
      <Route path="/merchant">
        <ProtectedRoute component={MerchantPage} />
      </Route>
      <Route path="/developers" component={DevelopersPage} />
      <Route path="/checkout/:paymentId" component={CheckoutPage} />

      <Route path="/verify/:receiptId" component={VerifyReceiptPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    registerAppServiceWorker();
  }, []);
  // Presence heartbeat — pings every 60s while the tab is visible so the
  // server's throttled isAuthenticated middleware can refresh last_activity.
  useEffect(() => {
    const ping = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/user", { credentials: "include" }).catch(() => {});
    };
    ping();
    const id = window.setInterval(ping, 60_000);
    const onVis = () => { if (document.visibilityState === "visible") ping(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <InactivityGuard>
            <Router />
          </InactivityGuard>
          <NotificationPermissionPrompt />
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
