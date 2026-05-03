import { fetchRecentHealthData } from "./healthData";
import { inferLatestPeriodStartFromMenstrualPoints } from "./menstrualCycleInference";
import { persistCycleHintsForUser } from "./cyclePersistence";
import type { CycleHintResult } from "./cycleHints";
import { supabase } from "./supabase";

export interface HealthVsAppCycleConflict {
  appPeriodStart: string;
  healthPeriodStart: string;
}

/** Latest menstrual period anchor stored in app (by calendar date). */
export async function fetchLatestAppPeriodStart(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("cycle_logs")
    .select("period_start")
    .eq("user_id", userId)
    .not("period_start", "is", null)
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  const raw = data && typeof data === "object" ? (data as { period_start?: string }).period_start : null;
  return raw?.trim() ? raw.trim() : null;
}

/**
 * Compare health menstrual samples (long lookback) with app cycle_logs anchor.
 * Returns null when either side is missing or dates match.
 */
export async function detectHealthAppCycleConflict(userId: string): Promise<HealthVsAppCycleConflict | null> {
  const payload = await fetchRecentHealthData({ lookbackDays: 120 });
  const healthIso = inferLatestPeriodStartFromMenstrualPoints(payload.menstrualFlow);
  const appIso = await fetchLatestAppPeriodStart(userId);
  if (!healthIso || !appIso) return null;
  if (healthIso === appIso) return null;
  return { appPeriodStart: appIso, healthPeriodStart: healthIso };
}

/** Apply phone-reported period start after user confirms overwrite (inserts cycle_logs anchor). */
export async function applyHealthPeriodStartOverride(userId: string, periodStartIso: string): Promise<void> {
  const hints: CycleHintResult = { periodStartIso };
  await persistCycleHintsForUser(userId, hints, "health_sync_override");
}
