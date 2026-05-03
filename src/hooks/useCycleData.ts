import { useCallback, useEffect, useMemo, useState } from "react";

import { calendarDaysSincePeriodStart, parsePeriodStartDate } from "../lib/cycleHints";
import { supabase } from "../lib/supabase";

type CyclePhase = "menstrual" | "follicular" | "ovulation" | "luteal";

interface CycleLogRow {
  id: string;
  period_start?: string | null;
  cycle_start_date?: string | null;
  created_at: string;
}

function latestPeriodStartLog(logs: CycleLogRow[]): CycleLogRow | undefined {
  for (const log of logs) {
    if (log.period_start) return log;
  }
  return undefined;
}

interface UseCycleDataReturn {
  cycleLogs: CycleLogRow[];
  isLoading: boolean;
  error: string | null;
  currentCycleDay: number;
  currentPhase: CyclePhase;
  nextPeriodDate: Date | null;
  typicalCycleLengthDays: number;
  refresh: () => Promise<void>;
}

function calculatePhase(cycleDay: number): CyclePhase {
  if (cycleDay <= 5) return "menstrual";
  if (cycleDay <= 13) return "follicular";
  if (cycleDay <= 16) return "ovulation";
  return "luteal";
}

export function useCycleData(): UseCycleDataReturn {
  const [cycleLogs, setCycleLogs] = useState<CycleLogRow[]>([]);
  const [typicalCycleLengthDays, setTypicalCycleLengthDays] = useState(28);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) {
        setCycleLogs([]);
        setTypicalCycleLengthDays(28);
        return;
      }

      const [{ data: hpRow }, { data, error: fetchError }] = await Promise.all([
        supabase.from("hormone_profiles").select("typical_cycle_length_days").eq("user_id", userId).maybeSingle(),
        supabase
          .from("cycle_logs")
          .select("*")
          .eq("user_id", userId)
          .order("period_start", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false }),
      ]);

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      const t =
        hpRow && typeof (hpRow as { typical_cycle_length_days?: number | null }).typical_cycle_length_days === "number"
          ? (hpRow as { typical_cycle_length_days: number }).typical_cycle_length_days
          : null;
      setTypicalCycleLengthDays(t != null && t > 0 ? t : 28);

      setCycleLogs((data as CycleLogRow[] | null) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法加载周期数据。");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const currentCycleDay = useMemo(() => {
    const log = latestPeriodStartLog(cycleLogs);
    const ps = log?.period_start?.trim();
    if (!ps) return 1;
    return calendarDaysSincePeriodStart(ps);
  }, [cycleLogs]);

  const currentPhase = useMemo(() => calculatePhase(currentCycleDay), [currentCycleDay]);

  const nextPeriodDate = useMemo(() => {
    const log = latestPeriodStartLog(cycleLogs);
    const ps = log?.period_start?.trim();
    if (!ps) return null;
    const start = parsePeriodStartDate(ps);
    if (!start) return null;
    const next = new Date(start);
    next.setDate(next.getDate() + typicalCycleLengthDays);
    return next;
  }, [cycleLogs, typicalCycleLengthDays]);

  return {
    cycleLogs,
    isLoading,
    error,
    currentCycleDay,
    currentPhase,
    nextPeriodDate,
    typicalCycleLengthDays,
    refresh,
  };
}
