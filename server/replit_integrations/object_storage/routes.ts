  app.post("/api/upload-image", async (req, res) => {
    try {
      const apiKey = process.env.IMGBB_API_KEY || "78d7e064b5ed8b0d0c2b52cea93405b7";
      
      // Check for image data in body
      let imagePayload = req.body.image || req.body.file || req.body.base64;
      
      if (!imagePayload) {
        return res.status(400).json({ error: "No image file provided" });
      }

      // If it's already an object with url, extract it
      if (typeof imagePayload === "object" && imagePayload.url) {
        imagePayload = imagePayload.url;
      }

      const formData = new URLSearchParams();
      
      // Clean base64 string if present
      if (typeof imagePayload === "string") {
        const cleanBase64 = imagePayload.replace(/^data:image\/\w+;base64,/, "");
        formData.append("image", cleanBase64);
      } else {
        formData.append("image", imagePayload);
      }

      const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      
      if (data.success && data.data) {
        // Return direct display URL so both buyer and merchant can view it directly
        const imageUrl = data.data.url || data.data.display_url;
        return res.json({ 
          url: imageUrl, 
          path: imageUrl,
          uploadURL: imageUrl 
        });
      } else {
        console.error("ImgBB Upload Failure:", data);
        return res.status(500).json({ error: "Failed to upload image to storage" });
      }
    } catch (err) {
      console.error("Image Proxy Upload Error:", err);
      return res.status(500).json({ error: "Internal upload server error" });
    }
  });
