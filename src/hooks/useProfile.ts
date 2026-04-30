import { useCallback, useEffect, useState } from "react";

import { supabase } from "../lib/supabase";

interface ProfileRecord {
  id: string;
  user_id: string;
  email?: string;
  name?: string;
}

interface HormoneProfileRecord {
  id: string;
  user_id: string;
  [key: string]: unknown;
}

interface UseProfileReturn {
  profile: ProfileRecord | null;
  hormoneProfile: HormoneProfileRecord | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateProfile: (values: Partial<ProfileRecord>) => Promise<void>;
  updateHormoneProfile: (values: Partial<HormoneProfileRecord>) => Promise<void>;
}

export function useProfile(): UseProfileReturn {
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [hormoneProfile, setHormoneProfile] = useState<HormoneProfileRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) {
        setProfile(null);
        setHormoneProfile(null);
        return;
      }

      // Difference from Next.js SSR fetch: profile is loaded client-side in RN hook and cached in state.
      const [{ data: profileData, error: profileError }, { data: hormoneData, error: hormoneError }] =
        await Promise.all([
          supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
          supabase.from("hormone_profiles").select("*").eq("user_id", userId).maybeSingle(),
        ]);

      if (profileError) {
        throw new Error(profileError.message);
      }
      if (hormoneError) {
        throw new Error(hormoneError.message);
      }

      setProfile((profileData as ProfileRecord | null) ?? null);
      setHormoneProfile((hormoneData as HormoneProfileRecord | null) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法读取档案。");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateProfile = useCallback(
    async (values: Partial<ProfileRecord>) => {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) {
        throw new Error("请先登录。");
      }

      const payload = { ...values, user_id: userId };
      const { error: upsertError } = await supabase.from("profiles").upsert(payload);
      if (upsertError) {
        throw new Error(upsertError.message);
      }

      setProfile((prev) => ({ ...(prev ?? { id: "", user_id: userId }), ...payload }));
    },
    [],
  );

  const updateHormoneProfile = useCallback(
    async (values: Partial<HormoneProfileRecord>) => {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) {
        throw new Error("请先登录。");
      }

      const payload = { ...values, user_id: userId };
      const { error: upsertError } = await supabase.from("hormone_profiles").upsert(payload);
      if (upsertError) {
        throw new Error(upsertError.message);
      }

      setHormoneProfile((prev) => ({ ...(prev ?? { id: "", user_id: userId }), ...payload }));
    },
    [],
  );

  return {
    profile,
    hormoneProfile,
    isLoading,
    error,
    refresh,
    updateProfile,
    updateHormoneProfile,
  };
}
