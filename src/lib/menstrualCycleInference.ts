import type { HealthDataPoint } from "./healthData";

/** Whether a menstrual_flow category sample counts as bleeding for cycle inference. */
export function isMenstrualBleedingSample(value: unknown): boolean {
  const s = String(value).toLowerCase();
  if (!s.trim()) return false;
  if (s === "none" || s.includes("none")) return false;
  return true;
}

function parseIsoDay(iso: string): Date {
  const part = iso.trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(part);
  if (!m) return new Date(NaN);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function daysBetweenIso(a: string, b: string): number {
  const da = parseIsoDay(a);
  const db = parseIsoDay(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return NaN;
  da.setHours(0, 0, 0, 0);
  db.setHours(0, 0, 0, 0);
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

/**
 * From menstrual_flow samples, infer the first calendar day of the most recent bleeding episode.
 */
export function inferLatestPeriodStartFromMenstrualPoints(points: HealthDataPoint[]): string | null {
  const bleedingDays = new Set<string>();
  for (const p of points) {
    if (p.type !== "menstrual_flow") continue;
    if (!isMenstrualBleedingSample(p.value)) continue;
    const day = p.startDate.split("T")[0];
    if (day) bleedingDays.add(day);
  }
  if (bleedingDays.size === 0) return null;

  const sorted = [...bleedingDays].sort();
  const clusters: string[][] = [];
  let cur: string[] = [];

  for (const d of sorted) {
    if (cur.length === 0) {
      cur.push(d);
      continue;
    }
    const prev = cur[cur.length - 1]!;
    const gap = daysBetweenIso(prev, d);
    if (gap === 1) {
      cur.push(d);
    } else {
      clusters.push(cur);
      cur = [d];
    }
  }
  if (cur.length) clusters.push(cur);

  const last = clusters[clusters.length - 1];
  const start = last?.[0];
  return start ?? null;
}
