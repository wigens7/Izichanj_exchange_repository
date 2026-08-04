import type { Express } from "express";
import https from "https";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";

export function registerObjectStorageRoutes(app: Express): void {
  const objectStorageService = new ObjectStorageService();

  app.post("/api/uploads/request-url", async (req, res) => {
    try {
      const { name, size, contentType } = req.body || {};

      if (!name) {
        return res.status(400).json({ error: "Missing required field: name" });
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

  app.post("/api/upload-image", (req, res) => {
    try {
      const apiKey = process.env.IMGBB_API_KEY || "78d7e064b5ed8b0d0c2b52cea93405b7";
      
      if (!req.body) {
        return res.status(400).json({ error: "Empty request body" });
      }

      let imagePayload = req.body.image || req.body.file || req.body.base64;
      if (!imagePayload) {
        return res.status(400).json({ error: "No image file provided" });
      }

      if (typeof imagePayload === "object" && imagePayload.url) {
        imagePayload = imagePayload.url;
      }

      const cleanBase64 = typeof imagePayload === "string" 
        ? imagePayload.replace(/^data:image\/\w+;base64,/, "")
        : String(imagePayload);

      const postData = new URLSearchParams({ image: cleanBase64 }).toString();

      const options = {
        hostname: "api.imgbb.com",
        path: `/1/upload?key=${apiKey}`,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(postData),
        },
      };

      const request = https.request(options, (response) => {
        let body = "";
        response.on("data", (chunk) => (body += chunk));
        response.on("end", () => {
          try {
            const data = JSON.parse(body);
            if (data && data.success && data.data) {
              const directImageUrl = data.data.display_url || data.data.url;
              return res.json({ 
                url: directImageUrl, 
                path: directImageUrl,
                uploadURL: directImageUrl,
                imageUrl: directImageUrl,
                fileUrl: directImageUrl
              });
            } else {
              console.error("ImgBB API Response Error:", data);
              return res.status(400).json({ error: "ImgBB upload failed" });
            }
          } catch (e) {
            console.error("JSON parse error:", e);
            return res.status(500).json({ error: "Invalid response from ImgBB" });
          }
        });
      });

      request.on("error", (err) => {
        console.error("HTTPS Request Error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Upload request failed" });
        }
      });

      request.write(postData);
      request.end();
    } catch (err) {
      console.error("Image Proxy Upload Error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal upload server error" });
      }
    }
  });

  app.get(/^\/objects\/(.+)$/, async (req, res) => {
    try {
      const objectPath = req.params[0];
      const fullPath = "/objects/" + objectPath;
      await objectStorageService.downloadObject(fullPath, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (!res.headersSent) {
        return res.status(500).json({ error: "Failed to serve object" });
      }
    }
  });
}
