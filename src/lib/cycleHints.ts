/**
 * Lightweight extraction of cycle-related facts from natural Chinese / mixed text.
 * Used by home long-press correction and mirrored server-side in chat Edge Function.
 */

export interface CycleHintResult {
  /** YYYY-MM-DD — inferred menstrual period start (cycle day 1) */
  periodStartIso?: string;
  /** Typical cycle length in days (hormone_profiles) */
  typicalCycleLengthDays?: number;
}

function padDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Local calendar date YYYY-MM-DD for "today" (device/server caller decides timezone). */
export function localTodayIso(): string {
  const d = new Date();
  return padDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** Shift a YYYY-MM-DD string by `deltaDays` using local date arithmetic. */
export function shiftIsoDate(iso: string, deltaDays: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + deltaDays);
  return padDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/**
 * From "today is cycle day N", infer period start = today - (N-1) in local time.
 */
export function periodStartFromCycleDayN(cycleDay: number, todayIso = localTodayIso()): string | null {
  if (!Number.isFinite(cycleDay) || cycleDay < 1 || cycleDay > 80) return null;
  return shiftIsoDate(todayIso, -(cycleDay - 1));
}

/**
 * Parse user text for cycle hints (conservative regexes).
 */
/** Parse YYYY-MM-DD or ISO datetime prefix to a local calendar Date (midnight). */
export function parsePeriodStartDate(isoOrDatetime: string): Date | null {
  const datePart = isoOrDatetime.trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Cycle day 1 = period start day; uses local calendar boundaries. */
export function calendarDaysSincePeriodStart(periodStartIso: string): number {
  const start = parsePeriodStartDate(periodStartIso);
  if (!start) return 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - start.getTime()) / 86400000) + 1;
  return Math.max(1, diff);
}

export function extractCycleHintsFromText(text: string): CycleHintResult {
  const raw = text.trim();
  if (!raw) return {};

  const out: CycleHintResult = {};

  const typical = raw.match(/(?:典型\s*)?周期\s*(?:长度|长约)?\s*(\d{1,2})\s*天/);
  if (typical) {
    const n = parseInt(typical[1]!, 10);
    if (n >= 21 && n <= 45) {
      out.typicalCycleLengthDays = n;
    }
  }

  const iso = raw.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) {
    const candidate = iso[1]!;
    const d = new Date(candidate + "T12:00:00");
    if (!Number.isNaN(d.getTime())) {
      out.periodStartIso = candidate;
    }
  }

  const dayPatterns = [
    /(?:经期|周期)\s*第\s*(\d{1,2})\s*天/,
    /今天(?:是)?\s*周期\s*第\s*(\d{1,2})\s*天/,
    /第\s*(\d{1,2})\s*天\s*(?:了)?(?:周期|经期)/,
  ];
  for (const re of dayPatterns) {
    const dm = raw.match(re);
    if (dm) {
      const n = parseInt(dm[1]!, 10);
      const start = periodStartFromCycleDayN(n);
      if (start) {
        out.periodStartIso = start;
        break;
      }
    }
  }

  return out;
}
