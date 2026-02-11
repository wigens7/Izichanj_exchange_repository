import { useUser } from "@/hooks/use-auth";
import { useKycStatus, useUploadKyc } from "@/hooks/use-kyc";
import { useUpload } from "@/hooks/use-upload";
import { useLanguage, languageNames, type Language } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { Loader2, UploadCloud, CheckCircle2, Globe, Clock } from "lucide-react";
import { useState } from "react";

export default function ProfilePage() {
  const { data: user } = useUser();
  const { data: kycStatus, isLoading } = useKycStatus();
  const { mutate: submitKyc, isPending: isSubmitting } = useUploadKyc();
  const { language, setLanguage, t } = useLanguage();
  
  const { uploadFile, isUploading } = useUpload();
  
  const [idUrl, setIdUrl] = useState<string>("");
  const [idBackUrl, setIdBackUrl] = useState<string>("");
  const [selfieUrl, setSelfieUrl] = useState<string>("");

  if (!user) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'id' | 'id-back' | 'selfie') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const res = await uploadFile(file);
    if (res) {
        if (type === 'id') setIdUrl(res.objectPath);
        else if (type === 'id-back') setIdBackUrl(res.objectPath);
        else setSelfieUrl(res.objectPath);
    }
  };

  const handleSubmit = () => {
    if (idUrl && idBackUrl && selfieUrl) {
        submitKyc({ idDocumentUrl: idUrl, idDocumentBackUrl: idBackUrl, selfieUrl: selfieUrl });
    }
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
                    {new Date(user.createdAt).toLocaleDateString()}
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
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {user.kycStatus === 'verified' ? null : (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t.profile.kycTitle}</CardTitle>
                <CardDescription className="text-xs">{t.profile.kycDescription}</CardDescription>
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

                    <Button 
                      className="w-full primary-gradient" 
                      disabled={!idUrl || !idBackUrl || !selfieUrl || isSubmitting || isUploading}
                      onClick={handleSubmit}
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
