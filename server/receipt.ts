import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import path from "path";
import { PassThrough } from "stream";
import { EXCHANGE_RATE_USDT_HTG } from "@shared/constants";

const HAITI_TZ = "America/Port-au-Prince";
function haitiDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: HAITI_TZ, dateStyle: "long", timeStyle: "short" }).format(new Date(date as any));
}

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

export interface AdjustmentReceiptData {
  receiptId: string;
  createdAt: Date;
  userName: string;
  userEmail: string;
  userId: number;
  oldBalance: number;
  newBalance: number;
  adjustmentAmount: number;
  reason: string;
}

export async function generateAdjustmentReceiptPDF(data: AdjustmentReceiptData): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, info: { Title: `Izichanj Balance Adjustment - ${data.receiptId}`, Author: "Izichanj" } });

    const buffers: Buffer[] = [];
    const stream = new PassThrough();
    stream.on("data", (chunk) => buffers.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(buffers)));
    stream.on("error", reject);
    doc.pipe(stream);

    const W = doc.page.width;
    const H = doc.page.height;
    const isCredit = data.adjustmentAmount >= 0;

    doc.rect(0, 0, W, H).fill(BRAND_LIGHT);

    try {
      doc.save();
      doc.opacity(0.04);
      doc.image(LOGO_PATH, (W - 320) / 2, (H - 320) / 2, { width: 320 });
      doc.restore();
    } catch (_) {}

    doc.rect(0, 0, W, 90).fill(BRAND_DARK);
    try { doc.image(LOGO_PATH, 36, 18, { height: 54 }); } catch (_) {}
    doc.font("Helvetica-Bold").fontSize(22).fillColor("#FFFFFF").text("IZICHANJ", 110, 28);
    doc.font("Helvetica").fontSize(10).fillColor("#94A3B8").text("Crypto to Cash Exchange", 111, 54);
    doc.font("Helvetica-Bold").fontSize(14).fillColor("#FFFFFF").text("BALANCE ADJUSTMENT", W - 230, 34, { width: 200, align: "right" });
    doc.font("Helvetica").fontSize(9).fillColor("#CBD5E1").text(`Ref: ${data.receiptId.toUpperCase()}`, W - 230, 56, { width: 200, align: "right" });

    const heroColor = isCredit ? "#10B981" : "#EF4444";
    doc.rect(0, 90, W, 6).fill(heroColor);

    const badgeY = 112;
    const badgeLabel = isCredit ? "CREDIT" : "DEBIT";
    const badgeBg = isCredit ? "#D1FAE5" : "#FEE2E2";
    const badgeFg = isCredit ? "#065F46" : "#991B1B";
    doc.roundedRect(36, badgeY, 72, 22, 4).fill(badgeBg);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(badgeFg).text(badgeLabel, 38, badgeY + 7, { width: 68, align: "center" });
    doc.font("Helvetica-Bold").fontSize(13).fillColor(BRAND_DARK).text("Admin Balance Adjustment", 120, badgeY + 4);

    doc.moveTo(36, 148).lineTo(W - 36, 148).strokeColor("#E2E8F0").lineWidth(1).stroke();

    const adj = Math.abs(data.adjustmentAmount);
    const sign = isCredit ? "+" : "-";
    doc.font("Helvetica-Bold").fontSize(36).fillColor(isCredit ? "#10B981" : "#EF4444");
    doc.text(`${sign}${adj.toFixed(2)} USDT`, 0, 162, { align: "center" });
    doc.font("Helvetica").fontSize(12).fillColor(TEXT_MUTED);
    doc.text(`Balance: ${data.oldBalance.toFixed(2)} → ${data.newBalance.toFixed(2)} USDT`, 0, 206, { align: "center" });

    doc.moveTo(36, 234).lineTo(W - 36, 234).strokeColor("#E2E8F0").lineWidth(1).stroke();

    const detailRows: [string, string][] = [
      ["Receipt ID", data.receiptId.toUpperCase()],
      ["Date & Time", haitiDateTime(data.createdAt)],
      ["Transaction Type", "Admin Balance Adjustment"],
      ["Reason", data.reason],
      ["Previous Balance", `${data.oldBalance.toFixed(2)} USDT`],
      ["Adjustment Amount", `${sign}${adj.toFixed(2)} USDT`],
      ["New Balance", `${data.newBalance.toFixed(2)} USDT`],
      ["Account Name", data.userName],
      ["Account Email", data.userEmail],
      ["User ID", `#${data.userId}`],
      ["Issued By", "Izichanj Admin"],
    ];

    const rowStartY = 250;
    const rowH = 30;
    const colLeft = 36;
    const colRight = W / 2 + 10;

    detailRows.forEach(([label, value], i) => {
      const rowY = rowStartY + i * rowH;
      doc.rect(colLeft, rowY, W - 72, rowH).fill(i % 2 === 0 ? "#F1F5F9" : "#FFFFFF");
      doc.font("Helvetica").fontSize(9).fillColor(TEXT_MUTED).text(label, colLeft + 10, rowY + 10, { width: colRight - colLeft - 20 });
      doc.font("Helvetica-Bold").fontSize(9).fillColor(BRAND_DARK).text(value, colRight, rowY + 10, { width: W - colRight - 46, align: "right" });
    });

    const tableBottom = rowStartY + detailRows.length * rowH + 16;

    const verifyUrl = "https://izichanj.com";
    const qrBuffer = await QRCode.toBuffer(verifyUrl, { type: "png", width: 100, margin: 1, color: { dark: BRAND_DARK, light: "#FFFFFF" } });
    const qrX = W - 36 - 110;
    const qrY = tableBottom + 8;
    doc.roundedRect(qrX - 8, qrY - 8, 126, 126, 6).fill("#FFFFFF").strokeColor("#E2E8F0").lineWidth(1).stroke();
    doc.image(qrBuffer, qrX, qrY, { width: 110 });
    doc.font("Helvetica").fontSize(7).fillColor(TEXT_MUTED).text("izichanj.com", qrX - 8, qrY + 116, { width: 126, align: "center" });

    doc.font("Helvetica-Bold").fontSize(10).fillColor(BRAND_DARK).text("Izichanj Platform", colLeft, tableBottom + 12, { width: qrX - colLeft - 16 });
    doc.font("Helvetica").fontSize(8.5).fillColor(TEXT_MUTED).text(
      "This receipt was issued by Izichanj admin for an account balance adjustment. For inquiries, visit our website.",
      colLeft, tableBottom + 28, { width: qrX - colLeft - 16 }
    );
    doc.font("Helvetica").fontSize(8).fillColor(BRAND_INDIGO).text(verifyUrl, colLeft, tableBottom + 72, { width: qrX - colLeft - 16 });

    const footerY = H - 54;
    doc.rect(0, footerY, W, 54).fill(BRAND_DARK);
    doc.moveTo(0, footerY).lineTo(W, footerY).strokeColor(BRAND_INDIGO).lineWidth(2).stroke();
    doc.font("Helvetica-Oblique").fontSize(8).fillColor("#64748B").text("This is a computer-generated receipt and does not require a physical signature.", 36, footerY + 12, { width: W - 72, align: "center" });
    doc.font("Helvetica").fontSize(7.5).fillColor("#475569").text(`© ${new Date().getFullYear()} Izichanj · izichanj.com · All rights reserved`, 36, footerY + 30, { width: W - 72, align: "center" });

    doc.end();
  });
}

