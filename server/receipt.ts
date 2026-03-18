import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import path from "path";
import { PassThrough } from "stream";
import { EXCHANGE_RATE_USDT_HTG } from "@shared/constants";

const LOGO_PATH = path.join(process.cwd(), "client/src/assets/logo.png");
const BRAND_DARK = "#0A0F1E";
const BRAND_INDIGO = "#4F46E5";
const BRAND_LIGHT = "#F8FAFC";
const TEXT_MUTED = "#94A3B8";

function maskDestination(value: string | null | undefined): string {
  if (!value) return "N/A";
  const clean = value.replace(/\D/g, "");
  if (clean.length >= 8) {
    const first = clean.slice(0, 4);
    const last = clean.slice(-2);
    const masked = "x".repeat(Math.max(clean.length - 6, 2));
    return `${first}-${masked}-${last}`;
  }
  if (value.length > 8) {
    return value.slice(0, 4) + "xxxx" + value.slice(-4);
  }
  return value;
}

function maskWallet(address: string | null | undefined): string {
  if (!address) return "N/A";
  if (address.length > 10) {
    return address.slice(0, 6) + "..." + address.slice(-4);
  }
  return address;
}

export interface ReceiptData {
  receiptId: string;
  type: "deposit" | "withdrawal";
  transactionRef: string;
  createdAt: Date;
  amountUsdt: number;
  fee: number;
  exchangeRate: number;
  finalAmountHtg: number;
  destination?: string | null;
  walletAddress?: string | null;
  currency?: string;
  network?: string;
  userName: string;
  userEmail: string;
  status: string;
}

