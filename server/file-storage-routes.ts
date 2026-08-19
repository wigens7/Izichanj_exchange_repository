import type { Express } from "express";
    import { db } from "./db";
    import { sql } from "drizzle-orm";
    import { isAuthenticated } from "./auth";

    // Maximum binary size accepted (5 MB)
    const MAX_FILE_BYTES = 5 * 1024 * 1024;

    /**
    * Create the app_files table if it does not exist.
    * This table holds every image uploaded through the platform (KYC, deposit
    * proofs, P2P chat) so no external image host is required.
    */
    async function runFileStorageMigrations(): Promise<void> {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS app_files (
          id          SERIAL PRIMARY KEY,
          profile_id  INTEGER NOT NULL REFERENCES profiles(id),
          purpose     TEXT NOT NULL DEFAULT 'general',
          mime_type   TEXT NOT NULL DEFAULT 'image/jpeg',
          file_size   INTEGER,
          data        BYTEA NOT NULL,
          created_at  TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_app_files_profile ON app_files(profile_id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_app_files_purpose ON app_files(purpose)`);
      console.log("[file-storage] app_files table ready");

      // One-time cleanup: null out broken proof URLs that stored the API endpoint
      // path instead of an actual image URL (from the ImgBB failure period).
      const cleaned = await db.execute(sql`
        UPDATE deposits
        SET proof_image_url = NULL
        WHERE proof_image_url = '/api/upload-image'
      `);
      const cleanedCount = (cleaned as any)?.rowCount ?? 0;
      if (cleanedCount > 0) console.log(`[file-storage] cleared ${cleanedCount} broken deposit proof URLs`);
    } catch (e) {
      console.warn("[file-storage] migration:", (e as Error).message);
    }
    }

    export async function registerFileStorageRoutes(app: Express): Promise<void> {
    await runFileStorageMigrations();

    /**
     * POST /api/files/upload
     * Accept a base64-encoded image (with or without the data-URL prefix),
     * store it in the database, and return a secure serving URL.
     * No external service is contacted.
     */
    app.post("/api/files/upload", isAuthenticated, async (req: any, res) => {
      const profileId = req.session?.profileId;
      if (!profileId) return res.status(401).json({ error: "Unauthorized" });

      try {
        const rawImage: string =
          req.body?.image ?? req.body?.file ?? req.body?.base64 ?? "";
        const purpose: string = (req.body?.purpose ?? "general")
          .toString()
          .slice(0, 50);

        if (!rawImage) return res.status(400).json({ error: "No image provided" });

        // Detect MIME type from data-URL prefix; fall back to JPEG
        const mimeMatch = rawImage.match(/^data:(image\/[a-zA-Z+]+);base64,/i);
        const mimeType = mimeMatch
          ? mimeMatch[1].toLowerCase()
          : "image/jpeg";

        // Strip the data-URL prefix and decode to binary
        const base64 = rawImage.replace(/^data:[^;,]+;base64,/i, "").trim();
        const buffer = Buffer.from(base64, "base64");

        if (buffer.length > MAX_FILE_BYTES) {
          return res
            .status(413)
            .json({ error: "Image too large (maximum 5 MB)" });
        }

        // Persist to database — use SQL decode() to pass base64 directly to PostgreSQL
        // and avoid Buffer serialisation issues with the pg/neon driver.
        const rows = await db.execute(sql`
          INSERT INTO app_files (profile_id, purpose, mime_type, file_size, data)
          VALUES (
            ${profileId},
            ${purpose},
            ${mimeType},
            ${buffer.length},
            decode(${base64}, 'base64')
          )
          RETURNING id
        `);
        const id = (rows as any[])[0]?.id;
        if (!id) throw new Error("Insert returned no ID");

        const url = `/api/files/${id}`;
        return res.status(201).json({
          id,
          url,
          path: url,
          uploadURL: url,
          imageUrl: url,
          fileUrl: url,
        });
      } catch (e) {
        console.error("[file-storage upload] error:", (e as any)?.message || e);
        return res.status(500).json({ error: "Upload failed", detail: (e as any)?.message || "unknown" });
      }
    });

    /**
     * GET /api/files/:id
     * Serve a stored file.  Access is granted only to the file owner or any
     * admin account.  The response is the raw binary image with the correct
     * Content-Type so it can be used directly in <img src="..."> tags.
     */
    app.get("/api/files/:id", isAuthenticated, async (req: any, res) => {
      const profileId = req.session?.profileId;
      if (!profileId) return res.status(401).json({ error: "Unauthorized" });

      const fileId = Number(req.params.id);
      if (!fileId || isNaN(fileId)) {
        return res.status(400).json({ error: "Invalid file ID" });
      }

      try {
        const rows = await db.execute(sql`
          SELECT
            f.id,
            f.profile_id,
            f.mime_type,
            f.data,
            p.role AS viewer_role
          FROM app_files f
          JOIN profiles p ON p.id = ${profileId}
          WHERE f.id = ${fileId}
          LIMIT 1
        `);
        const file = (rows as any[])[0];
        if (!file) return res.status(404).json({ error: "File not found" });

        // Only the owner or an admin may access the file
        if (file.profile_id !== profileId && file.viewer_role !== "admin") {
          return res.status(403).json({ error: "Forbidden" });
        }

        const buffer =
          file.data instanceof Buffer ? file.data : Buffer.from(file.data);

        res.setHeader("Content-Type", file.mime_type || "image/jpeg");
        res.setHeader("Content-Length", buffer.length);
        res.setHeader("Cache-Control", "private, max-age=3600");
        return res.end(buffer);
      } catch (e) {
        console.error("[file-storage serve]", e);
        return res.status(500).json({ error: "Failed to serve file" });
      }
    });
    }
    