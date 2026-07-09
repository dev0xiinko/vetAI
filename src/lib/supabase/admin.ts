import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { publicEnv, requireServerEnv } from "@/lib/env";

/**
 * SERVICE-ROLE client. Bypasses RLS. SERVER ONLY.
 *
 * The `server-only` import above makes this module a build error if it is ever
 * imported into a client bundle. Import this ONLY in trusted server code (e.g.
 * admin provisioning) and guard every use with an explicit role check first —
 * never echo raw results to an untrusted caller. See data-and-rls.md.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    publicEnv.supabaseUrl,
    requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
