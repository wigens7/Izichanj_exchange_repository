import { useState, useCallback } from "react";

interface UploadResponse {
  url: string;
}

interface UseUploadOptions {
  onSuccess?: (response: UploadResponse) => void;
  onError?: (error: Error) => void;
}

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

/**
 * Compress the image before sending it, to avoid 413 (payload too large) errors.
 */
async function fileToCompressedDataUrl(file: File): Promise<string> {
  const readAsDataUrl = () =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const dataUrl = await readAsDataUrl();
  if (!file.type.startsWith("image/") || typeof document === "undefined") {
    return dataUrl;
  }

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });

    const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));
    if (scale === 1 && dataUrl.length < 1_500_000) {
      return dataUrl;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } catch {
    return dataUrl;
  }
}

/**
 * React hook to upload a file directly to /api/upload-image
 * (the backend converts it to base64 and sends it to ImgBB).
 */
export function useUpload(options: UseUploadOptions = {}) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  const uploadFile = useCallback(
    async (file: File): Promise<UploadResponse | null> => {
      setIsUploading(true);
      setError(null);
      setProgress(0);

      try {
        setProgress(20);
        const base64 = await fileToCompressedDataUrl(file);

        setProgress(50);
        const response = await fetch("/api/upload-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64 }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Upload failed");
        }

        const data = await response.json();
        setProgress(100);
        options.onSuccess?.(data);
        return { url: data.url };
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Upload failed");
        setError(error);
        options.onError?.(error);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [options]
  );

  return {
    uploadFile,
    isUploading,
    error,
    progress,
  };
}