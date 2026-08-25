import { Response } from "express";

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

  async downloadObject(filePath: string, res: Response) {
    try {
      if (!filePath) {
        return res.status(404).json({ error: "Object not found" });
      }

      // Netwaye chemen an si gen /objects/ devan l
      let cleanUrl = filePath.replace(/^\/objects\//, "");

      // Si se deja yon URL ImgBB (https://i.ibb.co/...)
      if (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://")) {
        return res.redirect(301, cleanUrl);
      }

      return res.status(404).json({ error: "Image file format invalid or not found" });
    } catch (error) {
      console.error("Error serving object:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to process image" });
      }
    }
  }

  normalizeObjectEntityPath(rawPath: string): string {
    return rawPath || "";
  }

  async trySetObjectEntityAclPolicy(rawPath: string): Promise<string> {
    return rawPath;
  }

  async canAccessObjectEntity(): Promise<boolean> {
    return true;
  }
}

export const objectStorageClient = new ObjectStorageService();
