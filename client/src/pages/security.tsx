import { useUser } from "@/hooks/use-auth";
import { useLanguage } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, ShieldCheck, ShieldOff, Fingerprint, Trash2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { startRegistration } from "@simplewebauthn/browser";

export default function SecurityPage() {
  const { data: user } = useUser();
  const { t } = useLanguage();
  const { toast } = useToast();

  const [setupData, setSetupData] = useState<{ secret: string; qrCode: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [showDisable, setShowDisable] = useState(false);

  const { data: webauthnCreds, isLoading: credsLoading } = useQuery<{ id: number; deviceName: string; createdAt: string }[]>({
    queryKey: ["/api/security/webauthn/credentials"],
  });

  const setup2FA = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/security/2fa/setup");
      return res.json();
    },
    onSuccess: (data: { secret: string; qrCode: string }) => {
      setSetupData(data);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const verify2FA = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/security/2fa/verify", { code: totpCode });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "2FA enabled successfully" });
      setSetupData(null);
      setTotpCode("");
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const disable2FA = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/security/2fa/disable", { code: disableCode });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "2FA disabled" });
      setShowDisable(false);
      setDisableCode("");
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const registerWebAuthn = useMutation({
    mutationFn: async () => {
      const optionsRes = await apiRequest("POST", "/api/security/webauthn/register-options");
      const options = await optionsRes.json();
      const credential = await startRegistration({ optionsJSON: options });
      const verifyRes = await apiRequest("POST", "/api/security/webauthn/register-verify", {
        credential,
        deviceName: "Fingerprint",
      });
      return verifyRes.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Fingerprint registered successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/security/webauthn/credentials"] });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const removeWebAuthn = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/security/webauthn/credentials/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Device removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/security/webauthn/credentials"] });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  if (!user) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-security-title">{t.security.title}</h1>
        <p className="text-muted-foreground mt-1">{t.security.description}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{t.security.twoFactorAuth}</CardTitle>
              <CardDescription>{t.security.twoFactorDescription}</CardDescription>
            </div>
          </div>
          <Badge variant={user.twoFactorEnabled ? "default" : "secondary"} data-testid="badge-2fa-status">
            {user.twoFactorEnabled ? (
              <><ShieldCheck className="w-3 h-3 mr-1" />{t.security.twoFactorEnabled}</>
            ) : (
              <><ShieldOff className="w-3 h-3 mr-1" />{t.security.twoFactorDisabled}</>
            )}
          </Badge>
        </CardHeader>
        <CardContent>
          {user.twoFactorEnabled ? (
            <div className="space-y-4">
              {showDisable ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">{t.security.disableConfirm}</p>
                  <Input
                    placeholder="000000"
                    maxLength={6}
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
                    data-testid="input-disable-2fa-code"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      onClick={() => disable2FA.mutate()}
                      disabled={disableCode.length !== 6 || disable2FA.isPending}
                      data-testid="button-confirm-disable-2fa"
                    >
                      {disable2FA.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      {t.security.confirmDisable}
                    </Button>
                    <Button variant="outline" onClick={() => { setShowDisable(false); setDisableCode(""); }} data-testid="button-cancel-disable-2fa">
                      {t.security.cancel}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="destructive" onClick={() => setShowDisable(true)} data-testid="button-disable-2fa">
                  {t.security.disable2FA}
                </Button>
              )}
            </div>
          ) : setupData ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t.security.scanQRCode}</p>
              <div className="flex justify-center">
                <img src={setupData.qrCode} alt="2FA QR Code" className="w-48 h-48 rounded-lg border" data-testid="img-2fa-qrcode" />
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">{t.security.manualKey}</p>
                <code className="text-xs bg-muted px-2 py-1 rounded font-mono select-all" data-testid="text-2fa-secret">{setupData.secret}</code>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">{t.security.enterCode}</p>
                <Input
                  placeholder="000000"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                  data-testid="input-verify-2fa-code"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => verify2FA.mutate()}
                    disabled={totpCode.length !== 6 || verify2FA.isPending}
                    data-testid="button-verify-2fa"
                  >
                    {verify2FA.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {t.security.verify}
                  </Button>
                  <Button variant="outline" onClick={() => { setSetupData(null); setTotpCode(""); }} data-testid="button-cancel-2fa-setup">
                    {t.security.cancel}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Button onClick={() => setup2FA.mutate()} disabled={setup2FA.isPending} data-testid="button-enable-2fa">
              {setup2FA.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
              {t.security.enable2FA}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Fingerprint className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{t.security.fingerprint}</CardTitle>
              <CardDescription>{t.security.fingerprintDescription}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => registerWebAuthn.mutate()}
            disabled={registerWebAuthn.isPending}
            data-testid="button-register-fingerprint"
          >
            {registerWebAuthn.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Fingerprint className="w-4 h-4 mr-2" />}
            {t.security.registerFingerprint}
          </Button>

          <div>
            <h4 className="text-sm font-medium mb-2">{t.security.registeredDevices}</h4>
            {credsLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : webauthnCreds && webauthnCreds.length > 0 ? (
              <div className="space-y-2">
                {webauthnCreds.map((cred) => (
                  <div key={cred.id} className="flex items-center justify-between p-3 rounded-lg border" data-testid={`device-${cred.id}`}>
                    <div className="flex items-center gap-2">
                      <Fingerprint className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{cred.deviceName}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(cred.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeWebAuthn.mutate(cred.id)}
                      disabled={removeWebAuthn.isPending}
                      data-testid={`button-remove-device-${cred.id}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground" data-testid="text-no-devices">{t.security.noDevices}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
