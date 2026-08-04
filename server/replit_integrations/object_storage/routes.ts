import type { Express } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";

/**
 * Register object storage routes for file uploads via ImgBB Integration.
 */
export function registerObjectStorageRoutes(app: Express): void {
  const objectStorageService = new ObjectStorageService();

  /**
   * Request an upload URL or handle metadata request.
   */
  app.post("/api/uploads/request-url", async (req, res) => {
    try {
      const { name, size, contentType } = req.body;

      if (!name) {
        return res.status(400).json({
          error: "Missing required field: name",
        });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  /**
   * Direct Backend Image Proxy Upload Route for ImgBB.
   * Eliminates "Failed to fetch" CORS errors on frontend P2P and KYC uploads.
   */
  app.post("/api/upload-image", async (req, res) => {
    try {
      const apiKey = process.env.IMGBB_API_KEY || "78d7e064b5ed8b0d0c2b52cea93405b7";
      
      const imagePayload = req.body.image || req.body.file || req.body.base64;
      if (!imagePayload) {
        return res.status(400).json({ error: "No image file provided" });
      }

      const formData = new URLSearchParams();
      formData.append("image", imagePayload.replace(/^data:image\/\w+;base64,/, ""));

      const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        return res.json({ 
          url: data.data.url, 
          path: data.data.url,
          uploadURL: data.data.url 
        });
      } else {
        return res.status(500).json({ error: "Failed to upload image to ImgBB storage" });
      }
    } catch (err) {
      console.error("Image Proxy Upload Error:", err);
      return res.status(500).json({ error: "Internal upload server error" });
    }
  });

  /**
   * Serve uploaded objects or redirect to stored image URL.
   */
  app.get(/^\/objects\/(.+)$/, async (req, res) => {
    try {
      const objectPath = req.params[0];
      const fullPath = "/objects/" + objectPath;
      await objectStorageService.downloadObject(fullPath, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}
