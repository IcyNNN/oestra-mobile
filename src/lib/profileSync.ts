import { supabase } from "./supabase";

export async function syncUserProfileEmail(userId: string, email: string | null | undefined) {
  if (!userId || !email) {
    return;
  }

  // Difference from Next.js server actions: in RN we sync profile metadata client-side after auth events.
  const { error } = await supabase.from("profiles").upsert({
    user_id: userId,
    email,
  });

  // Keep auth flow resilient even if profile schema has not fully matched in this migration stage.
  if (error) {
    console.warn("[Oestra] Failed to sync profile email:", error.message);
  }
}