// ────────────────────────────────────────────────────────────────────
// Virtual Card Statement
// Generates a multi-page bank-style statement showing cardholder info,
// the statement period, a balance summary, and an itemised list of
// every transaction (funding events from our DB + spending events
// returned by the Strowallet card-transactions API).
// ────────────────────────────────────────────────────────────────────
export interface CardStatementTxn {
  date: Date;
  description: string;
  type: "credit" | "debit";   // credit = money added to card; debit = money spent
  amount: number;             // positive number; sign is implied by `type`
  currency: string;           // e.g. "USD"
  reference?: string | null;
  source?: string;            // "local" | "strowallet" | etc.
}

export interface CardStatementData {
  statementId: string;
  generatedAt: Date;
  periodStart: Date;
  periodEnd: Date;
  // Cardholder
  userName: string;
  userEmail: string;
  userId: number;
  // Card
  cardBrand: string;          // "Visa"
  cardLast4: string;          // "1234" — masked
  cardholderName: string;
  cardCurrency: string;       // "USD"
  cardStatus: string;         // "active" / "frozen" / etc.
  cardOpenedAt: Date;
  // Balances (best-effort; ending balance comes from Strowallet)
  endingBalance: number;
  // Transactions (already filtered to the period and sorted oldest → newest)
  transactions: CardStatementTxn[];
}

