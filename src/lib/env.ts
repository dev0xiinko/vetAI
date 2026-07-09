/**
 * Typed environment access.
 *
 * Anything read through `requireServerEnv` is SERVER ONLY. Never import this
 * into a client component to reach a secret — the service-role key and the
 * OpenAI key must never appear in a client bundle. See CLAUDE.md non-negotiables.
 */

/** Public values are safe for the browser (they ship in NEXT_PUBLIC_*). */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
};

/**
 * Read a required server-only env var. Throws (loudly, at call time) if unset
 * so a missing secret surfaces as a clear error rather than a silent bad call.
 */
export function requireServerEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required server environment variable: ${name}`);
  }
  return value;
}
