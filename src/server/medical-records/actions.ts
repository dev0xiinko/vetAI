"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import {
  medicalRecordCreateSchema,
  medicalRecordUpdateSchema,
} from "@/lib/validation/medical-records";
import type { UserRole } from "@/lib/roles";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const CLINICAL_ROLES: readonly UserRole[] = ["admin", "veterinarian"];

/** Strip clinical fields when the caller isn't a vet/admin (DB trigger is the real boundary). */
function stripClinicalForRole<T extends Record<string, unknown>>(
  fields: T,
  role: UserRole,
): T {
  if (CLINICAL_ROLES.includes(role)) return fields;
  const rest = { ...fields };
  delete rest.assessment;
  delete rest.plan;
  return rest;
}

/** Create a medical record. Staff may open a record with intake fields only. */
export async function createMedicalRecord(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireSession();

  const parsed = medicalRecordCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form and try again." };
  }

  // sync_pet_weight and prediction_id aren't plain insert columns as-is:
  // the sync flag never touches medical_records, and the prediction link is
  // verified below before it's written.
  const { sync_pet_weight, prediction_id, ...rest } = parsed.data;
  const fields = stripClinicalForRole(rest, session.role);
  const supabase = await createClient();

  // A prediction_id from the client is only a suggestion — confirm the row is
  // visible under RLS AND belongs to the same pet as this record before
  // linking it; otherwise save with no link rather than corrupting the audit
  // chain (a record for pet B must never point at pet A's prediction).
  let verifiedPredictionId: string | null = null;
  if (prediction_id) {
    const { data: prediction } = await supabase
      .from("predictions")
      .select("id, pet_id")
      .eq("id", prediction_id)
      .maybeSingle();
    verifiedPredictionId =
      prediction && prediction.pet_id === fields.pet_id ? prediction.id : null;
  }

  const { data, error } = await supabase
    .from("medical_records")
    .insert({
      ...fields,
      prediction_id: verifiedPredictionId,
      created_by: session.userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: "Could not save the record." };
  }

  // Best-effort weight sync: the record already saved, so a failure here
  // must not surface as an error to the vet.
  if (sync_pet_weight && fields.intake_weight_kg != null) {
    await supabase
      .from("pets")
      .update({ weight_kg: fields.intake_weight_kg })
      .eq("id", fields.pet_id);
  }

  revalidatePath("/records");
  return { ok: true, data: { id: data.id } };
}

/** Update a medical record. Staff are limited to intake fields (DB-enforced). */
export async function updateMedicalRecord(
  raw: unknown,
): Promise<ActionResult> {
  const session = await requireSession();

  const parsed = medicalRecordUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form and try again." };
  }

  // sync_pet_weight isn't a medical_records column — strip it before update.
  const { id, sync_pet_weight, ...rest } = parsed.data;
  const fields = stripClinicalForRole(rest, session.role);
  const supabase = await createClient();
  const { error } = await supabase
    .from("medical_records")
    .update(fields)
    .eq("id", id)
    .is("deleted_at", null);

  if (error) {
    return { ok: false, error: "Could not update the record." };
  }

  // Best-effort weight sync: the record already saved, so a failure here
  // must not surface as an error to the vet.
  if (sync_pet_weight && fields.intake_weight_kg != null) {
    const { data: recordRow } = await supabase
      .from("medical_records")
      .select("pet_id")
      .eq("id", id)
      .maybeSingle();
    if (recordRow) {
      await supabase
        .from("pets")
        .update({ weight_kg: fields.intake_weight_kg })
        .eq("id", recordRow.pet_id);
    }
  }

  revalidatePath("/records");
  revalidatePath(`/records/${id}/edit`);
  return { ok: true, data: undefined };
}

/** Soft-delete a medical record. Authenticated clinic users only. */
export async function softDeleteMedicalRecord(
  id: string,
): Promise<ActionResult> {
  await requireSession();

  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) {
    return { ok: false, error: "Invalid record id." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("medical_records")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", parsed.data)
    .is("deleted_at", null);

  if (error) {
    return { ok: false, error: "Could not remove the record." };
  }

  revalidatePath("/records");
  return { ok: true, data: undefined };
}
