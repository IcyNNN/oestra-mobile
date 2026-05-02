import { supabase } from "./supabase";
import {
  fetchRecentHealthData,
  type HealthDataPoint,
  type HealthMetricType,
} from "./healthData";

function sleepSeverityHours(hours: number): number {
  if (hours >= 7) return 5;
  if (hours >= 6) return 4;
  if (hours >= 5) return 3;
  if (hours >= 4) return 2;
  return 1;
}

function symptomLine(p: HealthDataPoint): string {
  if (typeof p.value === "number") {
    return `${p.value} ${p.unit}`.trim();
  }
  return String(p.value);
}

/** Stable log_type for DB — avoids clashing with mood/symptom manual enums. */
function logTypeForMetric(t: HealthMetricType): string {
  switch (t) {
    case "steps":
      return "health_steps";
    case "sleep":
      return "health_sleep";
    case "heart_rate":
      return "health_hr_avg";
    case "hrv":
      return "health_hrv";
    case "resting_heart_rate":
      return "health_rhr";
    case "basal_body_temperature":
    case "body_temperature":
      return "health_temp";
    case "menstrual_flow":
      return "health_menstruation";
    case "active_energy":
      return "health_active_kcal";
    default:
      return "health_other";
  }
}

function severityForPoint(p: HealthDataPoint): number | null {
  if (p.type === "sleep" && typeof p.value === "number") {
    return sleepSeverityHours(p.value);
  }
  return null;
}

function flattenHealthPayload(payload: Awaited<ReturnType<typeof fetchRecentHealthData>>): HealthDataPoint[] {
  return [
    ...payload.heartRate,
    ...payload.hrv,
    ...payload.sleep,
    ...payload.steps,
    ...payload.temperature,
    ...payload.menstrualFlow,
    ...payload.restingHeartRate,
    ...payload.activeEnergy,
  ];
}

export async function syncHealthData(userId: string): Promise<{ synced: number; errors: number }> {
  let synced = 0;
  let errors = 0;

  try {
    const payload = await fetchRecentHealthData();
    const points = flattenHealthPayload(payload);

    for (const p of points) {
      const loggedOn = p.startDate.split("T")[0]!;
      const logType = logTypeForMetric(p.type);
      const row = {
        user_id: userId,
        logged_on: loggedOn,
        log_type: logType,
        symptom: symptomLine(p),
        severity: severityForPoint(p),
        source: p.source,
        notes: `Synced from ${p.source}`,
      };

      const { error } = await supabase.from("symptom_logs").upsert(row, {
        onConflict: "user_id,logged_on,log_type,source",
      });

      if (error) {
        console.warn("[healthSync]", error.message);
        errors += 1;
      } else {
        synced += 1;
      }
    }
  } catch (e) {
    console.warn("[healthSync] failed", e);
    errors += 1;
  }

  return { synced, errors };
}
