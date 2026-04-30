import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "../lib/supabase";

type CyclePhase = "menstrual" | "follicular" | "ovulation" | "luteal";

interface CycleLog {
  id: string;
  cycle_start_date: string | null;
  created_at: string;
  [key: string]: unknown;
}

interface UseCycleDataReturn {
  cycleLogs: CycleLog[];
  isLoading: boolean;
  error: string | null;
  currentCycleDay: number;
  currentPhase: CyclePhase;
  nextPeriodDate: Date | null;
  refresh: () => Promise<void>;
}

function calculatePhase(cycleDay: number): CyclePhase {
  if (cycleDay <= 5) return "menstrual";
  if (cycleDay <= 13) return "follicular";
  if (cycleDay <= 16) return "ovulation";
  return "luteal";
}

function startFromLog(log: CycleLog | undefined): Date | null {
  if (!log) return null;
  const source = log.cycle_start_date || log.created_at;
  return source ? new Date(source) : null;
}

export function useCycleData(): UseCycleDataReturn {
  const [cycleLogs, setCycleLogs] = useState<CycleLog[]>([]);
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
        return;
      }

      // Difference from Next.js data fetching: cycle data is loaded from client hook in RN runtime.
      const { data, error: fetchError } = await supabase
        .from("cycle_logs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setCycleLogs((data as CycleLog[] | null) ?? []);
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
    const start = startFromLog(cycleLogs[0]);
    if (!start) return 1;
    const diff = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diff);
  }, [cycleLogs]);

  const currentPhase = useMemo(() => calculatePhase(currentCycleDay), [currentCycleDay]);

  const nextPeriodDate = useMemo(() => {
    const start = startFromLog(cycleLogs[0]);
    if (!start) return null;
    const next = new Date(start);
    next.setDate(next.getDate() + 28);
    return next;
  }, [cycleLogs]);

  return {
    cycleLogs,
    isLoading,
    error,
    currentCycleDay,
    currentPhase,
    nextPeriodDate,
    refresh,
  };
}
