import { useUser } from "@/hooks/use-auth";
import { formatDate } from "@/lib/dateUtils";
import { useLanguage } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, ShieldCheck, ShieldOff, Fingerprint, Trash2, KeyRound, Lock } from "lucide-react";
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
  const [pinDigits, setPinDigits] = useState(["", "", "", ""]);
  const [pinPassword, setPinPassword] = useState("");
  const [showPinSetup, setShowPinSetup] = useState(false);

  // Withdrawal PIN state
  const [wPinDigits, setWPinDigits] = useState(["", "", "", "", "", ""]);
  const [wPinPassword, setWPinPassword] = useState("");
  const [showWPinSetup, setShowWPinSetup] = useState(false);

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

  const hasPin = !!(user as any)?.pinHash;

  const setPin = useMutation({
    mutationFn: async () => {
      const pin = pinDigits.join("");
      const res = await apiRequest("POST", "/api/security/pin/set", { pin, password: pinPassword });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t.security.pinSetSuccess || "PIN Set", description: t.security.pinSetSuccessDesc || "You can now use your PIN to sign in quickly." });
      setPinDigits(["", "", "", ""]);
      setPinPassword("");
      setShowPinSetup(false);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const removePin = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/security/pin/remove");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t.security.pinRemoved || "PIN Removed", description: t.security.pinRemovedDesc || "PIN login has been disabled." });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
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

  const { data: wPinStatus, refetch: refetchWPinStatus } = useQuery<{ hasWithdrawalPin: boolean }>({
    queryKey: ["/api/security/withdrawal-pin/status"],
    enabled: !!user,
  });

  const setWithdrawalPin = useMutation({
    mutationFn: async () => {
      const pin = wPinDigits.join("");
      const res = await apiRequest("POST", "/api/security/withdrawal-pin/set", { pin, password: wPinPassword });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Withdrawal PIN Set", description: "Your 6-digit withdrawal authorization PIN is now active." });
      setWPinDigits(["", "", "", "", "", ""]);
      setWPinPassword("");
      setShowWPinSetup(false);
      refetchWPinStatus();
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  if (!user) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-2xl">
      <div>
        <h1 className="text-2xl font-display font-bold" data-testid="text-security-title">{t.security.title}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t.security.description}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{t.security.twoFactorAuth}</CardTitle>
              <CardDescription className="text-xs">{t.security.twoFactorDescription}</CardDescription>
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
            <div className="space-y-3">
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
                <img src={setupData.qrCode} alt="2FA QR Code" className="w-44 h-44 rounded-md border" data-testid="img-2fa-qrcode" />
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">{t.security.manualKey}</p>
                <code className="text-xs bg-muted px-2 py-1 rounded-md font-mono select-all" data-testid="text-2fa-secret">{setupData.secret}</code>
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
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center">
              <Fingerprint className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{t.security.fingerprint}</CardTitle>
              <CardDescription className="text-xs">{t.security.fingerprintDescription}</CardDescription>
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
                  <div key={cred.id} className="flex items-center justify-between gap-2 p-3 rounded-md border border-border" data-testid={`device-${cred.id}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <Fingerprint className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm font-medium truncate">{cred.deviceName}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatDate(cred.createdAt)}
                      </span>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeWebAuthn.mutate(cred.id)}
                      disabled={removeWebAuthn.isPending}
                      data-testid={`button-remove-device-${cred.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center">
              <KeyRound className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{t.security.pinLogin || "PIN Login"}</CardTitle>
              <CardDescription className="text-xs">{t.security.pinDescription || "Set a 4-digit PIN to quickly sign in after being logged out."}</CardDescription>
            </div>
          </div>
          <Badge variant={hasPin ? "default" : "secondary"} data-testid="badge-pin-status">
            {hasPin ? t.security.pinEnabled || "Enabled" : t.security.pinDisabledBadge || "Disabled"}
          </Badge>
        </CardHeader>
        <CardContent>
          {hasPin ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t.security.pinActive || "Your PIN is active. You can use it to sign in quickly."}</p>
              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={() => { setShowPinSetup(true); }}
                  variant="outline"
                  data-testid="button-change-pin"
                >
                  <KeyRound className="w-4 h-4 mr-2" />
                  {t.security.changePin || "Change PIN"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => removePin.mutate()}
                  disabled={removePin.isPending}
                  data-testid="button-remove-pin"
                >
                  {removePin.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  {t.security.removePin || "Remove PIN"}
                </Button>
              </div>
            </div>
          ) : !showPinSetup ? (
            <Button onClick={() => setShowPinSetup(true)} data-testid="button-setup-pin">
              <KeyRound className="w-4 h-4 mr-2" />
              {t.security.setupPin || "Set Up PIN"}
            </Button>
          ) : null}

          {showPinSetup && (
            <div className="space-y-4 mt-2">
              <div>
                <p className="text-sm font-medium mb-2">{t.security.enterPin || "Enter a 4-digit PIN"}</p>
                <div className="flex gap-3 justify-center">
                  {pinDigits.map((digit, i) => (
                    <Input
                      key={i}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      className="w-12 h-12 text-center text-lg font-bold"
                      data-testid={`input-pin-digit-${i}`}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        const newDigits = [...pinDigits];
                        newDigits[i] = val;
                        setPinDigits(newDigits);
                        if (val && i < 3) {
                          const next = e.target.parentElement?.querySelector(`[data-testid="input-pin-digit-${i + 1}"]`) as HTMLInputElement;
                          next?.focus();
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" && !pinDigits[i] && i > 0) {
                          const prev = (e.target as HTMLElement).parentElement?.querySelector(`[data-testid="input-pin-digit-${i - 1}"]`) as HTMLInputElement;
                          prev?.focus();
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">{t.security.confirmPassword || "Confirm your password"}</p>
                <Input
                  type="password"
                  placeholder={t.security.passwordPlaceholder || "Enter your password"}
                  value={pinPassword}
                  onChange={(e) => setPinPassword(e.target.value)}
                  data-testid="input-pin-password"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setPin.mutate()}
                  disabled={pinDigits.join("").length !== 4 || !pinPassword || setPin.isPending}
                  data-testid="button-save-pin"
                >
                  {setPin.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {t.security.savePin || "Save PIN"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setShowPinSetup(false); setPinDigits(["", "", "", ""]); setPinPassword(""); }}
                  data-testid="button-cancel-pin"
                >
                  {t.security.cancel}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Withdrawal PIN */}
      <Card data-testid="card-withdrawal-pin">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-orange-500/10 flex items-center justify-center">
              <Lock className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <CardTitle className="text-base">Withdrawal Authorization PIN</CardTitle>
              <CardDescription className="text-xs">Set a 6-digit PIN to authorize every USDT withdrawal.</CardDescription>
            </div>
          </div>
          <Badge variant={wPinStatus?.hasWithdrawalPin ? "default" : "secondary"} data-testid="badge-withdrawal-pin-status">
            {wPinStatus?.hasWithdrawalPin ? "Active" : "Not Set"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {wPinStatus?.hasWithdrawalPin ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Your withdrawal PIN is active. Required every time you request a USDT withdrawal.</p>
              {showWPinSetup ? (
                <div className="space-y-3 pt-2">
                  <p className="text-sm font-medium">Enter a new 6-digit withdrawal PIN</p>
                  <div className="flex gap-2 justify-start">
                    {wPinDigits.map((digit, i) => (
                      <Input
                        key={i}
                        type="password"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        className="w-10 h-10 text-center text-lg p-0"
                        data-testid={`input-withdrawal-pin-digit-${i}`}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "").slice(0, 1);
                          const newDigits = [...wPinDigits];
                          newDigits[i] = val;
                          setWPinDigits(newDigits);
                          if (val && i < 5) {
                            const next = document.querySelector(`[data-testid="input-withdrawal-pin-digit-${i + 1}"]`) as HTMLInputElement;
                            next?.focus();
                          }
                        }}
                      />
                    ))}
                  </div>
                  <Input
                    type="password"
                    placeholder="Confirm your account password"
                    value={wPinPassword}
                    onChange={(e) => setWPinPassword(e.target.value)}
                    data-testid="input-withdrawal-pin-password"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setWithdrawalPin.mutate()}
                      disabled={wPinDigits.join("").length !== 6 || !wPinPassword || setWithdrawalPin.isPending}
                      data-testid="button-save-withdrawal-pin"
                    >
                      {setWithdrawalPin.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Save New PIN
                    </Button>
                    <Button variant="outline" onClick={() => { setShowWPinSetup(false); setWPinDigits(["", "", "", "", "", ""]); setWPinPassword(""); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setShowWPinSetup(true)} data-testid="button-change-withdrawal-pin">
                  Change Withdrawal PIN
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">You have not set a withdrawal PIN. This PIN is required to authorize every USDT withdrawal.</p>
              {showWPinSetup ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Create a 6-digit withdrawal PIN</p>
                  <div className="flex gap-2 justify-start">
                    {wPinDigits.map((digit, i) => (
                      <Input
                        key={i}
                        type="password"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        className="w-10 h-10 text-center text-lg p-0"
                        data-testid={`input-withdrawal-pin-digit-${i}`}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "").slice(0, 1);
                          const newDigits = [...wPinDigits];
                          newDigits[i] = val;
                          setWPinDigits(newDigits);
                          if (val && i < 5) {
                            const next = document.querySelector(`[data-testid="input-withdrawal-pin-digit-${i + 1}"]`) as HTMLInputElement;
                            next?.focus();
                          }
                        }}
                      />
                    ))}
                  </div>
                  <Input
                    type="password"
                    placeholder="Confirm your account password"
                    value={wPinPassword}
                    onChange={(e) => setWPinPassword(e.target.value)}
                    data-testid="input-withdrawal-pin-password-setup"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setWithdrawalPin.mutate()}
                      disabled={wPinDigits.join("").length !== 6 || !wPinPassword || setWithdrawalPin.isPending}
                      data-testid="button-save-withdrawal-pin-setup"
                    >
                      {setWithdrawalPin.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Set Withdrawal PIN
                    </Button>
                    <Button variant="outline" onClick={() => { setShowWPinSetup(false); setWPinDigits(["", "", "", "", "", ""]); setWPinPassword(""); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button onClick={() => setShowWPinSetup(true)} size="sm" data-testid="button-setup-withdrawal-pin">
                  <Lock className="w-4 h-4 mr-2" />
                  Set Up Withdrawal PIN
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
