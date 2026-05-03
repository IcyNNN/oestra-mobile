import { useCallback, useEffect, useState } from "react";

import {
  checkHealthPermissions,
  requestHealthPermissions,
  type HealthPermissionResult,
} from "../lib/healthData";
import { syncHealthData } from "../lib/healthSync";
import { supabase } from "../lib/supabase";

export function useHealthSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [lastResult, setLastResult] = useState<{ synced: number; errors: number } | null>(null);

  const refreshPermission = useCallback(async () => {
    const ok = await checkHealthPermissions();
    setHasPermission(ok);
  }, []);

  const requestPermission = useCallback(async (): Promise<HealthPermissionResult> => {
    const result = await requestHealthPermissions();
    setHasPermission(result.ok);
    return result;
  }, []);

  const syncNow = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      throw new Error("请先登录后再同步健康数据。");
    }
    setIsSyncing(true);
    try {
      const result = await syncHealthData(uid);
      setLastResult(result);
      setLastSynced(new Date());
      return result;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    void refreshPermission();
  }, [refreshPermission]);

  return {
    isSyncing,
    lastSynced,
    hasPermission,
    lastResult,
    refreshPermission,
    requestPermission,
    syncNow,
  };
}
