import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type InsertDeposit, type InsertWithdrawal, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

// ================== DEPOSITS ==================

export function useDeposits() {
  return useQuery({
    queryKey: [api.deposits.list.path],
    queryFn: async () => {
      const res = await fetch(api.deposits.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch deposits");
      return api.deposits.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateDeposit() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertDeposit) => {
        // Coerce amount to number/string as needed by backend schema if it's decimal
      const res = await fetch(api.deposits.create.path, {
        method: api.deposits.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to create deposit");
      return api.deposits.create.responses[201].parse(await res.json());
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

// ================== WITHDRAWALS ==================

export function useWithdrawals() {
  return useQuery({
    queryKey: [api.withdrawals.list.path],
    queryFn: async () => {
      const res = await fetch(api.withdrawals.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch withdrawals");
      return api.withdrawals.list.responses[200].parse(await res.json());
    },
  });
}

export function useRequestWithdrawalOtp() {
    const { toast } = useToast();
    return useMutation({
        mutationFn: async () => {
            const res = await fetch(api.withdrawals.requestOtp.path, {
                method: api.withdrawals.requestOtp.method,
                credentials: "include"
            });
            if (!res.ok) throw new Error("Failed to send OTP");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "OTP Sent", description: "Check your email for the withdrawal code." });
        },
        onError: (err: Error) => {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        }
    });
}

export function useCreateWithdrawal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertWithdrawal & { otp: string }) => {
      const res = await fetch(api.withdrawals.create.path, {
        method: api.withdrawals.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        if(res.status === 401) throw new Error("Invalid OTP");
        throw new Error("Failed to create withdrawal");
      }
      return api.withdrawals.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.withdrawals.list.path] });
      toast({ title: "Withdrawal Requested", description: "Validated within 15–20 minutes." });
    },
    onError: (err: Error) => {
      toast({ title: "Withdrawal Failed", description: err.message, variant: "destructive" });
    },
  });
}

// ================== ADMIN ==================

export function useAdminData() {
    return useQuery({
        queryKey: [api.admin.users.path],
        queryFn: async () => {
            const res = await fetch(api.admin.users.path, { credentials: "include" });
            if (!res.ok) throw new Error("Failed to fetch users");
            return api.admin.users.responses[200].parse(await res.json());
        }
    });
}

export function useAdminUpdateBalance() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    
    return useMutation({
        mutationFn: async ({ id, balance }: { id: number, balance: number }) => {
            const url = buildUrl(api.admin.updateBalance.path, { id });
            const res = await fetch(url, {
                method: api.admin.updateBalance.method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ balance }),
                credentials: "include"
            });
            if (!res.ok) throw new Error("Failed to update balance");
            return api.admin.updateBalance.responses[200].parse(await res.json());
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [api.admin.users.path] });
            toast({ title: "Success", description: "User balance updated." });
        }
    });
}

export function useAdminApproveDeposit() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    
    return useMutation({
        mutationFn: async (id: number) => {
            const url = buildUrl(api.admin.approveDeposit.path, { id });
            const res = await fetch(url, { method: api.admin.approveDeposit.method, credentials: "include" });
            if(!res.ok) throw new Error("Failed");
            return api.admin.approveDeposit.responses[200].parse(await res.json());
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [api.deposits.list.path] }); // Technically admin usually views all deposits, but reusing cache key for now or add admin specific keys
            toast({ title: "Deposit Approved" });
        }
    });
}
// Add other admin hooks similarly...
