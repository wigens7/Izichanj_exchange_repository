import { Response } from "express";
import { randomUUID } from "crypto";

// ImgBB API Key provided for direct image uploading
const IMGBB_API_KEY = process.env.IMGBB_API_KEY || "78d7e064b5ed8b0d0c2b52cea93405b7";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  // Returns default storage directory tag
  getPrivateObjectDir(): string {
    return process.env.PRIVATE_OBJECT_DIR || "kyc-document";
  }

  // Generates or handles direct ImgBB endpoint upload URL
  async getObjectEntityUploadURL(): Promise<string> {
    return `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`;
  }

  // Streams/Redirects to the uploaded image URL
  async downloadObject(
    filePath: string,
    res: Response,
    cacheTtlSec: number = 3600
  ) {
    try {
      if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
        return res.redirect(filePath);
      }

      const cleanUrl = filePath.replace(/^\/objects\//, "");
      if (cleanUrl.startsWith("http")) {
        return res.redirect(cleanUrl);
      }

      res.status(404).json({ error: "Object not found" });
    } catch (error) {
      console.error("Error redirecting/downloading image:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error retrieving file" });
      }
    }
  }

  // Normalizes external ImgBB image URL for standard storage in DB
  normalizeObjectEntityPath(rawPath: string): string {
    if (!rawPath) return rawPath;
    return rawPath;
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
