import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useUser, useLogout } from "@/hooks/use-auth";
import { useLanguage } from "@/lib/i18n";
import { 
  LayoutDashboard, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  UserCircle, 
  ShieldCheck, 
  Shield,
  LogOut,
  Menu,
  X
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

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-6 py-8">
        <h1 className="text-2xl font-display font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
          EASYCHANGE
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t.nav.cryptoToCash}</p>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`nav-item cursor-pointer ${isActive ? "active" : ""}`}
                onClick={() => setIsOpen(false)}
              >
                <item.icon className={`w-5 h-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mt-auto border-t border-border">
        <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                {(user?.fullName || user?.email || "U").charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
                <p className="text-sm font-medium truncate">{user?.fullName || "User"}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
        </div>
        <Button 
            variant="ghost" 
            className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => logout()}
        >
          <LogOut className="w-4 h-4 mr-2" />
          {t.nav.signOut}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-slate-950">
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-border z-50 flex items-center justify-between px-4">
        <h1 className="text-xl font-display font-bold text-primary">EASYCHANGE</h1>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[280px]">
            <NavContent />
          </SheetContent>
        </Sheet>
      </header>

      <aside className="hidden lg:block fixed top-0 left-0 bottom-0 w-64 bg-white dark:bg-slate-900 border-r border-border z-40">
        <NavContent />
      </aside>

      <main className="pt-20 lg:pt-8 lg:pl-64 min-h-screen">
        <div className="container max-w-5xl mx-auto px-4 sm:px-6 pb-20">
          {children}
        </div>
      </main>
    </div>
  );
}
