import PhoneInputLib, { type Country } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { cn } from "@/lib/utils";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  defaultCountry?: Country;
  placeholder?: string;
  className?: string;
  "data-testid"?: string;
}

export function PhoneInput({
  value,
  onChange,
  defaultCountry = "HT",
  placeholder = "Phone number",
  className,
  "data-testid": dataTestId,
}: PhoneInputProps) {
  return (
    <div className={cn("phone-input-wrapper", className)} data-testid={dataTestId}>
      <PhoneInputLib
        international
        defaultCountry={defaultCountry}
        value={value || undefined}
        onChange={(val) => onChange(val ?? "")}
        placeholder={placeholder}
      />
    </div>
  );
}
