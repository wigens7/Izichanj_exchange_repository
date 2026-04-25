import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/lib/i18n";
import { useUser } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  CARD_LOAD_AMOUNT_USD, CARD_CREATION_FEE_USD, CARD_TOPUP_FIXED_FEE_USD, CARD_TOPUP_MIN_USD,
  calcCardCreationCost, calcCardTopUpCost,
} from "@shared/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  CreditCard,
  Plus,
  DollarSign,
  Loader2,
  Eye,
  EyeOff,
  Snowflake,
  PlayCircle,
  Copy,
  CheckCircle,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  ShieldCheck,
  FileText,
  RefreshCw,
  XCircle,
  RotateCcw,
  History,
  Store,
  CheckCircle2,
  XOctagon,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { formatDateTime } from "@/lib/dateUtils";
import type { VirtualCard } from "@shared/schema";
import cardTemplateBg from "@assets/IMG_20260325_122830_199_1774459787355.jpg";

export default function VirtualCardsPage() {
  const { t } = useLanguage();
  const { data: user } = useUser();
  const vc = t.virtualCard;

  const { data: cards, isLoading } = useQuery<VirtualCard[]>({
    queryKey: ["/api/cards"],
  });

  const kycVerified = user?.kycStatus === "verified";
  const hasPendingCard = cards?.some((c) => c.status === "pending");

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold" data-testid="text-virtual-cards-title">{vc.title}</h1>
        <p className="text-muted-foreground mt-1">{vc.subtitle}</p>
      </div>

      {!kycVerified && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <AlertCircle className="w-10 h-10 text-amber-500 mb-3" />
            <p className="font-medium mb-1" data-testid="text-kyc-required-cards">{vc.kycRequired || "KYC verification required"}</p>
            <p className="text-sm text-muted-foreground">{vc.kycRequiredDesc || "Complete your KYC verification to apply for virtual cards."}</p>
          </CardContent>
        </Card>
      )}

      {/* Only show Apply section when KYC done AND no pending card already in queue */}
      {kycVerified && !hasPendingCard && <ApplyCardSection />}

      {/* If they have a pending card, show a clear status banner instead of the apply form */}
      {kycVerified && hasPendingCard && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardContent className="flex items-start gap-3 py-5">
            <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Card Application in Progress</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Your virtual card is currently being processed. Your $30.00 payment has been received and is held securely.
                Use the <strong>"Check if my card is ready"</strong> button on the card below to check for updates.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : cards && cards.length > 0 ? (
        <div className="space-y-4">
          {cards.map((card) => (
            <CardItem key={card.id} card={card} />
          ))}
        </div>
      ) : kycVerified ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <CreditCard className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground" data-testid="text-no-cards">{vc.noCards || "No virtual cards yet. Apply for one above."}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function ApplyCardSection() {
  const { t } = useLanguage();
  const vc = t.virtualCard;
  const { data: user } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();

  // Pricing breakdown (single source of truth in @shared/constants)
  const cardBreakdown = calcCardCreationCost(CARD_LOAD_AMOUNT_USD);
  const CARD_COST        = cardBreakdown.total;        // e.g. $35.68
  const CARD_LOAD_AMOUNT = cardBreakdown.loadAmount;   // $20
  const CARD_FIXED_FEE   = cardBreakdown.fixedFee;     // $15
  const CARD_VAR_FEE     = cardBreakdown.variableFee;  // $0.68
  const userBalance = parseFloat(user?.balance || "0");
  const hasEnoughBalance = userBalance >= CARD_COST;

  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [kycPending, setKycPending] = useState(false);

  // Extra fields — shown when missing from profile
  const [extraFirstName, setExtraFirstName] = useState("");
  const [extraLastName, setExtraLastName] = useState("");
  const [extraDob, setExtraDob] = useState("");
  const [extraPhone, setExtraPhone] = useState("");
  const [showManualId, setShowManualId] = useState(false);
  const [manualCustomerId, setManualCustomerId] = useState("");

  // Determine which fields are missing (need user input)
  const needsFirstName = !user?.firstName;
  const needsLastName  = !user?.lastName;
  const needsDob       = !user?.dateOfBirth;
  const needsPhone     = !user?.phone;
  const hasMissingFields = needsFirstName || needsLastName || needsDob || needsPhone;

  // Pre-populate name fields from fullName when user data loads
  useEffect(() => {
    if (user && !user.firstName && user.fullName) {
      const parts = (user.fullName as string).trim().split(/\s+/);
      if (!extraFirstName) setExtraFirstName(parts[0] || "");
      if (!extraLastName && parts.length > 1) setExtraLastName(parts.slice(1).join(" "));
    }
  }, [user?.id]);

  const { data: stroStatus, isLoading: stroLoading } = useQuery<{ registered: boolean; customerId: string | null }>({
    queryKey: ["/api/cards/strowallet-status"],
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = { idType, idNumber };
      if (needsFirstName && extraFirstName.trim()) body.firstName   = extraFirstName.trim();
      if (needsLastName  && extraLastName.trim())  body.lastName    = extraLastName.trim();
      if (needsDob       && extraDob.trim())        body.dateOfBirth = extraDob.trim();
      if (needsPhone     && extraPhone.trim())      body.phone       = extraPhone.trim();
      const res = await apiRequest("POST", "/api/cards/register-cardholder", body);
      if (!res.ok) {
        const data = await res.json() as any;
        // Check for 409 — email already registered in Strowallet
        if (res.status === 409 && data.alreadyRegistered) {
          // Auto-show manual entry form
          setShowManualId(true);
          throw new Error(data.message || "Email already registered. Enter your Strowallet Customer ID below.");
        }
        throw new Error(data.message || "Failed to register card KYC");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Card KYC registered successfully!" });
      qc.invalidateQueries({ queryKey: ["/api/cards/strowallet-status"] });
      qc.invalidateQueries({ queryKey: ["/api/user"] }); // Refresh user to show saved phone/dob
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const manualIdMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cards/set-strowallet-customer-id", {
        strowalletCustomerId: manualCustomerId.trim(),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Strowallet ID linked successfully!" });
      setShowManualId(false);
      setManualCustomerId("");
      qc.invalidateQueries({ queryKey: ["/api/cards/strowallet-status"] });
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  // Validate that all required missing fields are filled before allowing submit
  const missingFieldsFilled =
    (!needsFirstName || extraFirstName.trim()) &&
    (!needsLastName  || extraLastName.trim()) &&
    (!needsDob       || extraDob.trim()) &&
    (!needsPhone     || extraPhone.trim());

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/cards/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: String(CARD_COST) }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.code === "STROWALLET_KYC_PENDING") {
          setKycPending(true);
          throw new Error("__KYC_PENDING__");
        }
        throw new Error(data?.message || "Failed to create card");
      }
      return data;
    },
    onSuccess: (data: any) => {
      setKycPending(false);
      if (data?.pending) {
        toast({
          title: "Card Request Received",
          description: "Your card is being processed. Please check back in 24 hours.",
        });
      } else {
        toast({ title: vc.cardCreated });
      }
      qc.invalidateQueries({ queryKey: ["/api/cards"] });
      qc.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (err: Error) => {
      if (err.message !== "__KYC_PENDING__") {
        toast({ title: err.message, variant: "destructive" });
      }
    },
  });

  const isRegistered = stroStatus?.registered;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="w-5 h-5" />
          {vc.applyTitle}
        </CardTitle>
        <CardDescription>{vc.applyDescription}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Step 1 – Strowallet KYC (only if not yet registered) */}
        {stroLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking card KYC status…
          </div>
        ) : !isRegistered ? (
          <div className="border rounded-lg p-4 space-y-4 bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Card Identity Verification Required</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  To comply with card network regulations, we need to verify your ID before issuing a virtual card.
                  Your name, date of birth, and country are already on file — just provide your ID details below.
                </p>
              </div>
            </div>

            {/* Missing profile info — collected once, saved to profile */}
            {hasMissingFields && (
              <div className="grid gap-3 sm:grid-cols-2">
                {needsFirstName && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">First Name</Label>
                    <Input
                      placeholder="e.g. Jean"
                      value={extraFirstName}
                      onChange={e => setExtraFirstName(e.target.value)}
                      data-testid="input-first-name"
                    />
                  </div>
                )}
                {needsLastName && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Last Name</Label>
                    <Input
                      placeholder="e.g. Pierre"
                      value={extraLastName}
                      onChange={e => setExtraLastName(e.target.value)}
                      data-testid="input-last-name"
                    />
                  </div>
                )}
                {needsDob && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Date of Birth</Label>
                    <Input
                      type="date"
                      value={extraDob}
                      onChange={e => setExtraDob(e.target.value)}
                      data-testid="input-dob"
                    />
                  </div>
                )}
                {needsPhone && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Phone Number</Label>
                    <Input
                      placeholder="e.g. +50934567890"
                      value={extraPhone}
                      onChange={e => setExtraPhone(e.target.value)}
                      data-testid="input-phone"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">ID Type</Label>
                <Select value={idType} onValueChange={setIdType} data-testid="select-id-type">
                  <SelectTrigger data-testid="trigger-id-type">
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
                <Label className="text-xs">ID Number</Label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="e.g. A12345678"
                    value={idNumber}
                    onChange={e => setIdNumber(e.target.value)}
                    className="pl-9"
                    data-testid="input-id-number"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={() => registerMutation.mutate()}
                disabled={registerMutation.isPending || !idType || !idNumber.trim() || !missingFieldsFilled}
                className="w-full sm:w-auto"
                data-testid="button-register-cardholder"
              >
                {registerMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Submitting…</>
                ) : (
                  <><ShieldCheck className="w-4 h-4 mr-2" />Submit Card KYC</>
                )}
              </Button>
              <Button
                onClick={() => setShowManualId(!showManualId)}
                variant="outline"
                size="sm"
                data-testid="button-toggle-manual-id"
              >
                {showManualId ? "Hide Manual Entry" : "Already Registered?"}
              </Button>
            </div>

            {/* Manual Strowallet ID entry – for users already registered manually */}
            {showManualId && (
              <div className="border rounded-lg p-4 space-y-3 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-600 mt-1 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">If you were already registered with Strowallet, enter your Customer ID below:</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Strowallet Customer ID</Label>
                  <Input
                    placeholder="e.g. 12345678"
                    value={manualCustomerId}
                    onChange={e => setManualCustomerId(e.target.value)}
                    data-testid="input-strowallet-customer-id"
                  />
                </div>
                <Button
                  onClick={() => manualIdMutation.mutate()}
                  disabled={manualIdMutation.isPending || !manualCustomerId.trim()}
                  className="w-full sm:w-auto"
                  variant="secondary"
                  data-testid="button-set-manual-customer-id"
                >
                  {manualIdMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" />Linking…</>
                  ) : (
                    <>Link Customer ID</>
                  )}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 rounded-md p-3">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <p>Card identity verification complete. You can now apply for a virtual card.</p>
          </div>
        )}

        {/* Step 2 – Apply card (only if Strowallet KYC done) */}
        {isRegistered && (
          <>
            <div className="bg-muted/30 rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm text-muted-foreground">{vc.cardCost}</p>
                  <p className="text-2xl font-bold font-display" data-testid="text-card-cost">${CARD_COST.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">USD</span></p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">{vc.yourBalance}</p>
                  <p className={`text-lg font-semibold ${hasEnoughBalance ? "text-emerald-600" : "text-red-500"}`} data-testid="text-your-balance">
                    ${userBalance.toFixed(2)} USDT
                  </p>
                </div>
              </div>
              {/* Detailed price breakdown */}
              <div className="border-t border-border/50 pt-2.5 space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground" data-testid="text-card-fee">
                  <span>⚡ Card / Activation fee</span>
                  <span>${CARD_FIXED_FEE.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground" data-testid="text-card-network-fee">
                  <span>🌐 Network fee (3.4%)</span>
                  <span>${CARD_VAR_FEE.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400 font-medium" data-testid="text-card-load-amount">
                  <span>💳 Amount to card</span>
                  <span>${CARD_LOAD_AMOUNT.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-foreground pt-1.5 border-t border-border/40" data-testid="text-card-total">
                  <span>Total to pay</span>
                  <span>${CARD_COST.toFixed(2)} USDT</span>
                </div>
              </div>
            </div>

            {!hasEnoughBalance && !kycPending && (
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-md p-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <p>{vc.insufficientBalance}</p>
              </div>
            )}

            {kycPending && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-4 space-y-2">
                <p className="font-semibold text-blue-800 dark:text-blue-300 text-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Our Team is Reviewing Your Documents
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  Your registration was submitted successfully. Our team is currently reviewing your identity documents — this is a normal process that takes <strong>24 to 48 hours</strong>.
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  ✅ You don't need to do anything. Once our team approves your documents, you'll be able to create your card immediately. You'll receive a WhatsApp notification when ready.
                </p>
              </div>
            )}

            {!kycPending && (
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !hasEnoughBalance}
                className="w-full sm:w-auto"
                data-testid="button-apply-card"
              >
                {createMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />{vc.applying}</>
                ) : (
                  <><CreditCard className="w-4 h-4 mr-2" />{vc.applyButton} — ${CARD_COST.toFixed(2)}</>  
                )}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CardItem({ card }: { card: VirtualCard }) {
  const { t } = useLanguage();
  const vc = t.virtualCard;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showDetails, setShowDetails] = useState(false);
  const [showFund, setShowFund] = useState(false);
  const [fundAmount, setFundAmount] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const isPending = card.status === "pending";
  const isFrozen = card.status === "frozen";
  const isActive = card.status === "active";

  const detailsQuery = useQuery<any>({
    queryKey: ["/api/cards", card.id, "details"],
    queryFn: async () => {
      const res = await fetch(`/api/cards/${card.id}/details`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch details");
      return res.json();
    },
    enabled: showDetails,
  });

  const [showTxModal, setShowTxModal] = useState(false);
  const [localBalance, setLocalBalance] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const transactionsQuery = useQuery<any[]>({
    queryKey: ["/api/cards", card.id, "transactions"],
    queryFn: async () => {
      const res = await fetch(`/api/cards/${card.id}/transactions`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch transactions");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: showTxModal,
    staleTime: 0,
    refetchOnMount: true,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/cards/${card.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Delete failed");
      return data as { success: boolean; refunded: number };
    },
    onSuccess: (data) => {
      if (data.refunded > 0) {
        toast({ title: "Card deleted — refund issued", description: `$${data.refunded.toFixed(2)} USDT has been refunded to your balance.` });
      } else {
        toast({ title: "Card deleted", description: "The virtual card has been removed from your account." });
      }
      qc.invalidateQueries({ queryKey: ["/api/cards"] });
      qc.invalidateQueries({ queryKey: ["/api/user"] });
      setConfirmDelete(false);
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
      setConfirmDelete(false);
    },
  });

  const refreshBalanceMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/cards/${card.id}/refresh-balance`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Refresh failed");
      return data as { balance: string; synced: boolean };
    },
    onSuccess: (data) => {
      setLocalBalance(data.balance);
      qc.invalidateQueries({ queryKey: ["/api/cards"] });
      toast({
        title: data.synced ? "Balance updated" : "Balance is current",
        description: `Card balance: $${Number(data.balance).toFixed(2)} USD`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Refresh failed", description: err.message, variant: "destructive" });
    },
  });

  const fundMutation = useMutation({
    mutationFn: async (amt: string) => {
      const res = await apiRequest("POST", `/api/cards/${card.id}/fund`, { amount: amt });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: vc.cardFunded });
      qc.invalidateQueries({ queryKey: ["/api/cards"] });
      qc.invalidateQueries({ queryKey: ["/api/user"] });
      setFundAmount("");
      setShowFund(false);
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const toggleFreezeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/cards/${card.id}/freeze`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/cards"] });
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const checkStatusMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/cards/${card.id}/check-status`, {
        method: "POST",
        credentials: "include",
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.found) {
        toast({ title: "🎉 Your card is ready!", description: "Card details are now available." });
        qc.invalidateQueries({ queryKey: ["/api/cards"] });
        qc.invalidateQueries({ queryKey: ["/api/user"] });
      } else {
        toast({
          title: "Still processing",
          description: data?.message || "Your card is not ready yet. Please try again later.",
        });
      }
    },
    onError: () => {
      toast({ title: "Check failed. Please try again.", variant: "destructive" });
    },
  });

  const userRetryMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/cards/${card.id}/user-retry`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Retry failed");
      return data;
    },
    onSuccess: (data: any) => {
      toast({ title: "🎉 Card issued successfully!", description: "Your virtual card is now ready." });
      qc.invalidateQueries({ queryKey: ["/api/cards"] });
      qc.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (err: Error) => {
      toast({ title: "Retry failed", description: err.message, variant: "destructive" });
    },
  });


  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  // Backend returns { card, remoteDetail } — extract the actual detail object
  // Also normalize camelCase vs snake_case field names from Strowallet
  const rawDetail = detailsQuery.data?.remoteDetail ?? detailsQuery.data;
  const cardDetails = rawDetail ? {
    card_number: rawDetail.card_number || rawDetail.cardNumber || rawDetail.card_pan || rawDetail.pan || null,
    cvv:         rawDetail.cvv       || rawDetail.cvv2      || rawDetail.card_cvv  || null,
    expiry_month: rawDetail.expiry_month || rawDetail.expiryMonth || rawDetail.expiry?.split("/")?.[0] || null,
    expiry_year:  rawDetail.expiry_year  || rawDetail.expiryYear  || rawDetail.expiry?.split("/")?.[1] || null,
    balance:      rawDetail.balance ?? null,
  } : null;

  return (
    <Card data-testid={`card-virtual-${card.id}`}>
      <CardContent className="p-0">
        <div className="relative overflow-hidden rounded-t-md" style={{ aspectRatio: "1.586" }}>
          <img
            src={cardTemplateBg}
            alt="Virtual Card"
            className={`absolute inset-0 w-full h-full object-cover ${isFrozen ? "opacity-40 grayscale" : ""} ${isPending ? "opacity-50 grayscale" : ""}`}
          />
          {isPending && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-t-md">
              <div className="text-center px-4">
                <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-white font-semibold text-sm">Processing...</p>
                <p className="text-white/70 text-xs mt-1">Ready in ~24 hours</p>
              </div>
            </div>
          )}
          <div className="absolute inset-0 flex flex-col justify-between p-5">
            <div className="flex items-center justify-between">
              <div />
              <div className="flex items-center gap-2">
                {isPending ? (
                  <Badge className="bg-amber-500/30 text-amber-200 border-amber-500/40">Processing</Badge>
                ) : (
                  <Badge variant={isFrozen ? "secondary" : "default"} className={isFrozen ? "" : "bg-emerald-500/20 text-emerald-200 border-emerald-500/30"}>
                    {isFrozen ? vc.frozen : vc.active}
                  </Badge>
                )}
                {/* Balance badge with refresh button */}
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-white/90 border-white/30 bg-white/10 font-mono" data-testid={`badge-card-balance-${card.id}`}>
                    ${Number(localBalance ?? card.balance).toFixed(2)}
                  </Badge>
                  {!isPending && (
                    <button
                      onClick={(e) => { e.stopPropagation(); refreshBalanceMutation.mutate(); }}
                      disabled={refreshBalanceMutation.isPending}
                      className="text-white/60 hover:text-white/90 transition-colors disabled:opacity-40"
                      title="Refresh card balance"
                      data-testid={`button-refresh-balance-${card.id}`}
                    >
                      <RefreshCw className={`w-3 h-3 ${refreshBalanceMutation.isPending ? "animate-spin" : ""}`} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-white font-mono text-xl sm:text-2xl tracking-[0.2em] drop-shadow-lg">
                {showDetails && cardDetails?.card_number
                  ? cardDetails.card_number.replace(/(.{4})/g, "$1 ").trim()
                  : `•••• •••• •••• ${card.last4 || "••••"}`}
              </p>

              <div className="flex items-end justify-between gap-2">
                <p className="text-white text-sm font-medium uppercase tracking-wider drop-shadow">{card.nameOnCard}</p>
                <div className="text-right text-white text-sm drop-shadow">
                  {showDetails && cardDetails ? (
                    <div className="flex items-center gap-3">
                      <span>Exp: {cardDetails.expiry_month}/{cardDetails.expiry_year}</span>
                      <span>CVV: {cardDetails.cvv || "•••"}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span>Exp: ••/••</span>
                      <span>CVV: •••</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {showDetails && cardDetails && (
            <div className="bg-muted/30 rounded-md p-3 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                {cardDetails.card_number && (
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(cardDetails.card_number, "number")} data-testid={`button-copy-number-${card.id}`}>
                    {copied === "number" ? <CheckCircle className="w-3 h-3 text-emerald-500 mr-1.5" /> : <Copy className="w-3 h-3 mr-1.5" />}
                    {vc.cardNumber}
                  </Button>
                )}
                {cardDetails.cvv && (
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(cardDetails.cvv, "cvv")} data-testid={`button-copy-cvv-${card.id}`}>
                    {copied === "cvv" ? <CheckCircle className="w-3 h-3 text-emerald-500 mr-1.5" /> : <Copy className="w-3 h-3 mr-1.5" />}
                    {vc.cvv}
                  </Button>
                )}
              </div>
            </div>
          )}

          {showFund && (() => {
            const fundNum = parseFloat(fundAmount) || 0;
            const fundBreakdown = fundNum >= CARD_TOPUP_MIN_USD ? calcCardTopUpCost(fundNum) : null;
            return (
              <div className="bg-muted/30 rounded-md p-3 space-y-3">
                <div>
                  <Label>{vc.fundAmount}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Minimum ${CARD_TOPUP_MIN_USD.toFixed(2)} USD</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      min={CARD_TOPUP_MIN_USD}
                      step="0.01"
                      value={fundAmount}
                      onChange={(e) => setFundAmount(e.target.value)}
                      className="pl-9"
                      placeholder={String(CARD_TOPUP_MIN_USD)}
                      data-testid={`input-fund-amount-${card.id}`}
                    />
                  </div>
                  <Button
                    onClick={() => fundMutation.mutate(fundAmount)}
                    disabled={fundMutation.isPending || !fundAmount || fundNum < CARD_TOPUP_MIN_USD}
                    data-testid={`button-fund-card-${card.id}`}
                  >
                    {fundMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : vc.fundButton}
                  </Button>
                </div>
                {fundBreakdown && (
                  <div className="border-t border-border/50 pt-2.5 space-y-1.5" data-testid={`text-fund-breakdown-${card.id}`}>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>⚡ Funding fee</span>
                      <span>${fundBreakdown.fixedFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>🌐 Network fee (1.9%)</span>
                      <span>${fundBreakdown.variableFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      <span>💳 Amount to card</span>
                      <span>${fundBreakdown.loadAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-foreground pt-1.5 border-t border-border/40">
                      <span>Total to pay</span>
                      <span>${fundBreakdown.total.toFixed(2)} USDT</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Transaction History Modal */}
          <Dialog open={showTxModal} onOpenChange={(open) => {
            setShowTxModal(open);
            // Auto-refresh balance whenever the modal opens
            if (open && !isPending) refreshBalanceMutation.mutate();
          }}>
            <DialogContent className="max-w-lg w-full max-h-[85vh] flex flex-col">
              <DialogHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <DialogTitle className="flex items-center gap-2">
                    <History className="w-5 h-5 text-primary" />
                    Transaction History
                    <span className="text-sm font-normal text-muted-foreground ml-1">— {card.nameOnCard}</span>
                  </DialogTitle>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Live balance inside modal */}
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground leading-none mb-0.5">Card Balance</p>
                      <p className="text-sm font-bold font-mono text-primary">
                        {refreshBalanceMutation.isPending ? (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Loader2 className="w-3 h-3 animate-spin" /> Syncing…
                          </span>
                        ) : (
                          `$${Number(localBalance ?? card.balance).toFixed(2)} USD`
                        )}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        refreshBalanceMutation.mutate();
                        qc.invalidateQueries({ queryKey: ["/api/cards", card.id, "transactions"] });
                      }}
                      disabled={refreshBalanceMutation.isPending || transactionsQuery.isFetching}
                      className="h-8 gap-1.5"
                      data-testid={`button-refresh-modal-${card.id}`}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${(refreshBalanceMutation.isPending || transactionsQuery.isFetching) ? "animate-spin" : ""}`} />
                      Refresh
                    </Button>
                  </div>
                </div>
              </DialogHeader>
              <Separator />

              <div className="flex-1 overflow-y-auto mt-2 space-y-1 pr-1">
                {transactionsQuery.isLoading ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <Loader2 className="w-7 h-7 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading transactions…</p>
                  </div>
                ) : transactionsQuery.isError ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                    <AlertTriangle className="w-8 h-8 text-amber-500" />
                    <p className="text-sm font-medium">Could not load transactions</p>
                    <p className="text-xs text-muted-foreground">Please try again later.</p>
                  </div>
                ) : transactionsQuery.data && transactionsQuery.data.length > 0 ? (
                  transactionsQuery.data.map((tx: any, idx: number) => {
                    const isLocal = tx.source === "local";
                    const isFunding = isLocal && (tx.type === "fund" || tx.type === "creation");

                    const rawMerchant = tx.narrative || tx.merchant_name || tx.merchant || tx.narration || tx.description || tx.reference || "";
                    const merchant = isFunding
                      ? (tx.description || "Card Funding")
                      : (rawMerchant ? rawMerchant.replace(/\s{2,}/g, " ").trim() : "Unknown Merchant");
                    const amount = Number(tx.amount || tx.transaction_amount || 0);
                    const currency = (tx.currency || tx.transaction_currency || "USD").toUpperCase();
                    const rawStatus = (tx.status || tx.transaction_status || "").toLowerCase();
                    const txType = (tx.type || tx.transaction_type || "").toLowerCase();
                    const isCredit = isFunding || txType === "credit" || txType === "reversal" || rawStatus === "reversal";
                    const statusOk = isLocal ? true : (rawStatus === "success" || rawStatus === "successful" || rawStatus === "completed" || rawStatus === "approved");
                    const statusFail = !isLocal && (rawStatus === "failed" || rawStatus === "declined" || rawStatus === "rejected" || rawStatus === "error");
                    const rawDate = tx.date || tx.created_at || tx.transaction_date || tx.createdAt || null;
                    const txDate = rawDate ? formatDateTime(rawDate) : null;

                    return (
                      <div key={tx.id ?? idx} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/40 transition-colors border border-transparent hover:border-border/50">
                        {/* Icon */}
                        <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isCredit ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-slate-100 dark:bg-slate-800"}`}>
                          {isFunding
                            ? <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            : isCredit
                              ? <ArrowDownLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              : <Store className="w-4 h-4 text-slate-500 dark:text-slate-400" />}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{merchant}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {statusOk ? (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-emerald-300 text-emerald-600 dark:text-emerald-400 dark:border-emerald-700 gap-0.5">
                                <CheckCircle2 className="w-2.5 h-2.5" /> Success
                              </Badge>
                            ) : statusFail ? (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-red-300 text-red-600 dark:text-red-400 dark:border-red-700 gap-0.5">
                                <XOctagon className="w-2.5 h-2.5" /> Failed
                              </Badge>
                            ) : rawStatus ? (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 capitalize">{rawStatus}</Badge>
                            ) : null}
                            {txDate && (
                              <span className="text-[11px] text-muted-foreground">{txDate}</span>
                            )}
                          </div>
                        </div>

                        {/* Amount */}
                        <div className="text-right flex-shrink-0">
                          <p className={`text-sm font-semibold ${isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
                            {isCredit ? "+" : "-"}{currency} {amount.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                    <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                      <History className="w-7 h-7 text-muted-foreground" />
                    </div>
                    <p className="text-base font-medium">No transactions yet</p>
                    <p className="text-sm text-muted-foreground max-w-[220px]">No transactions found for this card yet. Use your card to see activity here.</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {isPending ? (
            <div className="space-y-2">
              {/* Status bar */}
              <div className="flex items-start gap-3 rounded-md bg-amber-500/10 border border-amber-500/20 p-3">
                <div className="w-4 h-4 mt-0.5 shrink-0 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <div>
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Card request received</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Your $30.00 is held securely. If the card is not issued, you can retry or cancel for a full refund.</p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => checkStatusMutation.mutate()}
                  disabled={checkStatusMutation.isPending || userRetryMutation.isPending || deleteMutation.isPending}
                  data-testid={`button-check-card-status-${card.id}`}
                >
                  {checkStatusMutation.isPending ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Checking…</>
                  ) : (
                    <><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Check status</>
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => userRetryMutation.mutate()}
                  disabled={checkStatusMutation.isPending || userRetryMutation.isPending || deleteMutation.isPending}
                  data-testid={`button-user-retry-card-${card.id}`}
                >
                  {userRetryMutation.isPending ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Retrying…</>
                  ) : (
                    <><RotateCcw className="w-3.5 h-3.5 mr-1.5" />Retry creation</>
                  )}
                </Button>
              </div>

              {/* Delete / Cancel flow */}
              {!confirmDelete ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                  onClick={() => setConfirmDelete(true)}
                  disabled={deleteMutation.isPending}
                  data-testid={`button-cancel-card-${card.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Cancel & get $30.00 refund
                </Button>
              ) : (
                <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 space-y-2">
                  <p className="text-sm text-red-700 dark:text-red-400 font-medium">Are you sure you want to cancel?</p>
                  <p className="text-xs text-muted-foreground">$30.00 USDT will be instantly refunded to your balance. This cannot be undone.</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteMutation.mutate()}
                      disabled={deleteMutation.isPending}
                      className="flex-1"
                      data-testid={`button-confirm-cancel-card-${card.id}`}
                    >
                      {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Yes, cancel & refund"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleteMutation.isPending}
                      className="flex-1"
                      data-testid={`button-dismiss-cancel-${card.id}`}
                    >
                      Keep waiting
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
          <>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowDetails(!showDetails); if (showFund) setShowFund(false); }}
              data-testid={`button-view-details-${card.id}`}
            >
              {showDetails ? <EyeOff className="w-3.5 h-3.5 mr-1.5" /> : <Eye className="w-3.5 h-3.5 mr-1.5" />}
              {vc.viewDetails}
            </Button>

            {isActive && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setShowFund(!showFund); if (showDetails) setShowDetails(false); }}
                data-testid={`button-toggle-fund-${card.id}`}
              >
                <DollarSign className="w-3.5 h-3.5 mr-1.5" />
                {vc.fundCard}
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTxModal(true)}
              data-testid={`button-transactions-${card.id}`}
            >
              <History className="w-3.5 h-3.5 mr-1.5" />
              {vc.transactions}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshBalanceMutation.mutate()}
              disabled={refreshBalanceMutation.isPending}
              data-testid={`button-refresh-balance-action-${card.id}`}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshBalanceMutation.isPending ? "animate-spin" : ""}`} />
              {refreshBalanceMutation.isPending ? "Syncing…" : "Refresh Balance"}
            </Button>

            <Button
              variant={isFrozen ? "default" : "outline"}
              size="sm"
              onClick={() => toggleFreezeMutation.mutate()}
              disabled={toggleFreezeMutation.isPending}
              data-testid={`button-freeze-${card.id}`}
            >
              {toggleFreezeMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : isFrozen ? (
                <PlayCircle className="w-3.5 h-3.5 mr-1.5" />
              ) : (
                <Snowflake className="w-3.5 h-3.5 mr-1.5" />
              )}
              {isFrozen ? vc.unfreezeCard : vc.freezeCard}
            </Button>

            {/* Delete card button for active/frozen cards */}
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              onClick={() => setConfirmDelete(true)}
              disabled={deleteMutation.isPending}
              data-testid={`button-delete-card-${card.id}`}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Delete card
            </Button>
          </div>

          {/* Delete confirmation panel for active/frozen cards */}
          {confirmDelete && (
            <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 space-y-2 mt-2">
              <p className="text-sm text-red-700 dark:text-red-400 font-medium">Delete this virtual card?</p>
              <p className="text-xs text-muted-foreground">
                This card will be permanently removed from your account. Since the card has already been issued, <strong>no refund will be provided</strong>. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="flex-1"
                  data-testid={`button-confirm-delete-card-${card.id}`}
                >
                  {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Yes, delete permanently"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleteMutation.isPending}
                  className="flex-1"
                  data-testid={`button-dismiss-delete-${card.id}`}
                >
                  Keep card
                </Button>
              </div>
            </div>
          )}
          </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
