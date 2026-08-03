import { createClient } from "@supabase/supabase-js";
import { Response } from "express";
import { randomUUID } from "crypto";

// Initialize Supabase Client using environment variables from Railway
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  // Gets the bucket directory name from environment variables
  getPrivateObjectDir(): string {
    return (
      process.env.PRIVATE_OBJECT_DIR ||
      process.env.SUPABASE_STORAGE_BUCKET ||
      "kyc-document"
    );
  }

  // Generates a Signed Upload URL directly via Supabase Storage
  async getObjectEntityUploadURL(): Promise<string> {
    const bucketName = this.getPrivateObjectDir();
    const objectId = randomUUID();
    const filePath = `uploads/${objectId}`;

    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUploadUrl(filePath);

    if (error || !data) {
      console.error("Supabase Storage Upload Error:", error);
      throw new Error(`Failed to generate upload URL: ${error?.message}`);
    }

    return data.signedUrl;
  }

  // Downloads or streams an object directly to the response
  async downloadObject(
    filePath: string,
    res: Response,
    cacheTtlSec: number = 3600
  ) {
    try {
      const bucketName = this.getPrivateObjectDir();
      const cleanPath = filePath.replace(/^\/objects\//, "");

      const { data, error } = await supabase.storage
        .from(bucketName)
        .download(cleanPath);

      if (error || !data) {
        throw new ObjectNotFoundError();
      }

      const buffer = Buffer.from(await data.arrayBuffer());

      res.set({
        "Content-Type": data.type || "application/octet-stream",
        "Content-Length": buffer.length,
        "Cache-Control": `public, max-age=${cacheTtlSec}`,
      });

      res.send(buffer);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  // Normalizes path for database storage
  normalizeObjectEntityPath(rawPath: string): string {
    if (!rawPath) return rawPath;
    if (rawPath.startsWith("/objects/")) return rawPath;

    try {
      const url = new URL(rawPath);
      const pathname = url.pathname;
      const parts = pathname.split("/");
      const fileName = parts[parts.length - 1];
      return `/objects/uploads/${fileName}`;
    } catch {
      return rawPath;
    }
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: any
  ): Promise<string> {
    return this.normalizeObjectEntityPath(rawPath);
  }

  async canAccessObjectEntity(): Promise<boolean> {
    return true;
  }
}
