/**
 * ZiiroPay virtual-card service layer.
 *
 * Official docs: https://ziiropay.readme.io/reference
 *
 * This is the ONLY module that talks to the ZiiroPay card API. Routes call the
 * typed operations exported here; nothing else in the code base builds ZiiroPay
 * URLs or touches the API key.
 *
 * Authentication
 *   ZiiroPay authenticates with a `public_key` parameter (there is no
 *   Authorization header in the docs). The value comes ONLY from the
 *   `ZIIROPAY_API_KEY` environment variable. It is sent in the JSON body of
 *   POST calls and in the query string of GET calls (as the docs show). It is
 *   never logged and never returned to the browser.
 *
 * Environment variables
 *   ZIIROPAY_API_KEY        (required) API key from ziiropay.com → Apikey
 *   ZIIROPAY_MODE           (optional) set to "sandbox" to send `mode=sandbox`.
 *                           Leave unset for live traffic (docs: "remove it for live use").
 *   ZIIROPAY_BASE_URL       (optional) override the API base URL.
 *   PROXY_URL               (optional) static-IP proxy, same as the old card provider setup.
 *
 * Retry policy (deliberately different from the old Strowallet helper)
 *   GET requests are retried on transient network/gateway errors.
 *   POST requests are NOT retried unless the caller marks them idempotent —
 *   a timed-out "fund"/"withdraw"/"create card" may already have executed at
 *   the provider, and a blind retry would move money twice.
 */
export const ZIIROPAY_DEFAULT_BASE_URL = "https://www.ziiropay.com/api/bitvcard";

// ─────────────────────────── configuration ───────────────────────────

export function getZiiropayApiKey(): string {
  return (process.env.ZIIROPAY_API_KEY || "").trim();
}

export function isZiiropayConfigured(): boolean {
  return getZiiropayApiKey().length > 0;
}

function getBaseUrl(): string {
  return (process.env.ZIIROPAY_BASE_URL || ZIIROPAY_DEFAULT_BASE_URL).trim().replace(/\/+$/, "");
}

function modeParams(): Record<string, string> {
  return (process.env.ZIIROPAY_MODE || "").trim().toLowerCase() === "sandbox" ? { mode: "sandbox" } : {};
}

export class ZiiropayNotConfiguredError extends Error {
  constructor() {
    super("ZiiroPay is not configured (ZIIROPAY_API_KEY is missing)");
    this.name = "ZiiropayNotConfiguredError";
  }
}

// ─────────────────────────── transport ───────────────────────────

// undici is loaded lazily so this module has no hard dependency on it unless PROXY_URL is set.
async function createProxyDispatcher(): Promise<any> {
  const proxyUrl = process.env.PROXY_URL;
  if (!proxyUrl) return undefined;
  const { ProxyAgent } = await import("undici");
  const url = new URL(proxyUrl);
  const auth = url.username && url.password
    ? `Basic ${Buffer.from(`${url.username}:${url.password}`).toString("base64")}`
    : undefined;
  const cleanUrl = new URL(url);
  cleanUrl.username = "";
  cleanUrl.password = "";
  return new ProxyAgent({ uri: cleanUrl.toString(), token: auth });
}

/** True when an error from a ZiiroPay call is a proxy / network blip (worth a "try again" message). */
export function isProxyOrNetworkFailure(err: any): boolean {
  const msg = String(err?.message || "").toLowerCase();
  const causeMsg = String(err?.cause?.message || "").toLowerCase();
  const code = err?.code || err?.cause?.code || "";
  return (
    msg.includes("fetch failed") ||
    msg.includes("407") ||
    causeMsg.includes("407") ||
    causeMsg.includes("proxy response") ||
    msg.includes("abort") ||
    code === "UND_ERR_ABORTED" ||
    code === "UND_ERR_SOCKET" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND"
  );
}

