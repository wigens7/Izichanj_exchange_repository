import {
  useAdminUsers,
  useAdminDeposits,
  useAdminWithdrawals,
  useAdminApproveDeposit,
  useAdminRejectDeposit,
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
        <TabsList className="mb-4 grid w-full grid-cols-6 gap-2">
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
          <TabsTrigger value="messages" className="gap-2" data-testid="tab-admin-messages">
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Messages</span>
          </TabsTrigger>
          <TabsTrigger value="support" className="gap-2" data-testid="tab-admin-support">
            <Headphones className="w-4 h-4" />
            <span className="hidden sm:inline">Support</span>
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
        <TabsContent value="messages">
          <MessagesTab />
        </TabsContent>
        <TabsContent value="support">
          <SupportTab />
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

function UserRow({ user, onUpdateBalance, isPending }: { user: any; onUpdateBalance: any; isPending: boolean }) {
  const [balance, setBalance] = useState(user.balance);
  const [isEditing, setIsEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const handleSave = () => {
    onUpdateBalance({ id: user.id, balance: Number(balance) });
    setIsEditing(false);
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
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                className="w-28"
                data-testid={`input-balance-${user.id}`}
              />
              <Button size="icon" onClick={handleSave} disabled={isPending} data-testid={`button-save-balance-${user.id}`}>
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-medium">{Number(user.balance).toLocaleString()}</span>
              <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} data-testid={`button-edit-balance-${user.id}`}>
                <Pencil className="w-3 h-3" />
              </Button>
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
    </>
  );
}

function DepositsTab() {
  const { data: deposits, isLoading } = useAdminDeposits();
  const { mutate: approve, isPending: isApproving } = useAdminApproveDeposit();
  const { mutate: reject, isPending: isRejecting } = useAdminRejectDeposit();

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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <ArrowDownCircle className="w-5 h-5 text-emerald-600" />
          Deposit Management
        </CardTitle>
        {pendingCount > 0 && (
          <Badge variant="destructive" data-testid="badge-pending-deposits">
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
                <TableHead>Method</TableHead>
                <TableHead>Amount (USDT)</TableHead>
                <TableHead>HTG Value</TableHead>
                <TableHead>Tx Hash</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deposits?.map((deposit: any) => (
                <TableRow key={deposit.id} data-testid={`row-deposit-${deposit.id}`}>
                  <TableCell className="font-mono text-xs">{deposit.id}</TableCell>
                  <TableCell>{deposit.profileId}</TableCell>
                  <TableCell>
                    <Badge variant={deposit.depositMethod === "moncash" ? "secondary" : deposit.depositMethod === "nowpayments" ? "default" : "outline"} className="text-xs">
                      {deposit.depositMethod === "moncash" ? "MonCash" : deposit.depositMethod === "nowpayments" ? "Crypto (Auto)" : "USDT"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">${Number(deposit.amountUsdt).toFixed(2)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatHtg(usdtToHtg(Number(deposit.amountUsdt)))} HTG</TableCell>
                  <TableCell>
                    <span className="font-mono text-xs break-all max-w-[200px] block truncate" title={deposit.txHash}>
                      {deposit.txHash}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={deposit.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(deposit.createdAt), "MMM d, yyyy h:mm a")}
                  </TableCell>
                  <TableCell>
                    {deposit.status === "pending" ? (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => approve(deposit.id)}
                          disabled={isApproving}
                          className="bg-emerald-600 hover:bg-emerald-700"
                          data-testid={`button-approve-deposit-${deposit.id}`}
                        >
                          {isApproving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => reject(deposit.id)}
                          disabled={isRejecting}
                          data-testid={`button-reject-deposit-${deposit.id}`}
                        >
                          {isRejecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3 mr-1" />}
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Processed</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
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
  );
}

function WithdrawalsTab() {
  const { data: withdrawals, isLoading } = useAdminWithdrawals();
  const { mutate: approve, isPending: isApproving } = useAdminApproveWithdrawal();
  const { mutate: reject, isPending: isRejecting } = useAdminRejectWithdrawal();

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
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => approve(w.id)}
                          disabled={isApproving}
                          className="bg-emerald-600 hover:bg-emerald-700"
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
                          data-testid={`button-reject-withdrawal-${w.id}`}
                        >
                          {isRejecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3 mr-1" />}
                          Refund
                        </Button>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Processed</span>
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
                    <TableCell>
                      {user.kycStatus === "pending" ? (
                        <div className="flex items-center gap-2">
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
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {user.kycStatus === "verified" ? "Verified" : "Rejected"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {kycUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
                    <p className="text-sm font-medium">Selfie</p>
                    <img
                      src={docs.selfieUrl}
                      alt="Selfie"
                      className="w-full rounded-md border border-border object-contain max-h-64"
                      data-testid="img-kyc-selfie"
                    />
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
  { key: "kyc_submitted",    label: "KYC Submitted",       color: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300" },
  { key: "kyc_not_submitted","label": "KYC Not Submitted", color: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" },
] as const;

type UserCategory = typeof USER_CATEGORIES[number]["key"];

function filterByCategory(users: any[], category: UserCategory): any[] {
  switch (category) {
    case "otp_verified":     return users.filter(u => u.emailVerified);
    case "otp_not_verified": return users.filter(u => !u.emailVerified);
    case "kyc_verified":     return users.filter(u => u.kycStatus === "verified");
    case "kyc_submitted":    return users.filter(u => ["submitted", "verified", "rejected"].includes(u.kycStatus));
    case "kyc_not_submitted":return users.filter(u => !u.kycStatus || u.kycStatus === "pending");
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
