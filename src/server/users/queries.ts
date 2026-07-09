import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionProfile } from "@/lib/auth/session";
import type { UserRole } from "@/lib/roles";

export type UserRow = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
};

/**
 * List all clinic users (admin only). Uses the service-role client to read
 * auth emails, so it MUST be guarded — we re-check the caller is an admin here
 * even though the route also guards, since this bypasses RLS.
 */
export async function listUsers(): Promise<UserRow[]> {
  const session = await getSessionProfile();
  if (!session || session.role !== "admin") return [];

  const admin = createAdminClient();
  const [{ data: authData }, { data: profiles }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
    admin.from("profiles").select("id, full_name, role"),
  ]);

  const byId = new Map(
    (profiles ?? []).map((p) => [p.id, p] as const),
  );

  return (authData?.users ?? []).map((u) => {
    const p = byId.get(u.id);
    return {
      id: u.id,
      email: u.email ?? "",
      name: p?.full_name ?? "",
      role: (p?.role ?? "staff") as UserRole,
      createdAt: u.created_at,
    };
  });
}
