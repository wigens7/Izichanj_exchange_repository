import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertTriangle, Upload, CheckCircle, Loader2, X, ImageIcon } from "lucide-react";

const REPORT_REASONS = [
  { value: "fraud", label: "Fraud / Scam" },
  { value: "impersonation", label: "Impersonation" },
  { value: "harassment", label: "Harassment or Threats" },
  { value: "fake_kyc", label: "Fake KYC Documents" },
  { value: "unauthorized_access", label: "Unauthorized Account Access" },
  { value: "money_laundering", label: "Suspected Money Laundering" },
  { value: "abusive_behavior", label: "Abusive Behavior" },
  { value: "other", label: "Other" },
];

const reportSchema = z.object({
  reportedIdentifier: z.string().min(1, "Required — enter email or reference ID"),
  reason: z.string().min(1, "Please select a reason"),
  description: z.string().min(20, "Please provide at least 20 characters of detail"),
  proofImageUrl: z.string().optional(),
});

type ReportForm = z.infer<typeof reportSchema>;

export default function ReportPage() {
  const { toast } = useToast();
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [proofPath, setProofPath] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ReportForm>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      reportedIdentifier: "",
      reason: "",
      description: "",
      proofImageUrl: "",
    },
  });

  const handleProofUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 10MB allowed.", variant: "destructive" });
      return;
    }
    setUploadingProof(true);
    try {
      const urlRes = await apiRequest("POST", "/api/reports/upload-url");
      const { uploadURL, objectPath } = await urlRes.json();
      await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      setProofPath(objectPath);
      form.setValue("proofImageUrl", objectPath);
      const reader = new FileReader();
      reader.onload = (e) => setProofPreview(e.target?.result as string);
      reader.readAsDataURL(file);
      toast({ title: "Proof uploaded", description: "Screenshot attached successfully." });
    } catch {
      toast({ title: "Upload failed", description: "Could not upload screenshot. Try again.", variant: "destructive" });
    } finally {
      setUploadingProof(false);
    }
  };

  const submitMutation = useMutation({
    mutationFn: async (data: ReportForm) => {
      const res = await apiRequest("POST", "/api/reports", { ...data, proofImageUrl: proofPath });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      form.reset();
      setProofPreview(null);
      setProofPath(null);
    },
    onError: (e: Error) => {
      toast({ title: "Submission failed", description: e.message, variant: "destructive" });
    },
  });

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto space-y-6 animate-in fade-in duration-300">
        <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10">
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-4">
            <CheckCircle className="w-14 h-14 text-green-500" />
            <div>
              <h2 className="text-xl font-bold text-green-700 dark:text-green-400">Report Submitted</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Our admin team has been notified and will review your report. Thank you for helping keep Izichanj safe.
              </p>
            </div>
            <Button variant="outline" onClick={() => setSubmitted(false)} data-testid="button-report-again">
              Submit Another Report
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-display font-bold" data-testid="text-report-title">Report a User</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Help us keep the platform safe. All reports are reviewed by our admin team.
        </p>
      </div>

      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
        <CardContent className="pt-4 pb-3 flex gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            False reports are taken seriously and may result in account action. Only submit genuine concerns.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Report Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((d) => submitMutation.mutate(d))} className="space-y-5">
              <FormField
                control={form.control}
                name="reportedIdentifier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User to Report</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Email address or reference ID (e.g. REF-XXXXXX)"
                        data-testid="input-reported-identifier"
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">Enter the email or reference ID of the user you're reporting</p>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for Report</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-report-reason">
                          <SelectValue placeholder="Select a reason…" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {REPORT_REASONS.map((r) => (
                          <SelectItem key={r.value} value={r.value} data-testid={`option-reason-${r.value}`}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={5}
                        placeholder="Describe what happened in detail. Include dates, amounts, and any relevant context…"
                        data-testid="textarea-report-description"
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">{field.value?.length ?? 0} / 1000 characters</p>
                  </FormItem>
                )}
              />

              {/* Proof Upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Proof Screenshot (optional)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleProofUpload(e.target.files[0])}
                  data-testid="input-proof-file"
                />
                {proofPreview ? (
                  <div className="relative rounded-lg border overflow-hidden">
                    <img src={proofPreview} alt="Proof" className="w-full max-h-48 object-cover" />
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="absolute top-2 right-2"
                      onClick={() => { setProofPreview(null); setProofPath(null); form.setValue("proofImageUrl", ""); }}
                      data-testid="button-remove-proof"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingProof}
                    className="w-full border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                    data-testid="button-upload-proof"
                  >
                    {uploadingProof ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <ImageIcon className="w-6 h-6" />
                    )}
                    <span className="text-sm">{uploadingProof ? "Uploading…" : "Click to upload screenshot"}</span>
                    <span className="text-xs">PNG, JPG up to 10MB</span>
                  </button>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={submitMutation.isPending}
                data-testid="button-submit-report"
              >
                {submitMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" />Submit Report</>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
