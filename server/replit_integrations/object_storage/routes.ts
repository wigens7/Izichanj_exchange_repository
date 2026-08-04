  /**
   * Direct Upload Route forcing JPEG format return for Chat & KYC
   */
  app.post("/api/upload-image", async (req, res) => {
    try {
      const apiKey = process.env.IMGBB_API_KEY || "78d7e064b5ed8b0d0c2b52cea93405b7";
      
      let imagePayload = req.body.image || req.body.file || req.body.base64;
      if (!imagePayload) {
        return res.status(400).json({ error: "No image file provided" });
      }

      if (typeof imagePayload === "object" && imagePayload.url) {
        imagePayload = imagePayload.url;
      }

      let cleanBase64 = typeof imagePayload === "string" 
        ? imagePayload.replace(/^data:image\/\w+;base64,/, "")
        : String(imagePayload);

      const formData = new URLSearchParams();
      formData.append("image", cleanBase64);

      const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      const data = await response.json();

      if (data && data.success && data.data) {
        // Force the direct display URL (which ends with pure image extension like .jpg/.png)
        const directJpegUrl = data.data.display_url || data.data.url;

        return res.json({ 
          url: directJpegUrl, 
          path: directJpegUrl,
          uploadURL: directJpegUrl,
          // Extra fields in case frontend looks for different property names
          imageUrl: directJpegUrl,
          fileUrl: directJpegUrl
        });
      } else {
        console.error("ImgBB Upload Failure:", data);
        return res.status(400).json({ error: "Failed to process image format" });
      }
    } catch (err) {
      console.error("Image Proxy Upload Error:", err);
      return res.status(500).json({ error: "Internal upload server error" });
    }
  });
