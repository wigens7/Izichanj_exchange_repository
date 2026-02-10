import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useUser() {
  return useQuery({
    queryKey: ["/api/user"],
    queryFn: async () => {
      const res = await fetch("/api/user", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch user");
      return res.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Login failed");
      }
      return res.json();
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(["/api/user"], profile);
      toast({ title: "Welcome back!", description: `Signed in as ${profile.fullName}` });
    },
    onError: (error: Error) => {
      toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { fullName: string; email: string; password: string; confirmPassword: string }) => {
      const res = await apiRequest("POST", "/api/auth/register", data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Registration failed");
      }
      return res.json();
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(["/api/user"], profile);
      toast({ title: "Account created!", description: `Welcome to EASYCHANGE, ${profile.fullName}` });
    },
    onError: (error: Error) => {
      toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      queryClient.clear();
      toast({ title: "Logged out", description: "See you next time." });
    },
  });
}
