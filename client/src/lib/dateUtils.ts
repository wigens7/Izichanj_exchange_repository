const TZ = "America/Port-au-Prince";

// Matches PostgreSQL `timestamp without time zone` strings like
// "2026-04-17 04:23:47.942126" (no trailing Z, no offset). These are
// always stored in UTC by our backend, so we must parse them as UTC —
// `new Date(str)` would otherwise interpret them as local time.
const PG_NAIVE_TS = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/;

export function parseTs(date: Date | string | number | null | undefined): Date | null {
  if (date === null || date === undefined || date === "") return null;
  let d: Date;
  if (typeof date === "string" && PG_NAIVE_TS.test(date)) {
    d = new Date(date.replace(" ", "T") + "Z");
  } else {
    d = new Date(date as any);
  }
  return isNaN(d.getTime()) ? null : d;
}

const safe = parseTs;

function fmt(date: Date | string | number | null | undefined, opts: Intl.DateTimeFormatOptions): string {
  const d = safe(date);
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...opts }).format(d);
}

/** "Apr 8, 2026, 10:30 AM" */
export function formatDateTime(date: Date | string | number | null | undefined): string {
  return fmt(date, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

/** "April 8, 2026 at 10:30:25 AM" */
export function formatDateTimeFull(date: Date | string | number | null | undefined): string {
  return fmt(date, { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
}

/** "Apr 8, 2026" */
export function formatDate(date: Date | string | number | null | undefined): string {
  return fmt(date, { year: "numeric", month: "short", day: "numeric" });
}

/** "10:30 AM" */
export function formatTime(date: Date | string | number | null | undefined): string {
  return fmt(date, { hour: "numeric", minute: "2-digit", hour12: true });
}

/** "10:30:25" (24-hour) */
export function formatTimeSecs(date: Date | string | number | null | undefined): string {
  return fmt(date, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

/** "08/04/2026" (dd/MM/yyyy) */
export function formatDateDMY(date: Date | string | number | null | undefined): string {
  const d = safe(date);
  if (!d) return "—";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const p: Record<string, string> = {};
  parts.forEach(({ type, value }) => { p[type] = value; });
  return `${p.day}/${p.month}/${p.year}`;
}

/** "08/04/26 10:30" (dd/MM/yy HH:mm) */
export function formatDateTimeShort(date: Date | string | number | null | undefined): string {
  const d = safe(date);
  if (!d) return "—";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const p: Record<string, string> = {};
  parts.forEach(({ type, value }) => { p[type] = value; });
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

/** "08/04/2026 10:30" (dd/MM/yyyy HH:mm) */
export function formatDateTimeMedium(date: Date | string | number | null | undefined): string {
  const d = safe(date);
  if (!d) return "—";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const p: Record<string, string> = {};
  parts.forEach(({ type, value }) => { p[type] = value; });
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

/** "08/04 10:30" (dd/MM HH:mm) */
export function formatDateTimeMin(date: Date | string | number | null | undefined): string {
  const d = safe(date);
  if (!d) return "—";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const p: Record<string, string> = {};
  parts.forEach(({ type, value }) => { p[type] = value; });
  return `${p.day}/${p.month} ${p.hour}:${p.minute}`;
}

/** "08/04/26" (dd/MM/yy) */
export function formatDateShort(date: Date | string | number | null | undefined): string {
  const d = safe(date);
  if (!d) return "—";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "2-digit", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const p: Record<string, string> = {};
  parts.forEach(({ type, value }) => { p[type] = value; });
  return `${p.day}/${p.month}/${p.year}`;
}

/** "Apr 8, 10:30 AM" (no year, for card dates etc.) */
export function formatDateShortTime(date: Date | string | number | null | undefined): string {
  return fmt(date, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

/** For frozen-until display: "April 8, 2026" */
export function formatDateLong(date: Date | string | number | null | undefined): string {
  return fmt(date, { year: "numeric", month: "long", day: "numeric" });
}
