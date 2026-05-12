import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useUser, useLogout } from "@/hooks/use-auth";
import { useLanguage } from "@/lib/i18n";
import { formatHtg } from "@shared/constants";
import { useRates } from "@/hooks/use-rates";
import {
  LayoutDashboard,
  ArrowDownCircle,
  ArrowUpCircle,
  UserCircle,
  Shield,
  ShieldCheck,
  LogOut,
  Menu,
  CreditCard,
  Send,
  Smartphone,
  Flag,
  Store,
  Download,
  Tv,
  Briefcase,
  Code,
  Settings,
  ChevronDown,
  ChevronRight,
  Share2,
  Nfc,
  Eye,
  EyeOff,
} from "lucide-react";
import { useBalanceVisibility } from "@/hooks/use-balance-visibility";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { NotificationBell } from "@/components/notification-bell";
import { SupportChat } from "@/components/support-chat";
import { SocialLinks } from "@/components/social-links";
import logoImg from "@/assets/logo.png";

interface LayoutShellProps {
  children: ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: any;
}

export function LayoutShell({ children }: LayoutShellProps) {
  const [location] = useLocation();
  const { data: user } = useUser();
  const { mutate: logout } = useLogout();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  // Main scrollable nav items
  const navItems: NavItem[] = [
    { href: "/", label: t.nav.dashboard, icon: LayoutDashboard },
    { href: "/deposit", label: t.nav.deposit, icon: ArrowDownCircle },
    { href: "/withdraw", label: t.nav.withdraw, icon: ArrowUpCircle },
    { href: "/send-funds", label: t.nav.sendFunds ?? "Send Funds", icon: Send },
    { href: "/virtual-cards", label: t.nav.virtualCard ?? "Virtual Card", icon: CreditCard },
    { href: "/nfc-cards", label: "NFC Virtual Card", icon: Nfc },
    { href: "/top-up", label: "Mobile Top-Up", icon: Smartphone },
    { href: "/canal-plus", label: "Canal+", icon: Tv },
    { href: "/p2p", label: "P2P Market", icon: Store },
    { href: "/merchant", label: "Merchant Tools", icon: Briefcase },
    { href: "/developers", label: "Developers", icon: Code },
    { href: "/report", label: "Report a User", icon: Flag },
  ];

  // Settings sub-menu items
  const settingsItems: NavItem[] = [
    { href: "/profile", label: t.nav.profileKyc, icon: UserCircle },
    { href: "/security", label: t.security.title, icon: Shield },
  ];
  const isOnSettingsPage = settingsItems.some((s) => s.href === location);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(isOnSettingsPage);
  // Auto-expand Settings whenever the route changes to a settings sub-page
  useEffect(() => {
    if (isOnSettingsPage) setSettingsOpen(true);
  }, [isOnSettingsPage]);

  const { depositRate } = useRates();
  const balanceHtg = Number(user?.balance || 0) * depositRate;
  const { visible: balanceVisible, toggle: toggleBalanceVisible } = useBalanceVisibility();

  const NavContent = () => (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground overflow-hidden">
      {/* ── Fixed header: logo + balance ── */}
      <div className="shrink-0">
        <div className="px-5 pt-7 pb-4">
          <div className="flex items-center gap-2.5">
            <img src={logoImg} alt="Izichanj Logo" className="h-8 w-auto" />
            <div>
              <h1 className="text-lg font-display font-bold text-white tracking-tight">Izichanj</h1>
              <p className="text-[11px] text-sidebar-foreground/50 leading-none">{t.nav.cryptoToCash}</p>
            </div>
          </div>
        </div>

        <div className="mx-4 mb-4 p-3 rounded-md bg-sidebar-accent">
          <p className="text-[11px] uppercase tracking-wider text-sidebar-foreground/40 font-medium mb-1">
            {t.dashboard.currentBalance}
          </p>
          <p className="text-xl font-display font-bold text-white" data-testid="text-sidebar-balance">
            {balanceVisible ? (
              <>{formatHtg(balanceHtg)} <span className="text-sm font-normal text-sidebar-foreground/50">HTG</span></>
            ) : (
              <>••••• <span className="text-sm font-normal text-sidebar-foreground/50">HTG</span></>
            )}
          </p>
        </div>
      </div>

      {/* ── Scrollable middle: main menu ── */}
      <nav
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-1 space-y-0.5"
        data-testid="nav-scroll-area"
      >
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`nav-item cursor-pointer ${isActive ? "active" : ""}`}
                onClick={() => setIsOpen(false)}
                data-testid={`nav-${item.href.replace("/", "") || "dashboard"}`}
              >
                <item.icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? "text-sidebar-primary" : "text-sidebar-foreground/40"}`} />
                <span className="truncate">{item.label}</span>
              </div>
            </Link>
          );
        })}

        {/* ── Settings parent (collapsible) ── */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            className={`nav-item cursor-pointer w-full text-left ${isOnSettingsPage ? "active" : ""}`}
            data-testid="nav-settings-toggle"
            aria-expanded={settingsOpen}
            aria-controls="nav-settings-submenu"
          >
            <Settings className={`w-[18px] h-[18px] shrink-0 ${isOnSettingsPage ? "text-sidebar-primary" : "text-sidebar-foreground/40"}`} />
            <span className="flex-1 truncate">Settings</span>
            {settingsOpen ? (
              <ChevronDown className="w-4 h-4 shrink-0 text-sidebar-foreground/40" />
            ) : (
              <ChevronRight className="w-4 h-4 shrink-0 text-sidebar-foreground/40" />
            )}
          </button>

          {settingsOpen && (
            <div id="nav-settings-submenu" className="mt-1 mb-2 space-y-0.5" data-testid="nav-settings-submenu">
              {settingsItems.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link key={item.href} href={item.href}>
                    <div
                      className={`nav-subitem cursor-pointer ${isActive ? "active" : ""}`}
                      onClick={() => setIsOpen(false)}
                      data-testid={`nav-sub-${item.href.replace("/", "")}`}
                    >
                      <item.icon className={`w-4 h-4 shrink-0 ${isActive ? "text-sidebar-primary" : "text-sidebar-foreground/40"}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                  </Link>
                );
              })}

              {/* Social media inside Settings */}
              <div className="pl-9 pr-3 pt-2 pb-1">
                <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/40 font-medium mb-1.5 flex items-center gap-1.5">
                  <Share2 className="w-3 h-3" />
                  Social Media
                </p>
                <SocialLinks compact />
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* ── Fixed footer: Admin / APK / User+Logout ── */}
      <div className="shrink-0 border-t border-sidebar-border bg-sidebar">
        {user?.role === "admin" && (
          <div className="px-3 pt-3">
            <Link href="/admin">
              <div
                className={`nav-item cursor-pointer ${location === "/admin" ? "active" : ""}`}
                onClick={() => setIsOpen(false)}
                data-testid="nav-admin"
              >
                <ShieldCheck className={`w-[18px] h-[18px] shrink-0 ${location === "/admin" ? "text-sidebar-primary" : "text-sidebar-foreground/40"}`} />
                <span className="truncate">{t.nav.adminPanel}</span>
              </div>
            </Link>
          </div>
        )}

        <div className="px-3 pt-3">
          <a
            href="/api/download-app"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="link-download-apk"
            className="flex items-center gap-2.5 w-full rounded-md px-3 py-2 bg-green-600 hover:bg-green-500 active:bg-green-700 transition-colors text-white font-semibold text-sm shadow-md"
            onClick={() => setIsOpen(false)}
          >
            <Download className="w-4 h-4 shrink-0" />
            <span className="leading-tight truncate">Download APK</span>
          </a>
        </div>

        <div className="p-3">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="w-9 h-9 rounded-md bg-sidebar-accent flex items-center justify-center text-sidebar-primary font-bold text-sm shrink-0">
              {(user?.fullName || user?.email || "U").charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-white">{user?.fullName || "User"}</p>
              <p className="text-[11px] text-sidebar-foreground/40 truncate">{user?.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground/60 hover:text-white h-9"
            onClick={() => logout()}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4 mr-2" />
            {t.nav.signOut}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-sidebar border-b border-sidebar-border z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <img src={logoImg} alt="Izichanj Logo" className="h-7 w-auto" />
          <h1 className="text-base font-display font-bold text-white">Izichanj</h1>
        </div>
        <div className="flex items-center gap-1">
          <div className="text-sidebar-foreground">
            <NotificationBell />
          </div>
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-sidebar-foreground" data-testid="button-mobile-menu">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[280px] border-none">
              <NavContent />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <aside className="hidden lg:block fixed top-0 left-0 bottom-0 w-[260px] z-40">
        <NavContent />
      </aside>

      <main className="pt-14 lg:pt-0 lg:pl-[260px] min-h-screen">
        <div className="hidden lg:flex items-center justify-end px-6 py-3 border-b border-border">
          <NotificationBell />
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 pb-24">
          {children}
        </div>
      </main>
      <SupportChat />
    </div>
  );
}
