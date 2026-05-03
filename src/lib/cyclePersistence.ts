import type { CycleHintResult } from "./cycleHints";
import { supabase } from "./supabase";

/**
 * Persist extracted cycle hints: optional period anchor row + optional typical length on hormone_profiles.
 */
export async function persistCycleHintsForUser(
  userId: string,
  hints: CycleHintResult,
  notesTag: string,
): Promise<void> {
  if (hints.typicalCycleLengthDays != null) {
    const { data: hp } = await supabase
      .from("hormone_profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    const now = new Date().toISOString();
    if (hp) {
      const { error } = await supabase
        .from("hormone_profiles")
        .update({
          typical_cycle_length_days: hints.typicalCycleLengthDays,
          updated_at: now,
        })
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("hormone_profiles").insert({
        user_id: userId,
        goals: [],
        typical_cycle_length_days: hints.typicalCycleLengthDays,
        onboarding_completed: false,
        created_at: now,
        updated_at: now,
      });
      if (error) throw new Error(error.message);
    }
  }

  if (hints.periodStartIso) {
    const { error } = await supabase.from("cycle_logs").insert({
      user_id: userId,
      period_start: hints.periodStartIso,
      period_end: null,
      flow_intensity: null,
      notes: notesTag,
    });
    if (error) throw new Error(error.message);
  }
}
