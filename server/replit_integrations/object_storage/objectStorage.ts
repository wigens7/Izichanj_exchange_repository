import { Response } from "express";

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

  getPrivateObjectDir(): string {
    return process.env.PRIVATE_OBJECT_DIR || "kyc-document";
  }

  async getObjectEntityUploadURL(): Promise<string> {
    return `/api/upload-image`;
  }

  async getObjectEntityFile(objectPath: string): Promise<string> {
    return objectPath;
  }

  async downloadObject(
    filePath: string,
    res: Response,
    cacheTtlSec: number = 3600
  ) {
    try {
      if (!filePath) {
        return res.status(404).json({ error: "Object not found" });
      }

      if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
        return res.redirect(filePath);
      }

      const cleanUrl = filePath.replace(/^\/objects\//, "");
      if (cleanUrl.startsWith("http")) {
        return res.redirect(cleanUrl);
      }

      return res.status(404).json({ error: "Object not found" });
    } catch (error) {
      console.error("Error redirecting/downloading image:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error retrieving file" });
      }
    }
  }

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
