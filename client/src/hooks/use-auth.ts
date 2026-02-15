import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import { type ProfileInfoInput } from "@shared/schema";

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
    mutationFn: async (data: { identifier: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Login failed");
      }
      return res.json();
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(["/api/user"], profile);
      if (!profile.needsVerification) {
        toast({ title: "Welcome back!", description: `Signed in as ${profile.fullName}` });
      }
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
      toast({ title: "Check your WhatsApp", description: "We sent a 6-digit verification code" });
    },
    onError: (error: Error) => {
      toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useVerifyEmail() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest("POST", "/api/auth/verify-email", { code });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Verification failed");
      }
      return res.json();
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(["/api/user"], profile);
      toast({ title: "Email verified!", description: `Welcome to Izichanj, ${profile.fullName}` });
    },
    onError: (error: Error) => {
      toast({ title: "Verification failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useResendOtp() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/resend-otp");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to resend code");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Code resent", description: "Check your WhatsApp for the new code" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useLanguage();

  return useMutation({
    mutationFn: async (data: ProfileInfoInput) => {
      const res = await apiRequest("PATCH", "/api/user/profile", data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update profile");
      }
      return res.json();
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(["/api/user"], profile);
      toast({ title: t.profile.profileSaved || "Profile Saved", description: "Your information has been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const user = queryClient.getQueryData(["/api/user"]) as any;
      if (user?.email) {
        localStorage.setItem("izichanj_last_email", user.email);
      }
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      queryClient.clear();
      toast({ title: "Logged out", description: "See you next time." });
    },
  });
}
