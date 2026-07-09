"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import { petCreateSchema, petUpdateSchema } from "@/lib/validation/pets";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Create a pet. Any authenticated clinic user (mirrors the RLS matrix). */
export async function createPet(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireSession();

  const parsed = petCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form and try again." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pets")
    .insert({ ...parsed.data, created_by: session.userId })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: "Could not save the pet." };
  }

  revalidatePath("/pets");
  return { ok: true, data: { id: data.id } };
}

/** Update a pet (not soft-deleted). Authenticated clinic users only. */
export async function updatePet(raw: unknown): Promise<ActionResult> {
  await requireSession();

  const parsed = petUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form and try again." };
  }

  const { id, ...fields } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("pets")
    .update(fields)
    .eq("id", id)
    .is("deleted_at", null);

  if (error) {
    return { ok: false, error: "Could not update the pet." };
  }

  revalidatePath("/pets");
  revalidatePath(`/pets/${id}/edit`);
  return { ok: true, data: undefined };
}

/** Soft-delete a pet (preserves medical history). Authenticated clinic users only. */
export async function softDeletePet(id: string): Promise<ActionResult> {
  await requireSession();

  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) {
    return { ok: false, error: "Invalid pet id." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("pets")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", parsed.data)
    .is("deleted_at", null);

  if (error) {
    return { ok: false, error: "Could not remove the pet." };
  }

  revalidatePath("/pets");
  return { ok: true, data: undefined };
}