export interface ZiiropayResponse {
  /** HTTP 2xx AND no provider-level failure flag in the body. */
  ok: boolean;
  httpStatus: number;
  /** Parsed JSON body ({} when the provider returned a non-JSON body). */
  body: any;
  /** Human-readable provider message ("" when none). Safe to log; NOT safe to show users raw. */
  message: string;
}

interface RequestOptions {
  query?: Record<string, string | number | undefined | null>;
  body?: Record<string, unknown>;
  /** POST only: allow automatic retry on transient failures (state changes that are safe to repeat). */
  idempotent?: boolean;
  timeoutMs?: number;
}

const TRANSIENT_STATUSES = [407, 502, 503, 504];
const BACKOFFS_MS = [500, 1500, 4500];

/** Flatten the many error shapes the provider may return into one string. */
export function extractProviderMessage(body: any): string {
  if (!body || typeof body !== "object") return "";
  const raw = body.message ?? body.error ?? body.errors ?? body.detail ?? body.reason ?? "";
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  try {
    if (typeof raw === "object") {
      const flat = Object.values(raw as Record<string, unknown>).flat().map(String).join("; ");
      return flat || JSON.stringify(raw);
    }
  } catch { /* fall through */ }
  return String(raw);
}

/** Provider-level failure detection (ZiiroPay may answer HTTP 200 with success:false). */
export function isProviderFailure(httpStatus: number, body: any): boolean {
  if (httpStatus < 200 || httpStatus >= 300) return true;
  if (!body || typeof body !== "object") return false;
  if (body.success === false || body.status === false) return true;
  if (typeof body.status === "string" && /^(error|fail|failed|failure)$/i.test(body.status.trim())) return true;
  if (body.error) return true;
  return false;
}

export async function ziiropayRequest(
  method: "GET" | "POST",
  path: string,
  opts: RequestOptions = {},
): Promise<ZiiropayResponse> {
  const apiKey = getZiiropayApiKey();
  if (!apiKey) throw new ZiiropayNotConfiguredError();

  const auth = { public_key: apiKey, ...modeParams() };
  let url = `${getBaseUrl()}/${path.replace(/^\/+/, "")}`;
  const init: RequestInit = { method, headers: { Accept: "application/json" } };

  if (method === "GET") {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...(opts.query || {}), ...auth })) {
      if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
    }
    url += `?${params.toString()}`;
  } else {
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
    init.body = JSON.stringify({ ...(opts.body || {}), ...auth });
  }

  const maxAttempts = method === "GET" || opts.idempotent ? 3 : 1;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const proxyUrl = process.env.PROXY_URL;
  let lastError: any = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      let response: Response;
      if (proxyUrl) {
        const { fetch: undiciFetch } = await import("undici");
        response = await (undiciFetch(url, {
          ...init,
          dispatcher: await createProxyDispatcher(),
          signal: controller.signal,
        } as any) as unknown as Promise<Response>);
      } else {
        response = await fetch(url, { ...init, signal: controller.signal });
      }

      if (TRANSIENT_STATUSES.includes(response.status) && attempt < maxAttempts - 1) {
        clearTimeout(timer);
        console.warn(`[ZIIROPAY] ${method} ${path} → HTTP ${response.status} (transient), retry ${attempt + 1}/${maxAttempts - 1}`);
        await new Promise((r) => setTimeout(r, BACKOFFS_MS[attempt]));
        continue;
      }

      const text = await response.text();
      clearTimeout(timer);
      let body: any = {};
      try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text.slice(0, 200) }; }

      const failed = isProviderFailure(response.status, body);
      // Never log request bodies, card details or the key — status and path only.
      console.log(`[ZIIROPAY] ${method} ${path} → HTTP ${response.status}${failed ? " (failed)" : ""}`);
      return { ok: !failed, httpStatus: response.status, body, message: extractProviderMessage(body) };
    } catch (err: any) {
      clearTimeout(timer);
      lastError = err;
      if (!isProxyOrNetworkFailure(err) || attempt >= maxAttempts - 1) throw err;
      console.warn(`[ZIIROPAY] ${method} ${path} transient network error, retry ${attempt + 1}/${maxAttempts - 1}`);
      await new Promise((r) => setTimeout(r, BACKOFFS_MS[attempt]));
    }
  }
  throw lastError || new Error("ziiropayRequest: exhausted retries");
}

