  /**
   * Safe ImgBB Upload Route with Error Handling
   */
  app.post("/api/upload-image", async (req, res) => {
    try {
      const apiKey = process.env.IMGBB_API_KEY || "78d7e064b5ed8b0d0c2b52cea93405b7";
      
      // Safe check for request body
      if (!req.body) {
        return res.status(400).json({ error: "Empty request body" });
      }

      let imagePayload = req.body.image || req.body.file || req.body.base64;
      
      if (!imagePayload) {
        return res.status(400).json({ error: "No image payload provided" });
      }

      if (typeof imagePayload === "object" && imagePayload.url) {
        imagePayload = imagePayload.url;
      }

      let cleanBase64 = "";
      if (typeof imagePayload === "string") {
        cleanBase64 = imagePayload.replace(/^data:image\/\w+;base64,/, "");
      } else {
        cleanBase64 = String(imagePayload);
      }

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
        const imageUrl = data.data.url || data.data.display_url;
        return res.json({ 
          url: imageUrl, 
          path: imageUrl,
          uploadURL: imageUrl 
        });
      } else {
        console.error("ImgBB API Response Error:", data);
        return res.status(400).json({ error: "ImgBB rejected the image format" });
      }
    } catch (err) {
      console.error("Internal Upload Error:", err);
      // Catching error prevents Railway from crashing
      return res.status(500).json({ error: "Internal server error during upload" });
    }
  });
