import type { Express, Request, Response } from "express";
import { db } from "../db";
import { p2pChatMessages, p2pOrders } from "../../shared/schema";
import { eq } from "drizzle-orm";

async function postOrderChatMessage(req: Request, res: Response) {
  const orderId = Number(req.params.orderId);
  const senderId = req.user!.id;

  const fileUrl: string | null =
    req.body.file_url ?? req.body.fileUrl ?? req.body.image_url ?? req.body.imageUrl ?? req.body.image ?? null;

  const message: string = (req.body.message ?? "").toString().trim();

  if (!message && !fileUrl) {
    return res.status(400).json({ error: "Message or image is required." });
  }

  if (fileUrl && !/^data:image\/(jpeg|png);base64,/.test(fileUrl) && !/^https?:\/\//.test(fileUrl)) {
    return res.status(400).json({ error: "Invalid image payload." });
  }

  const [order] = await db
    .select({ id: p2pOrders.id, buyerId: p2pOrders.buyerId, sellerId: p2pOrders.sellerId })
    .from(p2pOrders)
    .where(eq(p2pOrders.id, orderId));

  if (!order) return res.status(404).json({ error: "Order not found." });
  if (order.buyerId !== senderId && order.sellerId !== senderId) {
    return res.status(403).json({ error: "Not a participant in this order." });
  }

  const [row] = await db
    .insert(p2pChatMessages)
    .values({
      orderId,
      senderId,
      message: message || null,
      fileUrl: fileUrl ?? null,
      fileName: fileUrl ? "chat-image.jpg" : null,
    })
    .returning();

  return res.status(201).json(row);
}

async function getOrderChatMessages(req: Request, res: Response) {
  const orderId = Number(req.params.orderId);
  const userId = req.user!.id;

  const [order] = await db
    .select({ id: p2pOrders.id, buyerId: p2pOrders.buyerId, sellerId: p2pOrders.sellerId })
    .from(p2pOrders)
    .where(eq(p2pOrders.id, orderId));

  if (!order) return res.status(404).json({ error: "Order not found." });
  if (order.buyerId !== userId && order.sellerId !== userId) {
    return res.status(403).json({ error: "Not a participant in this order." });
  }

  const rows = await db
    .select()
    .from(p2pChatMessages)
    .where(eq(p2pChatMessages.orderId, orderId))
    .orderBy(p2pChatMessages.createdAt);

  return res.json(rows);
}

export function registerP2pChatRoutes(app: Express) {
  app.post("/api/p2p/orders/:orderId/chat", postOrderChatMessage);
  app.get("/api/p2p/orders/:orderId/chat", getOrderChatMessages);
}