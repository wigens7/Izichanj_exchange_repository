import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type KycDocument } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useKycStatus() {
  return useQuery({
    queryKey: [api.kyc.status.path],
    queryFn: async () => {
      const res = await fetch(api.kyc.status.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch KYC status");
      // Could be null if no KYC submitted
      const data = await res.json();
      return api.kyc.status.responses[200].parse(data);
    },
  });
}

export function useUploadKyc() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { idDocumentUrl: string, idDocumentBackUrl: string, selfieUrl: string, idType?: string, idNumber?: string }) => {
      const res = await fetch(api.kyc.upload.path, {
        method: api.kyc.upload.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || "Failed to submit KYC");
      }
      return api.kyc.upload.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.kyc.status.path] });
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] }); // User object has kycStatus
      toast({ title: "KYC Submitted", description: "Your verification is under review. Please wait." });
    },
    onError: (err: Error) => {
      toast({ title: "Submission Failed", description: err.message, variant: "destructive" });
    },
  });
}