function fmtMoney(n: number, currency = "USD"): string {
  return `${n < 0 ? "-" : ""}${currency} ${Math.abs(n).toFixed(2)}`;
}

function fmtShortDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: HAITI_TZ, year: "numeric", month: "short", day: "2-digit" }).format(d);
}

export async function generateCardStatementPDF(data: CardStatementData): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 0,
      bufferPages: true,
      info: {
        Title: `Izichanj Card Statement - ${data.statementId}`,
        Author: "Izichanj",
        Subject: `Card statement ${fmtShortDate(data.periodStart)} – ${fmtShortDate(data.periodEnd)}`,
      },
    });

    const buffers: Buffer[] = [];
    const stream = new PassThrough();
    stream.on("data", (c) => buffers.push(c));
    stream.on("end", () => resolve(Buffer.concat(buffers)));
    stream.on("error", reject);
    doc.pipe(stream);

    const W = doc.page.width;
    const H = doc.page.height;
    const MARGIN = 36;

    // Page background
    doc.rect(0, 0, W, H).fill(BRAND_LIGHT);

    // Subtle watermark
    try {
      doc.save();
      doc.opacity(0.03);
      doc.image(LOGO_PATH, (W - 360) / 2, (H - 360) / 2, { width: 360 });
      doc.restore();
    } catch (_) {}

    // ── Header bar ──
    doc.rect(0, 0, W, 96).fill(BRAND_DARK);
    try { doc.image(LOGO_PATH, MARGIN, 20, { height: 56 }); } catch (_) {}
    doc.font("Helvetica-Bold").fontSize(22).fillColor("#FFFFFF").text("IZICHANJ", 110, 28);
    doc.font("Helvetica").fontSize(10).fillColor("#94A3B8").text("Crypto to Cash Exchange", 111, 54);
    doc.font("Helvetica-Bold").fontSize(14).fillColor("#FFFFFF").text("CARD STATEMENT", W - 240, 30, { width: 200, align: "right" });
    doc.font("Helvetica").fontSize(9).fillColor("#CBD5E1").text(`Ref: ${data.statementId.toUpperCase()}`, W - 240, 52, { width: 200, align: "right" });
    doc.font("Helvetica").fontSize(8).fillColor("#94A3B8").text(`Generated ${haitiDateTime(data.generatedAt)}`, W - 240, 68, { width: 200, align: "right" });

    // Hero band
    doc.rect(0, 96, W, 5).fill(BRAND_INDIGO);

    // ── Period banner ──
    let cursorY = 118;
    doc.roundedRect(MARGIN, cursorY, W - MARGIN * 2, 46, 6).fill("#FFFFFF").strokeColor("#E2E8F0").lineWidth(1).stroke();
    doc.font("Helvetica").fontSize(9).fillColor(TEXT_MUTED).text("STATEMENT PERIOD", MARGIN + 14, cursorY + 9);
    doc.font("Helvetica-Bold").fontSize(13).fillColor(BRAND_DARK)
       .text(`${fmtShortDate(data.periodStart)}  →  ${fmtShortDate(data.periodEnd)}`, MARGIN + 14, cursorY + 23);
    // Right-aligned tx count summary
    doc.font("Helvetica").fontSize(9).fillColor(TEXT_MUTED).text("TRANSACTIONS", W - MARGIN - 140, cursorY + 9, { width: 126, align: "right" });
    doc.font("Helvetica-Bold").fontSize(13).fillColor(BRAND_DARK)
       .text(String(data.transactions.length), W - MARGIN - 140, cursorY + 23, { width: 126, align: "right" });
    cursorY += 60;

    // ── Two-column info: Cardholder | Card ──
    const colW = (W - MARGIN * 2 - 16) / 2;
    const infoH = 130;
    // Left: cardholder
    doc.roundedRect(MARGIN, cursorY, colW, infoH, 6).fill("#FFFFFF").strokeColor("#E2E8F0").lineWidth(1).stroke();
    doc.font("Helvetica-Bold").fontSize(10).fillColor(BRAND_INDIGO).text("CARDHOLDER", MARGIN + 14, cursorY + 12);
    const chRows: [string, string][] = [
      ["Name", data.userName],
      ["Email", data.userEmail],
      ["Account ID", `#${data.userId}`],
    ];
    chRows.forEach(([k, v], i) => {
      const y = cursorY + 32 + i * 28;
      doc.font("Helvetica").fontSize(8.5).fillColor(TEXT_MUTED).text(k.toUpperCase(), MARGIN + 14, y);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(BRAND_DARK).text(v, MARGIN + 14, y + 11, { width: colW - 28, ellipsis: true });
    });
    // Right: card
    const rcX = MARGIN + colW + 16;
    doc.roundedRect(rcX, cursorY, colW, infoH, 6).fill("#FFFFFF").strokeColor("#E2E8F0").lineWidth(1).stroke();
    doc.font("Helvetica-Bold").fontSize(10).fillColor(BRAND_INDIGO).text("CARD", rcX + 14, cursorY + 12);
    const last4 = (data.cardLast4 || "0000").slice(-4);
    const cardRows: [string, string][] = [
      ["Card Number", `${data.cardBrand.toUpperCase()} •••• •••• •••• ${last4}`],
      ["Cardholder Name", data.cardholderName],
      ["Status / Currency", `${data.cardStatus.toUpperCase()} · ${data.cardCurrency}`],
    ];
    cardRows.forEach(([k, v], i) => {
      const y = cursorY + 32 + i * 28;
      doc.font("Helvetica").fontSize(8.5).fillColor(TEXT_MUTED).text(k.toUpperCase(), rcX + 14, y);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(BRAND_DARK).text(v, rcX + 14, y + 11, { width: colW - 28, ellipsis: true });
    });
    cursorY += infoH + 14;

    // ── Summary cards (3 across) ──
    const totalCredits = data.transactions.filter(t => t.type === "credit").reduce((s, t) => s + t.amount, 0);
    const totalDebits  = data.transactions.filter(t => t.type === "debit").reduce((s, t) => s + t.amount, 0);
    const sumW = (W - MARGIN * 2 - 16) / 3;
    const sumH = 64;
    const summary: { label: string; value: string; color: string }[] = [
      { label: "TOTAL FUNDED",   value: fmtMoney(totalCredits, data.cardCurrency), color: "#10B981" },
      { label: "TOTAL SPENT",    value: fmtMoney(totalDebits,  data.cardCurrency), color: "#EF4444" },
      { label: "ENDING BALANCE", value: fmtMoney(data.endingBalance, data.cardCurrency), color: BRAND_INDIGO },
    ];
    summary.forEach((s, i) => {
      const x = MARGIN + i * (sumW + 8);
      doc.roundedRect(x, cursorY, sumW, sumH, 6).fill("#FFFFFF").strokeColor("#E2E8F0").lineWidth(1).stroke();
      doc.rect(x, cursorY, 4, sumH).fill(s.color);
      doc.font("Helvetica").fontSize(8.5).fillColor(TEXT_MUTED).text(s.label, x + 14, cursorY + 12);
      doc.font("Helvetica-Bold").fontSize(15).fillColor(s.color).text(s.value, x + 14, cursorY + 28, { width: sumW - 28 });
    });
    cursorY += sumH + 18;

    // ── Transactions table ──
    doc.font("Helvetica-Bold").fontSize(11).fillColor(BRAND_DARK).text("Transactions", MARGIN, cursorY);
    cursorY += 18;

    const cols = {
      date:   { x: MARGIN,         w: 84 },
      desc:   { x: MARGIN + 88,    w: 250 },
      type:   { x: MARGIN + 342,   w: 60 },
      amount: { x: W - MARGIN - 96, w: 96 },
    };
    const headerH = 24;
    const rowH = 22;

    const drawTableHeader = (y: number) => {
      doc.rect(MARGIN, y, W - MARGIN * 2, headerH).fill(BRAND_DARK);
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#FFFFFF");
      doc.text("DATE",        cols.date.x + 6,   y + 8, { width: cols.date.w });
      doc.text("DESCRIPTION", cols.desc.x,        y + 8, { width: cols.desc.w });
      doc.text("TYPE",        cols.type.x,        y + 8, { width: cols.type.w });
      doc.text("AMOUNT",      cols.amount.x,      y + 8, { width: cols.amount.w, align: "right" });
      return y + headerH;
    };

    cursorY = drawTableHeader(cursorY);

    const FOOTER_RESERVE = 90;
    const drawFooterAndPaginate = () => {
      // Add footer to the current page only; final pagination text added after end.
      const fy = H - 54;
      doc.rect(0, fy, W, 54).fill(BRAND_DARK);
      doc.moveTo(0, fy).lineTo(W, fy).strokeColor(BRAND_INDIGO).lineWidth(2).stroke();
      doc.font("Helvetica-Oblique").fontSize(8).fillColor("#64748B")
         .text("This is a computer-generated statement and does not require a physical signature.", MARGIN, fy + 12, { width: W - MARGIN * 2, align: "center" });
      doc.font("Helvetica").fontSize(7.5).fillColor("#475569")
         .text(`© ${new Date().getFullYear()} Izichanj · izichanj.com · All rights reserved`, MARGIN, fy + 30, { width: W - MARGIN * 2, align: "center" });
    };

    if (data.transactions.length === 0) {
      doc.rect(MARGIN, cursorY, W - MARGIN * 2, 46).fill("#FFFFFF").strokeColor("#E2E8F0").lineWidth(1).stroke();
      doc.font("Helvetica-Oblique").fontSize(10).fillColor(TEXT_MUTED)
         .text("No transactions recorded for this period.", MARGIN, cursorY + 16, { width: W - MARGIN * 2, align: "center" });
      cursorY += 46;
    } else {
      data.transactions.forEach((tx, i) => {
        // Page break check
        if (cursorY + rowH > H - FOOTER_RESERVE) {
          drawFooterAndPaginate();
          doc.addPage();
          doc.rect(0, 0, W, H).fill(BRAND_LIGHT);
          // Compact header on continuation pages
          doc.rect(0, 0, W, 36).fill(BRAND_DARK);
          doc.font("Helvetica-Bold").fontSize(11).fillColor("#FFFFFF").text("IZICHANJ — Card Statement (continued)", MARGIN, 12);
          doc.font("Helvetica").fontSize(8).fillColor("#94A3B8").text(`Ref: ${data.statementId.toUpperCase()}`, W - 240, 14, { width: 200, align: "right" });
          cursorY = 56;
          cursorY = drawTableHeader(cursorY);
        }

        const bg = i % 2 === 0 ? "#F1F5F9" : "#FFFFFF";
        doc.rect(MARGIN, cursorY, W - MARGIN * 2, rowH).fill(bg);

        const isCredit = tx.type === "credit";
        const sign = isCredit ? "+" : "-";
        const color = isCredit ? "#059669" : "#DC2626";

        doc.font("Helvetica").fontSize(8.5).fillColor(BRAND_DARK)
           .text(fmtShortDate(tx.date), cols.date.x + 6, cursorY + 7, { width: cols.date.w });
        doc.font("Helvetica").fontSize(8.5).fillColor(BRAND_DARK)
           .text(tx.description || "—", cols.desc.x, cursorY + 7, { width: cols.desc.w, ellipsis: true });

        doc.roundedRect(cols.type.x, cursorY + 4, 52, 14, 3).fill(isCredit ? "#D1FAE5" : "#FEE2E2");
        doc.font("Helvetica-Bold").fontSize(7.5).fillColor(isCredit ? "#065F46" : "#991B1B")
           .text(isCredit ? "CREDIT" : "DEBIT", cols.type.x, cursorY + 8, { width: 52, align: "center" });

        doc.font("Helvetica-Bold").fontSize(9.5).fillColor(color)
           .text(`${sign}${tx.currency} ${tx.amount.toFixed(2)}`, cols.amount.x, cursorY + 6, { width: cols.amount.w, align: "right" });

        cursorY += rowH;
      });
    }

    drawFooterAndPaginate();

    // Page numbering across all pages
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.font("Helvetica").fontSize(7.5).fillColor("#94A3B8")
         .text(`Page ${i + 1} of ${range.count}`, W - MARGIN - 80, H - 22, { width: 80, align: "right" });
    }

    doc.end();
  });
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