// ─────────────────────────── response normalisers ───────────────────────────

/** Find the first array in a payload (provider wraps lists under varying keys). */
export function extractList(body: any, depth = 0): any[] {
  if (!body || depth > 4) return [];
  if (Array.isArray(body)) return body;
  if (typeof body !== "object") return [];
  for (const key of ["card_transactions", "transactions", "history", "data", "items", "records", "list", "response"]) {
    const v = body[key];
    if (Array.isArray(v)) return v;
  }
  for (const key of Object.keys(body)) {
    if (Array.isArray(body[key])) return body[key];
  }
  for (const key of Object.keys(body)) {
    const found = extractList(body[key], depth + 1);
    if (found.length) return found;
  }
  return [];
}

/** Card detail object: docs show `response.card_detail`; fall back to common wrappers. */
export function extractCardDetail(body: any): any {
  if (!body || typeof body !== "object") return {};
  return body.response?.card_detail || body.data?.card_detail || body.card_detail
    || body.response || body.data || body;
}

export function extractCustomerId(body: any): string | null {
  if (!body || typeof body !== "object") return null;
  const id =
    body.response?.customerId || body.response?.customer_id ||
    body.data?.customerId || body.data?.customer_id ||
    body.customerId || body.customer_id;
  return id ? String(id) : null;
}

// ─────────────────────────── operations ───────────────────────────

export interface CardKycInput {
  first_name: string;
  last_name: string;
  email: string;
  /** International format, no "+", WITHOUT the dial code (docs example: 800000000 with dial_code +234). */
  phone_number: string;
  dial_code: string;
  /** YYYY-MM-DD */
  date_of_birth: string;
  id_type: string;
  id_number: string;
  /** Base64 of the front of the ID document. */
  id_front_image: string;
  line1: string;
  city: string;
  state: string;
  postal_code: string;
  /** 3-letter country code (e.g. USA, HTI). */
  country: string;
  occupation: string;
  employment_status: string;
  account_purpose: string;
  annual_salary: string;
  expected_monthly_volume: string;
  place_of_birth: string;
}

/** POST cardkyc — submit the cardholder KYC. */
export function submitCardKyc(input: CardKycInput): Promise<ZiiropayResponse> {
  return ziiropayRequest("POST", "cardkyc", { body: { ...input } });
}

export interface CardKycStatus {
  response: ZiiropayResponse;
  /** Provider status word, lower-cased ("" when unknown). */
  status: string;
  approved: boolean;
  customerId: string | null;
}

const APPROVED_WORDS = ["approved", "verified", "active", "complete", "completed", "success"];

/** GET cardkycstatus — look up the cardholder by email. `customerId` is only set once approved. */
export async function getCardKycStatus(email: string): Promise<CardKycStatus> {
  const response = await ziiropayRequest("GET", "cardkycstatus", { query: { email } });
  const data = response.body?.data ?? response.body?.response ?? response.body ?? {};
  const status = String(data?.status ?? "").trim().toLowerCase();
  const customerId = extractCustomerId(response.body);
  const approved = response.ok && !!customerId && APPROVED_WORDS.some((w) => status.includes(w));
  return { response, status, approved, customerId: approved ? customerId : null };
}

export interface CreatedCard {
  response: ZiiropayResponse;
  cardId: string | null;
  last4: string | null;
  brand: string | null;
  detail: any;
}

