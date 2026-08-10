/**
 * KYC images are uploaded to ImgBB. Older records may contain either a direct
 * i.ibb.co image URL or an ibb.co/imgbb.com page URL, so the admin image proxy
 * normalizes both forms and keeps the ImgBB host out of the browser request.
 */
export function getKycImageSrc(rawUrl: unknown): string {
  if (typeof rawUrl !== "string") return "";

  const value = rawUrl.trim();
  if (!value) return "";

  if (/^https?:\/\/(?:i\.)?(?:ibb\.co|imgbb\.com)\//i.test(value)) {
    return `/api/admin/kyc-image?url=${encodeURIComponent(value)}`;
  }

  return value;
}