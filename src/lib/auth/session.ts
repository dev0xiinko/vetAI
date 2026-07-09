import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/roles";

export type SessionProfile = {
  userId: string;
  role: UserRole;
  fullName: string | null;
};

/**
 * Resolve the caller's session + role server-side. Returns null if unauthed.
 * This is a UX/convenience layer — RLS is still the real security boundary.
 */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return { userId: user.id, role: profile.role, fullName: profile.full_name };
}

/** Require a session; redirect to /login if absent. */
export async function requireSession(): Promise<SessionProfile> {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  return session;
}

/**
 * Require one of `roles`. Redirects unauthed callers to /login and
 * authenticated-but-unauthorized callers to the dashboard. Mirrors RLS for UX;
 * the DB still enforces the real rule.
 */
export async function requireRole(
  roles: readonly UserRole[],
): Promise<SessionProfile> {
  const session = await requireSession();
  if (!roles.includes(session.role)) redirect("/");
  return session;
}
