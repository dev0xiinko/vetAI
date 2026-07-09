"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionProfile } from "@/lib/auth/session";
import { createUserSchema, setUserRoleSchema } from "@/lib/validation/users";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Guard: only an admin session may run user-management actions. */
async function requireAdmin(): Promise<boolean> {
  const session = await getSessionProfile();
  return session?.role === "admin";
}

/** Provision a new clinic user (admin only). Uses the service-role client. */
export async function createUser(raw: unknown): Promise<ActionResult> {
  if (!(await requireAdmin())) {
    return { ok: false, error: "Not authorized." };
  }
  const parsed = createUserSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form and try again." };
  }
  const { email, full_name, role, password } = parsed.data;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (error || !data.user) {
    return { ok: false, error: "Could not create user (email may be in use)." };
  }

  // The signup trigger created a `staff` profile row; set the chosen role + name.
  const { error: profileErr } = await admin
    .from("profiles")
    .update({ role, full_name })
    .eq("id", data.user.id);
  if (profileErr) {
    return {
      ok: false,
      error: "User created, but the role couldn't be set — adjust it in the list.",
    };
  }

  revalidatePath("/users");
  return { ok: true };
}

/** Change a user's role (admin only). */
export async function setUserRole(raw: unknown): Promise<ActionResult> {
  const session = await getSessionProfile();
  if (session?.role !== "admin") {
    return { ok: false, error: "Not authorized." };
  }
  const parsed = setUserRoleSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  // Guard against an admin removing their own admin access by accident.
  if (parsed.data.userId === session.userId && parsed.data.role !== "admin") {
    return { ok: false, error: "You can't change your own role." };
  }

  const admin = createAdminClient();

  // Don't strand the clinic with zero admins.
  if (parsed.data.role !== "admin") {
    const { data: target } = await admin
      .from("profiles")
      .select("role")
      .eq("id", parsed.data.userId)
      .single();
    if (target?.role === "admin") {
      const { count } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) <= 1) {
        return { ok: false, error: "Can't demote the last remaining admin." };
      }
    }
  }

  const { error } = await admin
    .from("profiles")
    .update({ role: parsed.data.role })
    .eq("id", parsed.data.userId);
  if (error) {
    return { ok: false, error: "Could not update role." };
  }

  revalidatePath("/users");
  return { ok: true };
}
