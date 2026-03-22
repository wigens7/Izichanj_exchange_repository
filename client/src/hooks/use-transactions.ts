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
    mutationFn: async (data: { amount: string; currency: string; withdrawMethod: string; phoneNumber?: string; qrCodeUrl?: string; otp: string }) => {
      const res = await apiRequest(api.withdrawals.create.method, api.withdrawals.create.path, data);
      if (!res.ok) {
        if (res.status === 401) throw new Error("Invalid OTP");
        throw new Error("Failed to create withdrawal");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.withdrawals.list.path] });
      toast({ title: "Withdrawal Requested", description: "Validated within 15-20 minutes." });
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
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, "_blank");
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.users.path] });
      toast({ title: "Balance updated", description: "Receipt opened in a new tab." });
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
