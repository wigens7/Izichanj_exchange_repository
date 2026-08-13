import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UploadCloud, Check, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import { useUploadKyc } from "@/hooks/use-kyc";

type Slot = "front" | "back" | "selfie";

const SLOTS: { key: Slot; label: string; hint: string }[] = [
  { key: "front", label: "ID Document (Front)", hint: "Photo of the front of your ID" },
  { key: "back", label: "ID Document (Back)", hint: "Photo of the back of your ID" },
  { key: "selfie", label: "Selfie with ID", hint: "Photo of you holding your ID" },
];

/**
 * In-app KYC submission. Every image is uploaded to ImgBB through
 * POST /api/upload-image, and only the returned https://i.ibb.co/... URL is
 * stored on the KYC record (never the local endpoint path).
 */
export function KycForm({ disabled }: { disabled?: boolean }) {
  const { toast } = useToast();
  const { uploadFile } = useUpload();
  const uploadKyc = useUploadKyc();

  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [urls, setUrls] = useState<Partial<Record<Slot, string>>>({});
  const [busy, setBusy] = useState<Slot | null>(null);
  const inputs = useRef<Partial<Record<Slot, HTMLInputElement | null>>>({});

  const handleFile = async (slot: Slot, file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please choose an image file.", variant: "destructive" });
      return;
    }
    setBusy(slot);
    try {
      const res = await uploadFile(file);
      const url = res?.url;
      if (!url || !/^https?:\/\//i.test(url)) {
        throw new Error("Image host did not return a valid URL");
      }
      setUrls((prev) => ({ ...prev, [slot]: url }));
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Could not upload the image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const ready =
    !!urls.front && !!urls.back && !!urls.selfie && !!idType && idNumber.trim().length > 0 && addressLine1.trim().length > 0;

  const submit = () => {
    if (!ready) return;
    uploadKyc.mutate({
      idDocumentUrl: urls.front!,
      idDocumentBackUrl: urls.back!,
      selfieUrl: urls.selfie!,
      idType,
      idNumber: idNumber.trim(),
      addressLine1: addressLine1.trim(),
    });
  };

  return (
    <div className={`space-y-4 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">ID Type</Label>
          <Select value={idType} onValueChange={setIdType}>
            <SelectTrigger data-testid="select-kyc-id-type">
              <SelectValue placeholder="Select ID type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="national_id">National ID (CIN)</SelectItem>
              <SelectItem value="passport">Passport</SelectItem>
              <SelectItem value="driver_license">Driver's License</SelectItem>
              <SelectItem value="nif">NIF</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">ID Number</Label>
          <Input
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            placeholder="e.g. 00-01-99-1990-01-00001"
            data-testid="input-kyc-id-number"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Address</Label>
        <Input
          value={addressLine1}
          onChange={(e) => setAddressLine1(e.target.value)}
          placeholder="Street, city"
          data-testid="input-kyc-address"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {SLOTS.map((slot) => (
          <div key={slot.key} className="rounded-md border p-3 space-y-2">
            <div className="text-xs font-medium">{slot.label}</div>
            {urls[slot.key] ? (
              <img
                src={urls[slot.key]}
                alt={slot.label}
                className="w-full h-24 object-cover rounded"
                data-testid={`img-kyc-${slot.key}`}
              />
            ) : (
              <div className="w-full h-24 rounded bg-muted flex items-center justify-center">
                <Camera className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">{slot.hint}</p>
            <input
              ref={(el) => {
                inputs.current[slot.key] = el;
              }}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void handleFile(slot.key, e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant={urls[slot.key] ? "outline" : "secondary"}
              size="sm"
              className="w-full"
              disabled={busy === slot.key}
              onClick={() => inputs.current[slot.key]?.click()}
              data-testid={`button-kyc-upload-${slot.key}`}
            >
              {busy === slot.key ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading…
                </>
              ) : urls[slot.key] ? (
                <>
                  <Check className="w-4 h-4 mr-2" /> Replace
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4 mr-2" /> Choose photo
                </>
              )}
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        className="w-full primary-gradient"
        disabled={!ready || uploadKyc.isPending || busy !== null}
        onClick={submit}
        data-testid="button-submit-kyc"
      >
        {uploadKyc.isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting…
          </>
        ) : (
          "Submit for verification"
        )}
      </Button>
    </div>
  );
}