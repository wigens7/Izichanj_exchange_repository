import {
  useAdminUsers,
  useAdminDeposits,
  useAdminWithdrawals,
  useAdminApproveDeposit,
  useAdminRejectDeposit,
  useAdminRejectDepositWithReason,
  useAdminRejectDepositForFraud,
  useAdminApproveWithdrawal,
  useAdminRejectWithdrawal,
  useAdminVerifyKyc,
  useAdminRejectKyc,
  useAdminUpdateBalance,
} from "@/hooks/use-transactions";
import { useUser } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";
import { useState, useRef, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  ArrowDownCircle,
  ArrowUpCircle,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Loader2,
  Pencil,
  Save,
  Send,
  MessageSquare,
  Eye,
  X,
  FileImage,
  Headphones,
  MessageCircle,
  User,
  Bot,
  Star,
  Paperclip,
  FileText,
  Download,
  Image as ImageIcon,
  KeyRound,
  Ban,
  Unlock,
  Search,
  Trash2,
  ChevronDown,
  ChevronUp,
  Hash,
  Calendar,
  Phone,
  MapPin,
  Mail,
  Activity,
  Monitor,
  Clock,
  LogIn,
  RefreshCw,
  CreditCard,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  ExternalLink,
  ShieldOff,
  Copy,
  Link as LinkIcon,
  Filter,
  Wifi,
  Globe,
  ArrowRightLeft,
  Landmark,
  ShieldAlert,
  History,
  Info,
  Flag,
  Lock,
  Share2,
  Smartphone,
  Tv,
  Wallet,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { formatDateTime, formatDateTimeFull, formatDateShortTime, formatTime, formatTimeSecs, formatDateDMY, formatDateTimeShort, formatDateTimeMedium, formatDateTimeMin, formatDateShort } from "@/lib/dateUtils";
import { formatHtg, formatUsdt } from "@shared/constants";
import { useRates } from "@/hooks/use-rates";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export default function AdminPage() {
  const { data: currentUser } = useUser();

  if (!currentUser || currentUser.role !== "admin") {
    return (
      <div className="p-10 text-center text-destructive" data-testid="text-access-denied">
        Access Denied
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-display font-bold" data-testid="text-admin-title">Admin Panel</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage users, transactions, and KYC verifications</p>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <div className="mb-4 overflow-x-auto">
          <TabsList className="flex w-max min-w-full h-auto gap-1 p-1">
            <TabsTrigger value="users" className="flex-col items-center gap-1 shrink-0 min-w-[60px] h-auto py-2.5 px-2 text-[10px] font-medium" data-testid="tab-admin-users">
              <Users className="w-5 h-5" />
              <span>Users</span>
            </TabsTrigger>
            <TabsTrigger value="deposits" className="flex-col items-center gap-1 shrink-0 min-w-[60px] h-auto py-2.5 px-2 text-[10px] font-medium" data-testid="tab-admin-deposits">
              <ArrowDownCircle className="w-5 h-5" />
              <span>Deposits</span>
            </TabsTrigger>
            <TabsTrigger value="withdrawals" className="flex-col items-center gap-1 shrink-0 min-w-[60px] h-auto py-2.5 px-2 text-[10px] font-medium" data-testid="tab-admin-withdrawals">
              <ArrowUpCircle className="w-5 h-5" />
              <span>Withdrawals</span>
            </TabsTrigger>
            <TabsTrigger value="kyc" className="flex-col items-center gap-1 shrink-0 min-w-[60px] h-auto py-2.5 px-2 text-[10px] font-medium" data-testid="tab-admin-kyc">
              <ShieldCheck className="w-5 h-5" />
              <span>KYC</span>
            </TabsTrigger>
            <TabsTrigger value="cards" className="flex-col items-center gap-1 shrink-0 min-w-[60px] h-auto py-2.5 px-2 text-[10px] font-medium" data-testid="tab-admin-cards">
              <CreditCard className="w-5 h-5" />
              <span>Cards</span>
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex-col items-center gap-1 shrink-0 min-w-[60px] h-auto py-2.5 px-2 text-[10px] font-medium" data-testid="tab-admin-messages">
              <MessageSquare className="w-5 h-5" />
              <span>Messages</span>
            </TabsTrigger>
            <TabsTrigger value="support" className="flex-col items-center gap-1 shrink-0 min-w-[60px] h-auto py-2.5 px-2 text-[10px] font-medium" data-testid="tab-admin-support">
              <Headphones className="w-5 h-5" />
              <span>Support</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex-col items-center gap-1 shrink-0 min-w-[60px] h-auto py-2.5 px-2 text-[10px] font-medium" data-testid="tab-admin-activity">
              <Activity className="w-5 h-5" />
              <span>Activity</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-col items-center gap-1 shrink-0 min-w-[60px] h-auto py-2.5 px-2 text-[10px] font-medium" data-testid="tab-admin-settings">
              <TrendingUp className="w-5 h-5" />
              <span>Rates</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex-col items-center gap-1 shrink-0 min-w-[60px] h-auto py-2.5 px-2 text-[10px] font-medium" data-testid="tab-admin-audit">
              <ShieldCheck className="w-5 h-5" />
              <span>Audit</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex-col items-center gap-1 shrink-0 min-w-[60px] h-auto py-2.5 px-2 text-[10px] font-medium" data-testid="tab-admin-reports">
              <Flag className="w-5 h-5" />
              <span>Reports</span>
            </TabsTrigger>
            <TabsTrigger value="referral-payouts" className="flex-col items-center gap-1 shrink-0 min-w-[60px] h-auto py-2.5 px-2 text-[10px] font-medium" data-testid="tab-admin-referral-payouts">
              <Share2 className="w-5 h-5" />
              <span>Referrals</span>
            </TabsTrigger>
            <TabsTrigger value="p2p-disputes" className="flex-col items-center gap-1 shrink-0 min-w-[60px] h-auto py-2.5 px-2 text-[10px] font-medium relative" data-testid="tab-admin-p2p-disputes">
              <ShieldAlert className="w-5 h-5" />
              <span>Disputes</span>
            </TabsTrigger>
            <TabsTrigger value="canalplus" className="flex-col items-center gap-1 shrink-0 min-w-[60px] h-auto py-2.5 px-2 text-[10px] font-medium" data-testid="tab-admin-canalplus">
              <Tv className="w-5 h-5" />
              <span>Canal+</span>
            </TabsTrigger>
            <TabsTrigger value="merchant-payouts" className="flex-col items-center gap-1 shrink-0 min-w-[60px] h-auto py-2.5 px-2 text-[10px] font-medium" data-testid="tab-admin-merchant-payouts">
              <Wallet className="w-5 h-5" />
              <span>Payouts</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
        <TabsContent value="deposits">
          <DepositsTab />
        </TabsContent>
        <TabsContent value="withdrawals">
          <WithdrawalsTab />
        </TabsContent>
        <TabsContent value="kyc">
          <KycTab />
        </TabsContent>
        <TabsContent value="cards">
          <VirtualCardReadyTab />
        </TabsContent>
        <TabsContent value="messages">
          <MessagesTab />
        </TabsContent>
        <TabsContent value="support">
          <SupportTab />
        </TabsContent>
        <TabsContent value="activity">
          <ActivityTab />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab />
        </TabsContent>
        <TabsContent value="audit">
          <AuditTab />
        </TabsContent>
        <TabsContent value="reports">
          <ReportsTab />
        </TabsContent>
        <TabsContent value="referral-payouts">
          <ReferralPayoutsTab />
        </TabsContent>
        <TabsContent value="merchant-payouts">
          <MerchantPayoutsTab />
        </TabsContent>
        <TabsContent value="p2p-disputes">
          <P2PDisputesTab key="p2p-disputes" />
        </TabsContent>
        <TabsContent value="canalplus">
          <CanalplusTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UsersTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { mutate: updateBalance, isPending } = useAdminUpdateBalance();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: users, isLoading, isError, refetch } = useQuery<any[]>({
    queryKey: ["/api/admin/users", debouncedSearch],
    queryFn: async () => {
      const url = debouncedSearch
        ? `/api/admin/users?search=${encodeURIComponent(debouncedSearch)}`
        : "/api/admin/users";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    retry: 3,
  });

  const { data: downloadStats } = useQuery<any>({
    queryKey: ["/api/admin/app-downloads"],
    refetchInterval: 60000,
  });

  const downloaderIdSet = new Set<number>((downloadStats?.downloaderIds || []) as number[]);

  const activeUsers = users?.filter((u: any) => !u.isDeleted) || [];
  const deletedUsers = users?.filter((u: any) => u.isDeleted) || [];

  if (isLoading && !users) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <Users className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <p className="font-medium">Could not load users</p>
            <p className="text-sm text-muted-foreground mt-1">There was a problem connecting to the database. Please try again.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {downloadStats && (
        <Card className="mb-4 border-green-500/30 bg-green-500/5" data-testid="card-app-downloads">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-600 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total App Downloads</p>
                  <p className="text-2xl font-bold text-green-500" data-testid="text-total-downloads">{downloadStats.total}</p>
                </div>
              </div>
              <div className="flex gap-3 flex-wrap">
                {(downloadStats.byDevice || []).map((d: any) => (
                  <div key={d.device_type} className="text-center">
                    <p className="text-xs text-muted-foreground capitalize">{d.device_type}</p>
                    <p className="text-sm font-semibold">{d.count}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            User Management
          </CardTitle>
          <Badge variant="secondary" data-testid="badge-user-count">
            {activeUsers.length} active users
          </Badge>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by Reference ID, name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-users"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Balance (USDT)</TableHead>
                <TableHead>KYC</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead>Signed Up</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeUsers.map((user: any) => (
                <UserRow key={user.id} user={user} onUpdateBalance={updateBalance} isPending={isPending} hasDownloaded={downloaderIdSet.has(user.id)} />
              ))}
              {activeUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {searchQuery ? "No users found matching your search" : "No users found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {deletedUsers.length > 0 && (
          <div className="mt-6 border-t pt-4">
            <p className="text-sm font-medium text-muted-foreground mb-2">Deleted Accounts ({deletedUsers.length})</p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ref ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Deleted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deletedUsers.map((user: any) => (
                    <TableRow key={user.id} className="opacity-50" data-testid={`row-deleted-user-${user.id}`}>
                      <TableCell className="font-mono text-xs">{user.referenceId || "—"}</TableCell>
                      <TableCell>{user.fullName}</TableCell>
                      <TableCell className="text-sm">{user.email}</TableCell>
                      <TableCell className="text-sm">{user.deletedAt ? formatDateTime(user.deletedAt) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
    </>
  );
}

const BALANCE_ADJUSTMENT_REASONS = [
  "Administrative Adjustment",
  "Manual Credit",
  "Bonus / Reward",
  "Correction / Error Fix",
  "Refund",
  "Penalty / Deduction",
  "KYC Incentive",
  "Promotional Credit",
  "Other",
];

function UserRow({ user, onUpdateBalance, isPending, hasDownloaded }: { user: any; onUpdateBalance: any; isPending: boolean; hasDownloaded?: boolean }) {
  const [balance, setBalance] = useState(user.balance);
  const [reason, setReason] = useState("Administrative Adjustment");
  const [isEditing, setIsEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [receiptBlobUrl, setReceiptBlobUrl] = useState<string | null>(null);
  const [show360, setShow360] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const handleSave = () => {
    onUpdateBalance(
      { id: user.id, balance: Number(balance), reason },
      {
        onSuccess: (blobUrl: string) => {
          if (receiptBlobUrl) URL.revokeObjectURL(receiptBlobUrl);
          setReceiptBlobUrl(blobUrl);
          setIsEditing(false);
          toast({ title: "Balance updated", description: "Receipt is ready — view or download below." });
        },
      }
    );
  };

  const disable2faMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/admin/users/${user.id}/disable-2fa`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "2FA disabled for " + user.fullName });
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: () => {
      toast({ title: "Failed to disable 2FA", variant: "destructive" });
    },
  });

  const banMutation = useMutation({
    mutationFn: async (isBanned: boolean) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${user.id}/ban`, { isBanned });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: data.isBanned ? "User banned" : "User unbanned",
        description: `${user.fullName} has been ${data.isBanned ? "temporarily banned" : "unbanned"}.`
      });
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const grantEditMutation = useMutation({
    mutationFn: async (allow: boolean) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${user.id}/grant-edit`, { allow });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.canEditProfile ? "Edit access granted" : "Edit access revoked",
        description: `${user.fullName} can now ${data.canEditProfile ? "" : "no longer "}edit their profile.`
      });
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/admin/users/${user.id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Account deleted", description: `${user.fullName}'s account has been permanently deleted and blacklisted.` });
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showStrowalletModal, setShowStrowalletModal] = useState(false);
  const [strowalletInput, setStrowalletInput] = useState(user.strowalletCustomerId || "");

  const setStrowalletMutation = useMutation({
    mutationFn: async (customerId: string) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${user.id}/strowallet-customer-id`, { strowalletCustomerId: customerId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Strowallet ID saved", description: `Customer ID set for ${user.fullName}.` });
      setShowStrowalletModal(false);
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleAffiliateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/admin/users/${user.id}/toggle-affiliate`);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: data.affiliateEnabled ? "Affiliate Enabled" : "Affiliate Disabled", description: data.affiliateEnabled ? `${user.fullName} can now use the referral system.` : `Affiliate disabled for ${user.fullName}.` });
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Edit user first/last name (typo fixes)
  const [editingName, setEditingName] = useState(false);
  const [editFirstName, setEditFirstName] = useState(user.firstName || "");
  const [editLastName, setEditLastName]   = useState(user.lastName  || "");
  const editNameMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/admin/users/${user.id}/name`, {
        firstName: editFirstName.trim(),
        lastName:  editLastName.trim(),
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Name updated", description: `Saved as "${data.fullName}".` });
      setEditingName(false);
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update name", description: error.message, variant: "destructive" });
    },
  });

  return (
    <>
      <TableRow data-testid={`row-user-${user.id}`} className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <TableCell className="font-mono text-xs">
          <div className="flex items-center gap-1">
            <Hash className="w-3 h-3 text-muted-foreground" />
            {user.referenceId || "—"}
          </div>
        </TableCell>
        <TableCell className="font-medium">
          <div className="flex items-center gap-1 flex-wrap">
            {user.fullName}
            {user.isBanned && (
              <Badge variant="destructive" className="text-[10px] uppercase">Banned</Badge>
            )}
            {hasDownloaded && (
              <Badge className="text-[9px] uppercase bg-green-600 hover:bg-green-600 text-white gap-0.5 px-1 py-0" data-testid={`badge-apk-${user.id}`}>
                <Smartphone className="w-2.5 h-2.5" />APK
              </Badge>
            )}
            {expanded ? <ChevronUp className="w-3 h-3 ml-1 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 ml-1 text-muted-foreground" />}
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground text-sm">{user.email}</TableCell>
        <TableCell>
          <StatusBadge status={user.role} />
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          {isEditing ? (
            <div className="flex flex-col gap-2 min-w-[220px]">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  className="w-28 h-8 text-sm"
                  data-testid={`input-balance-${user.id}`}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setIsEditing(false)}
                  data-testid={`button-cancel-balance-${user.id}`}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full text-xs rounded-md border border-input bg-background px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                data-testid={`select-reason-${user.id}`}
              >
                {BALANCE_ADJUSTMENT_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <Button
                size="sm"
                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                onClick={handleSave}
                disabled={isPending}
                data-testid={`button-save-balance-${user.id}`}
              >
                {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                Save & Download Receipt
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="font-medium">{Number(user.balance).toLocaleString()}</span>
                <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} data-testid={`button-edit-balance-${user.id}`}>
                  <Pencil className="w-3 h-3" />
                </Button>
              </div>
              {receiptBlobUrl && (
                <div className="flex gap-1.5">
                  <a href={receiptBlobUrl} target="_blank" rel="noopener noreferrer">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] gap-1 border-indigo-300 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-950"
                      data-testid={`button-view-receipt-${user.id}`}
                    >
                      <Eye className="w-3 h-3" />
                      View
                    </Button>
                  </a>
                  <a href={receiptBlobUrl} download={`balance-receipt-${user.id}.pdf`}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] gap-1 border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950"
                      data-testid={`button-download-receipt-${user.id}`}
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </Button>
                  </a>
                </div>
              )}
            </div>
          )}
        </TableCell>
        <TableCell>
          <StatusBadge status={user.kycStatus} />
        </TableCell>
        <TableCell>
          {user.emailVerified ? (
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          ) : (
            <XCircle className="w-4 h-4 text-red-400" />
          )}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {formatDateTime(user.createdAt)}
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1 flex-wrap">
            {user.twoFactorEnabled && (
              <Button variant="outline" size="sm" onClick={() => disable2faMutation.mutate()} disabled={disable2faMutation.isPending} data-testid={`button-disable-2fa-${user.id}`}>
                {disable2faMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <KeyRound className="w-3 h-3 mr-1" />}
                Disable 2FA
              </Button>
            )}
            <Button
              variant={user.isBanned ? "default" : "outline"}
              size="sm"
              onClick={() => banMutation.mutate(!user.isBanned)}
              disabled={banMutation.isPending}
              data-testid={`button-ban-user-${user.id}`}
            >
              {banMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : user.isBanned ? <Unlock className="w-3 h-3 mr-1" /> : <Ban className="w-3 h-3 mr-1" />}
              {user.isBanned ? "Unban" : "Ban"}
            </Button>
            <Button
              variant={user.canEditProfile ? "default" : "outline"}
              size="sm"
              onClick={() => grantEditMutation.mutate(!user.canEditProfile)}
              disabled={grantEditMutation.isPending}
              data-testid={`button-grant-edit-${user.id}`}
              title={user.canEditProfile ? "Revoke profile edit access" : "Grant one-time profile edit access"}
            >
              {grantEditMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Pencil className="w-3 h-3 mr-1" />}
              {user.canEditProfile ? "Revoke Edit" : "Grant Edit"}
            </Button>
            <Button
              variant={user.strowalletCustomerId ? "default" : "outline"}
              size="sm"
              onClick={() => setShowStrowalletModal(true)}
              data-testid={`button-set-strowallet-${user.id}`}
              title="Set or update Strowallet Customer ID"
            >
              <CreditCard className="w-3 h-3 mr-1" />
              {user.strowalletCustomerId ? "Update Strowallet" : "Set Strowallet"}
            </Button>
            <Button
              variant={user.affiliateEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => toggleAffiliateMutation.mutate()}
              disabled={toggleAffiliateMutation.isPending}
              data-testid={`button-toggle-affiliate-${user.id}`}
              title={user.affiliateEnabled ? "Disable affiliate program" : "Enable affiliate program"}
            >
              {toggleAffiliateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Users className="w-3 h-3 mr-1" />}
              {user.affiliateEnabled ? "Affiliate ON" : "Affiliate OFF"}
            </Button>
            {!confirmDelete ? (
              <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)} disabled={user.role === "admin"} data-testid={`button-delete-user-${user.id}`}>
                <Trash2 className="w-3 h-3 mr-1" />
                Delete
              </Button>
            ) : (
              <div className="flex items-center gap-1">
                <Button variant="destructive" size="sm" onClick={() => { deleteMutation.mutate(); setConfirmDelete(false); }} disabled={deleteMutation.isPending} data-testid={`button-confirm-delete-${user.id}`}>
                  {deleteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  Confirm
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)} data-testid={`button-cancel-delete-${user.id}`}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={9}>
            <div className="p-4 bg-muted/30 rounded-md space-y-3">
              <p className="text-sm font-medium">Personal Information</p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Hash className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Reference ID</p>
                    <p className="font-mono font-medium">{user.referenceId || "Not assigned"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 col-span-2">
                  <User className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-muted-foreground text-xs">First & Last Name</p>
                      {!editingName && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[11px] gap-1 text-indigo-600 hover:text-indigo-700"
                          onClick={() => {
                            setEditFirstName(user.firstName || "");
                            setEditLastName(user.lastName || "");
                            setEditingName(true);
                          }}
                          data-testid={`button-edit-name-${user.id}`}
                        >
                          <Pencil className="w-3 h-3" /> Fix typo
                        </Button>
                      )}
                    </div>
                    {editingName ? (
                      <div className="mt-1 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                        <Input
                          value={editFirstName}
                          onChange={(e) => setEditFirstName(e.target.value)}
                          placeholder="First name"
                          className="h-8 text-sm"
                          data-testid={`input-edit-firstname-${user.id}`}
                        />
                        <Input
                          value={editLastName}
                          onChange={(e) => setEditLastName(e.target.value)}
                          placeholder="Last name"
                          className="h-8 text-sm"
                          data-testid={`input-edit-lastname-${user.id}`}
                        />
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white"
                            onClick={() => editNameMutation.mutate()}
                            disabled={
                              editNameMutation.isPending ||
                              !editFirstName.trim() ||
                              !editLastName.trim() ||
                              (editFirstName.trim() === (user.firstName || "") &&
                               editLastName.trim()  === (user.lastName  || ""))
                            }
                            data-testid={`button-save-name-${user.id}`}
                          >
                            {editNameMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => setEditingName(false)}
                            data-testid={`button-cancel-edit-name-${user.id}`}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="font-medium" data-testid={`text-user-name-${user.id}`}>
                        {(user.firstName || "—") + " " + (user.lastName || "")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Date of Birth</p>
                    <p className="font-medium">{user.dateOfBirth || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Country</p>
                    <p className="font-medium">{user.country || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">City</p>
                    <p className="font-medium">{user.city || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Phone</p>
                    <p className="font-medium">{user.phone || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Email</p>
                    <p className="font-medium">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Signed Up</p>
                    <p className="font-medium">{formatDateTimeFull(user.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">2FA Enabled</p>
                    <p className="font-medium">{user.twoFactorEnabled ? "Yes" : "No"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Monitor className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Last IP</p>
                    <p className="font-mono font-medium text-xs" data-testid={`text-user-last-ip-${user.id}`}>{(user as any).lastIp || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Monitor className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Registration IP</p>
                    <p className="font-mono font-medium text-xs" data-testid={`text-user-reg-ip-${user.id}`}>{(user as any).registrationIp || "—"}</p>
                  </div>
                </div>
                {(user as any).lastLoginAt && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-muted-foreground text-xs">Last Login</p>
                      <p className="font-medium text-xs">{formatDateTime((user as any).lastLoginAt)}</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="pt-2 border-t">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => { e.stopPropagation(); setShow360(true); }}
                  className="gap-2 text-primary border-primary/30 hover:bg-primary/5"
                  data-testid={`button-360-view-${user.id}`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  360° Activity View
                </Button>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
      {show360 && <User360Modal userId={user.id} userName={user.fullName} onClose={() => setShow360(false)} />}
      {/* Modal for setting Strowallet Customer ID */}
      {showStrowalletModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-sm mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Set Strowallet Customer ID
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">{user.fullName} ({user.email})</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Customer ID</label>
                <Input
                  placeholder="e.g. 12345678"
                  value={strowalletInput}
                  onChange={(e) => setStrowalletInput(e.target.value)}
                  data-testid={`input-strowallet-id-${user.id}`}
                />
              </div>
              {user.strowalletCustomerId && (
                <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                  Current ID: <span className="font-mono font-medium">{user.strowalletCustomerId}</span>
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    if (strowalletInput.trim()) {
                      setStrowalletMutation.mutate(strowalletInput.trim());
                    }
                  }}
                  disabled={setStrowalletMutation.isPending || !strowalletInput.trim()}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                  data-testid={`button-save-strowallet-id-${user.id}`}
                >
                  {setStrowalletMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
                  Save
                </Button>
                <Button
                  onClick={() => {
                    setShowStrowalletModal(false);
                    setStrowalletInput(user.strowalletCustomerId || "");
                  }}
                  variant="outline"
                  className="flex-1"
                  data-testid={`button-cancel-strowallet-id-${user.id}`}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

async function approveAndRelease(type: "deposits" | "withdrawals", id: number, setLoading: (v: boolean) => void) {
  setLoading(true);
  try {
    const res = await fetch(`/api/admin/${type}/${id}/approve-release`, {
      method: "PATCH",
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed");
    const blob = await res.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `izichanj-receipt-${id}.pdf`;
    link.click();
    URL.revokeObjectURL(link.href);
    window.location.reload();
  } catch (e) {
    console.error("Approve & Release failed", e);
  } finally {
    setLoading(false);
  }
}

function previewReceipt(type: "deposits" | "withdrawals", id: number) {
  window.open(`/api/admin/receipts/${type === "deposits" ? "deposit" : "withdrawal"}/${id}`, "_blank");
}

function DepositsTab() {
  const { data: deposits, isLoading } = useAdminDeposits();
  const { depositRate } = useRates();
  const { mutate: approve, isPending: isApproving } = useAdminApproveDeposit();
  const { mutate: reject, isPending: isRejecting } = useAdminRejectDeposit();
  const { mutate: rejectWithReason, isPending: isRejectingWithReason } = useAdminRejectDepositWithReason();
  const { mutate: rejectForFraud, isPending: isRejectingForFraud } = useAdminRejectDepositForFraud();
  const [releaseLoadingId, setReleaseLoadingId] = useState<number | null>(null);
  const [rejectModalDepositId, setRejectModalDepositId] = useState<number | null>(null);
  const [fraudModalDepositId, setFraudModalDepositId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [proofViewUrl, setProofViewUrl] = useState<string | null>(null);
  const [txHashInputs, setTxHashInputs] = useState<Record<number, string>>({});
  const [savingTxHashId, setSavingTxHashId] = useState<number | null>(null);
  const [copiedTxId, setCopiedTxId] = useState<number | null>(null);
  const { toast } = useToast();

  const isManualDeposit = (deposit: any) => deposit.depositMethod === "moncash" && deposit.moncashTransactionId;
  const isCryptoDeposit = (deposit: any) => !isManualDeposit(deposit);

  const saveTxHash = async (depositId: number) => {
    const txHash = (txHashInputs[depositId] || "").trim();
    if (!txHash || txHash.length < 5) {
      toast({ title: "Invalid TxtID", description: "Please enter a valid Transaction ID (min 5 characters)", variant: "destructive" });
      return;
    }
    setSavingTxHashId(depositId);
    try {
      const res = await fetch(`/api/admin/deposits/${depositId}/set-txhash`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ txHash }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save TxtID");
      queryClient.invalidateQueries({ queryKey: [api.admin.allDeposits.path] });
      setTxHashInputs(prev => ({ ...prev, [depositId]: "" }));
      toast({ title: "TxtID Saved", description: "Transaction ID has been saved. You can now approve this deposit." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSavingTxHashId(null);
    }
  };

  const copyTxHash = (depositId: number, txHash: string) => {
    navigator.clipboard.writeText(txHash).then(() => {
      setCopiedTxId(depositId);
      setTimeout(() => setCopiedTxId(null), 2000);
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const pendingCount = deposits?.filter((d: any) => d.status === "pending").length || 0;
  const pendingManualCount = deposits?.filter((d: any) => d.status === "pending" && isManualDeposit(d)).length || 0;

  return (
    <>
      {/* Rejection reason modal */}
      {rejectModalDepositId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="modal-reject-deposit">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                Reject Deposit #{rejectModalDepositId}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Provide a clear reason for rejecting this deposit. The user will be notified via in-app notification and WhatsApp.
              </p>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Rejection Reason</label>
                <textarea
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="e.g. Transaction ID not found, Screenshot does not match amount, Duplicate submission..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  data-testid="textarea-reject-reason"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={!rejectReason.trim() || isRejectingWithReason}
                  onClick={() => {
                    rejectWithReason(
                      { id: rejectModalDepositId, reason: rejectReason },
                      {
                        onSuccess: () => {
                          setRejectModalDepositId(null);
                          setRejectReason("");
                        },
                      }
                    );
                  }}
                  data-testid="button-confirm-reject-deposit"
                >
                  {isRejectingWithReason ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <XCircle className="w-3 h-3 mr-2" />}
                  Confirm Rejection
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setRejectModalDepositId(null); setRejectReason(""); }}
                  data-testid="button-cancel-reject-deposit"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Fraud rejection confirmation modal */}
      {fraudModalDepositId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" data-testid="modal-fraud-deposit">
          <Card className="w-full max-w-md border-red-500">
            <CardHeader className="bg-red-500/10">
              <CardTitle className="flex items-center gap-2 text-red-600">
                <ShieldOff className="w-5 h-5" />
                Reject for Fraud — Deposit #{fraudModalDepositId}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300 space-y-1">
                <p className="font-semibold">⚠️ This action will:</p>
                <ul className="list-disc ml-4 space-y-0.5 text-xs">
                  <li>Reject the deposit as fraudulent</li>
                  <li>Record a fraud strike against the user</li>
                  <li>After 3 strikes in 30 minutes → account frozen 24h</li>
                  <li>Alert sent to admin Telegram + user WhatsApp</li>
                </ul>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={isRejectingForFraud}
                  onClick={() => {
                    rejectForFraud(fraudModalDepositId, {
                      onSuccess: () => setFraudModalDepositId(null),
                    });
                  }}
                  data-testid="button-confirm-fraud-reject"
                >
                  {isRejectingForFraud ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <ShieldOff className="w-3 h-3 mr-2" />}
                  Confirm Fraud Rejection
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setFraudModalDepositId(null)}
                  data-testid="button-cancel-fraud-reject"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Proof image viewer */}
      {proofViewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setProofViewUrl(null)}
          data-testid="modal-proof-viewer"
        >
          <div className="relative max-w-2xl w-full max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="secondary"
              size="icon"
              className="absolute -top-10 right-0"
              onClick={() => setProofViewUrl(null)}
            >
              <X className="w-4 h-4" />
            </Button>
            <img src={proofViewUrl} alt="Deposit proof" className="w-full rounded-lg object-contain max-h-[75vh]" />
            <a
              href={proofViewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-2 right-2 text-xs bg-background/90 rounded px-2 py-1 flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              Open original
            </a>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <ArrowDownCircle className="w-5 h-5 text-emerald-600" />
            Deposit Management
          </CardTitle>
          <div className="flex items-center gap-2">
            {pendingManualCount > 0 && (
              <Badge variant="destructive" className="text-xs" data-testid="badge-pending-manual-deposits">
                {pendingManualCount} manual pending
              </Badge>
            )}
            {pendingCount > 0 && (
              <Badge variant="destructive" data-testid="badge-pending-deposits">
                {pendingCount} pending
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Tx / Proof</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deposits?.map((deposit: any) => {
                  const isManual = isManualDeposit(deposit);
                  return (
                    <TableRow key={deposit.id} data-testid={`row-deposit-${deposit.id}`} className={isManual && deposit.status === "pending" ? "bg-amber-500/5 border-l-2 border-l-amber-500" : ""}>
                      <TableCell className="font-mono text-xs">{deposit.id}</TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <div className="font-medium text-foreground">ID: {deposit.profileId}</div>
                          {deposit.userEmail && <div className="text-muted-foreground truncate max-w-[120px]">{deposit.userEmail}</div>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={isManual ? "secondary" : deposit.depositMethod === "nowpayments" ? "default" : "outline"}
                          className="text-xs"
                        >
                          {isManual ? "MonCash/NatCash" : deposit.depositMethod === "nowpayments" ? "Crypto (Auto)" : "USDT"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">${Number(deposit.amountUsdt).toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">{formatHtg(Number(deposit.amountUsdt) * depositRate)} HTG</div>
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        {isManual ? (
                          <div className="space-y-1">
                            {deposit.moncashTransactionId && (
                              <div>
                                <p className="text-[10px] text-muted-foreground uppercase font-medium">TX ID</p>
                                <p className="font-mono text-xs break-all">{deposit.moncashTransactionId}</p>
                              </div>
                            )}
                            {deposit.proofImageUrl && (
                              <button
                                type="button"
                                onClick={() => setProofViewUrl(deposit.proofImageUrl)}
                                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 underline"
                                data-testid={`button-view-proof-${deposit.id}`}
                              >
                                <ImageIcon className="w-3 h-3" />
                                View Screenshot
                              </button>
                            )}
                            {deposit.rejectionReason && (
                              <div className="text-[10px] text-red-600 dark:text-red-400 bg-red-500/10 rounded px-1.5 py-0.5">
                                Reason: {deposit.rejectionReason}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {deposit.txHash ? (
                              <div className="space-y-1">
                                <p className="text-[10px] text-muted-foreground uppercase font-medium flex items-center gap-1">
                                  <LinkIcon className="w-2.5 h-2.5" /> TxtID
                                </p>
                                <div className="flex items-center gap-1">
                                  <span className="font-mono text-[10px] break-all leading-tight text-foreground flex-1 bg-muted/50 rounded px-1.5 py-1 border" title={deposit.txHash}>
                                    {deposit.txHash.length > 20 ? `${deposit.txHash.slice(0, 10)}…${deposit.txHash.slice(-8)}` : deposit.txHash}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => copyTxHash(deposit.id, deposit.txHash)}
                                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground flex-shrink-0"
                                    title="Copy full TxtID"
                                    data-testid={`button-copy-txhash-${deposit.id}`}
                                  >
                                    {copiedTxId === deposit.id ? <CheckCircle className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                                {(deposit.status === "pending" || deposit.status === "expired") && (
                                  <div className="flex gap-1 mt-1">
                                    <Input
                                      placeholder="Update TxtID…"
                                      value={txHashInputs[deposit.id] ?? ""}
                                      onChange={e => setTxHashInputs(prev => ({ ...prev, [deposit.id]: e.target.value }))}
                                      className="h-6 text-[10px] font-mono px-1.5"
                                      data-testid={`input-txhash-${deposit.id}`}
                                    />
                                    <Button size="sm" variant="outline" className="h-6 px-1.5 text-[10px]"
                                      onClick={() => saveTxHash(deposit.id)}
                                      disabled={savingTxHashId === deposit.id}
                                    >
                                      {savingTxHashId === deposit.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Save className="w-2.5 h-2.5" />}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                                  <Hash className="w-2.5 h-2.5" /> TxtID Required
                                </p>
                                <div className="flex gap-1">
                                  <Input
                                    placeholder="Paste TxtID…"
                                    value={txHashInputs[deposit.id] ?? ""}
                                    onChange={e => setTxHashInputs(prev => ({ ...prev, [deposit.id]: e.target.value }))}
                                    className="h-7 text-[10px] font-mono px-1.5 border-amber-300 dark:border-amber-700"
                                    data-testid={`input-txhash-${deposit.id}`}
                                  />
                                  <Button size="sm" className="h-7 px-2 text-[10px] bg-amber-600 hover:bg-amber-700 text-white flex-shrink-0"
                                    onClick={() => saveTxHash(deposit.id)}
                                    disabled={savingTxHashId === deposit.id}
                                    data-testid={`button-save-txhash-${deposit.id}`}
                                  >
                                    {savingTxHashId === deposit.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {deposit.ipAddress ? (
                          <span className="font-mono text-[10px] text-muted-foreground" data-testid={`text-deposit-ip-${deposit.id}`}>{deposit.ipAddress}</span>
                        ) : <span className="text-muted-foreground/40 text-xs">—</span>}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={deposit.status} />
                        {deposit.expiresAt && deposit.status !== "approved" && deposit.status !== "rejected" && (
                          <div className={`text-[10px] mt-0.5 ${deposit.status === "expired" ? "text-orange-500" : "text-muted-foreground/60"}`}>
                            {deposit.status === "expired" ? "⏰ Expired" : "⏳"} {formatTime(deposit.expiresAt)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(deposit.createdAt)}
                      </TableCell>
                      <TableCell>
                        {(deposit.status === "pending" || deposit.status === "expired") ? (
                          <div className="flex flex-col gap-1.5">
                            {deposit.status === "expired" && !isManual && (
                              <p className="text-[10px] text-orange-600 dark:text-orange-400 font-medium">Auto-expired — manual override allowed</p>
                            )}
                            {isCryptoDeposit(deposit) && !deposit.txHash && (
                              <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1 bg-amber-500/10 rounded px-1.5 py-1">
                                <Hash className="w-2.5 h-2.5 shrink-0" /> Add TxtID first
                              </p>
                            )}
                            <Button
                              size="sm"
                              onClick={() => approveAndRelease("deposits", deposit.id, (v) => setReleaseLoadingId(v ? deposit.id : null))}
                              disabled={releaseLoadingId === deposit.id || (isCryptoDeposit(deposit) && !deposit.txHash)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs disabled:opacity-40"
                              title={isCryptoDeposit(deposit) && !deposit.txHash ? "Set TxtID before approving" : undefined}
                              data-testid={`button-approve-release-deposit-${deposit.id}`}
                            >
                              {releaseLoadingId === deposit.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Download className="w-3 h-3 mr-1" />}
                              Approve & Release Receipt
                            </Button>
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                onClick={() => approve(deposit.id)}
                                disabled={isApproving || (isCryptoDeposit(deposit) && !deposit.txHash)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-xs flex-1 disabled:opacity-40"
                                title={isCryptoDeposit(deposit) && !deposit.txHash ? "Set TxtID before approving" : undefined}
                                data-testid={`button-approve-deposit-${deposit.id}`}
                              >
                                {isApproving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  if (isManual) {
                                    setRejectModalDepositId(deposit.id);
                                    setRejectReason("");
                                  } else {
                                    reject(deposit.id);
                                  }
                                }}
                                disabled={isRejecting}
                                className="text-xs flex-1"
                                data-testid={`button-reject-deposit-${deposit.id}`}
                              >
                                {isRejecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3 mr-1" />}
                                Reject
                              </Button>
                            </div>
                            {isManual && (
                              <Button
                                size="sm"
                                onClick={() => setFraudModalDepositId(deposit.id)}
                                disabled={isRejectingForFraud}
                                className="w-full text-xs bg-orange-600 hover:bg-orange-700 text-white"
                                data-testid={`button-reject-fraud-deposit-${deposit.id}`}
                              >
                                <ShieldOff className="w-3 h-3 mr-1" />
                                Reject for Fraud
                              </Button>
                            )}
                          </div>
                        ) : deposit.status === "approved" ? (
                          <div className="flex flex-col gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => previewReceipt("deposits", deposit.id)}
                              className="text-xs border-indigo-500/40 text-indigo-600 hover:bg-indigo-50"
                              data-testid={`button-preview-receipt-deposit-${deposit.id}`}
                            >
                              <FileText className="w-3 h-3 mr-1" />
                              {deposit.receiptId ? "Preview Receipt" : "Release Receipt"}
                            </Button>
                            {!deposit.receiptId && (
                              <Button
                                size="sm"
                                onClick={() => approveAndRelease("deposits", deposit.id, (v) => setReleaseLoadingId(v ? deposit.id : null))}
                                disabled={releaseLoadingId === deposit.id}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                                data-testid={`button-release-receipt-deposit-${deposit.id}`}
                              >
                                {releaseLoadingId === deposit.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Download className="w-3 h-3 mr-1" />}
                                Release Receipt
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span className="text-sm text-red-500">Rejected</span>
                            {deposit.rejectionReason && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[150px] leading-tight">{deposit.rejectionReason}</p>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(!deposits || deposits.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No deposits found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function WithdrawalRiskBadge({ withdrawalId, ipAddress }: { withdrawalId: number; ipAddress?: string }) {
  const [open, setOpen] = useState(false);
  const { data: risk, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/withdrawals", withdrawalId, "risk-check"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/withdrawals/${withdrawalId}/risk-check`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: open,
  });

  const hasRisk = risk?.riskFlags?.ipChanged || risk?.riskFlags?.multiAccountAlert || risk?.riskFlags?.failedLoginsLast24h > 2;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${hasRisk ? "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-700 dark:text-red-400" : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500"}`}
        data-testid={`button-risk-check-${withdrawalId}`}
        title="Risk Check"
      >
        {hasRisk ? <ShieldAlert className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
        {hasRisk ? "RISK" : "OK"}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              Withdrawal Risk Assessment #{withdrawalId}
            </DialogTitle>
          </DialogHeader>
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : risk ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className={`p-3 rounded-lg border text-center ${risk.riskFlags.ipChanged ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800" : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"}`}>
                  <Globe className={`w-5 h-5 mx-auto mb-1 ${risk.riskFlags.ipChanged ? "text-red-500" : "text-green-500"}`} />
                  <p className="text-xs font-medium">IP Changed</p>
                  <p className={`text-sm font-bold ${risk.riskFlags.ipChanged ? "text-red-600" : "text-green-600"}`}>
                    {risk.riskFlags.ipChanged ? "⚠ YES" : "✓ NO"}
                  </p>
                </div>
                <div className={`p-3 rounded-lg border text-center ${risk.riskFlags.multiAccountAlert ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800" : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"}`}>
                  <Users className={`w-5 h-5 mx-auto mb-1 ${risk.riskFlags.multiAccountAlert ? "text-red-500" : "text-green-500"}`} />
                  <p className="text-xs font-medium">Multi-Account</p>
                  <p className={`text-sm font-bold ${risk.riskFlags.multiAccountAlert ? "text-red-600" : "text-green-600"}`}>
                    {risk.riskFlags.multiAccountAlert ? "⚠ YES" : "✓ NO"}
                  </p>
                </div>
                <div className={`p-3 rounded-lg border text-center ${risk.riskFlags.failedLoginsLast24h > 2 ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800" : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"}`}>
                  <AlertTriangle className={`w-5 h-5 mx-auto mb-1 ${risk.riskFlags.failedLoginsLast24h > 2 ? "text-amber-500" : "text-green-500"}`} />
                  <p className="text-xs font-medium">Failed Logins (24h)</p>
                  <p className="text-sm font-bold">{risk.riskFlags.failedLoginsLast24h}</p>
                </div>
                <div className="p-3 rounded-lg border text-center bg-slate-50 dark:bg-slate-800">
                  <Wifi className="w-5 h-5 mx-auto mb-1 text-slate-500" />
                  <p className="text-xs font-medium">Withdrawal IP</p>
                  <p className="text-xs font-mono text-slate-600 dark:text-slate-400 break-all">{risk.riskFlags.withdrawalIp || "—"}</p>
                </div>
              </div>

              {risk.riskFlags.ipChanged && risk.riskFlags.recentLoginIps?.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Recent login IPs (last 5):</p>
                  {risk.riskFlags.recentLoginIps.map((ip: string, i: number) => (
                    <p key={i} className="text-xs font-mono text-amber-600 dark:text-amber-300">{ip}</p>
                  ))}
                </div>
              )}

              {risk.riskFlags.sharedIpUsers?.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">⚠ Other accounts from same IP:</p>
                  {risk.riskFlags.sharedIpUsers.map((u: any, i: number) => (
                    <p key={i} className="text-xs text-red-600 dark:text-red-300">{u.full_name} ({u.email})</p>
                  ))}
                </div>
              )}
            </div>
          ) : <p className="text-muted-foreground text-sm">No risk data available.</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}

function WithdrawalsTab() {
  const { data: withdrawals, isLoading } = useAdminWithdrawals();
  const { depositRate } = useRates();
  const { mutate: approve, isPending: isApproving } = useAdminApproveWithdrawal();
  const { mutate: reject, isPending: isRejecting } = useAdminRejectWithdrawal();
  const [releaseLoadingId, setReleaseLoadingId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const pendingCount = withdrawals?.filter((w: any) => w.status === "pending").length || 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <ArrowUpCircle className="w-5 h-5 text-amber-600" />
          Withdrawal Management
        </CardTitle>
        {pendingCount > 0 && (
          <Badge variant="destructive" data-testid="badge-pending-withdrawals">
            {pendingCount} pending
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Amount (USDT)</TableHead>
                <TableHead>HTG Value</TableHead>
                <TableHead>Wallet</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>IP / Risk</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {withdrawals?.map((w: any) => (
                <TableRow key={w.id} data-testid={`row-withdrawal-${w.id}`}>
                  <TableCell className="font-mono text-xs">{w.id}</TableCell>
                  <TableCell>{w.profileId}</TableCell>
                  <TableCell className="font-medium">{formatUsdt(Number(w.amount))} USDT</TableCell>
                  <TableCell className="text-muted-foreground">{formatHtg(Number(w.amount) * depositRate)} HTG</TableCell>
                  <TableCell>
                    <Badge variant="outline">{w.currency}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{(w as any).trcAddress ? "USDT TRC-20" : w.withdrawMethod === "qrcode" ? "QR Code" : "Phone"}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs max-w-[180px]">
                    {(w as any).trcAddress ? (
                      <span className="text-orange-600 dark:text-orange-400 break-all" data-testid={`text-trc-address-${w.id}`} title={(w as any).trcAddress}>
                        {(w as any).trcAddress.slice(0, 10)}...{(w as any).trcAddress.slice(-6)}
                      </span>
                    ) : w.withdrawMethod === "qrcode" ? (
                      w.qrCodeUrl ? (
                        <a href={w.qrCodeUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline" data-testid={`link-qr-${w.id}`}>View QR</a>
                      ) : "—"
                    ) : (
                      w.phoneNumber || "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {w.ipAddress ? (
                        <span className="font-mono text-[10px] text-muted-foreground" data-testid={`text-withdrawal-ip-${w.id}`}>{w.ipAddress}</span>
                      ) : <span className="text-muted-foreground/40 text-xs">—</span>}
                      {w.status === "pending" && (
                        <WithdrawalRiskBadge withdrawalId={w.id} ipAddress={w.ipAddress} />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={w.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(w.createdAt)}
                  </TableCell>
                  <TableCell>
                    {w.status === "pending" ? (
                      <div className="flex flex-col gap-1.5">
                        <Button
                          size="sm"
                          onClick={() => approveAndRelease("withdrawals", w.id, (v) => setReleaseLoadingId(v ? w.id : null))}
                          disabled={releaseLoadingId === w.id}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                          data-testid={`button-approve-release-withdrawal-${w.id}`}
                        >
                          {releaseLoadingId === w.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Download className="w-3 h-3 mr-1" />}
                          Approve & Release Receipt
                        </Button>
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => approve(w.id)}
                            disabled={isApproving}
                            className="bg-emerald-600 hover:bg-emerald-700 text-xs flex-1"
                            data-testid={`button-approve-withdrawal-${w.id}`}
                          >
                            {isApproving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => reject(w.id)}
                            disabled={isRejecting}
                            className="text-xs flex-1"
                            data-testid={`button-reject-withdrawal-${w.id}`}
                          >
                            {isRejecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3 mr-1" />}
                            Refund
                          </Button>
                        </div>
                      </div>
                    ) : w.status === "approved" ? (
                      <div className="flex flex-col gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => previewReceipt("withdrawals", w.id)}
                          className="text-xs border-indigo-500/40 text-indigo-600 hover:bg-indigo-50"
                          data-testid={`button-preview-receipt-withdrawal-${w.id}`}
                        >
                          <FileText className="w-3 h-3 mr-1" />
                          {w.receiptId ? "Preview Receipt" : "Preview"}
                        </Button>
                        {!w.receiptId && (
                          <Button
                            size="sm"
                            onClick={() => approveAndRelease("withdrawals", w.id, (v) => setReleaseLoadingId(v ? w.id : null))}
                            disabled={releaseLoadingId === w.id}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                            data-testid={`button-release-receipt-withdrawal-${w.id}`}
                          >
                            {releaseLoadingId === w.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Download className="w-3 h-3 mr-1" />}
                            Release Receipt
                          </Button>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Rejected</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!withdrawals || withdrawals.length === 0) && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    No withdrawals found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function KycTab() {
  const { data: users, isLoading: usersLoading } = useAdminUsers();
  const { data: kycDocs, isLoading: kycLoading } = useQuery<any[]>({ queryKey: ["/api/admin/kyc"] });
  const { mutate: verify, isPending: isVerifying } = useAdminVerifyKyc();
  const { mutate: rejectKyc, isPending: isRejecting } = useAdminRejectKyc();
  const [viewingUser, setViewingUser] = useState<any>(null);
  const [resubmitConfirmId, setResubmitConfirmId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { mutate: requestResubmit, isPending: isRequestingResubmit } = useMutation({
    mutationFn: async (profileId: number) => {
      const res = await apiRequest("POST", `/api/admin/kyc/${profileId}/request-resubmit`);
      if (!res.ok) throw new Error("Failed to request resubmit");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc"] });
      setResubmitConfirmId(null);
      toast({ title: "Re-upload Requested", description: "User has been notified to resubmit their KYC documents." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const [retryingStroId, setRetryingStroId] = useState<number | null>(null);
  const retryStrowallet = async (profileId: number) => {
    setRetryingStroId(profileId);
    try {
      const res = await apiRequest("POST", `/api/admin/kyc/${profileId}/strowallet-register`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Strowallet Registered", description: `Customer ID: ${data.customerId}` });
    } catch (e: any) {
      toast({ title: "Strowallet Failed", description: e.message, variant: "destructive" });
    } finally {
      setRetryingStroId(null);
    }
  };

  const isLoading = usersLoading || kycLoading;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const kycUsers = users?.filter((u: any) => u.kycStatus !== "not_submitted") || [];
  const pendingCount = kycUsers.filter((u: any) => u.kycStatus === "pending").length;

  const getKycDocsForUser = (profileId: number) => {
    return kycDocs?.find((doc: any) => doc.profileId === profileId);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            KYC Verification
          </CardTitle>
          {pendingCount > 0 && (
            <Badge variant="destructive" data-testid="badge-pending-kyc">
              {pendingCount} pending
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Documents</TableHead>
                  <TableHead>KYC Status</TableHead>
                  <TableHead>Strowallet</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kycUsers.map((user: any) => (
                  <TableRow key={user.id} data-testid={`row-kyc-${user.id}`}>
                    <TableCell className="font-mono text-xs">{user.id}</TableCell>
                    <TableCell className="font-medium">
        {user.fullName}
        {user.isBanned && (
          <Badge variant="destructive" className="ml-2 text-[10px] h-4 px-1 uppercase">Banned</Badge>
        )}
      </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{user.email}</TableCell>
                    <TableCell>
                      {getKycDocsForUser(user.id) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setViewingUser(user)}
                          data-testid={`button-view-kyc-${user.id}`}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">No docs</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={user.kycStatus} />
                    </TableCell>
                    <TableCell data-testid={`strowallet-status-${user.id}`}>
                      {user.strowalletCustomerId ? (
                        <div className="flex flex-col gap-0.5">
                          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] w-fit">✅ Registered</Badge>
                          <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[100px]" title={user.strowalletCustomerId}>{user.strowalletCustomerId}</span>
                        </div>
                      ) : user.kycStatus === "verified" ? (
                        <div className="flex flex-col gap-1">
                          <Badge variant="destructive" className="text-[10px] w-fit">⚠️ Not registered</Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-[10px] h-6 px-2"
                            disabled={retryingStroId === user.id}
                            onClick={() => retryStrowallet(user.id)}
                            data-testid={`button-strowallet-retry-${user.id}`}
                          >
                            {retryingStroId === user.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Retry"}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.kycStatus === "pending" ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            size="sm"
                            onClick={() => verify(user.id)}
                            disabled={isVerifying}
                            className="bg-emerald-600 hover:bg-emerald-700"
                            data-testid={`button-verify-kyc-${user.id}`}
                          >
                            {isVerifying ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                            Verify
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => rejectKyc(user.id)}
                            disabled={isRejecting}
                            data-testid={`button-reject-kyc-${user.id}`}
                          >
                            {isRejecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3 mr-1" />}
                            Reject
                          </Button>
                          {resubmitConfirmId === user.id ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">Sure?</span>
                              <Button size="sm" variant="destructive" onClick={() => requestResubmit(user.id)} disabled={isRequestingResubmit} data-testid={`button-confirm-resubmit-${user.id}`}>
                                {isRequestingResubmit ? <Loader2 className="w-3 h-3 animate-spin" /> : "Yes"}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setResubmitConfirmId(null)}>No</Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => setResubmitConfirmId(user.id)} data-testid={`button-request-resubmit-${user.id}`}>
                              <RefreshCw className="w-3 h-3 mr-1" />
                              Re-upload
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-muted-foreground">
                            {user.kycStatus === "verified" ? "Verified" : "Rejected"}
                          </span>
                          {resubmitConfirmId === user.id ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">Sure?</span>
                              <Button size="sm" variant="destructive" onClick={() => requestResubmit(user.id)} disabled={isRequestingResubmit} data-testid={`button-confirm-resubmit-${user.id}`}>
                                {isRequestingResubmit ? <Loader2 className="w-3 h-3 animate-spin" /> : "Yes"}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setResubmitConfirmId(null)}>No</Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => setResubmitConfirmId(user.id)} data-testid={`button-request-resubmit-${user.id}`}>
                              <RefreshCw className="w-3 h-3 mr-1" />
                              Re-upload
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {kycUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No KYC submissions yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {viewingUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setViewingUser(null)}>
          <div
            className="bg-background rounded-md max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
            data-testid="modal-kyc-documents"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <FileImage className="w-5 h-5" />
                KYC Documents - {viewingUser.fullName}
              </h3>
              <Button size="icon" variant="ghost" onClick={() => setViewingUser(null)} data-testid="button-close-kyc-modal">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{viewingUser.email}</p>
            {(() => {
              const docs = getKycDocsForUser(viewingUser.id);
              if (!docs) return <p className="text-muted-foreground">No documents found.</p>;
              return (
                <div className="space-y-4">
                  {(docs.idType || docs.idNumber || docs.addressLine1) && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-muted/30 rounded-md p-3 text-sm">
                      {docs.idType && (
                        <div><span className="text-muted-foreground">ID Type: </span><span className="font-medium capitalize">{docs.idType.replace(/_/g, " ")}</span></div>
                      )}
                      {docs.idNumber && (
                        <div><span className="text-muted-foreground">ID Number: </span><span className="font-medium">{docs.idNumber}</span></div>
                      )}
                      {docs.addressLine1 && (
                        <div><span className="text-muted-foreground">Address: </span><span className="font-medium">{docs.addressLine1}</span></div>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">ID Card (Front)</p>
                      <img
                        src={docs.idDocumentUrl}
                        alt="ID Front"
                        className="w-full rounded-md border border-border object-contain max-h-64"
                        data-testid="img-kyc-id-front"
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">ID Card (Back)</p>
                      <img
                        src={docs.idDocumentBackUrl}
                        alt="ID Back"
                        className="w-full rounded-md border border-border object-contain max-h-64"
                        data-testid="img-kyc-id-back"
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Selfie / User Photo</p>
                      <img
                        src={docs.selfieUrl}
                        alt="Selfie"
                        className="w-full rounded-md border border-border object-contain max-h-64"
                        data-testid="img-kyc-selfie"
                      />
                    </div>
                  </div>
                </div>
              );
            })()}
            {viewingUser.kycStatus === "pending" && (
              <div className="flex items-center gap-3 mt-6 pt-4 border-t border-border">
                <Button
                  onClick={() => { verify(viewingUser.id); setViewingUser(null); }}
                  disabled={isVerifying}
                  className="bg-emerald-600 hover:bg-emerald-700"
                  data-testid="button-modal-verify-kyc"
                >
                  {isVerifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                  Approve KYC
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => { rejectKyc(viewingUser.id); setViewingUser(null); }}
                  disabled={isRejecting}
                  data-testid="button-modal-reject-kyc"
                >
                  {isRejecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                  Reject KYC
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const WA_ICON = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const USER_CATEGORIES = [
  { key: "all",              label: "All Users",           color: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200" },
  { key: "otp_verified",     label: "OTP Verified",        color: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" },
  { key: "otp_not_verified", label: "OTP Not Verified",    color: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" },
  { key: "kyc_verified",     label: "KYC Verified",        color: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" },
  { key: "kyc_not_submitted","label": "KYC Not Submitted", color: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" },
] as const;

type UserCategory = typeof USER_CATEGORIES[number]["key"];

function filterByCategory(users: any[], category: UserCategory): any[] {
  switch (category) {
    case "otp_verified":     return users.filter(u => u.emailVerified);
    case "otp_not_verified": return users.filter(u => !u.emailVerified);
    case "kyc_verified":     return users.filter(u => u.kycStatus === "verified");
    case "kyc_submitted":    return users.filter(u => ["pending", "verified", "rejected"].includes(u.kycStatus));
    case "kyc_not_submitted":return users.filter(u => !u.kycStatus || u.kycStatus === "not_submitted");
    default:                 return users;
  }
}

function MessagesTab() {
  const { data: users, isLoading } = useAdminUsers();
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [userSearch, setUserSearch] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [activeCategory, setActiveCategory] = useState<UserCategory>("all");

  const activeUsers = (users?.filter((u: any) => !u.isDeleted && u.role !== "admin") || []) as any[];
  const categoryUsers = filterByCategory(activeUsers, activeCategory);
  const filteredUsers = categoryUsers.filter((u: any) =>
    `${u.fullName} ${u.email} ${u.phone || ""}`.toLowerCase().includes(userSearch.toLowerCase())
  );
  const allSelected = filteredUsers.length > 0 && filteredUsers.every((u: any) => selectedIds.has(u.id));

  const selectCategory = (cat: UserCategory) => {
    setActiveCategory(cat);
    setUserSearch("");
    const matched = filterByCategory(activeUsers, cat);
    setSelectedIds(new Set(matched.map((u: any) => u.id)));
  };

  const toggleUser = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredUsers.forEach((u: any) => next.delete(u.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredUsers.forEach((u: any) => next.add(u.id));
        return next;
      });
    }
  };

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Title is required");
      if (!message.trim()) throw new Error("Message is required");
      if (selectedIds.size === 0) throw new Error("Select at least one user");
      const res = await apiRequest("POST", "/api/admin/notifications/send-bulk", {
        profileIds: Array.from(selectedIds),
        sendToAll: false,
        title: title.trim(),
        message: message.trim(),
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: `Message sent to ${data.sent} user${data.sent !== 1 ? "s" : ""}`,
        description: `WhatsApp delivered to ${data.whatsappSent} user${data.whatsappSent !== 1 ? "s" : ""} with a phone number.`,
      });
      setSelectedIds(new Set());
      setTitle("");
      setMessage("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to send", description: error.message, variant: "destructive" });
    },
  });

  const sendToAll = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Title is required");
      if (!message.trim()) throw new Error("Message is required");
      const res = await apiRequest("POST", "/api/admin/notifications/send-bulk", {
        sendToAll: true,
        title: title.trim(),
        message: message.trim(),
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: `Broadcast sent to all ${data.sent} users`,
        description: `WhatsApp delivered to ${data.whatsappSent} user${data.whatsappSent !== 1 ? "s" : ""} with a phone number.`,
      });
      setSelectedIds(new Set());
      setTitle("");
      setMessage("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to send", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  const isPending = sendMessage.isPending || sendToAll.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="w-5 h-5" />
          Send Direct Message
        </CardTitle>
        <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
          <span className="inline-flex items-center gap-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium px-2 py-0.5 rounded-full">
            <WA_ICON />
            WhatsApp
          </span>
          Delivered via WhatsApp + in-app notification
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-medium">Filter by Category</label>
          <div className="flex flex-wrap gap-2">
            {USER_CATEGORIES.map(cat => {
              const count = filterByCategory(activeUsers, cat.key).length;
              const isActive = activeCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => selectCategory(cat.key)}
                  data-testid={`button-category-${cat.key}`}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${cat.color} ${
                    isActive ? "border-primary ring-2 ring-primary/20" : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                >
                  {cat.label}
                  <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${isActive ? "bg-primary text-primary-foreground" : "bg-black/10 dark:bg-white/20"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              Recipients
              {activeCategory !== "all" && (
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  ({USER_CATEGORIES.find(c => c.key === activeCategory)?.label})
                </span>
              )}
            </label>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <Badge variant="secondary">{selectedIds.size} selected</Badge>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggleAll}
                data-testid="button-toggle-all-users"
              >
                {allSelected ? "Deselect All" : "Select All"}
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search within category..."
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-message-users"
            />
          </div>
          <div className="border rounded-md divide-y max-h-52 overflow-y-auto" data-testid="list-message-users">
            {filteredUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
            ) : (
              filteredUsers.map((user: any) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 cursor-pointer transition-colors"
                  onClick={() => toggleUser(user.id)}
                  data-testid={`item-message-user-${user.id}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(user.id)}
                    onChange={() => toggleUser(user.id)}
                    onClick={e => e.stopPropagation()}
                    className="h-4 w-4 accent-primary cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.fullName}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.phone || user.email}</p>
                  </div>
                  {user.phone ? (
                    <span className="text-green-600 dark:text-green-400 shrink-0"><WA_ICON /></span>
                  ) : (
                    <span className="text-xs text-muted-foreground shrink-0">no phone</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Title</label>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Message title..."
            data-testid="input-message-title"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Message</label>
          <Textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Type your message..."
            className="resize-none"
            rows={4}
            data-testid="input-message-text"
          />
          <p className="text-xs text-muted-foreground">The link https://izichanj.com will be added automatically.</p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => sendMessage.mutate()}
            disabled={isPending || selectedIds.size === 0}
            className="flex-1"
            data-testid="button-send-message"
          >
            {sendMessage.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Send to {selectedIds.size > 0 ? `${selectedIds.size} user${selectedIds.size !== 1 ? "s" : ""}` : "Selected"}
          </Button>
          <Button
            onClick={() => sendToAll.mutate()}
            disabled={isPending}
            variant="outline"
            data-testid="button-send-all"
          >
            {sendToAll.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Send to All ({activeUsers.length})
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function isImageFile(fileName: string) {
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(fileName);
}

function AdminFileAttachment({ fileUrl, fileName, isAdmin }: { fileUrl: string; fileName: string; isAdmin: boolean }) {
  const isImage = isImageFile(fileName);
  return (
    <div className="mt-1.5">
      {isImage ? (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" data-testid="link-admin-file-attachment">
          <img src={fileUrl} alt={fileName} className="max-w-full max-h-32 rounded-md border border-border/30 cursor-pointer" data-testid="img-admin-file-attachment" />
        </a>
      ) : (
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs ${isAdmin ? "bg-primary-foreground/10" : "bg-muted-foreground/10"}`}
          data-testid="link-admin-file-attachment"
        >
          <FileText className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate max-w-[140px]">{fileName}</span>
          <Download className="w-3 h-3 flex-shrink-0" />
        </a>
      )}
    </div>
  );
}

function SupportTab() {
  const { data: conversations = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/support/conversations"],
    refetchInterval: 10000,
  });
  const [selectedConvo, setSelectedConvo] = useState<any>(null);
  const [replyText, setReplyText] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef2 = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: messages = [], isLoading: messagesLoading } = useQuery<any[]>({
    queryKey: ["/api/support/messages", selectedConvo?.id],
    queryFn: async () => {
      if (!selectedConvo?.id) return [];
      const res = await fetch(`/api/support/messages/${selectedConvo.id}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedConvo?.id,
    refetchInterval: selectedConvo ? 5000 : false,
  });

  const replyMutation = useMutation({
    mutationFn: async (payload: { message?: string; fileUrl?: string; fileName?: string }) => {
      const res = await apiRequest("POST", "/api/admin/support/reply", {
        conversationId: selectedConvo.id,
        ...payload,
      });
      return res.json();
    },
    onSuccess: () => {
      setReplyText("");
      setPendingFile(null);
      queryClient.invalidateQueries({ queryKey: ["/api/support/messages", selectedConvo?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support/conversations"] });
    },
  });

  const uploadAndSendAdmin = async (file: File, textMessage?: string) => {
    setIsUploading(true);
    try {
      const uploadRes = await apiRequest("POST", "/api/admin/support/upload", {
        name: file.name,
        size: file.size,
        contentType: file.type,
      });
      const { uploadURL, objectPath } = await uploadRes.json();
      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      await replyMutation.mutateAsync({
        message: textMessage || undefined,
        fileUrl: objectPath,
        fileName: file.name,
      });
    } catch (e) {
      console.error("Admin file upload error:", e);
    } finally {
      setIsUploading(false);
      setPendingFile(null);
    }
  };

  const handleAdminSend = () => {
    if (isUploading || replyMutation.isPending) return;
    if (pendingFile) {
      uploadAndSendAdmin(pendingFile, replyText.trim() || undefined);
      setReplyText("");
      return;
    }
    if (!replyText.trim()) return;
    replyMutation.mutate({ message: replyText.trim() });
    setReplyText("");
  };

  const handleAdminFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("File too large (max 10MB)");
      return;
    }
    setPendingFile(file);
    if (fileInputRef2.current) fileInputRef2.current.value = "";
  };

  const closeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/admin/support/close/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Conversation closed" });
      setSelectedConvo(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support/conversations"] });
    },
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-md" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const activeConvos = conversations.filter((c: any) => c.status !== "closed");
  const closedConvos = conversations.filter((c: any) => c.status === "closed");
  const waitingCount = conversations.filter((c: any) => c.status === "waiting_agent").length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-1">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Headphones className="w-5 h-5" />
            Support Chats
          </CardTitle>
          {waitingCount > 0 && (
            <Badge variant="destructive" data-testid="badge-waiting-support">
              {waitingCount} waiting
            </Badge>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[500px] overflow-y-auto">
            {activeConvos.length === 0 && closedConvos.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-8 px-4">No support conversations yet</p>
            )}
            {activeConvos.map((convo: any) => (
              <div
                key={convo.id}
                onClick={() => setSelectedConvo(convo)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-border hover-elevate ${selectedConvo?.id === convo.id ? "bg-muted" : ""}`}
                data-testid={`support-convo-${convo.id}`}
              >
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{convo.profile?.fullName}</p>
                    {convo.status === "waiting_agent" && (
                      <Badge variant="destructive" className="text-[10px]">Waiting</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{convo.lastMessage || "No messages"}</p>
                </div>
              </div>
            ))}
            {closedConvos.length > 0 && (
              <>
                <p className="text-xs text-muted-foreground px-4 py-2 bg-muted/50 font-medium">Closed</p>
                {closedConvos.slice(0, 5).map((convo: any) => (
                  <div
                    key={convo.id}
                    onClick={() => setSelectedConvo(convo)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-border opacity-60 hover-elevate ${selectedConvo?.id === convo.id ? "bg-muted" : ""}`}
                    data-testid={`support-convo-closed-${convo.id}`}
                  >
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{convo.profile?.fullName}</p>
                      <p className="text-xs text-muted-foreground truncate">{convo.lastMessage || "No messages"}</p>
                      {convo.rating && (
                        <div className="flex gap-0.5 mt-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star key={s} className={`w-3 h-3 ${s <= convo.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        {!selectedConvo ? (
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <MessageCircle className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">Select a conversation to view messages</p>
          </CardContent>
        ) : (
          <>
            <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">{selectedConvo.profile?.fullName}</CardTitle>
                  <p className="text-xs text-muted-foreground">{selectedConvo.profile?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedConvo.status === "waiting_agent" && (
                  <Badge variant="destructive">Waiting for agent</Badge>
                )}
                {selectedConvo.status === "closed" && selectedConvo.rating && (
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className={`w-4 h-4 ${s <= selectedConvo.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                    ))}
                  </div>
                )}
                {selectedConvo.status === "closed" && (
                  <Badge variant="secondary">Closed</Badge>
                )}
                {selectedConvo.status !== "closed" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => closeMutation.mutate(selectedConvo.id)}
                    disabled={closeMutation.isPending}
                    data-testid="button-close-conversation"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Close
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[350px] overflow-y-auto p-4 space-y-3">
                {messagesLoading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                )}
                {messages.map((msg: any) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2 ${msg.sender === "user" ? "justify-start" : "justify-end"}`}
                  >
                    {msg.sender === "user" && (
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <User className="w-3.5 h-3.5 text-primary" />
                      </div>
                    )}
                    <div
                      className={`max-w-[70%] px-3 py-2 rounded-md text-sm whitespace-pre-wrap ${
                        msg.sender === "user"
                          ? "bg-muted"
                          : msg.sender === "admin"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted border border-border"
                      }`}
                    >
                      {msg.sender === "bot" && (
                        <p className="text-[10px] font-medium text-muted-foreground mb-1">Bot</p>
                      )}
                      {msg.sender === "admin" && (
                        <p className="text-[10px] font-medium opacity-70 mb-1">You (Admin)</p>
                      )}
                      {(!msg.fileUrl || (msg.message && !msg.message.startsWith("Sent a file:"))) && msg.message}
                      {msg.fileUrl && (
                        <AdminFileAttachment fileUrl={msg.fileUrl} fileName={msg.fileName || "file"} isAdmin={msg.sender === "admin"} />
                      )}
                    </div>
                    {msg.sender !== "user" && (
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${msg.sender === "bot" ? "bg-muted" : "bg-primary/10"}`}>
                        {msg.sender === "bot" ? <Bot className="w-3.5 h-3.5 text-muted-foreground" /> : <ShieldCheck className="w-3.5 h-3.5 text-primary" />}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              {selectedConvo.status !== "closed" && (
                <div className="px-4 pb-4 pt-2 border-t border-border space-y-2">
                  {pendingFile && (
                    <div className="flex items-center gap-2 px-2 py-1.5 bg-muted rounded-md text-xs">
                      {isImageFile(pendingFile.name) ? (
                        <ImageIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className="truncate flex-1">{pendingFile.name}</span>
                      <button
                        onClick={() => setPendingFile(null)}
                        className="text-muted-foreground"
                        data-testid="button-admin-remove-file"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef2}
                      className="hidden"
                      onChange={handleAdminFileSelect}
                      accept="image/*,.pdf,.doc,.docx,.txt,.zip"
                      data-testid="input-admin-file-upload"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => fileInputRef2.current?.click()}
                      disabled={isUploading || replyMutation.isPending}
                      data-testid="button-admin-attach-file"
                    >
                      <Paperclip className="w-4 h-4" />
                    </Button>
                    <Input
                      value={replyText}
                      onChange={(e: any) => setReplyText(e.target.value)}
                      onKeyDown={(e: any) => {
                        if (e.key === "Enter" && !e.shiftKey && (replyText.trim() || pendingFile)) {
                          e.preventDefault();
                          handleAdminSend();
                        }
                      }}
                      placeholder="Type your reply..."
                      className="flex-1 text-sm"
                      disabled={isUploading || replyMutation.isPending}
                      data-testid="input-admin-reply"
                    />
                    <Button
                      size="icon"
                      onClick={handleAdminSend}
                      disabled={(!replyText.trim() && !pendingFile) || isUploading || replyMutation.isPending}
                      data-testid="button-admin-send-reply"
                    >
                      {isUploading || replyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}

function PendingCardsSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: pendingCards, isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/pending-cards"] });
  const [retryLoadingId, setRetryLoadingId] = useState<number | null>(null);
  const [retryResults, setRetryResults] = useState<Record<number, { success: boolean; message: string; alreadyRegistered?: boolean }>>({});
  const [cancelLoadingId, setCancelLoadingId] = useState<number | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<number | null>(null);
  const [manualIds, setManualIds] = useState<Record<number, string>>({});
  const [manualIdLoadingId, setManualIdLoadingId] = useState<number | null>(null);

  const handleRetry = async (card: any) => {
    setRetryLoadingId(card.id);
    try {
      const res = await apiRequest("POST", `/api/admin/cards/${card.id}/retry`);
      const data = await res.json();
      if (!res.ok) {
        setRetryResults(prev => ({ ...prev, [card.id]: { success: false, message: data.message || "Strowallet returned an error" } }));
        toast({ title: "Retry failed", description: data.message, variant: "destructive" });
      } else {
        setRetryResults(prev => ({ ...prev, [card.id]: { success: true, message: `Card issued ✓  Last 4: ${data.last4 || "—"}` } }));
        toast({ title: "Card issued!", description: `${card.profileName}'s card was created successfully.` });
        qc.invalidateQueries({ queryKey: ["/api/admin/pending-cards"] });
      }
    } catch (err: any) {
      // apiRequest throws "STATUS: {json}" for non-2xx — extract the json message
      let msg = "Network error — could not reach server";
      let alreadyRegistered = false;
      try {
        const rawMsg = err?.message || "";
        const jsonPart = rawMsg.includes(": ") ? rawMsg.slice(rawMsg.indexOf(": ") + 2) : rawMsg;
        const parsed = JSON.parse(jsonPart);
        msg = parsed?.message || jsonPart;
        alreadyRegistered = parsed?.alreadyRegistered === true;
      } catch { /* leave msg as-is */ }
      setRetryResults(prev => ({ ...prev, [card.id]: { success: false, message: msg, alreadyRegistered } }));
      if (!alreadyRegistered) toast({ title: "Retry failed", description: msg, variant: "destructive" });
    } finally {
      setRetryLoadingId(null);
    }
  };

  const handleSetManualId = async (card: any) => {
    const customerId = (manualIds[card.id] || "").trim();
    if (!customerId) return;
    setManualIdLoadingId(card.id);
    try {
      const res = await apiRequest("PATCH", `/api/admin/profiles/${card.profileId}/strowallet-customer-id`, { customerId });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed to set ID", description: data.message, variant: "destructive" });
      } else {
        toast({ title: "Customer ID saved", description: "Now retrying card issuance…" });
        setRetryResults(prev => ({ ...prev, [card.id]: { success: false, message: "", alreadyRegistered: false } }));
        qc.invalidateQueries({ queryKey: ["/api/admin/pending-cards"] });
        // Auto-retry card issuance now that the ID is saved
        setTimeout(() => handleRetry({ ...card, strowalletCustomerId: customerId }), 500);
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setManualIdLoadingId(null);
    }
  };

  const handleCancelRefund = async (card: any) => {
    setCancelLoadingId(card.id);
    setConfirmCancelId(null);
    try {
      const res = await apiRequest("POST", `/api/admin/cards/${card.id}/cancel-refund`);
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Cancel failed", description: data.message, variant: "destructive" });
      } else {
        toast({
          title: "Card cancelled & refunded",
          description: `$${Number(data.refunded || 20).toFixed(2)} USDT refunded to ${data.userName || card.profileName}.`,
        });
        qc.invalidateQueries({ queryKey: ["/api/admin/pending-cards"] });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setCancelLoadingId(null);
    }
  };

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (!pendingCards?.length) return null;

  return (
    <Card className="border-amber-300 dark:border-amber-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-500" />
          Pending Card Requests
          <Badge className="ml-2 bg-amber-500 text-white">{pendingCards.length}</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          These users paid $30 USDT but card issuance failed due to low Strowallet master balance. Fund your Strowallet account then click <strong>Retry Issue Card</strong>.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>DB&nbsp;ID</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Strowallet ID</TableHead>
                <TableHead>Amount Held</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingCards.map((card: any) => (
                <TableRow key={card.id} data-testid={`row-pending-card-${card.id}`}>
                  <TableCell className="font-mono text-xs text-muted-foreground">#{card.id}</TableCell>
                  <TableCell className="font-medium">{card.profileName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{card.profileEmail}</TableCell>
                  <TableCell className="text-sm">{card.profilePhone || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{card.strowalletCustomerId || <span className="text-muted-foreground">—</span>}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-amber-600 border-amber-300">${Number(card.balance || 20).toFixed(2)} USDT</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateShortTime(card.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1.5 min-w-[220px]">
                      {retryResults[card.id] && retryResults[card.id].message ? (
                        <div className={`text-xs font-medium px-2 py-1 rounded ${retryResults[card.id].success ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"}`}>
                          {retryResults[card.id].message}
                        </div>
                      ) : null}

                      {/* Manual customer ID input shown when Strowallet says email already taken */}
                      {retryResults[card.id]?.alreadyRegistered && (
                        <div className="flex gap-1 mt-0.5">
                          <input
                            type="text"
                            placeholder="Strowallet customer ID…"
                            value={manualIds[card.id] || ""}
                            onChange={e => setManualIds(prev => ({ ...prev, [card.id]: e.target.value }))}
                            className="flex-1 h-7 text-xs px-2 rounded border border-input bg-background font-mono"
                            data-testid={`input-strowallet-id-${card.id}`}
                          />
                          <Button
                            size="sm"
                            className="h-7 text-xs px-2 bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => handleSetManualId(card)}
                            disabled={manualIdLoadingId === card.id || !manualIds[card.id]?.trim()}
                            data-testid={`button-set-strowallet-id-${card.id}`}
                          >
                            {manualIdLoadingId === card.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save & Retry"}
                          </Button>
                        </div>
                      )}

                      {(!retryResults[card.id] || !retryResults[card.id].success) && (
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-amber-500 hover:bg-amber-600 text-white gap-1.5"
                          onClick={() => handleRetry(card)}
                          disabled={retryLoadingId === card.id || cancelLoadingId === card.id}
                          data-testid={`button-retry-card-${card.id}`}
                        >
                          {retryLoadingId === card.id
                            ? <><Loader2 className="w-3 h-3 animate-spin" /> Retrying…</>
                            : <><RefreshCw className="w-3 h-3" /> Retry Issue Card</>}
                        </Button>
                      )}

                      {/* Cancel & Refund */}
                      {confirmCancelId === card.id ? (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-8 text-xs flex-1"
                            onClick={() => handleCancelRefund(card)}
                            disabled={cancelLoadingId === card.id}
                            data-testid={`button-confirm-cancel-admin-${card.id}`}
                          >
                            {cancelLoadingId === card.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm refund"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => setConfirmCancelId(null)}
                            data-testid={`button-dismiss-cancel-admin-${card.id}`}
                          >
                            No
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 gap-1.5"
                          onClick={() => setConfirmCancelId(card.id)}
                          disabled={retryLoadingId === card.id || cancelLoadingId === card.id}
                          data-testid={`button-cancel-refund-admin-${card.id}`}
                        >
                          <XCircle className="w-3 h-3" /> Cancel &amp; Refund
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function PendingNfcCardsSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: pendingNfcCards, isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/pending-nfc-cards"] });
  const [cancelLoadingId, setCancelLoadingId] = useState<number | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<number | null>(null);

  const handleCancelRefund = async (card: any) => {
    setCancelLoadingId(card.id);
    setConfirmCancelId(null);
    try {
      const res = await apiRequest("POST", `/api/admin/nfc-cards/${card.id}/cancel-refund`);
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Cancel failed", description: data.message, variant: "destructive" });
      } else {
        toast({
          title: "NFC request cancelled & refunded",
          description: `$${Number(data.refunded || 19).toFixed(2)} USDT refunded to ${data.userName || card.profileName}.`,
        });
        qc.invalidateQueries({ queryKey: ["/api/admin/pending-nfc-cards"] });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setCancelLoadingId(null);
    }
  };

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (!pendingNfcCards?.length) return null;

  return (
    <Card className="border-amber-300 dark:border-amber-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-500" />
          Pending NFC Card Requests
          <Badge className="ml-2 bg-amber-500 text-white">{pendingNfcCards.length}</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          These users paid for an NFC card but issuance failed (often due to a low Strowallet master balance). Cancel the request to refund the user, or fund Strowallet and have the user retry.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>DB&nbsp;ID</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Amount Held</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingNfcCards.map((card: any) => {
                const heldAmount = Number(card.cardDetail?.amountHeld) || 19;
                return (
                  <TableRow key={card.id} data-testid={`row-pending-nfc-card-${card.id}`}>
                    <TableCell className="font-mono text-xs text-muted-foreground">#{card.id}</TableCell>
                    <TableCell className="font-medium" data-testid={`text-nfc-user-${card.id}`}>{card.profileName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{card.profileEmail}</TableCell>
                    <TableCell className="text-sm">{card.profilePhone || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-amber-600 border-amber-300">
                        ${heldAmount.toFixed(2)} USDT
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateShortTime(card.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5 min-w-[180px]">
                        {confirmCancelId === card.id ? (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-8 text-xs flex-1"
                              onClick={() => handleCancelRefund(card)}
                              disabled={cancelLoadingId === card.id}
                              data-testid={`button-confirm-cancel-nfc-${card.id}`}
                            >
                              {cancelLoadingId === card.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm refund"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              onClick={() => setConfirmCancelId(null)}
                              data-testid={`button-dismiss-cancel-nfc-${card.id}`}
                            >
                              No
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 gap-1.5"
                            onClick={() => setConfirmCancelId(card.id)}
                            disabled={cancelLoadingId === card.id}
                            data-testid={`button-cancel-request-nfc-${card.id}`}
                          >
                            <XCircle className="w-3 h-3" /> Cancel Request
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function CardProfitTracker() {
  const { data: stats, isLoading } = useQuery<any>({ queryKey: ["/api/admin/card-stats"] });

  const statItems = [
    { label: "Active Cards", value: stats?.activeCards ?? 0, icon: CreditCard, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30" },
    { label: "Pending Cards", value: stats?.pendingCards ?? 0, icon: Clock, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30" },
    { label: "Total Issued", value: stats?.totalIssued ?? 0, icon: TrendingUp, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
  ];

  return (
    <Card className="border-emerald-200 dark:border-emerald-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-emerald-600" />
          Virtual Card Revenue Tracker
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Price: <strong>$30.00</strong> per card &nbsp;·&nbsp; Our cost: <strong>$22.80</strong> &nbsp;·&nbsp; Net profit: <strong className="text-emerald-600">${stats?.profitPerCard?.toFixed(2) ?? "7.20"}</strong> per card
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {statItems.map(item => (
              <div key={item.label} className={`rounded-lg p-3 ${item.bg}`}>
                <div className="flex items-center gap-2 mb-1">
                  <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </div>
                <p className={`text-2xl font-bold font-display ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Revenue summary */}
        <div className="rounded-lg border border-border/50 p-3 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Total Revenue</p>
            <p className="text-base font-semibold">${isLoading ? "—" : (stats?.totalRevenue ?? 0).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Total Cost</p>
            <p className="text-base font-semibold text-red-500">${isLoading ? "—" : ((stats?.totalIssued ?? 0) * 22.80).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Net Profit</p>
            <p className="text-base font-bold text-emerald-600">${isLoading ? "—" : (stats?.totalProfit ?? 0).toFixed(2)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function VirtualCardReadyTab() {
  const { data: users, isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/virtual-card-ready"] });
  const { toast } = useToast();
  const [checkResults, setCheckResults] = useState<any[]>([]);

  const checkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/strowallet/check-all-cardholders");
      return res.json();
    },
    onSuccess: (data) => {
      setCheckResults(data.results || []);
      toast({
        title: `Checked ${data.checked} cardholders`,
        description: `Results sent to your Telegram. ✅ Approved: ${data.results?.filter((r: any) => r.isApproved).length} | ⏳ Pending: ${data.results?.filter((r: any) => !r.isApproved && r.status !== "error").length}`,
      });
    },
    onError: () => {
      toast({ title: "Check failed", description: "Could not reach Strowallet API.", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <CardProfitTracker />
      <PendingCardsSection />
      <PendingNfcCardsSection />
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                Users Registered with Strowallet
                {users && (
                  <Badge className="ml-2 bg-blue-600 text-white">{users.length} registered</Badge>
                )}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                These users are KYC-verified and registered with Strowallet. Strowallet may still take <strong>24–48 hours</strong> to internally approve their documents before they can create a card.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => checkMutation.mutate()}
              disabled={checkMutation.isPending}
              data-testid="button-check-all-cardholders"
              className="shrink-0"
            >
              {checkMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
              Check Cardholder Status
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Strowallet ID</TableHead>
                    <TableHead>Balance (USDT)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.map((user: any) => (
                    <TableRow key={user.id} data-testid={`row-cardready-${user.id}`}>
                      <TableCell className="font-mono text-xs">{user.referenceId || user.id}</TableCell>
                      <TableCell className="font-medium">{user.fullName}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{user.email}</TableCell>
                      <TableCell className="text-sm">{user.phone || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>
                        <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded" title={user.strowalletCustomerId}>{user.strowalletCustomerId}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">{Number(user.balance || 0).toFixed(2)}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!users || users.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                        No users are ready for virtual cards yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {checkResults.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              Strowallet Status Results
              <Badge className="ml-auto">{checkResults.length} checked</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Strowallet ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Raw Response</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checkResults.map((r: any) => (
                    <TableRow key={r.id} data-testid={`row-status-${r.id}`}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.email}</TableCell>
                      <TableCell><span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{r.strowalletCustomerId}</span></TableCell>
                      <TableCell>
                        <Badge className={r.isApproved ? "bg-emerald-600 text-white" : r.status === "error" ? "bg-red-600 text-white" : "bg-amber-500 text-white"}>
                          {r.isApproved ? "✅ Approved" : r.status === "error" ? "❌ Error" : `⏳ ${r.status}`}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">View</summary>
                          <pre className="mt-1 text-[10px] bg-muted p-2 rounded overflow-auto max-h-32">{JSON.stringify(r.rawResponse || r.error, null, 2)}</pre>
                        </details>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ActivityTab() {
  const { data: logs, isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/login-activity"] });
  const [search, setSearch] = useState("");

  const filtered = (logs || []).filter((l: any) =>
    `${l.profile?.fullName || ""} ${l.profile?.email || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const methodLabel = (m: string) => {
    if (m === "pin") return { label: "PIN", color: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300" };
    if (m === "2fa") return { label: "2FA", color: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" };
    if (m === "webauthn") return { label: "Biometric", color: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" };
    return { label: "Password", color: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200" };
  };

  const userLoginCounts = (logs || []).reduce((acc: Record<number, number>, l: any) => {
    if (l.profileId) acc[l.profileId] = (acc[l.profileId] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Login Activity
          </CardTitle>
          <p className="text-xs text-muted-foreground">All successful logins — most recent first</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-activity"
            />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <LogIn className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No login activity yet</p>
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="hidden md:table-cell">IP Address</TableHead>
                    <TableHead>Date &amp; Time</TableHead>
                    <TableHead className="text-right">Total Logins</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((log: any) => {
                    const m = methodLabel(log.method);
                    const count = userLoginCounts[log.profileId] || 1;
                    return (
                      <TableRow key={log.id} data-testid={`row-activity-${log.id}`}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm" data-testid={`text-activity-name-${log.id}`}>
                              {log.profile?.fullName || "Unknown"}
                            </span>
                            <span className="text-xs text-muted-foreground">{log.profile?.email || ""}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${m.color}`}>
                            {m.label}
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground font-mono">
                          {log.ipAddress || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium" data-testid={`text-activity-date-${log.id}`}>
                              {log.loginAt ? formatDateDMY(log.loginAt) : "—"}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {log.loginAt ? formatTimeSecs(log.loginAt) : ""}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold" data-testid={`text-activity-count-${log.id}`}>
                            {count}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="text-xs text-muted-foreground text-right">Showing last {filtered.length} of {(logs || []).length} logins</p>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsTab() {
  const { depositRate, withdrawalRate } = useRates();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [depInput, setDepInput] = useState<string>("");
  const [witInput, setWitInput] = useState<string>("");
  const [initialized, setInitialized] = useState(false);
  const [moncashInput, setMoncashInput] = useState("");
  const [natcashInput, setNatcashInput] = useState("");
  const [phonesInitialized, setPhonesInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && depositRate && withdrawalRate) {
      setDepInput(String(depositRate));
      setWitInput(String(withdrawalRate));
      setInitialized(true);
    }
  }, [depositRate, withdrawalRate, initialized]);

  const { data: paymentInfo } = useQuery<any>({
    queryKey: ["/api/deposits/manual/payment-info"],
  });

  useEffect(() => {
    if (!phonesInitialized && paymentInfo) {
      setMoncashInput(paymentInfo.moncash || "");
      setNatcashInput(paymentInfo.natcash || "");
      setPhonesInitialized(true);
    }
  }, [paymentInfo, phonesInitialized]);

  const updateRates = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/settings/rates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depositRate: parseFloat(depInput), withdrawalRate: parseFloat(witInput) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update rates");
      }
      return res.json();
    },
    onSuccess: (data: { depositRate: number; withdrawalRate: number }) => {
      qc.invalidateQueries({ queryKey: ["/api/settings/rates"] });
      setDepInput(String(data.depositRate));
      setWitInput(String(data.withdrawalRate));
      toast({ title: "Rates updated", description: `Deposit: 1 USDT = ${data.depositRate} HTG | Withdrawal: 1 USDT = ${data.withdrawalRate} HTG` });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    },
  });

  const updatePhones = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/settings/payment-phones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moncash: moncashInput, natcash: natcashInput }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update phone numbers");
      }
      return res.json();
    },
    onSuccess: (data: { moncash: string; natcash: string }) => {
      qc.invalidateQueries({ queryKey: ["/api/deposits/manual/payment-info"] });
      setMoncashInput(data.moncash);
      setNatcashInput(data.natcash);
      toast({ title: "Deposit numbers updated", description: "MonCash and NatCash numbers are now live for users." });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    },
  });

  const previewDep = parseFloat(depInput) || depositRate;
  const previewWit = parseFloat(witInput) || withdrawalRate;

  return (
    <div className="max-w-md space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Exchange Rate Settings
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Set the HTG value of 1 USDT for deposits and withdrawals. Changes take effect immediately platform-wide.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-500" />
              Deposit Rate — 1 USDT = ? HTG
            </label>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                step="0.5"
                min="1"
                value={depInput}
                onChange={e => setDepInput(e.target.value)}
                placeholder="e.g. 143"
                className="font-mono"
                data-testid="input-deposit-rate"
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">HTG</span>
            </div>
            <p className="text-xs text-muted-foreground">Live rate: <strong>{depositRate} HTG / USDT</strong></p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <ArrowUpCircle className="w-3.5 h-3.5 text-rose-500" />
              Withdrawal Rate — 1 USDT = ? HTG
            </label>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                step="0.5"
                min="1"
                value={witInput}
                onChange={e => setWitInput(e.target.value)}
                placeholder="e.g. 139"
                className="font-mono"
                data-testid="input-withdrawal-rate"
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">HTG</span>
            </div>
            <p className="text-xs text-muted-foreground">Live rate: <strong>{withdrawalRate} HTG / USDT</strong></p>
          </div>

          <Button
            onClick={() => updateRates.mutate()}
            disabled={updateRates.isPending || !depInput || !witInput}
            className="w-full"
            data-testid="button-save-rates"
          >
            {updateRates.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Exchange Rates
          </Button>

          <div className="p-3 rounded-md bg-muted/50 border text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground text-sm">Preview</p>
            <p>Deposit: 100 USDT → <strong>{(100 * previewDep).toLocaleString()} HTG</strong></p>
            <p>Withdrawal: 100 USDT → <strong>{(100 * previewWit).toLocaleString()} HTG</strong></p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-primary" />
            Deposit Account Numbers
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            The MonCash and NatCash numbers shown to users when making a manual deposit. Changes take effect immediately.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-full bg-red-500 inline-block shrink-0" />
              MonCash Number
            </label>
            <Input
              type="tel"
              value={moncashInput}
              onChange={e => setMoncashInput(e.target.value)}
              placeholder="e.g. 509-3456-7890"
              className="font-mono"
              data-testid="input-moncash-phone"
            />
            {paymentInfo?.moncash && (
              <p className="text-xs text-muted-foreground">Current: <strong>{paymentInfo.moncash}</strong></p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-full bg-blue-500 inline-block shrink-0" />
              NatCash Number
            </label>
            <Input
              type="tel"
              value={natcashInput}
              onChange={e => setNatcashInput(e.target.value)}
              placeholder="e.g. 509-4567-8901"
              className="font-mono"
              data-testid="input-natcash-phone"
            />
            {paymentInfo?.natcash && (
              <p className="text-xs text-muted-foreground">Current: <strong>{paymentInfo.natcash}</strong></p>
            )}
          </div>

          <Button
            onClick={() => updatePhones.mutate()}
            disabled={updatePhones.isPending || !moncashInput.trim() || !natcashInput.trim()}
            className="w-full"
            data-testid="button-save-phones"
          >
            {updatePhones.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Deposit Numbers
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── User 360° Activity Modal ─────────────────────────────────────────────────
function User360Modal({ userId, userName, onClose }: { userId: number; userName: string; onClose: () => void }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/users", userId, "activity"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}/activity`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch user activity");
      return res.json();
    },
  });

  const secEventColor = (type: string) => {
    if (type === "failed_login") return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";
    if (type === "password_reset") return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300";
    return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300";
  };

  const balanceChangeColor = (change: number) => change >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            360° Activity View — {userName}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : data ? (
          <ScrollArea className="flex-1 pr-2">
            <div className="space-y-5">

              {/* Balance & Security Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Deposits", value: data.deposits?.length ?? 0, icon: <ArrowDownCircle className="w-4 h-4 text-emerald-500" /> },
                  { label: "Withdrawals", value: data.withdrawals?.length ?? 0, icon: <ArrowUpCircle className="w-4 h-4 text-amber-500" /> },
                  { label: "P2P Transfers", value: (data.p2pSent?.length ?? 0) + (data.p2pReceived?.length ?? 0), icon: <ArrowRightLeft className="w-4 h-4 text-blue-500" /> },
                  { label: "Security Events", value: data.securityEvents?.length ?? 0, icon: <ShieldAlert className="w-4 h-4 text-red-500" /> },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border">
                    {s.icon}
                    <div>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className="text-lg font-bold">{s.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Login History */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><LogIn className="w-4 h-4 text-primary" />Login History ({data.loginLogs?.length ?? 0})</h3>
                {data.loginLogs?.length > 0 ? (
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Method</TableHead><TableHead>IP Address</TableHead><TableHead>Device</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {data.loginLogs.slice(0, 20).map((l: any) => (
                          <TableRow key={l.id}>
                            <TableCell className="text-xs">{l.login_at ? formatDateTimeShort(l.login_at) : "—"}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{l.method}</Badge></TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{l.ip_address || "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{l.device_info || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : <p className="text-xs text-muted-foreground">No login records.</p>}
              </div>

              <Separator />

              {/* Security Events */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-red-500" />Security Events ({data.securityEvents?.length ?? 0})</h3>
                {data.securityEvents?.length > 0 ? (
                  <div className="space-y-1.5">
                    {data.securityEvents.slice(0, 20).map((e: any) => (
                      <div key={e.id} className="flex items-start gap-3 p-2.5 rounded-md bg-muted/30 border">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${secEventColor(e.event_type)}`}>{e.event_type}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground truncate">{e.details || "—"}</p>
                          <p className="text-xs font-mono text-muted-foreground/70">{e.ip_address} · {e.device_info}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{e.created_at ? formatDateTimeMin(e.created_at) : "—"}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-muted-foreground">No security events recorded.</p>}
              </div>

              <Separator />

              {/* Balance History */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><History className="w-4 h-4 text-indigo-500" />Balance History ({data.balanceLogs?.length ?? 0})</h3>
                {data.balanceLogs?.length > 0 ? (
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Action</TableHead><TableHead>Change</TableHead><TableHead>Before</TableHead><TableHead>After</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {data.balanceLogs.slice(0, 30).map((b: any) => {
                          const ch = Number(b.change);
                          return (
                            <TableRow key={b.id}>
                              <TableCell className="text-xs">{b.created_at ? formatDateTimeShort(b.created_at) : "—"}</TableCell>
                              <TableCell><Badge variant="outline" className="text-xs">{b.action}</Badge></TableCell>
                              <TableCell className={`font-medium text-sm ${balanceChangeColor(ch)}`}>{ch >= 0 ? "+" : ""}{ch.toFixed(2)}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{Number(b.previous_balance).toFixed(2)}</TableCell>
                              <TableCell className="text-xs font-medium">{Number(b.new_balance).toFixed(2)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : <p className="text-xs text-muted-foreground">No balance changes recorded yet.</p>}
              </div>

              <Separator />

              {/* Deposits */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><ArrowDownCircle className="w-4 h-4 text-emerald-500" />Deposits ({data.deposits?.length ?? 0})</h3>
                {data.deposits?.length > 0 ? (
                  <div className="space-y-1.5">
                    {data.deposits.slice(0, 20).map((d: any) => (
                      <div key={d.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/30 border text-xs">
                        <StatusBadge status={d.status} />
                        <span className="font-medium">{Number(d.amount_usdt).toFixed(2)} USDT</span>
                        <Badge variant="outline" className="text-[10px]">{d.deposit_method}</Badge>
                        <span className="text-muted-foreground font-mono">{d.ip_address}</span>
                        <span className="ml-auto text-muted-foreground">{d.created_at ? formatDateTimeShort(d.created_at) : "—"}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-muted-foreground">No deposits.</p>}
              </div>

              <Separator />

              {/* Withdrawals */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><ArrowUpCircle className="w-4 h-4 text-amber-500" />Withdrawals ({data.withdrawals?.length ?? 0})</h3>
                {data.withdrawals?.length > 0 ? (
                  <div className="space-y-1.5">
                    {data.withdrawals.slice(0, 20).map((w: any) => (
                      <div key={w.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/30 border text-xs">
                        <StatusBadge status={w.status} />
                        <span className="font-medium">{Number(w.amount).toFixed(2)} USDT</span>
                        <Badge variant="outline" className="text-[10px]">{w.currency}</Badge>
                        {w.trc_address && <span className="font-mono text-muted-foreground">{w.trc_address.slice(0, 8)}…</span>}
                        <span className="text-muted-foreground font-mono">{w.ip_address}</span>
                        <span className="ml-auto text-muted-foreground">{w.created_at ? formatDateTimeShort(w.created_at) : "—"}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-muted-foreground">No withdrawals.</p>}
              </div>

              <Separator />

              {/* P2P Transfers */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><ArrowRightLeft className="w-4 h-4 text-blue-500" />P2P Transfers</h3>
                {(data.p2pSent?.length > 0 || data.p2pReceived?.length > 0) ? (
                  <div className="space-y-1.5">
                    {[...( data.p2pSent || []).map((t: any) => ({ ...t, dir: "sent" })), ...(data.p2pReceived || []).map((t: any) => ({ ...t, dir: "received" }))]
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .slice(0, 20)
                      .map((t: any) => (
                        <div key={`${t.id}-${t.dir}`} className="flex items-center gap-3 p-2 rounded-md bg-muted/30 border text-xs">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${t.dir === "sent" ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"}`}>{t.dir}</span>
                          <span className="font-medium">{Number(t.amount).toFixed(2)} USDT</span>
                          <span className="text-muted-foreground">{t.dir === "sent" ? `→ ${t.receiver_name || "unknown"}` : `← ${t.sender_name || "unknown"}`}</span>
                          {t.note && <span className="text-muted-foreground italic">"{t.note}"</span>}
                          <span className="ml-auto text-muted-foreground">{t.created_at ? formatDateTimeShort(t.created_at) : "—"}</span>
                        </div>
                      ))}
                  </div>
                ) : <p className="text-xs text-muted-foreground">No P2P transfers.</p>}
              </div>

              {/* Virtual Cards */}
              {data.cards?.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><CreditCard className="w-4 h-4 text-purple-500" />Virtual Cards ({data.cards?.length ?? 0})</h3>
                    <div className="space-y-1.5">
                      {data.cards.map((c: any) => (
                        <div key={c.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/30 border text-xs">
                          <StatusBadge status={c.status} />
                          <span className="font-medium">{c.card_type} *{c.last4 || "?????"}</span>
                          <Badge variant="outline" className="text-[10px]">{c.brand || "Visa"}</Badge>
                          <span className="text-muted-foreground">${Number(c.balance || 0).toFixed(2)}</span>
                          <span className="ml-auto text-muted-foreground">{c.created_at ? formatDateShort(c.created_at) : "—"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

            </div>
          </ScrollArea>
        ) : <p className="text-muted-foreground text-sm text-center py-8">No data available.</p>}
      </DialogContent>
    </Dialog>
  );
}

// ─── Global Audit Log Tab ─────────────────────────────────────────────────────
function AuditTab() {
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");

  const { data: auditLog, isLoading: auditLoading, refetch: refetchAudit } = useQuery<any[]>({
    queryKey: ["/api/admin/audit-log", filterType],
    queryFn: async () => {
      const res = await fetch(`/api/admin/audit-log?type=${filterType}&limit=200`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: multiAccountAlerts, isLoading: alertsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/multi-account-alerts"],
    queryFn: async () => {
      const res = await fetch("/api/admin/multi-account-alerts", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const entryIcon = (type: string) => {
    if (type === "deposit") return <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />;
    if (type === "withdrawal") return <ArrowUpCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />;
    if (type === "security") return <ShieldAlert className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />;
    if (type === "login") return <LogIn className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />;
    if (type === "p2p") return <ArrowRightLeft className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />;
    if (type === "balance") return <History className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />;
    return <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />;
  };

  const entryBadge = (entry: any) => {
    if (entry.entryType === "deposit") return entry.deposit_method || entry.status;
    if (entry.entryType === "withdrawal") return `${Number(entry.amount || 0).toFixed(2)} USDT`;
    if (entry.entryType === "security") return entry.event_type;
    if (entry.entryType === "login") return entry.method;
    if (entry.entryType === "p2p") return `${Number(entry.amount || 0).toFixed(2)} USDT`;
    if (entry.entryType === "balance") return entry.action;
    return "—";
  };

  const entryDescription = (entry: any) => {
    const name = entry.full_name || "Unknown";
    if (entry.entryType === "deposit") return `${name} deposited ${Number(entry.amount_usdt || 0).toFixed(2)} USDT via ${entry.deposit_method}`;
    if (entry.entryType === "withdrawal") return `${name} withdrew ${Number(entry.amount || 0).toFixed(2)} USDT to ${entry.currency}`;
    if (entry.entryType === "security") return `${name}: ${entry.details || entry.event_type}`;
    if (entry.entryType === "login") return `${name} logged in via ${entry.method}`;
    if (entry.entryType === "p2p") return `${entry.sender_name || "?"} → ${entry.receiver_name || "?"}: ${Number(entry.amount || 0).toFixed(2)} USDT`;
    if (entry.entryType === "balance") return `${name} balance changed by ${Number(entry.change || 0) >= 0 ? "+" : ""}${Number(entry.change || 0).toFixed(2)} USDT (${entry.action})`;
    return "";
  };

  const filtered = (auditLog || []).filter(e => {
    if (!search) return true;
    const name = (e.full_name || e.sender_name || "").toLowerCase();
    const email = (e.email || e.sender_email || "").toLowerCase();
    const q = search.toLowerCase();
    return name.includes(q) || email.includes(q) || (e.ip_address || "").includes(q) || (e.event_type || "").includes(q);
  });

  return (
    <div className="space-y-6">

      {/* Multi-Account IP Alerts */}
      <Card className="border-red-200 dark:border-red-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-500" />
            Multi-Account IP Alerts
            {(multiAccountAlerts?.length ?? 0) > 0 && (
              <Badge variant="destructive" data-testid="badge-multi-account-count">{multiAccountAlerts!.length}</Badge>
            )}
          </CardTitle>
          <p className="text-xs text-muted-foreground">IP addresses used by more than one registered account — high fraud risk indicator.</p>
        </CardHeader>
        <CardContent>
          {alertsLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (multiAccountAlerts?.length ?? 0) === 0 ? (
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm py-2">
              <CheckCircle className="w-4 h-4" />
              No multi-account alerts detected.
            </div>
          ) : (
            <div className="space-y-2">
              {multiAccountAlerts!.map((alert: any, i: number) => (
                <div key={i} className="flex flex-col md:flex-row md:items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800" data-testid={`row-ip-alert-${i}`}>
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-red-500" />
                    <span className="font-mono text-sm font-bold text-red-700 dark:text-red-400">{alert.ip_address}</span>
                    <Badge variant="destructive" className="text-xs">{alert.user_count} accounts</Badge>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">
                      Users: {(alert.user_names || []).join(", ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Emails: {(alert.emails || []).join(", ")}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    Last: {alert.last_seen ? formatDateTimeShort(alert.last_seen) : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Global Audit Log */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-row items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Global Audit Log
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => refetchAudit()} className="gap-2">
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </Button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Search by name, email, IP…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" data-testid="input-audit-search" />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40 h-8 text-sm" data-testid="select-audit-filter">
                <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="deposit">Deposits</SelectItem>
                <SelectItem value="withdrawal">Withdrawals</SelectItem>
                <SelectItem value="security">Security</SelectItem>
                <SelectItem value="login">Logins</SelectItem>
                <SelectItem value="p2p">P2P Transfers</SelectItem>
                <SelectItem value="balance">Balance Changes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {auditLoading ? (
            <div className="p-4 space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No audit entries found</p>
            </div>
          ) : (
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {filtered.map((entry: any, i: number) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors" data-testid={`row-audit-${i}`}>
                  <div className="mt-0.5">{entryIcon(entry.entryType)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{entryDescription(entry)}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-mono text-muted-foreground">{entry.ip_address || "no IP"}</span>
                      {entry.device_info && <span className="text-[10px] text-muted-foreground hidden sm:block">· {entry.device_info}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{entryBadge(entry)}</Badge>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {entry.created_at ? formatDateTimeShort(entry.created_at) : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {filtered.length > 0 && (
            <div className="px-4 py-2 border-t text-xs text-muted-foreground">
              Showing {filtered.length} entries
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Reports Tab ──────────────────────────────────────────────────────────────
const REPORT_REASON_LABELS: Record<string, string> = {
  fraud: "Fraud / Scam",
  impersonation: "Impersonation",
  harassment: "Harassment or Threats",
  fake_kyc: "Fake KYC Documents",
  unauthorized_access: "Unauthorized Account Access",
  money_laundering: "Suspected Money Laundering",
  abusive_behavior: "Abusive Behavior",
  other: "Other",
};

function ReportsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [noteInputs, setNoteInputs] = useState<Record<number, string>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: reports = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/reports"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/reports");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, adminNote }: { id: number; status: string; adminNote?: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/reports/${id}/status`, { status, adminNote });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/reports"] });
      toast({ title: "Report updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const freezeMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("POST", `/api/admin/users/${userId}/freeze`);
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/reports"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Account frozen for 7 days" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const unfreezeMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("POST", `/api/admin/users/${userId}/unfreeze`);
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/reports"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Account unfrozen successfully" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const banMutation = useMutation({
    mutationFn: async ({ userId, isBanned }: { userId: number; isBanned: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${userId}/ban`, { isBanned });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: (_, { isBanned }) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/reports"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: isBanned ? "Account banned" : "Account unbanned" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = statusFilter === "all" ? reports : reports.filter((r: any) => r.status === statusFilter);

  const statusBadge = (status: string) => {
    if (status === "pending") return <Badge variant="outline" className="text-amber-600 border-amber-400 bg-amber-50 dark:bg-amber-900/20">Pending</Badge>;
    if (status === "reviewed") return <Badge variant="outline" className="text-blue-600 border-blue-400 bg-blue-50 dark:bg-blue-900/20">Reviewed</Badge>;
    return <Badge variant="outline" className="text-muted-foreground">Dismissed</Badge>;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Flag className="w-4 h-4 text-red-500" />
            User Reports
            <Badge variant="secondary" className="ml-1">{reports.length}</Badge>
          </CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-8 text-xs" data-testid="select-reports-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">No reports found</div>
          ) : (
            <div className="divide-y">
              {filtered.map((report: any) => (
                <div key={report.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {statusBadge(report.status)}
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {REPORT_REASON_LABELS[report.reason] ?? report.reason}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {report.created_at ? formatDateTimeMedium(report.created_at) : "—"}
                        </span>
                      </div>
                      <div className="text-xs space-y-0.5">
                        <p><span className="text-muted-foreground">Reporter:</span> <span className="font-medium">{report.reporter_name ?? "—"}</span> <span className="text-muted-foreground">{report.reporter_email ? `(${report.reporter_email})` : ""}</span></p>
                        <p><span className="text-muted-foreground">Reported:</span> <span className="font-medium">{report.reported_identifier}</span>{report.reported_name ? <span className="text-muted-foreground ml-1">({report.reported_name})</span> : <span className="text-amber-500 ml-1 text-[10px]">user not found</span>}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-shrink-0"
                      onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}
                      data-testid={`button-expand-report-${report.id}`}
                    >
                      {expandedId === report.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>

                  {expandedId === report.id && (
                    <div className="mt-3 space-y-3 border-t pt-3">
                      <div className="bg-muted/40 rounded-md p-3 text-xs">
                        <p className="font-medium mb-1 text-foreground">Description:</p>
                        <p className="text-muted-foreground whitespace-pre-wrap">{report.description}</p>
                      </div>

                      {report.proof_image_url && (
                        <div>
                          <p className="text-xs font-medium mb-1">Proof Screenshot:</p>
                          <a href={report.proof_image_url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={report.proof_image_url}
                              alt="Proof"
                              className="max-h-48 rounded-md border object-contain cursor-pointer hover:opacity-90 transition-opacity"
                              data-testid={`img-proof-${report.id}`}
                            />
                          </a>
                        </div>
                      )}

                      {report.admin_note && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-md p-2 text-xs">
                          <span className="font-medium text-blue-700 dark:text-blue-400">Admin Note:</span>
                          <p className="text-muted-foreground mt-0.5">{report.admin_note}</p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="text-xs font-medium">Admin Note (optional)</label>
                        <textarea
                          className="w-full text-xs border rounded-md p-2 min-h-[60px] bg-background resize-none"
                          placeholder="Add a note about this report…"
                          value={noteInputs[report.id] ?? report.admin_note ?? ""}
                          onChange={(e) => setNoteInputs(prev => ({ ...prev, [report.id]: e.target.value }))}
                          data-testid={`textarea-admin-note-${report.id}`}
                        />
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          className="text-xs"
                          variant="outline"
                          onClick={() => updateMutation.mutate({ id: report.id, status: "reviewed", adminNote: noteInputs[report.id] ?? report.admin_note })}
                          disabled={updateMutation.isPending}
                          data-testid={`button-mark-reviewed-${report.id}`}
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1 text-blue-500" /> Mark Reviewed
                        </Button>
                        <Button
                          size="sm"
                          className="text-xs"
                          variant="outline"
                          onClick={() => updateMutation.mutate({ id: report.id, status: "dismissed", adminNote: noteInputs[report.id] ?? report.admin_note })}
                          disabled={updateMutation.isPending}
                          data-testid={`button-dismiss-report-${report.id}`}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1 text-muted-foreground" /> Dismiss
                        </Button>
                        {report.status !== "pending" && (
                          <Button
                            size="sm"
                            className="text-xs"
                            variant="ghost"
                            onClick={() => updateMutation.mutate({ id: report.id, status: "pending" })}
                            disabled={updateMutation.isPending}
                            data-testid={`button-reopen-report-${report.id}`}
                          >
                            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reopen
                          </Button>
                        )}
                      </div>

                      {/* Account Actions — only if reported user is matched */}
                      {report.reported_profile_id && (
                        <div className="space-y-1.5">
                          <Separator />
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Account Actions</p>
                          <div className="flex gap-2 flex-wrap">
                            <Button
                              size="sm"
                              className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
                              onClick={() => freezeMutation.mutate(report.reported_profile_id)}
                              disabled={freezeMutation.isPending || unfreezeMutation.isPending}
                              data-testid={`button-freeze-user-${report.id}`}
                            >
                              <Lock className="w-3.5 h-3.5 mr-1" /> Freeze 7 Days
                            </Button>
                            <Button
                              size="sm"
                              className="text-xs"
                              variant="outline"
                              onClick={() => unfreezeMutation.mutate(report.reported_profile_id)}
                              disabled={freezeMutation.isPending || unfreezeMutation.isPending}
                              data-testid={`button-unfreeze-user-${report.id}`}
                            >
                              <Unlock className="w-3.5 h-3.5 mr-1 text-green-500" /> Unfreeze
                            </Button>
                            <Button
                              size="sm"
                              className="text-xs"
                              variant="destructive"
                              onClick={() => banMutation.mutate({ userId: report.reported_profile_id, isBanned: true })}
                              disabled={banMutation.isPending}
                              data-testid={`button-ban-reported-user-${report.id}`}
                            >
                              <Ban className="w-3.5 h-3.5 mr-1" /> Ban Account
                            </Button>
                          </div>
                          {report.reported_name && (
                            <p className="text-[10px] text-muted-foreground">Reported user: <span className="font-medium">{report.reported_name}</span> ({report.reported_email})</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {filtered.length > 0 && (
            <div className="px-4 py-2 border-t text-xs text-muted-foreground">
              Showing {filtered.length} report{filtered.length !== 1 ? "s" : ""}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReferralPayoutsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: payouts, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/referral-payouts"],
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/admin/referral-payouts/${id}/approve`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Payout Approved", description: "Referral balance transferred to user's main balance." });
      qc.invalidateQueries({ queryKey: ["/api/admin/referral-payouts"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/admin/referral-payouts/${id}/reject`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Payout Rejected" });
      qc.invalidateQueries({ queryKey: ["/api/admin/referral-payouts"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const pendingPayouts = payouts?.filter((p) => p.status === "pending") || [];
  const processedPayouts = payouts?.filter((p) => p.status !== "pending") || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Referral Payout Requests</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-6">
              {/* Pending */}
              {pendingPayouts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No pending payout requests.</p>
              ) : (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Pending ({pendingPayouts.length})</p>
                  <div className="space-y-2">
                    {pendingPayouts.map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3" data-testid={`row-referral-payout-${p.id}`}>
                        <div>
                          <p className="font-medium text-sm">{p.full_name}</p>
                          <p className="text-xs text-muted-foreground">{p.email}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(p.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-base">${Number(p.amount).toFixed(2)}</span>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => approveMutation.mutate(p.id)}
                            disabled={approveMutation.isPending}
                            data-testid={`button-approve-referral-payout-${p.id}`}
                          >
                            {approveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => rejectMutation.mutate(p.id)}
                            disabled={rejectMutation.isPending}
                            data-testid={`button-reject-referral-payout-${p.id}`}
                          >
                            {rejectMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3 mr-1" />}
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* History */}
              {processedPayouts.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">History</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processedPayouts.map((p) => (
                        <TableRow key={p.id} data-testid={`row-payout-history-${p.id}`}>
                          <TableCell>
                            <p className="font-medium text-sm">{p.full_name}</p>
                            <p className="text-xs text-muted-foreground">{p.email}</p>
                          </TableCell>
                          <TableCell className="font-mono">${Number(p.amount).toFixed(2)}</TableCell>
                          <TableCell><StatusBadge status={p.status} /></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDateTime(p.reviewed_at || p.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── P2P Dispute & Investigation Center ─────────────────────────────────────
function P2PDisputesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: disputes, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/p2p/disputes"],
    queryFn: () => fetch("/api/admin/p2p/disputes", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 15000,
  });

  const { data: detail, isLoading: detailLoading } = useQuery<any>({
    queryKey: ["/api/admin/p2p/disputes", selectedId],
    queryFn: () => fetch(`/api/admin/p2p/disputes/${selectedId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!selectedId,
    refetchInterval: 8000,
  });

  const count = disputes?.length ?? 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="w-5 h-5 text-red-400" />
            P2P Dispute Center
            {count > 0 && (
              <Badge variant="destructive" className="ml-auto text-xs">{count} Active</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : !disputes?.length ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-muted-foreground">
              <ShieldCheck className="w-10 h-10 opacity-30" />
              <p className="text-sm">No active disputes</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {disputes.map((d: any) => (
                <DisputeListItem
                  key={d.id}
                  dispute={d}
                  isSelected={selectedId === d.id}
                  onSelect={() => setSelectedId(selectedId === d.id ? null : d.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedId && (
        <DisputeDetailPanel
          disputeId={selectedId}
          detail={detail}
          isLoading={detailLoading}
          onClose={() => setSelectedId(null)}
          onRefresh={() => {
            qc.invalidateQueries({ queryKey: ["/api/admin/p2p/disputes"] });
            qc.invalidateQueries({ queryKey: ["/api/admin/p2p/disputes", selectedId] });
          }}
          toast={toast}
        />
      )}
    </div>
  );
}

function DisputeListItem({ dispute: d, isSelected, onSelect }: { dispute: any; isSelected: boolean; onSelect: () => void }) {
  const isBuyerBanned = d.buyer_banned;
  const isSellerBanned = d.seller_banned;
  const buyerFrozen = d.buyer_frozen && new Date(d.buyer_frozen) > new Date();
  const sellerFrozen = d.seller_frozen && new Date(d.seller_frozen) > new Date();

  return (
    <div
      className={`p-4 cursor-pointer transition-colors hover:bg-muted/30 ${isSelected ? "bg-primary/5 border-l-2 border-primary" : ""}`}
      onClick={onSelect}
      data-testid={`dispute-item-${d.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">#{d.id}</span>
            <Badge variant="destructive" className="text-[10px] py-0">Disputed</Badge>
            <span className="text-sm font-semibold">{parseFloat(d.amount_usdt).toFixed(2)} USDT</span>
            <span className="text-xs text-muted-foreground">
              @ {parseFloat(d.rate).toFixed(2)} {d.currency ?? "HTG"}/USDT
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              Buyer: <span className="text-foreground font-medium ml-0.5">{d.buyer_name}</span>
              {isBuyerBanned && <Badge variant="destructive" className="text-[9px] py-0 px-1 ml-0.5">Banned</Badge>}
              {buyerFrozen && <Badge className="text-[9px] py-0 px-1 ml-0.5 bg-blue-500/20 text-blue-400 border-blue-500/30">Frozen</Badge>}
              {d.buyer_flagged && <Badge className="text-[9px] py-0 px-1 ml-0.5 bg-orange-500/20 text-orange-400 border-orange-500/30">{d.buyer_flagged}</Badge>}
            </span>
            <span className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              Seller: <span className="text-foreground font-medium ml-0.5">{d.seller_name}</span>
              {isSellerBanned && <Badge variant="destructive" className="text-[9px] py-0 px-1 ml-0.5">Banned</Badge>}
              {sellerFrozen && <Badge className="text-[9px] py-0 px-1 ml-0.5 bg-blue-500/20 text-blue-400 border-blue-500/30">Frozen</Badge>}
              {d.seller_flagged && <Badge className="text-[9px] py-0 px-1 ml-0.5 bg-orange-500/20 text-orange-400 border-orange-500/30">{d.seller_flagged}</Badge>}
            </span>
          </div>
          {d.dispute_reason && (
            <p className="text-xs text-red-400 mt-1 line-clamp-1 italic">"{d.dispute_reason}"</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[10px] text-muted-foreground">{d.message_count} msgs</span>
          <span className="text-[10px] text-muted-foreground">{formatDateTime(d.updated_at)}</span>
          {isSelected ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>
    </div>
  );
}

function DisputeDetailPanel({ disputeId, detail, isLoading, onClose, onRefresh, toast }: {
  disputeId: number; detail: any; isLoading: boolean; onClose: () => void;
  onRefresh: () => void; toast: any;
}) {
  const [resolveAction, setResolveAction] = useState<"release_buyer" | "refund_seller" | "">("");
  const [reason, setReason] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [detail?.chat]);

  if (isLoading || !detail) {
    return (
      <Card>
        <CardContent className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const { order, chat, buyerLogins, sellerLogins, actions } = detail;
  if (!order) return null;

  const isResolved = ["released", "cancelled"].includes(order.status);

  async function doResolve() {
    if (!resolveAction || !reason.trim()) { toast({ title: "Please select an action and enter a reason.", variant: "destructive" }); return; }
    setActionPending(true);
    try {
      const r = await fetch(`/api/admin/p2p/disputes/${disputeId}/resolve`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: resolveAction, reason }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message);
      toast({ title: resolveAction === "release_buyer" ? "✅ Funds released to buyer" : "✅ Funds refunded to seller" });
      setReason(""); setResolveAction("");
      onRefresh();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setActionPending(false); }
  }

  async function doUserAction(userId: number, action: string, extraBody: any = {}) {
    if (!reason.trim()) { toast({ title: "Enter a reason before taking action.", variant: "destructive" }); return; }
    setActionPending(true);
    let url = ""; let body: any = { reason, orderId: disputeId };
    if (action === "flag_buyer" || action === "flag_seller") {
      url = `/api/admin/p2p/disputes/${disputeId}/flag`;
      body = { ...body, userId, flagAs: action === "flag_buyer" ? "Reported Buyer" : "Reported Seller" };
    } else if (action === "unflag") {
      url = `/api/admin/p2p/disputes/${disputeId}/flag`;
      body = { ...body, userId, flagAs: null };
    } else if (action === "seller_restrict" || action === "seller_unrestrict") {
      url = `/api/admin/p2p/users/${userId}/seller-restrict`;
      body = { ...body, restricted: action === "seller_restrict" };
    } else if (action === "ban") {
      url = `/api/admin/p2p/users/${userId}/ban`;
      body = { ...body, isBanned: true };
    } else if (action === "unban") {
      url = `/api/admin/p2p/users/${userId}/ban`;
      body = { ...body, isBanned: false };
    } else if (action === "freeze") {
      url = `/api/admin/p2p/users/${userId}/freeze`;
      body = { ...body, freeze: true, durationDays: extraBody.days ?? 7 };
    } else if (action === "unfreeze") {
      url = `/api/admin/p2p/users/${userId}/freeze`;
      body = { ...body, freeze: false };
    }
    try {
      const r = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message);
      toast({ title: "Action applied", description: `${action} on user #${userId}.` });
      onRefresh();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setActionPending(false); }
  }

  const currency = order.currency ?? "HTG";
  const buyerFrozen = order.buyer_frozen && new Date(order.buyer_frozen) > new Date();
  const sellerFrozen = order.seller_frozen && new Date(order.seller_frozen) > new Date();

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3 border-b border-border">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              Investigation — Order #{order.id}
              {isResolved && <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Resolved</Badge>}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {parseFloat(order.amount_usdt).toFixed(2)} USDT in escrow · Payment: {order.payment_method}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-5">
        {/* Escrow Banner */}
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5">
          <Lock className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-amber-300">Funds Locked in Escrow</p>
            <p className="text-[11px] text-amber-400/80">
              {parseFloat(order.amount_usdt).toFixed(2)} USDT
              {order.amount_local ? ` · ${parseFloat(order.amount_local).toFixed(2)} ${currency}` : ""}
              {order.rate ? ` @ ${parseFloat(order.rate).toFixed(2)} ${currency}/USDT` : ""}
            </p>
          </div>
        </div>

        {/* Dispute reason */}
        {order.dispute_reason && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
            <p className="text-xs font-semibold text-red-400 mb-0.5">Dispute Filed By User</p>
            <p className="text-xs text-foreground italic">"{order.dispute_reason}"</p>
          </div>
        )}

        {/* Shared Reason Input — MUST be filled before any action button works */}
        <div className="space-y-2 bg-muted/20 border border-border rounded-lg p-3">
          <Label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Decision / Action Reason</span>
            <span className="text-red-400 ml-0.5">*</span>
          </Label>
          <Textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Enter your reason here first — this unlocks all action buttons and will be sent as a notification to the concerned parties…"
            rows={3}
            className="text-sm resize-none"
            data-testid="textarea-admin-reason"
          />
          {!reason.trim() && (
            <p className="text-[11px] text-amber-400 flex items-center gap-1.5 font-medium">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              Fill in a reason above to unlock all action buttons below.
            </p>
          )}
        </div>

        {/* Both parties */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DisputePartyCard
            role="Buyer"
            name={order.buyer_name}
            email={order.buyer_email}
            phone={order.buyer_phone}
            refId={order.buyer_ref}
            country={order.buyer_country}
            isBanned={!!order.buyer_banned}
            isFrozen={!!buyerFrozen}
            frozenUntil={order.buyer_frozen}
            flaggedAs={order.buyer_flagged}
            isSellerRestricted={!!order.buyer_restricted}
            logins={buyerLogins ?? []}
            onAction={(action, extra) => doUserAction(order.buyer_id, action, extra)}
            actionPending={actionPending}
            reason={reason}
          />
          <DisputePartyCard
            role="Seller"
            name={order.seller_name}
            email={order.seller_email}
            phone={order.seller_phone}
            refId={order.seller_ref}
            country={order.seller_country}
            isBanned={!!order.seller_banned}
            isFrozen={!!sellerFrozen}
            frozenUntil={order.seller_frozen}
            flaggedAs={order.seller_flagged}
            isSellerRestricted={!!order.seller_restricted}
            logins={sellerLogins ?? []}
            onAction={(action, extra) => doUserAction(order.seller_id, action, extra)}
            actionPending={actionPending}
            reason={reason}
          />
        </div>

        {/* Chat History */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" /> Trade Chat History ({chat?.length ?? 0} messages)
          </p>
          <div ref={chatScrollRef} className="bg-muted/10 border border-border rounded-lg p-3 space-y-2.5 max-h-80 overflow-y-auto">
            {!chat?.length ? (
              <p className="text-xs text-muted-foreground text-center py-4">No messages</p>
            ) : chat.map((m: any) => {
              const isSystem = /^[💰✅❌⏰⚠️🔒]/.test(m.message ?? "");
              const isBuyerMsg = m.sender_id === order.buyer_id;
              const fileUrl = m.file_url;
              return (
                <div key={m.id} className={`flex flex-col ${isSystem ? "items-center" : isBuyerMsg ? "items-start" : "items-end"}`}>
                  {isSystem ? (
                    <span className="text-[10px] bg-muted text-muted-foreground rounded-full px-3 py-1 border border-border">{m.message}</span>
                  ) : (
                    <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${isBuyerMsg ? "bg-muted/60" : "bg-primary/15"}`}>
                      <p className={`text-[10px] font-semibold mb-0.5 ${isBuyerMsg ? "text-blue-400" : "text-primary"}`}>
                        {m.sender_name ?? (isBuyerMsg ? order.buyer_name : order.seller_name)}
                        <span className="text-muted-foreground font-normal ml-1">({isBuyerMsg ? "Buyer" : "Seller"})</span>
                      </p>
                      {m.message && <p className="leading-relaxed break-words">{m.message}</p>}
                      {fileUrl && (
                        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 mt-1.5 text-blue-400 underline hover:opacity-80">
                          <ImageIcon className="w-3 h-3 shrink-0" /> {m.file_name ?? "View attachment"}
                        </a>
                      )}
                      <p className="text-[9px] text-muted-foreground mt-1">{formatDateTimeFull(m.created_at)}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Resolution Actions */}
        {!isResolved && (
          <div className="border border-border rounded-lg p-4 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Resolve Trade Dispute
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setResolveAction("release_buyer")}
                className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs transition-all ${resolveAction === "release_buyer" ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30" : "border-border text-muted-foreground hover:border-emerald-500/40 hover:text-foreground"}`}
                data-testid="button-resolve-release-buyer"
              >
                <ArrowDownCircle className="w-5 h-5" />
                <span className="font-semibold">Release to Buyer</span>
                <span className="text-[10px] opacity-70">USDT credited to buyer</span>
              </button>
              <button
                onClick={() => setResolveAction("refund_seller")}
                className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs transition-all ${resolveAction === "refund_seller" ? "border-blue-500 bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/30" : "border-border text-muted-foreground hover:border-blue-500/40 hover:text-foreground"}`}
                data-testid="button-resolve-refund-seller"
              >
                <ArrowUpCircle className="w-5 h-5" />
                <span className="font-semibold">Refund to Seller</span>
                <span className="text-[10px] opacity-70">USDT returned to seller</span>
              </button>
            </div>
            <Button
              className="w-full gap-2"
              onClick={doResolve}
              disabled={!resolveAction || !reason.trim() || actionPending}
              data-testid="button-confirm-dispute-resolution"
            >
              {actionPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Confirm Decision & Notify Both Parties
            </Button>
          </div>
        )}
        {isResolved && (
          <div className="flex items-center justify-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-3 text-sm text-emerald-400">
            <CheckCircle className="w-4 h-4" />
            This dispute has been resolved.
          </div>
        )}

        {/* Admin Action Log */}
        {actions?.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" /> Admin Action Log
            </p>
            <div className="space-y-1.5">
              {actions.map((a: any) => (
                <div key={a.id} className="flex items-start gap-2 bg-muted/20 rounded-lg px-3 py-2 text-xs">
                  <ShieldCheck className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold">{a.admin_name}</span>
                    <span className="text-muted-foreground mx-1.5">→</span>
                    <span className="text-amber-400 font-mono text-[10px]">{a.action}</span>
                    {a.target_name && <span className="text-muted-foreground ml-1.5 text-[10px]">on {a.target_name}</span>}
                    <p className="text-muted-foreground mt-0.5 break-words">"{a.reason}"</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">{formatDateTime(a.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Dispute Party Card ──────────────────────────────────────────────────────
function DisputePartyCard({ role, name, email, phone, refId, country, isBanned, isFrozen, frozenUntil, flaggedAs, isSellerRestricted, logins, onAction, actionPending, reason }: {
  role: "Buyer" | "Seller"; name: string; email: string; phone?: string; refId?: string;
  country?: string; isBanned: boolean; isFrozen: boolean; frozenUntil?: string;
  flaggedAs?: string; isSellerRestricted: boolean; logins: any[];
  onAction: (action: string, extra?: any) => void; actionPending: boolean; reason: string;
}) {
  const [showLogins, setShowLogins] = useState(false);
  const isFlagged = !!flaggedAs;

  return (
    <div className="border border-border rounded-lg p-3 space-y-3 text-xs">
      {/* Header */}
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{role}</span>
          <span className="font-semibold text-sm text-foreground">{name}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {isBanned && <Badge variant="destructive" className="text-[9px] py-0 px-1.5">Banned</Badge>}
          {isFrozen && <Badge className="text-[9px] py-0 px-1.5 bg-blue-500/20 text-blue-400 border-blue-500/30">Frozen</Badge>}
          {isSellerRestricted && <Badge className="text-[9px] py-0 px-1.5 bg-purple-500/20 text-purple-400 border-purple-500/30">Seller Restricted</Badge>}
          {flaggedAs && <Badge className="text-[9px] py-0 px-1.5 bg-orange-500/20 text-orange-400 border-orange-500/30">🚩 {flaggedAs}</Badge>}
        </div>
      </div>

      {/* Info */}
      <div className="space-y-1 text-muted-foreground">
        <div className="flex items-center gap-1.5 truncate"><Mail className="w-3 h-3 shrink-0" /><span className="truncate">{email}</span></div>
        {phone && <div className="flex items-center gap-1.5"><Phone className="w-3 h-3 shrink-0" />{phone}</div>}
        {refId && <div className="flex items-center gap-1.5"><Hash className="w-3 h-3 shrink-0" />{refId}</div>}
        {country && <div className="flex items-center gap-1.5"><Globe className="w-3 h-3 shrink-0" />{country}</div>}
        {isFrozen && frozenUntil && <div className="flex items-center gap-1.5 text-blue-400"><Clock className="w-3 h-3 shrink-0" />Until {formatDateTime(frozenUntil)}</div>}
      </div>

      {/* Login IP history */}
      <button
        className="w-full flex items-center justify-between text-[10px] text-muted-foreground hover:text-foreground transition-colors py-1"
        onClick={() => setShowLogins(!showLogins)}
      >
        <span className="flex items-center gap-1"><Monitor className="w-3 h-3" /> Login History ({logins.length})</span>
        {showLogins ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {showLogins && (
        <div className="bg-muted/20 rounded-lg p-2 space-y-2">
          {!logins.length ? (
            <p className="text-[10px] text-muted-foreground text-center py-1">No records</p>
          ) : logins.map((l: any, i: number) => (
            <div key={i} className="text-[10px] border-b border-border/50 last:border-0 pb-1.5 last:pb-0">
              <div className="flex items-center gap-1.5 font-mono text-foreground">
                <Wifi className="w-2.5 h-2.5 text-blue-400 shrink-0" />
                {l.ip_address ?? "Unknown IP"}
              </div>
              {l.device_info && <p className="text-muted-foreground pl-4 truncate">{l.device_info}</p>}
              <p className="text-muted-foreground pl-4">{formatDateTime(l.created_at)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Per-user Actions */}
      <div className="pt-2 border-t border-border space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">User Actions</p>
        <div className="flex flex-wrap gap-1.5">
          {/* Flag / Unflag */}
          {!isFlagged ? (
            <Button size="sm" variant="outline"
              className="h-6 text-[10px] px-2 border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
              onClick={() => onAction(role === "Buyer" ? "flag_buyer" : "flag_seller")}
              disabled={actionPending || !reason.trim()}
              data-testid={`button-flag-${role.toLowerCase()}`}
            >
              <Flag className="w-2.5 h-2.5 mr-1" /> Flag {role}
            </Button>
          ) : (
            <Button size="sm" variant="outline"
              className="h-6 text-[10px] px-2"
              onClick={() => onAction("unflag")}
              disabled={actionPending || !reason.trim()}
            >
              <XCircle className="w-2.5 h-2.5 mr-1" /> Remove Flag
            </Button>
          )}

          {/* Seller Restrict (available for all parties, for cross-role abuse) */}
          {!isSellerRestricted ? (
            <Button size="sm" variant="outline"
              className="h-6 text-[10px] px-2 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
              onClick={() => onAction("seller_restrict")}
              disabled={actionPending || !reason.trim()}
              data-testid={`button-seller-restrict-${role.toLowerCase()}`}
            >
              <ShieldOff className="w-2.5 h-2.5 mr-1" /> Restrict Selling
            </Button>
          ) : (
            <Button size="sm" variant="outline"
              className="h-6 text-[10px] px-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              onClick={() => onAction("seller_unrestrict")}
              disabled={actionPending || !reason.trim()}
            >
              <ShieldCheck className="w-2.5 h-2.5 mr-1" /> Restore Selling
            </Button>
          )}

          {/* Freeze / Unfreeze */}
          {!isFrozen ? (
            <Button size="sm" variant="outline"
              className="h-6 text-[10px] px-2 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
              onClick={() => onAction("freeze", { days: 7 })}
              disabled={actionPending || !reason.trim()}
              data-testid={`button-freeze-${role.toLowerCase()}`}
            >
              <Lock className="w-2.5 h-2.5 mr-1" /> Freeze 7d
            </Button>
          ) : (
            <Button size="sm" variant="outline"
              className="h-6 text-[10px] px-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              onClick={() => onAction("unfreeze")}
              disabled={actionPending || !reason.trim()}
            >
              <Unlock className="w-2.5 h-2.5 mr-1" /> Unfreeze
            </Button>
          )}

          {/* Ban / Unban */}
          {!isBanned ? (
            <Button size="sm" variant="outline"
              className="h-6 text-[10px] px-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
              onClick={() => onAction("ban")}
              disabled={actionPending || !reason.trim()}
              data-testid={`button-ban-${role.toLowerCase()}`}
            >
              <Ban className="w-2.5 h-2.5 mr-1" /> Ban Account
            </Button>
          ) : (
            <Button size="sm" variant="outline"
              className="h-6 text-[10px] px-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              onClick={() => onAction("unban")}
              disabled={actionPending || !reason.trim()}
            >
              <Unlock className="w-2.5 h-2.5 mr-1" /> Unban
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Canal+ Management Tab ──────────────────────────────────────────────────────
function CanalplusTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | "pending" | "success" | "failed">("all");

  const { data: subs, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/canalplus"],
    queryFn: async () => {
      const res = await fetch("/api/admin/canalplus", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load Canal+ subscriptions");
      return res.json();
    },
  });

  const approveMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/admin/canalplus/${id}/approve`);
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || "Failed"); }
    },
    onSuccess: () => {
      toast({ title: "Abonnement approuvé ✅", description: "L'utilisateur a été notifié par WhatsApp." });
      qc.invalidateQueries({ queryKey: ["/api/admin/canalplus"] });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const rejectMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/admin/canalplus/${id}/reject`);
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || "Failed"); }
    },
    onSuccess: () => {
      toast({ title: "Abonnement refusé & remboursé", description: "Le montant USDT a été remboursé." });
      qc.invalidateQueries({ queryKey: ["/api/admin/canalplus"] });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const PLAN_COLORS: Record<string, string> = {
    "ToutCanal+": "text-yellow-500",
    "Evasion+":   "text-purple-500",
    "Evasion":    "text-blue-500",
    "Acces":      "text-emerald-500",
  };

  const filtered = (subs || []).filter((s: any) => filter === "all" || s.status === filter);
  const pending = (subs || []).filter((s: any) => s.status === "pending").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <Tv className="w-5 h-5 text-primary" />
            Canal+ Gestion
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {pending > 0 && <Badge variant="destructive" className="text-xs">{pending} en attente</Badge>}
            <div className="flex gap-1">
              {(["all", "pending", "success", "failed"] as const).map((f) => (
                <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} className="h-7 text-xs px-2" onClick={() => setFilter(f)}>
                  {f === "all" ? "Tout" : f === "pending" ? "En attente" : f === "success" ? "Activé" : "Refusé"}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">Aucun abonnement Canal+ trouvé</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref / User</TableHead>
                  <TableHead>Carte Canal+</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((sub: any) => (
                  <TableRow key={sub.id} data-testid={`row-admin-canalplus-${sub.id}`}>
                    <TableCell>
                      <div className="text-sm font-medium">{sub.full_name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{sub.reference_id}</div>
                      <div className="text-xs text-muted-foreground">{sub.email}</div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm tracking-widest">{sub.card_number}</span>
                    </TableCell>
                    <TableCell>
                      <span className={`font-semibold text-sm ${PLAN_COLORS[sub.plan_name] || ""}`}>{sub.plan_name}</span>
                      {sub.auto_renew && <div className="text-[10px] text-amber-500">Auto-renouvellement</div>}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{formatHtg(Number(sub.plan_price_htg))} HTG</div>
                      <div className="text-xs text-muted-foreground">{formatUsdt(Number(sub.plan_price_usdt))} USDT</div>
                    </TableCell>
                    <TableCell>
                      {sub.status === "success" && <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-xs">✅ Activé</Badge>}
                      {sub.status === "failed"  && <Badge className="bg-red-500/15 text-red-600 border-red-500/30 text-xs">❌ Refusé</Badge>}
                      {sub.status === "pending" && <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-xs">⏳ En attente</Badge>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(sub.created_at)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {sub.status === "pending" && (
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            className="h-7 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-500"
                            onClick={() => approveMut.mutate(sub.id)}
                            disabled={approveMut.isPending || rejectMut.isPending}
                            data-testid={`button-approve-canalplus-${sub.id}`}
                          >
                            ✅ Approuver
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-xs px-2.5"
                            onClick={() => rejectMut.mutate(sub.id)}
                            disabled={approveMut.isPending || rejectMut.isPending}
                            data-testid={`button-reject-canalplus-${sub.id}`}
                          >
                            ❌ Refuser
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const PAYOUT_METHOD_DISPLAY: Record<string, { label: string; colorName: string; hex: string }> = {
  moncash: { label: "MonCash", colorName: "Red", hex: "#EF4444" },
  natcash: { label: "NatCash", colorName: "Lemon Yellow", hex: "#E3FF00" },
  zelle: { label: "Zelle", colorName: "Navy Blue", hex: "#1A237E" },
  cashapp: { label: "CashApp", colorName: "Green", hex: "#22C55E" },
};

type AdminPayout = {
  id: number; userId: number; merchantId: number | null;
  amount: string; method: keyof typeof PAYOUT_METHOD_DISPLAY;
  details: any; status: "pending" | "approved" | "rejected";
  adminNote: string | null; createdAt: string; processedAt: string | null;
  user: { id: number; fullName: string; email: string } | null;
  merchant: { id: number; businessName: string } | null;
};

function MerchantPayoutsTab() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<{ payouts: AdminPayout[] }>({
    queryKey: ["/api/admin/payouts"],
    refetchInterval: 15000,
  });
  const payouts = data?.payouts || [];
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const approve = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest("POST", `/api/admin/payouts/${id}/approve`, {});
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payouts"] });
      toast({ title: "Payout approved" });
    },
    onError: (e: any) => toast({ title: "Approve failed", description: e?.message, variant: "destructive" }),
  });

  const reject = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest("POST", `/api/admin/payouts/${id}/reject`, { adminNote: rejectNote });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payouts"] });
      toast({ title: "Payout rejected", description: "Funds refunded to user balance." });
      setRejectingId(null);
      setRejectNote("");
    },
    onError: (e: any) => toast({ title: "Reject failed", description: e?.message, variant: "destructive" }),
  });

  const filtered = filter === "pending" ? payouts.filter((p) => p.status === "pending") : payouts;
  const pendingCount = payouts.filter((p) => p.status === "pending").length;

  return (
    <Card data-testid="card-admin-payouts">
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2"><Wallet className="w-5 h-5" />Merchant Payouts</CardTitle>
            <CardDescription>{pendingCount} pending request{pendingCount === 1 ? "" : "s"}. Review and process within 24-48h.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={filter === "pending" ? "default" : "outline"}
              onClick={() => setFilter("pending")}
              data-testid="button-filter-pending"
            >Pending ({pendingCount})</Button>
            <Button
              size="sm"
              variant={filter === "all" ? "default" : "outline"}
              onClick={() => setFilter("all")}
              data-testid="button-filter-all"
            >All ({payouts.length})</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-payouts">No payouts to display.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((p) => {
              const meta = PAYOUT_METHOD_DISPLAY[p.method];
              const detail = p.details?.phoneNumber || p.details?.email || p.details?.cashtag || "—";
              return (
                <div key={p.id} className="border rounded-lg p-4 space-y-3" data-testid={`row-admin-payout-${p.id}`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="inline-block w-4 h-4 rounded-full border mt-1 shrink-0" style={{ backgroundColor: meta.hex }} />
                      <div className="min-w-0">
                        <p className="font-semibold">{meta.label}</p>
                        <p className="text-sm text-muted-foreground">{p.user?.fullName} • <span className="font-mono text-xs">{p.user?.email}</span></p>
                        {p.merchant && <p className="text-xs text-muted-foreground">🏪 {p.merchant.businessName}</p>}
                        <p className="text-sm font-mono mt-1" data-testid={`text-detail-${p.id}`}>{detail}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-2xl font-bold" data-testid={`text-amount-${p.id}`}>{Number(p.amount).toFixed(2)} <span className="text-sm font-normal">USDT</span></p>
                      <Badge
                        variant={p.status === "approved" ? "default" : p.status === "rejected" ? "destructive" : "secondary"}
                        data-testid={`badge-status-${p.id}`}
                      >{p.status}</Badge>
                      <p className="text-[11px] text-muted-foreground mt-1">{new Date(p.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  {p.adminNote && (
                    <div className="text-xs p-2 rounded bg-muted">
                      <span className="font-semibold">Note:</span> {p.adminNote}
                    </div>
                  )}
                  {p.status === "pending" && (
                    <>
                      {rejectingId === p.id ? (
                        <div className="space-y-2 pt-2 border-t">
                          <Label className="text-xs">Reason for rejection (sent to user)</Label>
                          <Input
                            placeholder="e.g. Invalid phone number"
                            value={rejectNote}
                            onChange={(e) => setRejectNote(e.target.value)}
                            data-testid={`input-reject-note-${p.id}`}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => reject.mutate(p.id)}
                              disabled={reject.isPending}
                              data-testid={`button-confirm-reject-${p.id}`}
                            >
                              {reject.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                              Confirm reject & refund
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setRejectingId(null); setRejectNote(""); }} data-testid={`button-cancel-reject-${p.id}`}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2 pt-2 border-t">
                          <Button
                            size="sm"
                            onClick={() => approve.mutate(p.id)}
                            disabled={approve.isPending}
                            data-testid={`button-approve-${p.id}`}
                          >
                            {approve.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                            Mark as paid
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setRejectingId(p.id)}
                            data-testid={`button-reject-${p.id}`}
                          >Reject & refund</Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
