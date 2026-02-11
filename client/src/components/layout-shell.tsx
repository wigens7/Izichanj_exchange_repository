import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useUser, useLogout } from "@/hooks/use-auth";
import { useLanguage } from "@/lib/i18n";
import { usdtToHtg, formatHtg } from "@shared/constants";
import { 
  LayoutDashboard, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  UserCircle, 
  Shield,
  ShieldCheck, 
  LogOut,
  Menu,
  Wallet
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

interface LayoutShellProps {
  children: ReactNode;
}

export function LayoutShell({ children }: LayoutShellProps) {
  const [location] = useLocation();
  const { data: user } = useUser();
  const { mutate: logout } = useLogout();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const navItems: { href: string; label: string; icon: any }[] = [
    { href: "/", label: t.nav.dashboard, icon: LayoutDashboard },
    { href: "/deposit", label: t.nav.deposit, icon: ArrowDownCircle },
    { href: "/withdraw", label: t.nav.withdraw, icon: ArrowUpCircle },
    { href: "/profile", label: t.nav.profileKyc, icon: UserCircle },
    { href: "/security", label: t.security.title, icon: Shield },
  ];

  if (user?.role === "admin") {
    navItems.push({ href: "/admin", label: t.nav.adminPanel, icon: ShieldCheck });
  }

  const balanceHtg = usdtToHtg(Number(user?.balance || 0));

  const NavContent = () => (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="px-5 pt-7 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-md bg-sidebar-primary flex items-center justify-center">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-display font-bold text-white tracking-tight">
              EASYCHANGE
            </h1>
            <p className="text-[11px] text-sidebar-foreground/50 leading-none">{t.nav.cryptoToCash}</p>
          </div>
        </div>
      </div>

      <div className="mx-4 mb-5 p-3.5 rounded-md bg-sidebar-accent">
        <p className="text-[11px] uppercase tracking-wider text-sidebar-foreground/40 font-medium mb-1">{t.dashboard.currentBalance}</p>
        <p className="text-xl font-display font-bold text-white" data-testid="text-sidebar-balance">{formatHtg(balanceHtg)} <span className="text-sm font-normal text-sidebar-foreground/50">HTG</span></p>
      </div>

      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`nav-item cursor-pointer ${isActive ? "active" : ""}`}
                onClick={() => setIsOpen(false)}
                data-testid={`nav-${item.href.replace("/", "") || "dashboard"}`}
              >
                <item.icon className={`w-[18px] h-[18px] ${isActive ? "text-sidebar-primary" : "text-sidebar-foreground/40"}`} />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mt-auto border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-9 h-9 rounded-md bg-sidebar-accent flex items-center justify-center text-sidebar-primary font-bold text-sm">
                {(user?.fullName || user?.email || "U").charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-white">{user?.fullName || "User"}</p>
                <p className="text-[11px] text-sidebar-foreground/40 truncate">{user?.email}</p>
            </div>
        </div>
        <Button 
            variant="ghost" 
            className="w-full justify-start text-sidebar-foreground/50"
            onClick={() => logout()}
            data-testid="button-logout"
        >
          <LogOut className="w-4 h-4 mr-2" />
          {t.nav.signOut}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-sidebar border-b border-sidebar-border z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-sidebar-primary flex items-center justify-center">
            <Wallet className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-base font-display font-bold text-white">EASYCHANGE</h1>
        </div>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent" data-testid="button-mobile-menu">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[280px] border-none">
            <NavContent />
          </SheetContent>
        </Sheet>
      </header>

      <aside className="hidden lg:block fixed top-0 left-0 bottom-0 w-[260px] z-40">
        <NavContent />
      </aside>

      <main className="pt-14 lg:pt-0 lg:pl-[260px] min-h-screen">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 pb-24">
          {children}
        </div>
      </main>
    </div>
  );
}
