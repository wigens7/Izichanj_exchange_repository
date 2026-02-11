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
  const { data: users, isLoading } = useAdminUsers();
  const { mutate: updateBalance, isPending } = useAdminUpdateBalance();

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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          User Management
        </CardTitle>
        <Badge variant="secondary" data-testid="badge-user-count">
          {users?.length || 0} users
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Balance (USDT)</TableHead>
                <TableHead>KYC</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((user: any) => (
                <UserRow key={user.id} user={user} onUpdateBalance={updateBalance} isPending={isPending} />
              ))}
              {(!users || users.length === 0) && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No users found
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

function UserRow({ user, onUpdateBalance, isPending }: { user: any; onUpdateBalance: any; isPending: boolean }) {
  const [balance, setBalance] = useState(user.balance);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    onUpdateBalance({ id: user.id, balance: Number(balance) });
    setIsEditing(false);
  };

  return (
    <TableRow data-testid={`row-user-${user.id}`}>
      <TableCell className="font-mono text-xs">{user.id}</TableCell>
      <TableCell className="font-medium">{user.fullName}</TableCell>
      <TableCell className="text-muted-foreground text-sm">{user.email}</TableCell>
      <TableCell>
        <StatusBadge status={user.role} />
      </TableCell>
      <TableCell>
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsEditing(true)}
              data-testid={`button-edit-balance-${user.id}`}
            >
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
        {format(new Date(user.createdAt), "MMM d, yyyy")}
      </TableCell>
    </TableRow>
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
                          Reject
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
                    <TableCell className="font-medium">{user.fullName}</TableCell>
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

const sendMessageSchema = z.object({
  userId: z.string().min(1, "Please select a user"),
  title: z.string().min(1, "Title is required").max(100, "Title must be under 100 characters"),
  message: z.string().min(1, "Message is required").max(500, "Message must be under 500 characters"),
});

function MessagesTab() {
  const { data: users, isLoading } = useAdminUsers();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof sendMessageSchema>>({
    resolver: zodResolver(sendMessageSchema),
    defaultValues: {
      userId: "",
      title: "",
      message: "",
    },
  });

  const sendMessage = useMutation({
    mutationFn: async (data: z.infer<typeof sendMessageSchema>) => {
      await apiRequest("POST", "/api/admin/notifications/send", {
        profileId: parseInt(data.userId),
        title: data.title,
        message: data.message,
      });
    },
    onSuccess: () => {
      toast({ title: "Message sent", description: "The notification has been sent to the user." });
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to send", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: z.infer<typeof sendMessageSchema>) => {
    sendMessage.mutate(data);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="w-5 h-5" />
          Send Notification
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select User</FormLabel>
                  <FormControl>
                    <select
                      {...field}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      data-testid="select-message-user"
                    >
                      <option value="">Choose a user...</option>
                      {users?.map((user: any) => (
                        <option key={user.id} value={user.id.toString()}>
                          {user.fullName} ({user.email})
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Notification title..."
                      data-testid="input-message-title"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Type your notification message..."
                      className="resize-none"
                      rows={4}
                      data-testid="input-message-text"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={sendMessage.isPending} data-testid="button-send-message">
              {sendMessage.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send Notification
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function SupportTab() {
  const { data: conversations = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/support/conversations"],
    refetchInterval: 10000,
  });
  const [selectedConvo, setSelectedConvo] = useState<any>(null);
  const [replyText, setReplyText] = useState("");
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
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/support/reply", {
        conversationId: selectedConvo.id,
        message: replyText.trim(),
      });
      return res.json();
    },
    onSuccess: () => {
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: ["/api/support/messages", selectedConvo?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support/conversations"] });
    },
  });

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
                      {msg.message}
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
                <div className="px-4 pb-4 pt-2 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Input
                      value={replyText}
                      onChange={(e: any) => setReplyText(e.target.value)}
                      onKeyDown={(e: any) => {
                        if (e.key === "Enter" && !e.shiftKey && replyText.trim()) {
                          e.preventDefault();
                          replyMutation.mutate();
                        }
                      }}
                      placeholder="Type your reply..."
                      className="flex-1 text-sm"
                      disabled={replyMutation.isPending}
                      data-testid="input-admin-reply"
                    />
                    <Button
                      size="icon"
                      onClick={() => replyMutation.mutate()}
                      disabled={!replyText.trim() || replyMutation.isPending}
                      data-testid="button-admin-send-reply"
                    >
                      {replyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
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
