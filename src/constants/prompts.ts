/**
 * Chat persona and safety rules live in the Edge Function:
 * `supabase/functions/chat/index.ts` → `buildSystemPrompt`.
 *
 * Keep this file for future non-chat prompts (onboarding copy, etc.).
 */

export const PLACEHOLDER_PROMPT_NOTE =
  "Oestra chat system prompt is server-side only; see supabase/functions/chat.";