/** POST create-nfc-card — issue a USD card loaded with `amountUsd`. */
export async function createDollarCard(input: { name: string; customerId: string; amountUsd: number }): Promise<CreatedCard> {
  const response = await ziiropayRequest("POST", "create-nfc-card", {
    body: { name: input.name, customer_id: input.customerId, amount: String(input.amountUsd) },
  });
  const detail = extractCardDetail(response.body);
  const rawCardId = detail?.card_id ?? detail?.cardId ?? detail?.id ?? response.body?.card_id ?? response.body?.cardId;
  const pan = detail?.card_number ? String(detail.card_number) : "";
  const last4 = detail?.last4 ?? detail?.lastFour ?? (pan.length >= 4 ? pan.slice(-4) : null);
  return {
    response,
    cardId: rawCardId ? String(rawCardId) : null,
    last4: last4 ? String(last4) : null,
    brand: detail?.card_brand ?? detail?.brand ?? detail?.cardBrand ?? null,
    detail,
  };
}

export interface CardDetails {
  response: ZiiropayResponse;
  detail: any;
  /** Numeric balance when the provider returned one. */
  balance: number | null;
}

/** GET fetch-nfccard-detail */
export async function getCardDetails(cardId: string): Promise<CardDetails> {
  const response = await ziiropayRequest("GET", "fetch-nfccard-detail", { query: { card_id: cardId } });
  const detail = extractCardDetail(response.body);
  const bal = detail?.balance;
  const n = bal === undefined || bal === null || bal === "" ? NaN : Number(bal);
  return { response, detail, balance: Number.isFinite(n) ? n : null };
}

/** GET nfc-card-transactions */
export async function getCardHistory(cardId: string): Promise<{ response: ZiiropayResponse; transactions: any[] }> {
  const response = await ziiropayRequest("GET", "nfc-card-transactions", { query: { card_id: cardId } });
  return { response, transactions: response.ok ? extractList(response.body) : [] };
}

/** POST fund-withdraw-nfccard (type=fund). NOT retried automatically. */
export function fundCard(cardId: string, amountUsd: number): Promise<ZiiropayResponse> {
  return ziiropayRequest("POST", "fund-withdraw-nfccard", {
    body: { card_id: cardId, amount: String(amountUsd), type: "fund" },
  });
}

/** POST fund-withdraw-nfccard (type=withdraw). NOT retried automatically. */
export function withdrawCard(cardId: string, amountUsd: number): Promise<ZiiropayResponse> {
  return ziiropayRequest("POST", "fund-withdraw-nfccard", {
    body: { card_id: cardId, amount: String(amountUsd), type: "withdraw" },
  });
}

/** POST nfc-cards/status — freeze ("frozen") or re-activate ("active"). Safe to repeat. */
export function setCardStatus(cardId: string, status: "active" | "frozen"): Promise<ZiiropayResponse> {
  return ziiropayRequest("POST", "nfc-cards/status", { body: { card_id: cardId, status }, idempotent: true });
}

/** POST cards/terminate */
export function terminateCard(cardId: string): Promise<ZiiropayResponse> {
  return ziiropayRequest("POST", "cards/terminate", { body: { card_id: cardId } });
}

// ─────────────────────────── KYC payload helpers ───────────────────────────

/** Billing address used for every cardholder (unchanged from the previous provider integration). */
export const DEFAULT_BILLING_ADDRESS = {
  line1: "3401 N. Miami Ave. Ste 230",
  city: "Miami",
  state: "FL",
  postal_code: "33127",
  country: "USA",
} as const;

const ALLOWED_ID_TYPES = new Set([
  "bvn", "nin", "passport", "drivers_license", "national_id", "vnin", "voters_card", "ghana_card",
]);

