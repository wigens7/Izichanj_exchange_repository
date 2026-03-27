import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type InsertDeposit, type InsertWithdrawal, buildUrl } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useDeposits() {
  return useQuery({
    queryKey: [api.deposits.list.path],
    queryFn: async () => {
      const res = await fetch(api.deposits.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch deposits");
      return res.json();
    },
  });
}

export function useCreateDeposit() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertDeposit) => {
      const res = await apiRequest(api.deposits.create.method, api.deposits.create.path, data);
      if (!res.ok) throw new Error("Failed to create deposit");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.deposits.list.path] });
      toast({ title: "Deposit Submitted", description: "Your deposit is pending approval." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useWithdrawals() {
  return useQuery({
    queryKey: [api.withdrawals.list.path],
    queryFn: async () => {
      const res = await fetch(api.withdrawals.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch withdrawals");
      return res.json();
    },
  });
}

export function useRequestWithdrawalOtp() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest(api.withdrawals.requestOtp.method, api.withdrawals.requestOtp.path);
      if (!res.ok) throw new Error("Failed to send OTP");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "OTP Sent", description: "Check your email for the withdrawal code." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useCreateWithdrawal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      amount: string;
      currency: string;
      trcAddress?: string;
      pin?: string;
      withdrawMethod?: string;
      phoneNumber?: string;
      qrCodeUrl?: string;
      otp?: string;
    }) => {
      const res = await apiRequest(api.withdrawals.create.method, api.withdrawals.create.path, data);
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: "Failed to create withdrawal" }));
        throw new Error(body.message || "Failed to create withdrawal");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.withdrawals.list.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Withdrawal Submitted", description: "Your withdrawal is under review and will be processed shortly." });
    },
    onError: (err: Error) => {
      toast({ title: "Withdrawal Failed", description: err.message, variant: "destructive" });
    },
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: [api.admin.users.path],
    queryFn: async () => {
      const res = await fetch(api.admin.users.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });
}

export function useAdminDeposits() {
  return useQuery({
    queryKey: [api.admin.allDeposits.path],
    queryFn: async () => {
      const res = await fetch(api.admin.allDeposits.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch deposits");
      return res.json();
    },
  });
}

export function useAdminWithdrawals() {
  return useQuery({
    queryKey: [api.admin.allWithdrawals.path],
    queryFn: async () => {
      const res = await fetch(api.admin.allWithdrawals.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch withdrawals");
      return res.json();
    },
  });
}

export function useAdminUpdateBalance() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, balance, reason }: { id: number; balance: number; reason: string }) => {
      const url = buildUrl(api.admin.updateBalance.path, { id });
      const res = await apiRequest(api.admin.updateBalance.method, url, { balance, reason });
      if (!res.ok) throw new Error("Failed to update balance");
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    },
    onSuccess: (blobUrl) => {
      queryClient.invalidateQueries({ queryKey: [api.admin.users.path] });
      return blobUrl;
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update balance.", variant: "destructive" });
    },
  });
}

export function useAdminApproveDeposit() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.admin.approveDeposit.path, { id });
      const res = await apiRequest(api.admin.approveDeposit.method, url);
      if (!res.ok) throw new Error("Failed to approve deposit");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.allDeposits.path] });
      toast({ title: "Deposit Approved" });
    },
  });
}

export function useAdminRejectDeposit() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.admin.rejectDeposit.path, { id });
      const res = await apiRequest(api.admin.rejectDeposit.method, url);
      if (!res.ok) throw new Error("Failed to reject deposit");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.allDeposits.path] });
      toast({ title: "Deposit Rejected" });
    },
  });
}

export function useAdminRejectDepositWithReason() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/deposits/${id}/reject-manual`, { reason });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to reject deposit");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.allDeposits.path] });
      toast({ title: "Deposit Rejected", description: "User has been notified with the rejection reason." });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });
}

export function useAdminRejectDepositForFraud() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/admin/deposits/${id}/reject-fraud`, {});
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to reject deposit for fraud");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.admin.allDeposits.path] });
      toast({
        title: data.accountFrozen ? "🚨 Account Frozen — Fraud Detected" : "⚠️ Fraud Rejection Sent",
        description: data.message,
        variant: data.accountFrozen ? "destructive" : "default",
      });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });
}

export function useAdminApproveWithdrawal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.admin.approveWithdrawal.path, { id });
      const res = await apiRequest(api.admin.approveWithdrawal.method, url);
      if (!res.ok) throw new Error("Failed to approve withdrawal");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.allWithdrawals.path] });
      toast({ title: "Withdrawal Approved" });
    },
  });
}

export function useAdminRejectWithdrawal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.admin.rejectWithdrawal.path, { id });
      const res = await apiRequest(api.admin.rejectWithdrawal.method, url);
      if (!res.ok) throw new Error("Failed to reject withdrawal");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.allWithdrawals.path] });
      toast({ title: "Withdrawal Rejected" });
    },
  });
}

export function useAdminVerifyKyc() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (profileId: number) => {
      const url = buildUrl(api.admin.verifyKyc.path, { id: profileId });
      const res = await apiRequest(api.admin.verifyKyc.method, url);
      if (!res.ok) throw new Error("Failed to verify KYC");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.users.path] });
      toast({ title: "KYC Verified" });
    },
  });
}

export function useAdminRejectKyc() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (profileId: number) => {
      const url = buildUrl(api.admin.rejectKyc.path, { id: profileId });
      const res = await apiRequest(api.admin.rejectKyc.method, url);
      if (!res.ok) throw new Error("Failed to reject KYC");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.users.path] });
      toast({ title: "KYC Rejected" });
    },
  });
}

export { useAdminUsers as useAdminData };
