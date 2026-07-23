// Server-only. Service-role client — bypasses RLS entirely. Used narrowly for
// system-level writes that shouldn't depend on the acting user's own row permissions
// (currently: the ai_runs audit log in ../ai/client.ts). Never expose this client or
// the underlying key to a browser context.
import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export function createAdminClient() {
  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
