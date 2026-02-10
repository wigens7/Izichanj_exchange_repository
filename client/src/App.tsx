import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useUser } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import DepositPage from "@/pages/deposit";
import WithdrawPage from "@/pages/withdraw";
import ProfilePage from "@/pages/profile";
import AdminPage from "@/pages/admin";
import NotFound from "@/pages/not-found";
import { LayoutShell } from "@/components/layout-shell";

function ProtectedRoute({ component: Component, adminOnly = false }: { component: any, adminOnly?: boolean }) {
  const { data: user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="loader-protected" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
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
      <Route path="/admin">
        <ProtectedRoute component={AdminPage} adminOnly />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
