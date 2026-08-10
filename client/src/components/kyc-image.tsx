import { useState } from "react";
import { ImageOff } from "lucide-react";
import { getKycImageSrc } from "@/lib/kyc-image";

interface KycImageProps {
  src: string | null | undefined;
  alt: string;
  testId: string;
  className?: string;
}

/**
 * Keeps a failed ImgBB image from looking like a broken/blank admin screen.
 * The original URL remains available through the "Open original" link.
 */
export function KycImage({
  src,
  alt,
  testId,
  className = "",
}: KycImageProps) {
  const [failed, setFailed] = useState(false);
  const originalUrl = typeof src === "string" ? src.trim() : "";
  const imageSrc = getKycImageSrc(originalUrl);

  if (!imageSrc || failed) {
    return (
      <div
        className={`min-h-32 rounded-md border border-dashed border-border flex flex-col items-center justify-center gap-2 p-3 text-center text-xs text-muted-foreground ${className}`}
        data-testid={`${testId}-error`}
      >
        <ImageOff className="h-5 w-5" />
        <span>Image unavailable</span>
        {originalUrl && (
          <a
            href={originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            Open original
          </a>
        )}
      </div>
    );
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      data-testid={testId}
      onError={() => setFailed(true)}
    />
  );
}