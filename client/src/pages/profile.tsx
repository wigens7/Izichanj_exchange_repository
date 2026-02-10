import { useUser } from "@/hooks/use-auth";
import { useKycStatus, useUploadKyc } from "@/hooks/use-kyc";
import { useUpload } from "@/hooks/use-upload";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";
import { Loader2, UploadCloud, CheckCircle2 } from "lucide-react";
import { useState } from "react";

export default function ProfilePage() {
  const { data: user } = useUser();
  const { data: kycStatus, isLoading } = useKycStatus();
  const { mutate: submitKyc, isPending: isSubmitting } = useUploadKyc();
  
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
    <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row gap-8">
            <div className="w-full md:w-1/3 space-y-6">
                <Card>
                    <CardHeader className="text-center">
                        <div className="w-24 h-24 rounded-full bg-primary/10 text-primary text-3xl font-bold flex items-center justify-center mx-auto mb-4">
                            {user.fullName.charAt(0)}
                        </div>
                        <CardTitle>{user.fullName}</CardTitle>
                        <CardDescription>{user.email}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center py-2 border-b">
                                <span className="text-sm text-muted-foreground">Status</span>
                                <StatusBadge status={user.kycStatus} />
                            </div>
                            <div className="flex justify-between items-center py-2 border-b">
                                <span className="text-sm text-muted-foreground">Joined</span>
                                <span className="text-sm font-medium">
                                    {new Date(user.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="w-full md:w-2/3">
                <Card>
                    <CardHeader>
                        <CardTitle>Identity Verification (KYC)</CardTitle>
                        <CardDescription>
                            Verify your identity to increase limits and enable withdrawals.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {user.kycStatus === 'verified' ? (
                            <div className="text-center py-10 space-y-4">
                                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                                    <CheckCircle2 className="w-8 h-8" />
                                </div>
                                <h3 className="text-xl font-bold text-emerald-700">You are verified!</h3>
                                <p className="text-muted-foreground">Your account has full access.</p>
                            </div>
                        ) : user.kycStatus === 'pending' ? (
                            <div className="text-center py-10 bg-amber-50 rounded-xl border border-amber-100">
                                <h3 className="text-lg font-bold text-amber-700">Verification Under Review</h3>
                                <p className="text-amber-600/80 mt-2">Please wait while our team reviews your documents.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>ID Card (Front)</Label>
                                        <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:bg-muted/50 transition-colors">
                                            {idUrl ? (
                                                <div className="text-sm text-emerald-600 flex items-center justify-center gap-2" data-testid="status-id-front-uploaded">
                                                    <CheckCircle2 className="w-4 h-4" /> Uploaded
                                                </div>
                                            ) : (
                                                <>
                                                    <Input 
                                                        type="file" 
                                                        accept="image/*" 
                                                        className="hidden" 
                                                        id="id-upload"
                                                        data-testid="input-id-front-upload"
                                                        onChange={(e) => handleFileUpload(e, 'id')}
                                                        disabled={isUploading}
                                                    />
                                                    <label htmlFor="id-upload" className="cursor-pointer block">
                                                        <UploadCloud className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                                                        <span className="text-sm text-primary font-medium">Click to upload</span>
                                                    </label>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>ID Card (Back)</Label>
                                        <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:bg-muted/50 transition-colors">
                                            {idBackUrl ? (
                                                <div className="text-sm text-emerald-600 flex items-center justify-center gap-2" data-testid="status-id-back-uploaded">
                                                    <CheckCircle2 className="w-4 h-4" /> Uploaded
                                                </div>
                                            ) : (
                                                <>
                                                    <Input 
                                                        type="file" 
                                                        accept="image/*" 
                                                        className="hidden" 
                                                        id="id-back-upload"
                                                        data-testid="input-id-back-upload"
                                                        onChange={(e) => handleFileUpload(e, 'id-back')}
                                                        disabled={isUploading}
                                                    />
                                                    <label htmlFor="id-back-upload" className="cursor-pointer block">
                                                        <UploadCloud className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                                                        <span className="text-sm text-primary font-medium">Click to upload</span>
                                                    </label>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Selfie with ID</Label>
                                        <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:bg-muted/50 transition-colors">
                                            {selfieUrl ? (
                                                <div className="text-sm text-emerald-600 flex items-center justify-center gap-2" data-testid="status-selfie-uploaded">
                                                    <CheckCircle2 className="w-4 h-4" /> Uploaded
                                                </div>
                                            ) : (
                                                <>
                                                    <Input 
                                                        type="file" 
                                                        accept="image/*" 
                                                        className="hidden" 
                                                        id="selfie-upload"
                                                        data-testid="input-selfie-upload"
                                                        onChange={(e) => handleFileUpload(e, 'selfie')}
                                                        disabled={isUploading}
                                                    />
                                                    <label htmlFor="selfie-upload" className="cursor-pointer block">
                                                        <UploadCloud className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                                                        <span className="text-sm text-primary font-medium">Click to upload</span>
                                                    </label>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                {isUploading && <p className="text-center text-sm text-muted-foreground animate-pulse">Uploading documents...</p>}

                                <Button 
                                    className="w-full primary-gradient" 
                                    disabled={!idUrl || !idBackUrl || !selfieUrl || isSubmitting || isUploading}
                                    onClick={handleSubmit}
                                    data-testid="button-submit-kyc"
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : "Submit for Verification"}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
  );
}