export interface TransferReceiptData {
  receiptId: string;
  transactionId: string;
  createdAt: Date;
  amount: number;
  fee: number;
  senderName: string;
  recipientName: string;
  network: string;
  status: string;
  note?: string | null;
}

export async function generateTransferReceiptPDF(data: TransferReceiptData): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 0,
      info: {
        Title: `Izichanj Transfer Receipt - ${data.receiptId}`,
        Author: "Izichanj",
        Subject: "P2P Transfer Receipt",
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
    try { doc.image(LOGO_PATH, 36, 18, { height: 54 }); } catch (_) {}
    doc.font("Helvetica-Bold").fontSize(22).fillColor("#FFFFFF").text("IZICHANJ", 110, 28);
    doc.font("Helvetica").fontSize(10).fillColor("#94A3B8").text("Crypto to Cash Exchange", 111, 54);
    doc.font("Helvetica-Bold").fontSize(14).fillColor("#FFFFFF").text("TRANSFER RECEIPT", W - 230, 34, { width: 200, align: "right" });
    doc.font("Helvetica").fontSize(9).fillColor("#CBD5E1").text(`Ref: ${data.receiptId.toUpperCase()}`, W - 230, 56, { width: 200, align: "right" });

    // ── Hero colored band ──
    const heroColor = "#4F46E5";
    doc.rect(0, 90, W, 6).fill(heroColor);

    // ── Status badge ──
    const badgeY = 112;
    doc.roundedRect(36, badgeY, 90, 22, 4).fill("#D1FAE5");
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#065F46").text(data.status.toUpperCase(), 38, badgeY + 7, { width: 86, align: "center" });
    doc.font("Helvetica-Bold").fontSize(13).fillColor(BRAND_DARK).text("P2P Transfer — Send Funds", 138, badgeY + 4);

    // ── Divider ──
    doc.moveTo(36, 148).lineTo(W - 36, 148).strokeColor("#E2E8F0").lineWidth(1).stroke();

    // ── Amount hero ──
    const net = data.amount - data.fee;
    doc.font("Helvetica-Bold").fontSize(36).fillColor(BRAND_INDIGO).text(`${data.amount.toFixed(2)} USDT`, 0, 168, { align: "center" });
    doc.font("Helvetica").fontSize(12).fillColor(TEXT_MUTED).text(`${data.senderName}  →  ${data.recipientName}`, 0, 210, { align: "center" });

    // ── Divider ──
    doc.moveTo(36, 238).lineTo(W - 36, 238).strokeColor("#E2E8F0").lineWidth(1).stroke();

    // ── Detail rows ──
    const detailRows: [string, string][] = [
      ["Transaction ID", data.transactionId],
      ["Date & Time", haitiDateTime(data.createdAt)],
      ["Type", "P2P Transfer (Send Funds)"],
      ["Amount", `${data.amount.toFixed(2)} USDT`],
      ["Fee", `${data.fee.toFixed(2)} USDT`],
      ["Net Sent", `${net.toFixed(2)} USDT`],
      ["Sender", data.senderName],
      ["Recipient", data.recipientName],
      ["Network", data.network],
      ["Status", data.status],
    ];
    if (data.note) detailRows.push(["Note", data.note]);

    const rowStartY = 254;
    const rowH = 30;
    const colLeft = 36;
    const colRight = W / 2 + 10;

    detailRows.forEach(([label, value], i) => {
      const rowY = rowStartY + i * rowH;
      doc.rect(colLeft, rowY, W - 72, rowH).fill(i % 2 === 0 ? "#F1F5F9" : "#FFFFFF");
      doc.font("Helvetica").fontSize(9).fillColor(TEXT_MUTED).text(label, colLeft + 10, rowY + 10, { width: colRight - colLeft - 20 });
      doc.font("Helvetica-Bold").fontSize(9).fillColor(BRAND_DARK).text(value, colRight, rowY + 10, { width: W - colRight - 46, align: "right" });
    });

    const tableBottom = rowStartY + detailRows.length * rowH + 10;

    // ── QR Code ──
    const verifyUrl = "https://izichanj.com";
    const qrBuffer = await QRCode.toBuffer(verifyUrl, { type: "png", width: 100, margin: 1, color: { dark: BRAND_DARK, light: "#FFFFFF" } });
    const qrX = W - 36 - 110;
    const qrY = tableBottom + 10;
    doc.roundedRect(qrX - 8, qrY - 8, 126, 126, 6).fill("#FFFFFF").strokeColor("#E2E8F0").lineWidth(1).stroke();
    doc.image(qrBuffer, qrX, qrY, { width: 110 });
    doc.font("Helvetica").fontSize(7).fillColor(TEXT_MUTED).text("izichanj.com", qrX - 8, qrY + 116, { width: 126, align: "center" });

    doc.font("Helvetica-Bold").fontSize(10).fillColor(BRAND_DARK).text("Izichanj Platform", colLeft, tableBottom + 14, { width: qrX - colLeft - 16 });
    doc.font("Helvetica").fontSize(8.5).fillColor(TEXT_MUTED).text(
      "This receipt confirms an internal transfer of funds between two Izichanj accounts. For support or inquiries, visit our website.",
      colLeft, tableBottom + 30, { width: qrX - colLeft - 16 }
    );
    doc.font("Helvetica").fontSize(8).fillColor(BRAND_INDIGO).text(verifyUrl, colLeft, tableBottom + 80, { width: qrX - colLeft - 16 });

    // ── Footer bar ──
    const footerY = H - 54;
    doc.rect(0, footerY, W, 54).fill(BRAND_DARK);
    doc.moveTo(0, footerY).lineTo(W, footerY).strokeColor(BRAND_INDIGO).lineWidth(2).stroke();
    doc.font("Helvetica-Oblique").fontSize(8).fillColor("#64748B").text("This is a computer-generated receipt and does not require a physical signature.", 36, footerY + 12, { width: W - 72, align: "center" });
    doc.font("Helvetica").fontSize(7.5).fillColor("#475569").text(`© ${new Date().getFullYear()} Izichanj · izichanj.com · All rights reserved`, 36, footerY + 30, { width: W - 72, align: "center" });

    doc.end();
  });
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
      ["Date & Time", haitiDateTime(data.createdAt)],
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
