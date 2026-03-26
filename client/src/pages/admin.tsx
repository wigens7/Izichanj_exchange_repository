import {
  useAdminUsers,
  useAdminDeposits,
  useAdminWithdrawals,
  useAdminApproveDeposit,
  useAdminRejectDeposit,
  useAdminRejectDepositWithReason,
  useAdminApproveWithdrawal,
  useAdminRejectWithdrawal,
  useAdminVerifyKyc,
  useAdminRejectKyc,
  useAdminUpdateBalance,
} from "@/hooks/use-transactions";
import { useUser } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";
import { format } from "date-fns";
import { usdtToHtg, formatHtg, formatUsdt } from "@shared/constants";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
        <TabsList className="mb-4 grid w-full grid-cols-8 gap-1">
          <TabsTrigger value="users" className="gap-2" data-testid="tab-admin-users">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Users</span>
          </TabsTrigger>
          <TabsTrigger value="deposits" className="gap-2" data-testid="tab-admin-deposits">
            <ArrowDownCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Deposits</span>
          </TabsTrigger>
          <TabsTrigger value="withdrawals" className="gap-2" data-testid="tab-admin-withdrawals">
            <ArrowUpCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Withdrawals</span>
          </TabsTrigger>
          <TabsTrigger value="kyc" className="gap-2" data-testid="tab-admin-kyc">
            <ShieldCheck className="w-4 h-4" />
            <span className="hidden sm:inline">KYC</span>
          </TabsTrigger>
          <TabsTrigger value="cards" className="gap-2" data-testid="tab-admin-cards">
            <CreditCard className="w-4 h-4" />
            <span className="hidden sm:inline">Cards</span>
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-2" data-testid="tab-admin-messages">
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Messages</span>
          </TabsTrigger>
          <TabsTrigger value="support" className="gap-2" data-testid="tab-admin-support">
            <Headphones className="w-4 h-4" />
            <span className="hidden sm:inline">Support</span>
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2" data-testid="tab-admin-activity">
            <Activity className="w-4 h-4" />
            <span className="hidden sm:inline">Activity</span>
          </TabsTrigger>
        </TabsList>

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
                <UserRow key={user.id} user={user} onUpdateBalance={updateBalance} isPending={isPending} />
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
                      <TableCell className="text-sm">{user.deletedAt ? format(new Date(user.deletedAt), "MMM d, yyyy h:mm a") : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
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

function UserRow({ user, onUpdateBalance, isPending }: { user: any; onUpdateBalance: any; isPending: boolean }) {
  const [balance, setBalance] = useState(user.balance);
  const [reason, setReason] = useState("Administrative Adjustment");
  const [isEditing, setIsEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [receiptBlobUrl, setReceiptBlobUrl] = useState<string | null>(null);
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
          {format(new Date(user.createdAt), "MMM d, yyyy h:mm a")}
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
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">First Name</p>
                    <p className="font-medium">{user.firstName || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Last Name</p>
                    <p className="font-medium">{user.lastName || "—"}</p>
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
                    <p className="font-medium">{format(new Date(user.createdAt), "MMM d, yyyy 'at' h:mm:ss a")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">2FA Enabled</p>
                    <p className="font-medium">{user.twoFactorEnabled ? "Yes" : "No"}</p>
                  </div>
                </div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
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
  const { mutate: approve, isPending: isApproving } = useAdminApproveDeposit();
  const { mutate: reject, isPending: isRejecting } = useAdminRejectDeposit();
  const { mutate: rejectWithReason, isPending: isRejectingWithReason } = useAdminRejectDepositWithReason();
  const [releaseLoadingId, setReleaseLoadingId] = useState<number | null>(null);
  const [rejectModalDepositId, setRejectModalDepositId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [proofViewUrl, setProofViewUrl] = useState<string | null>(null);

  const isManualDeposit = (deposit: any) => deposit.depositMethod === "moncash" && deposit.moncashTransactionId;

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
                        <div className="text-xs text-muted-foreground">{formatHtg(usdtToHtg(Number(deposit.amountUsdt)))} HTG</div>
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
                          <span className="font-mono text-xs break-all block truncate" title={deposit.txHash}>
                            {deposit.txHash || "—"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={deposit.status} />
                        {deposit.expiresAt && deposit.status !== "approved" && deposit.status !== "rejected" && (
                          <div className={`text-[10px] mt-0.5 ${deposit.status === "expired" ? "text-orange-500" : "text-muted-foreground/60"}`}>
                            {deposit.status === "expired" ? "⏰ Expired" : "⏳"} {format(new Date(deposit.expiresAt), "h:mm a")}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(deposit.createdAt), "MMM d, yyyy h:mm a")}
                      </TableCell>
                      <TableCell>
                        {(deposit.status === "pending" || deposit.status === "expired") ? (
                          <div className="flex flex-col gap-1.5">
                            {deposit.status === "expired" && !isManual && (
                              <p className="text-[10px] text-orange-600 dark:text-orange-400 font-medium">Auto-expired — manual override allowed</p>
                            )}
                            <Button
                              size="sm"
                              onClick={() => approveAndRelease("deposits", deposit.id, (v) => setReleaseLoadingId(v ? deposit.id : null))}
                              disabled={releaseLoadingId === deposit.id}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                              data-testid={`button-approve-release-deposit-${deposit.id}`}
                            >
                              {releaseLoadingId === deposit.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Download className="w-3 h-3 mr-1" />}
                              Approve & Release Receipt
                            </Button>
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                onClick={() => approve(deposit.id)}
                                disabled={isApproving}
                                className="bg-emerald-600 hover:bg-emerald-700 text-xs flex-1"
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

function WithdrawalsTab() {
  const { data: withdrawals, isLoading } = useAdminWithdrawals();
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
                  <TableCell className="text-muted-foreground">{formatHtg(usdtToHtg(Number(w.amount)))} HTG</TableCell>
                  <TableCell>
                    <Badge variant="outline">{w.currency}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{w.withdrawMethod === "qrcode" ? "QR Code" : "Phone"}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {w.withdrawMethod === "qrcode" ? (
                      w.qrCodeUrl ? (
                        <a href={w.qrCodeUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline" data-testid={`link-qr-${w.id}`}>View QR</a>
                      ) : "—"
                    ) : (
                      w.phoneNumber || "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={w.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(w.createdAt), "MMM d, yyyy h:mm a")}
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
                    {format(new Date(card.createdAt), "MMM d, h:mm a")}
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
                              {log.loginAt ? format(new Date(log.loginAt), "dd/MM/yyyy") : "—"}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {log.loginAt ? format(new Date(log.loginAt), "HH:mm:ss") : ""}
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
