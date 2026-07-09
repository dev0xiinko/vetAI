"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import {
  ownerCreateSchema,
  ownerUpdateSchema,
  registerClientSchema,
} from "@/lib/validation/owners";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Result of the combined register-client flow. On the partial-failure path
 * (owner saved, pet insert failed) `data.ownerId` is still returned so the
 * caller can link to the new owner instead of losing the reference.
 */
export type RegisterClientResult =
  | { ok: true; data: { ownerId: string; petId: string | null } }
  | { ok: false; error: string; data?: { ownerId: string } };

/**
 * Create an owner. Any authenticated clinic user may do this (mirrors the RLS
 * matrix). Input is re-validated server-side; errors are generic (no PII leak).
 */
export async function createOwner(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireSession();

  const parsed = ownerCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form and try again." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("owners")
    .insert({ ...parsed.data, created_by: session.userId })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: "Could not save the owner." };
  }

  revalidatePath("/owners");
  return { ok: true, data: { id: data.id } };
}

/** Update an owner (not soft-deleted). Authenticated clinic users only. */
export async function updateOwner(raw: unknown): Promise<ActionResult> {
  await requireSession();

  const parsed = ownerUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form and try again." };
  }

  const { id, ...fields } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("owners")
    .update(fields)
    .eq("id", id)
    .is("deleted_at", null);

  if (error) {
    return { ok: false, error: "Could not update the owner." };
  }

  revalidatePath("/owners");
  revalidatePath(`/owners/${id}/edit`);
  return { ok: true, data: undefined };
}

/** Soft-delete an owner (preserves history). Authenticated clinic users only. */
export async function softDeleteOwner(id: string): Promise<ActionResult> {
  await requireSession();

  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) {
    return { ok: false, error: "Invalid owner id." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("owners")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", parsed.data)
    .is("deleted_at", null);

  if (error) {
    return { ok: false, error: "Could not remove the owner." };
  }

  revalidatePath("/owners");
  return { ok: true, data: undefined };
}

/**
 * One-step client registration: create the owner and, optionally, their
 * first pet. Deliberately **not atomic** — an owner without a pet is a
 * valid, useful state (e.g. the vet wants to add pets later), so a pet
 * insert failure after the owner succeeds is reported but does not roll
 * back the owner.
 */
export async function registerClient(
  raw: unknown,
): Promise<RegisterClientResult> {
  const session = await requireSession();

  const parsed = registerClientSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form and try again." };
  }

  const { owner, pet, skipPet } = parsed.data;

  const supabase = await createClient();
  const { data: ownerRow, error: ownerError } = await supabase
    .from("owners")
    .insert({ ...owner, created_by: session.userId })
    .select("id")
    .single();

  if (ownerError || !ownerRow) {
    return { ok: false, error: "Could not save the owner." };
  }

  const ownerId: string = ownerRow.id;

  if (skipPet || !pet) {
    revalidatePath("/owners");
    return { ok: true, data: { ownerId, petId: null } };
  }

  const { data: petRow, error: petError } = await supabase
    .from("pets")
    .insert({ ...pet, owner_id: ownerId, created_by: session.userId })
    .select("id")
    .single();

  revalidatePath("/owners");

  if (petError || !petRow) {
    return {
      ok: false,
      error:
        "Owner saved, but the pet could not be added — add it from the owner's page.",
      data: { ownerId },
    };
  }

  revalidatePath("/pets");
  return { ok: true, data: { ownerId, petId: petRow.id } };
}