/** Map the app's free-form KYC id type onto the values ZiiroPay accepts. */
export function mapIdType(raw: string | null | undefined): string {
  const t = String(raw || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (ALLOWED_ID_TYPES.has(t)) return t;
  if (/driver|driving|licen[cs]e/.test(t)) return "drivers_license";
  if (/passport/.test(t)) return "passport";
  return "national_id"; // id card / CIN / NIF / unknown
}

/** Normalise a date to YYYY-MM-DD ("" when it can't be parsed). */
export function normalizeDob(raw: string | null | undefined): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** Split a phone into { dial_code: "+509", phone_number: "37001234" } (Haiti by default). */
export function splitPhone(raw: string | null | undefined, defaultDial = "+509"): { dial_code: string; phone_number: string } {
  const digits = String(raw || "").replace(/\D/g, "");
  const defaultDigits = defaultDial.replace(/\D/g, "");
  if (!digits) return { dial_code: defaultDial, phone_number: "" };
  if (digits.startsWith(defaultDigits) && digits.length > defaultDigits.length + 5) {
    return { dial_code: defaultDial, phone_number: digits.slice(defaultDigits.length) };
  }
  if (String(raw || "").trim().startsWith("+") || digits.length > 10) {
    // 1-3 digit country calling codes; NANP (+1) is the only 1-digit case we expect here.
    if (digits.startsWith("1") && digits.length === 11) return { dial_code: "+1", phone_number: digits.slice(1) };
    return { dial_code: `+${digits.slice(0, 3)}`, phone_number: digits.slice(3) };
  }
  return { dial_code: defaultDial, phone_number: digits };
}

/**
 * Defaults for the compliance fields the card provider requires but this app does not
 * collect. They are declarations made to the card issuer on the user's behalf, so they
 * are configurable per deployment instead of hard-coded.
 */
function kycDefaults() {
  return {
    occupation: process.env.ZIIROPAY_KYC_OCCUPATION || "other",
    employment_status: process.env.ZIIROPAY_KYC_EMPLOYMENT_STATUS || "employed",
    account_purpose: process.env.ZIIROPAY_KYC_ACCOUNT_PURPOSE || "online_purchases",
    annual_salary: process.env.ZIIROPAY_KYC_ANNUAL_SALARY || "12000",
    expected_monthly_volume: process.env.ZIIROPAY_KYC_EXPECTED_MONTHLY_VOLUME || "500",
  };
}

/** Build the `cardkyc` payload from a profile + Izichanj KYC record. Pure function. */
export function buildCardKycInput(args: {
  profile: {
    email: string; fullName?: string | null; firstName?: string | null; lastName?: string | null;
    dateOfBirth?: string | null; phone?: string | null; country?: string | null;
  };
  kyc: { idType?: string | null; idNumber?: string | null } | null | undefined;
  idFrontImageBase64: string;
  overrides?: { idType?: string; idNumber?: string };
}): CardKycInput {
  const { profile, kyc, idFrontImageBase64 } = args;
  const parts = (profile.fullName || "").trim().split(/\s+/).filter(Boolean);
  const firstName = (profile.firstName || parts[0] || "").trim();
  const lastName = (profile.lastName || parts.slice(1).join(" ") || firstName).trim();
  const { dial_code, phone_number } = splitPhone(profile.phone);
  return {
    first_name: firstName,
    last_name: lastName,
    email: profile.email,
    phone_number,
    dial_code,
    date_of_birth: normalizeDob(profile.dateOfBirth),
    id_type: mapIdType(args.overrides?.idType ?? kyc?.idType),
    id_number: String(args.overrides?.idNumber ?? kyc?.idNumber ?? "").trim(),
    id_front_image: idFrontImageBase64,
    ...DEFAULT_BILLING_ADDRESS,
    ...kycDefaults(),
    place_of_birth: (profile.country || "Haiti").trim(),
  };
}

/** Names of required `cardkyc` fields that are empty — lets callers fail fast with a clear message. */
export function missingKycFields(input: CardKycInput): string[] {
  const required: (keyof CardKycInput)[] = [
    "first_name", "last_name", "email", "phone_number", "date_of_birth", "id_type", "id_number", "id_front_image",
  ];
  return required.filter((k) => !String(input[k] ?? "").trim());
}
