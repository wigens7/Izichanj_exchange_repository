import { useUser, useUpdateProfile, useLogout } from "@/hooks/use-auth";
import { useKycStatus, useUploadKyc } from "@/hooks/use-kyc";
import { useUpload } from "@/hooks/use-upload";
import { compressImage } from "@/lib/image-compress";
import { formatDate } from "@/lib/dateUtils";
import { useLanguage, languageNames, type Language } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { Loader2, UploadCloud, CheckCircle2, Globe, Clock, User, UserCheck, Copy, Check, FileText, MapPin, LogOut, Users, DollarSign, Share2, HelpCircle, Smartphone, Download, Mail } from "lucide-react";
import { InstallPwaButton } from "@/components/install-pwa-button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { profileInfoSchema, type ProfileInfoInput } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function ProfilePage() {
  const { data: user } = useUser();
  const { data: kycStatus } = useKycStatus();
  const { mutate: submitKyc, isPending: isSubmitting } = useUploadKyc();
  const { mutate: updateProfile, isPending: isUpdatingProfile } = useUpdateProfile();
  const { mutate: logout } = useLogout();
  const { language, setLanguage, t } = useLanguage();
  
  const { toast } = useToast();
  const { uploadFile, isUploading } = useUpload();
  const [refCopied, setRefCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const qc = useQueryClient();

  const { data: referralStats, isLoading: referralLoading } = useQuery<any>({
    queryKey: ["/api/referral/stats"],
    enabled: !!user?.affiliateEnabled,
  });

  const payoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/referral/request-payout"),
    onSuccess: () => {
      toast({ title: "Payout Requested", description: "Your referral balance will be transferred after admin review." });
      qc.invalidateQueries({ queryKey: ["/api/referral/stats"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  
  const [idUrl, setIdUrl] = useState<string>("");
  const [idBackUrl, setIdBackUrl] = useState<string>("");
  const [selfieUrl, setSelfieUrl] = useState<string>("");
  const [idType, setIdType] = useState<string>("");
  const [idNumber, setIdNumber] = useState<string>("");
  const [addressLine1, setAddressLine1] = useState<string>("");

  const form = useForm<ProfileInfoInput>({
    resolver: zodResolver(profileInfoSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      dateOfBirth: user?.dateOfBirth || "",
      country: user?.country || "",
      city: user?.city || "",
      phone: user?.phone || "",
    }
  });

  useEffect(() => {
    if (user) {
      form.reset({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        dateOfBirth: user.dateOfBirth || "",
        country: user.country || "",
        city: user.city || "",
        phone: user.phone || "",
      });
    }
  }, [user, form]);

  if (!user) return null;

  const isProfileComplete = user.firstName && user.lastName && user.dateOfBirth && user.country && user.city && user.phone;
  const canEdit = !!user.canEditProfile;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'id' | 'id-back' | 'selfie') => {
    const raw = e.target.files?.[0];
    if (!raw) return;

    // Compress ID photos to stay under 1.5 MB — Strowallet rejects larger images
    let file = raw;
    const MAX_BYTES = 1.5 * 1024 * 1024;
    if (raw.size > MAX_BYTES && raw.type.startsWith("image/")) {
      try {
        toast({ title: t.profile?.compressingImage || "Optimising image…", description: t.profile?.compressingDesc || "Reducing file size for compatibility." });
        file = await compressImage(raw, MAX_BYTES);
      } catch {
        toast({ title: "Compression failed", description: "Using original file. Upload may be slower.", variant: "destructive" });
      }
    }

    const res = await uploadFile(file);
    if (res) {
        if (type === 'id') setIdUrl(res.objectPath);
        else if (type === 'id-back') setIdBackUrl(res.objectPath);
        else setSelfieUrl(res.objectPath);
    }
  };

  const handleSubmitKyc = () => {
    if (idUrl && idBackUrl && selfieUrl && idType && idNumber && addressLine1) {
        submitKyc({ idDocumentUrl: idUrl, idDocumentBackUrl: idBackUrl, selfieUrl: selfieUrl, idType, idNumber, addressLine1 });
    }
  };

  const onProfileSubmit = (data: ProfileInfoInput) => {
    updateProfile(data);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-display font-bold">{t.nav.profileKyc}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your account information and identity verification</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="w-16 h-16 rounded-md bg-primary/10 text-primary text-2xl font-bold flex items-center justify-center mx-auto mb-3">
                  {user.fullName.charAt(0)}
                </div>
                <h3 className="font-display font-bold text-lg">{user.fullName}</h3>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>

              <div className="mt-5 space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">{t.profile.status}</span>
                  <StatusBadge status={user.kycStatus} />
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">{t.profile.joined}</span>
                  <span className="text-sm font-medium">
                    {formatDate(user.createdAt)}
                  </span>
                </div>
                <div className="py-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{t.profile.language}</span>
                  </div>
                  <Select value={language} onValueChange={(val) => setLanguage(val as Language)}>
                    <SelectTrigger data-testid="select-language">
                      <SelectValue placeholder={t.profile.selectLanguage} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en" data-testid="option-lang-en">{languageNames.en}</SelectItem>
                      <SelectItem value="fr" data-testid="option-lang-fr">{languageNames.fr}</SelectItem>
                      <SelectItem value="ht" data-testid="option-lang-ht">{languageNames.ht}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {user.referenceId && (
                <div className="mt-4 pt-3 border-t border-border">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">{t.profile.referenceId}</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono bg-muted px-3 py-2 rounded-md" data-testid="text-reference-id">{user.referenceId}</code>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(user.referenceId!);
                        setRefCopied(true);
                        toast({ title: t.profile.copied, description: t.profile.copiedDesc });
                        setTimeout(() => setRefCopied(false), 2000);
                      }}
                      data-testid="button-copy-reference-id"
                    >
                      {refCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5">{t.profile.referenceIdDescription}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                <CardTitle className="text-base">{t.profile.personalInfoTitle}</CardTitle>
              </div>
              <CardDescription className="text-xs">{t.profile.personalInfoDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              {canEdit && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
                  <span className="text-base">✏️</span>
                  <span>One-time edit unlocked — update your information and save to lock it again.</span>
                </div>
              )}
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onProfileSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.profile.firstName}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-first-name" disabled={!!user.firstName && !canEdit} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.profile.lastName}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-last-name" disabled={!!user.lastName && !canEdit} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="dateOfBirth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.profile.dateOfBirth}</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-dob" disabled={!!user.dateOfBirth && !canEdit} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.withdraw.phoneNumber}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-profile-phone" disabled={!!user.phone && !canEdit} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.profile.country}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-country" disabled={!!user.country && !canEdit} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.profile.city}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-city" disabled={!!user.city && !canEdit} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  {(!isProfileComplete || canEdit) && (
                    <Button 
                      type="submit" 
                      className="w-full primary-gradient" 
                      disabled={isUpdatingProfile}
                      data-testid="button-save-profile"
                    >
                      {isUpdatingProfile ? <Loader2 className="animate-spin mr-2" /> : <UserCheck className="w-4 h-4 mr-2" />}
                      {t.profile.saveProfile}
                    </Button>
                  )}
                </form>
              </Form>
            </CardContent>
          </Card>

          {user.kycStatus === 'verified' ? null : (
            <Card className={!isProfileComplete ? "opacity-50 pointer-events-none" : ""}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t.profile.kycTitle}</CardTitle>
                <CardDescription className="text-xs">
                  {!isProfileComplete ? t.profile.profileIncomplete : t.profile.kycDescription}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {user.kycStatus === 'pending' ? (
                  <div className="text-center py-8 rounded-md bg-amber-500/5 border border-amber-200 dark:border-amber-800/50">
                    <div className="w-12 h-12 rounded-md bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
                      <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <h3 className="text-base font-bold text-amber-700 dark:text-amber-400">{t.profile.underReview}</h3>
                    <p className="text-sm text-amber-600/80 dark:text-amber-400/60 mt-1 max-w-sm mx-auto">{t.profile.underReviewDescription}</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <UploadZone
                        label={t.profile.idFront}
                        uploaded={!!idUrl}
                        uploadedLabel={t.profile.uploaded}
                        uploadLabel={t.profile.clickToUpload}
                        inputId="id-upload"
                        testId="input-id-front-upload"
                        statusTestId="status-id-front-uploaded"
                        isUploading={isUploading}
                        onChange={(e) => handleFileUpload(e, 'id')}
                      />
                      <UploadZone
                        label={t.profile.idBack}
                        uploaded={!!idBackUrl}
                        uploadedLabel={t.profile.uploaded}
                        uploadLabel={t.profile.clickToUpload}
                        inputId="id-back-upload"
                        testId="input-id-back-upload"
                        statusTestId="status-id-back-uploaded"
                        isUploading={isUploading}
                        onChange={(e) => handleFileUpload(e, 'id-back')}
                      />
                      <UploadZone
                        label={t.profile.selfie}
                        uploaded={!!selfieUrl}
                        uploadedLabel={t.profile.uploaded}
                        uploadLabel={t.profile.clickToUpload}
                        inputId="selfie-upload"
                        testId="input-selfie-upload"
                        statusTestId="status-selfie-uploaded"
                        isUploading={isUploading}
                        onChange={(e) => handleFileUpload(e, 'selfie')}
                      />
                    </div>

                    {isUploading && <p className="text-center text-sm text-muted-foreground animate-pulse">{t.profile.uploading}</p>}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1.5">
                        <Label className="text-sm">ID Type</Label>
                        <Select value={idType} onValueChange={setIdType}>
                          <SelectTrigger data-testid="select-kyc-id-type">
                            <SelectValue placeholder="Select ID type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="passport">Passport</SelectItem>
                            <SelectItem value="national_id">National ID Card</SelectItem>
                            <SelectItem value="driver_license">Driver's License</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">ID Number</Label>
                        <div className="relative">
                          <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            placeholder="e.g. A12345678"
                            value={idNumber}
                            onChange={e => setIdNumber(e.target.value)}
                            className="pl-9"
                            data-testid="input-kyc-id-number"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-sm">Address Line 1</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="e.g. 123 Main Street, Port-au-Prince"
                          value={addressLine1}
                          onChange={e => setAddressLine1(e.target.value)}
                          className="pl-9"
                          data-testid="input-kyc-address"
                        />
                      </div>
                    </div>

                    <Button 
                      className="w-full primary-gradient" 
                      disabled={!idUrl || !idBackUrl || !selfieUrl || !idType || !idNumber || !addressLine1 || isSubmitting || isUploading || !isProfileComplete}
                      onClick={handleSubmitKyc}
                      data-testid="button-submit-kyc"
                    >
                      {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : t.profile.submitVerification}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Referral / Affiliate Panel ── */}
      {user.affiliateEnabled && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">Referral Program</CardTitle>
            </div>
            <CardDescription className="text-xs">Earn USDT by inviting friends to Izichanj</CardDescription>
          </CardHeader>
          <CardContent>
            {referralLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="space-y-5">
                {/* Referral code */}
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Your Referral Code</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 font-mono text-lg font-bold tracking-widest" data-testid="text-referral-code">
                      {referralStats?.referralCode || "—"}
                    </code>
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => {
                        if (referralStats?.referralCode) {
                          navigator.clipboard.writeText(referralStats.referralCode);
                          setCodeCopied(true);
                          toast({ title: "Copied!", description: "Referral code copied to clipboard." });
                          setTimeout(() => setCodeCopied(false), 2000);
                        }
                      }}
                      data-testid="button-copy-referral-code"
                    >
                      {codeCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Share this code with friends. They enter it during registration.</p>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-border bg-muted/20 p-3 text-center">
                    <Users className="w-4 h-4 text-primary mx-auto mb-1" />
                    <p className="text-xl font-bold">{referralStats?.referrals?.length ?? 0}</p>
                    <p className="text-[11px] text-muted-foreground">Referrals</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-3 text-center">
                    <DollarSign className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                    <p className="text-xl font-bold">${(referralStats?.totalEarned ?? 0).toFixed(2)}</p>
                    <p className="text-[11px] text-muted-foreground">Total Earned</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-3 text-center">
                    <DollarSign className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                    <p className="text-xl font-bold">${(referralStats?.referralBalance ?? 0).toFixed(2)}</p>
                    <p className="text-[11px] text-muted-foreground">Balance</p>
                  </div>
                </div>

                {/* Commission guide */}
                <div className="rounded-lg border border-border/60 bg-primary/5 p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-semibold text-foreground text-sm mb-1.5">Commission Structure</p>
                  <div className="flex justify-between"><span>Friend registers</span><span className="font-mono font-bold text-foreground">+$0.05</span></div>
                  <div className="flex justify-between"><span>Friend completes KYC</span><span className="font-mono font-bold text-foreground">+$0.25</span></div>
                  <div className="flex justify-between"><span>Friend deposits ≥ $50 (first time)</span><span className="font-mono font-bold text-foreground">+$2.00</span></div>
                </div>

                {/* Payout request */}
                <div className="flex items-center gap-3">
                  <Button
                    className="primary-gradient"
                    disabled={payoutMutation.isPending || (referralStats?.referralBalance ?? 0) < 1 || (referralStats?.pendingPayout ?? 0) > 0}
                    onClick={() => payoutMutation.mutate()}
                    data-testid="button-request-referral-payout"
                  >
                    {payoutMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Request Payout
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {(referralStats?.pendingPayout ?? 0) > 0
                      ? `Payout pending: $${referralStats.pendingPayout.toFixed(2)}`
                      : "Min. $1.00 to request"}
                  </span>
                </div>

                {/* Referral list */}
                {referralStats?.referrals?.length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Your Referrals</p>
                    <div className="space-y-1.5">
                      {referralStats.referrals.map((r: any) => (
                        <div key={r.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0" data-testid={`row-referral-${r.id}`}>
                          <div>
                            <span className="font-medium">{r.full_name}</span>
                            <StatusBadge status={r.kyc_status} className="ml-2 text-[10px]" />
                          </div>
                          <span className="font-mono text-emerald-600 dark:text-emerald-400">+${Number(r.earned_from_this).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Payout history */}
                {referralStats?.payoutHistory?.length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Payout History</p>
                    <div className="space-y-1.5">
                      {referralStats.payoutHistory.map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0" data-testid={`row-payout-${p.id}`}>
                          <span className="text-muted-foreground">{formatDate(p.created_at)}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono">${Number(p.amount).toFixed(2)}</span>
                            <StatusBadge status={p.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Newsletter ── */}
      <NewsletterSection />

      {/* ── Mobile App ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-primary" /> Mobile App
          </CardTitle>
          <CardDescription className="text-xs">
            Install Izichanj on your phone for a faster, app-like experience with push notifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-3">
            <InstallPwaButton className="w-full" />
            <Button asChild variant="default" className="w-full" data-testid="button-download-apk">
              <a href="/api/download-app" target="_blank" rel="noopener noreferrer">
                <Download className="w-4 h-4 mr-2" /> Download Android APK
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            iPhone users: open this site in Safari, tap the Share button and choose "Add to Home Screen".
          </p>
        </CardContent>
      </Card>

      {/* ── FAQ Section ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-primary" /> Frequently Asked Questions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="space-y-1" data-testid="faq-accordion">
            {[
              { q: "How do I deposit USDT?", a: "Go to the Deposit page, choose TRC20 or BEP20, enter the amount, and send USDT to the generated address. Your balance is credited automatically after confirmation." },
              { q: "What are the deposit fees?", a: "TRC20: $2.50 fee, minimum $5.00. BEP20: $0.25 fee, minimum $1.00." },
              { q: "How do I withdraw USDT?", a: "Go to Withdraw, enter a TRC20 wallet address, amount (min $10, max $10,000/day), and your 6-digit withdrawal PIN. A fixed $2.50 fee applies." },
              { q: "What is KYC and why is it required?", a: "KYC (Know Your Customer) verifies your identity. It is required to unlock all platform features including withdrawals and virtual cards. Upload your ID, selfie, and personal details on the Profile page." },
              { q: "How does the P2P Market work?", a: "Sellers post USDT listings with their preferred payment method and rate. Buyers place orders, send payment via the listed method, then mark it paid. The seller confirms receipt and releases USDT from escrow to the buyer." },
              { q: "How do virtual cards work?", a: "Apply for a virtual Visa card on the Virtual Cards page. Once approved, fund it with USDT and use it for online payments worldwide." },
              { q: "How do I send funds to another user?", a: "Use the Send Funds page and enter the recipient's reference ID, email, or phone number. Funds are transferred instantly." },
              { q: "What happens if I dispute a P2P trade?", a: "Either party can open a dispute. An admin will review the trade chat and evidence, then resolve the order. Funds remain in escrow during the dispute." },
            ].map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border border-border rounded-md px-3" data-testid={`faq-item-${i}`}>
                <AccordionTrigger className="text-sm font-medium py-3 hover:no-underline">{item.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground pb-3">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      <div className="flex justify-start pt-2">
        <Button
          variant="ghost"
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-2"
          onClick={() => logout()}
          data-testid="button-logout-profile"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

function UploadZone({ label, uploaded, uploadedLabel, uploadLabel, inputId, testId, statusTestId, isUploading, onChange }: {
  label: string; uploaded: boolean; uploadedLabel: string; uploadLabel: string;
  inputId: string; testId: string; statusTestId: string; isUploading: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <div className="border-2 border-dashed border-border rounded-md p-5 text-center">
        {uploaded ? (
          <div className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-2" data-testid={statusTestId}>
            <CheckCircle2 className="w-4 h-4" /> {uploadedLabel}
          </div>
        ) : (
          <>
            <Input 
              type="file" accept="image/*" className="hidden" id={inputId}
              data-testid={testId}
              onChange={onChange}
              disabled={isUploading}
            />
            <label htmlFor={inputId} className="cursor-pointer block">
              <UploadCloud className="w-6 h-6 mx-auto text-muted-foreground mb-1.5" />
              <span className="text-xs text-primary font-medium">{uploadLabel}</span>
            </label>
          </>
        )}
      </div>
    </div>
  );
}

function NewsletterSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ subscribed: boolean; subscribedAt: string | null }>({
    queryKey: ["/api/profile/newsletter"],
  });

  const subscribe = useMutation({
    mutationFn: () => apiRequest("POST", "/api/profile/newsletter/subscribe"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/profile/newsletter"] });
      toast({ title: "Subscribed!", description: "You'll receive our newsletter by email." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const unsubscribe = useMutation({
    mutationFn: () => apiRequest("POST", "/api/profile/newsletter/unsubscribe"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/profile/newsletter"] });
      toast({ title: "Unsubscribed", description: "You won't receive newsletter emails anymore." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isSubscribed = !!data?.subscribed;
  const pending = subscribe.isPending || unsubscribe.isPending;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="w-4 h-4 text-primary" /> Newsletter
        </CardTitle>
        <CardDescription className="text-xs">
          Get product updates, new features, and announcements from Izichanj by email.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : isSubscribed ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span data-testid="text-newsletter-status">You're subscribed</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => unsubscribe.mutate()}
              disabled={pending}
              data-testid="button-newsletter-unsubscribe"
            >
              {pending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              Unsubscribe
            </Button>
          </div>
        ) : (
          <Button
            className="w-full"
            onClick={() => subscribe.mutate()}
            disabled={pending}
            data-testid="button-newsletter-subscribe"
          >
            {pending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
            Subscribe to Newsletter
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
