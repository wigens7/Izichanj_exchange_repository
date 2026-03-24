/**
 * Compress an image file to be under maxBytes using Canvas API.
 * Preserves readability by iterating quality from 0.85 down to 0.40.
 * Returns a new File with the compressed data.
 */
export async function compressImage(
  file: File,
  maxBytes = 1.5 * 1024 * 1024, // 1.5 MB default
  maxDimension = 1920
): Promise<File> {
  if (file.size <= maxBytes) return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width >= height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));

      ctx.drawImage(img, 0, 0, width, height);

      const tryQuality = (quality: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Compression failed"));

            if (blob.size <= maxBytes || quality <= 0.35) {
              const ext = file.name.replace(/\.[^.]+$/, "") + ".jpg";
              resolve(new File([blob], ext, { type: "image/jpeg" }));
            } else {
              tryQuality(Math.round((quality - 0.1) * 10) / 10);
            }
          },
          "image/jpeg",
          quality
        );
      };

      tryQuality(0.85);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for compression"));
    };

    img.src = url;
  });
}
