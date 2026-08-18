import type { Express } from "express";
    import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
    import { URL } from "url";

    const ALLOWED_IMAGE_HOSTS = new Set(["i.ibb.co", "ibb.co", "imgbb.com", "www.imgbb.com"]);
    const MAX_PROXY_IMAGE_BYTES = 10 * 1024 * 1024;

    function isAllowedImageUrl(rawUrl: string): boolean {
    try {
      const url = new URL(rawUrl);
      return url.protocol === "https:" && ALLOWED_IMAGE_HOSTS.has(url.hostname.toLowerCase());
    } catch {
      return false;
    }
    }

    async function fetchImgBbImage(rawUrl: string): Promise<{ body: Buffer; contentType: string }> {
    if (!isAllowedImageUrl(rawUrl)) {
      throw new Error("Unsupported image host");
    }

    const response = await fetch(rawUrl, {
      headers: { Accept: "image/*,text/html;q=0.9" },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`ImgBB returned ${response.status}`);
    }
    if (response.url && !isAllowedImageUrl(response.url)) {
      throw new Error("ImgBB redirected to an unsupported host");
    }

    const contentType = response.headers.get("content-type") || "";
    const body = Buffer.from(await response.arrayBuffer());
    if (body.byteLength > MAX_PROXY_IMAGE_BYTES) {
      throw new Error("Image is too large");
    }

    if (contentType.toLowerCase().startsWith("image/")) {
      return { body, contentType: contentType.split(";")[0] };
    }

    // ImgBB page URLs are not valid <img> sources. Resolve the image from the
    // page's og:image metadata so old database rows continue to work.
    const html = body.toString("utf8");
    const ogImage =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1];

    if (!ogImage) {
      throw new Error("ImgBB page has no image");
    }

    const resolvedUrl = new URL(ogImage, rawUrl).toString();
    if (!isAllowedImageUrl(resolvedUrl)) {
      throw new Error("Resolved image host is not allowed");
    }

    const imageResponse = await fetch(resolvedUrl, {
      headers: { Accept: "image/*" },
      redirect: "follow",
    });
    if (!imageResponse.ok) {
      throw new Error(`ImgBB image returned ${imageResponse.status}`);
    }
    if (imageResponse.url && !isAllowedImageUrl(imageResponse.url)) {
      throw new Error("ImgBB image redirected to an unsupported host");
    }

    const imageType = imageResponse.headers.get("content-type") || "";
    if (!imageType.toLowerCase().startsWith("image/")) {
      throw new Error("ImgBB did not return an image");
    }

    const imageBody = Buffer.from(await imageResponse.arrayBuffer());
    if (imageBody.byteLength > MAX_PROXY_IMAGE_BYTES) {
      throw new Error("Image is too large");
    }

    return { body: imageBody, contentType: imageType.split(";")[0] };
    }

    // ImgBB returns several URLs; only some point at the raw image file. Prefer
    // the direct i.ibb.co file links over the viewer page URL, which 404s in <img>.
    function pickDirectImageUrl(data: any): string | null {
    const candidates = [
      data?.image?.url,
      data?.display_url,
      data?.url,
      data?.medium?.url,
      data?.thumb?.url,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    const direct = candidates.find((value) => /^https:\/\/i\.ibb\.co\//i.test(value));
    return direct || candidates[0] || null;
    }

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

    // Upload a proof image to ImgBB and return the direct public URL.
    // Uses fetch (undici) instead of raw https.request so Content-Length is
    // handled automatically and large base64 payloads are sent correctly.
    app.post("/api/upload-image", async (req, res) => {
      try {
        const apiKey = process.env.IMGBB_API_KEY;
        if (!apiKey) {
          return res.status(503).json({ error: "Image upload is temporarily unavailable" });
        }
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

        const cleanBase64 = (typeof imagePayload === "string"
          ? imagePayload.replace(/^data:[^;,]*;base64,/i, "")
          : String(imagePayload)
        ).trim();

        const formBody = new URLSearchParams({ image: cleanBase64 }).toString();
        const imgbbRes = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formBody,
        });

        const responseText = await imgbbRes.text();
        let data: any;
        try {
          data = JSON.parse(responseText);
        } catch {
          console.error("[ImgBB] Non-JSON response (HTTP", imgbbRes.status, "):", responseText.slice(0, 300));
          return res.status(502).json({ error: "ImgBB returned an unexpected response — check IMGBB_API_KEY" });
        }

        if (data && data.success && data.data) {
          const directImageUrl = pickDirectImageUrl(data.data);
          if (!directImageUrl) {
            console.error("[ImgBB] No usable image URL in response:", data);
            return res.status(502).json({ error: "ImgBB returned no image URL" });
          }
          return res.json({
            url: directImageUrl,
            path: directImageUrl,
            uploadURL: directImageUrl,
            imageUrl: directImageUrl,
            fileUrl: directImageUrl,
          });
        } else {
          const errMsg = data?.error?.message || data?.status_txt || "ImgBB upload failed";
          console.error("[ImgBB] Upload rejected:", JSON.stringify(data));
          return res.status(400).json({ error: errMsg });
        }
      } catch (err) {
        console.error("[ImgBB] Image upload error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Internal upload server error" });
        }
      }
    });

    // Serve ImgBB KYC images through the authenticated admin session. This
    // supports old ImgBB page URLs as well as direct image URLs and avoids
    // browser hotlink/CSP problems after the application domain changes.
    app.get("/api/admin/kyc-image", async (req: any, res) => {
      if (!req.session?.profileId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      try {
        const profile = await (await import("../../storage")).storage.getProfile(req.session.profileId);
        if (!profile || profile.role !== "admin") {
          return res.status(403).json({ message: "Forbidden" });
        }

        const rawUrl = typeof req.query.url === "string" ? req.query.url.trim() : "";
        if (!rawUrl || !isAllowedImageUrl(rawUrl)) {
          return res.status(400).json({ message: "Invalid image URL" });
        }

        const image = await fetchImgBbImage(rawUrl);
        res.setHeader("Cache-Control", "private, max-age=300");
        res.setHeader("Content-Type", image.contentType);
        return res.send(image.body);
      } catch (error) {
        console.error("[KYC image proxy] Failed to load ImgBB image:", error);
        return res.status(404).json({ message: "KYC image is unavailable" });
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
    