export async function generateReceiptPDF(data: ReceiptData): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 0,
      info: {
        Title: `Izichanj Receipt - ${data.receiptId}`,
        Author: "Izichanj",
        Subject: "Transaction Receipt",
      },
    });

    const buffers: Buffer[] = [];
    const stream = new PassThrough();
    stream.on("data", (chunk) => buffers.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(buffers)));
    stream.on("error", reject);
    doc.pipe(stream);

    const W = doc.page.width;
    const H = doc.page.height;

    // ── Background ──
    doc.rect(0, 0, W, H).fill(BRAND_LIGHT);

    // ── Watermark logo ──
    try {
      doc.save();
      doc.opacity(0.04);
      const wmSize = 320;
      doc.image(LOGO_PATH, (W - wmSize) / 2, (H - wmSize) / 2, { width: wmSize });
      doc.restore();
    } catch (_) {}

    // ── Header bar ──
    doc.rect(0, 0, W, 90).fill(BRAND_DARK);

    // Logo in header
    try {
      doc.image(LOGO_PATH, 36, 18, { height: 54 });
    } catch (_) {}

    // App name in header
    doc.font("Helvetica-Bold").fontSize(22).fillColor("#FFFFFF");
    doc.text("IZICHANJ", 110, 28);
    doc.font("Helvetica").fontSize(10).fillColor("#94A3B8");
    doc.text("Crypto to Cash Exchange", 111, 54);

    // Receipt label (right side of header)
    doc.font("Helvetica-Bold").fontSize(14).fillColor("#FFFFFF");
    doc.text("TRANSACTION RECEIPT", W - 230, 34, { width: 200, align: "right" });
    doc.font("Helvetica").fontSize(9).fillColor("#CBD5E1");
    doc.text(`Ref: ${data.receiptId.toUpperCase()}`, W - 230, 56, { width: 200, align: "right" });

    // ── Hero colored band ──
    const isDeposit = data.type === "deposit";
    const heroColor = isDeposit ? "#10B981" : "#F59E0B";
    doc.rect(0, 90, W, 6).fill(heroColor);

    // ── Status badge ──
    const badgeY = 112;
    const badgeText = "APPROVED";
    doc.roundedRect(36, badgeY, 82, 22, 4).fill(isDeposit ? "#D1FAE5" : "#FEF3C7");
    doc.font("Helvetica-Bold").fontSize(9).fillColor(isDeposit ? "#065F46" : "#92400E");
    doc.text(badgeText, 38, badgeY + 7, { width: 78, align: "center" });

    // Type label
    const typeLabel = isDeposit
      ? `USDT Deposit → HTG${data.network ? ` (${data.network})` : ""}`
      : `${data.currency || "HTG"} Withdrawal`;
    doc.font("Helvetica-Bold").fontSize(13).fillColor(BRAND_DARK);
    doc.text(typeLabel, 130, badgeY + 4);

    // ── Divider ──
    doc.moveTo(36, 148).lineTo(W - 36, 148).strokeColor("#E2E8F0").lineWidth(1).stroke();

    // ── Amount hero ──
    const netUsdt = data.amountUsdt - data.fee;
    doc.font("Helvetica-Bold").fontSize(36).fillColor(BRAND_INDIGO);
    doc.text(`${netUsdt.toFixed(2)} USDT`, 0, 164, { align: "center" });
    doc.font("Helvetica").fontSize(13).fillColor(TEXT_MUTED);
    doc.text(`≈ ${data.finalAmountHtg.toLocaleString("fr-HT", { minimumFractionDigits: 2 })} HTG`, 0, 206, { align: "center" });

    // ── Divider ──
    doc.moveTo(36, 236).lineTo(W - 36, 236).strokeColor("#E2E8F0").lineWidth(1).stroke();

    // ── Detail rows ──
    const detailRows: [string, string][] = [
      ["Transaction ID", data.transactionRef],
      ["Date & Time", new Date(data.createdAt).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })],
      ["Transaction Type", isDeposit ? "Crypto Deposit (USDT → HTG)" : "Mobile Money Withdrawal"],
      ["Gross Amount", `${data.amountUsdt.toFixed(2)} USDT`],
      ["Service Fee", `${data.fee.toFixed(2)} USDT`],
      ["Net Amount", `${netUsdt.toFixed(2)} USDT`],
      ["Exchange Rate", `1 USDT = ${data.exchangeRate.toFixed(2)} HTG`],
      ["Amount Received (HTG)", `${data.finalAmountHtg.toLocaleString("fr-HT", { minimumFractionDigits: 2 })} HTG`],
      isDeposit
        ? ["Network", data.network || "USDT TRC20"]
        : ["Destination", maskDestination(data.destination)],
      ["Account Name", data.userName],
      ["Account Email", data.userEmail],
      ["Status", "Approved ✓"],
    ];

    const rowStartY = 252;
    const rowH = 30;
    const colLeft = 36;
    const colRight = W / 2 + 10;

    detailRows.forEach(([label, value], i) => {
      const rowY = rowStartY + i * rowH;
      const bgColor = i % 2 === 0 ? "#F1F5F9" : "#FFFFFF";
      doc.rect(colLeft, rowY, W - 72, rowH).fill(bgColor);
      doc.font("Helvetica").fontSize(9).fillColor(TEXT_MUTED);
      doc.text(label, colLeft + 10, rowY + 10, { width: colRight - colLeft - 20 });
      doc.font("Helvetica-Bold").fontSize(9).fillColor(BRAND_DARK);
      doc.text(value, colRight, rowY + 10, { width: W - colRight - 46, align: "right" });
    });

    const tableBottom = rowStartY + detailRows.length * rowH + 10;

    // ── QR Code ──
    const verifyUrl = `https://izichanj.com`;
    const qrBuffer = await QRCode.toBuffer(verifyUrl, {
      type: "png",
      width: 100,
      margin: 1,
      color: { dark: BRAND_DARK, light: "#FFFFFF" },
    });

    const qrX = W - 36 - 110;
    const qrY = tableBottom + 10;
    doc.roundedRect(qrX - 8, qrY - 8, 126, 126, 6).fill("#FFFFFF").strokeColor("#E2E8F0").lineWidth(1).stroke();
    doc.image(qrBuffer, qrX, qrY, { width: 110 });
    doc.font("Helvetica").fontSize(7).fillColor(TEXT_MUTED);
    doc.text("izichanj.com", qrX - 8, qrY + 116, { width: 126, align: "center" });

    // ── Website text beside QR ──
    doc.font("Helvetica-Bold").fontSize(10).fillColor(BRAND_DARK);
    doc.text("Izichanj Platform", colLeft, tableBottom + 14, { width: qrX - colLeft - 16 });
    doc.font("Helvetica").fontSize(8.5).fillColor(TEXT_MUTED);
    doc.text(
      "This receipt was issued by Izichanj, the trusted crypto-to-cash exchange platform. For support or inquiries, visit our website.",
      colLeft, tableBottom + 30, { width: qrX - colLeft - 16 }
    );
    doc.font("Helvetica").fontSize(8).fillColor(BRAND_INDIGO);
    doc.text(verifyUrl, colLeft, tableBottom + 80, { width: qrX - colLeft - 16 });

    // ── Footer bar ──
    const footerY = H - 54;
    doc.rect(0, footerY, W, 54).fill(BRAND_DARK);
    doc.moveTo(0, footerY).lineTo(W, footerY).strokeColor(BRAND_INDIGO).lineWidth(2).stroke();
    doc.font("Helvetica-Oblique").fontSize(8).fillColor("#64748B");
    doc.text(
      "This is a computer-generated receipt and does not require a physical signature.",
      36, footerY + 12, { width: W - 72, align: "center" }
    );
    doc.font("Helvetica").fontSize(7.5).fillColor("#475569");
    doc.text(
      `© ${new Date().getFullYear()} Izichanj · izichanj.com · All rights reserved`,
      36, footerY + 30, { width: W - 72, align: "center" }
    );

    doc.end();
  });
}
