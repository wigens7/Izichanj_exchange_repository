/**
 * Server-side image compression for KYC documents.
 * Downloads from object storage, compresses with sharp, re-uploads, returns new objectPath.
 */
import sharp from "sharp";
import { ObjectStorageService } from "./replit_integrations/object_storage";

const MAX_KYC_BYTES = 1.5 * 1024 * 1024; // 1.5 MB — Strowallet rejects > 2 MB

/**
 * Download, compress and re-upload a KYC image if it exceeds MAX_KYC_BYTES.
 * If already small enough — or if the path looks like an external URL — returns as-is.
 * Returns the (possibly new) object path to use in Strowallet calls.
 */
export async function ensureKycImageSize(objectPath: string): Promise<string> {
  if (!objectPath) return objectPath;

  // External URLs (http/https that aren't our object storage) — skip
  if (objectPath.startsWith("http") && !objectPath.startsWith("https://storage.googleapis.com")) {
    return objectPath;
  }

  try {
    const storage = new ObjectStorageService();

    // Download the image buffer from object storage
    const file = await storage.getObjectEntityFile(objectPath);
    const [buffer] = await file.download();

    if (buffer.length <= MAX_KYC_BYTES) {
      console.log(`[KYC compress] ${objectPath} is ${(buffer.length / 1024).toFixed(0)} KB — no compression needed`);
      return objectPath;
    }

    console.log(`[KYC compress] ${objectPath} is ${(buffer.length / 1024).toFixed(0)} KB — compressing…`);

    // Compress with sharp — try quality 85 → 70 → 55 → 40 until under limit
    let compressed: Buffer | null = null;
    const qualities = [85, 70, 55, 40];

    for (const q of qualities) {
      const attempt = await sharp(buffer)
        .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: q, progressive: true })
        .toBuffer();

      console.log(`[KYC compress] quality=${q} → ${(attempt.length / 1024).toFixed(0)} KB`);
      compressed = attempt;
      if (attempt.length <= MAX_KYC_BYTES) break;
    }

    if (!compressed) return objectPath;

    // Upload compressed image back to object storage
    const presignedUrl = await storage.getObjectEntityUploadURL();
    const putRes = await fetch(presignedUrl, {
      method: "PUT",
      body: compressed,
      headers: { "Content-Type": "image/jpeg" },
    });

    if (!putRes.ok) {
      console.error("[KYC compress] Re-upload failed:", putRes.status, await putRes.text());
      return objectPath; // Fall back to original if upload fails
    }

    const newPath = storage.normalizeObjectEntityPath(presignedUrl);
    console.log(`[KYC compress] Re-uploaded compressed image → ${newPath} (${(compressed.length / 1024).toFixed(0)} KB)`);
    return newPath;
  } catch (err) {
    console.error("[KYC compress] Error — falling back to original path:", err);
    return objectPath; // Safe fallback — don't break the main flow
  }
}
