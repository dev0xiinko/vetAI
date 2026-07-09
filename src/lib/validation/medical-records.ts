import { z } from "zod";

const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;
const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

const optionalText = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());
const clearableText = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable().optional());

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const weight = z.coerce.number().positive().max(2000);
const temp = z.coerce.number().min(0).max(60);

/**
 * Clinical fields are vet/admin only (enforced by the DB guard trigger). Server
 * actions strip these for staff before insert/update as defense-in-depth.
 */
export const CLINICAL_FIELDS = ["assessment", "plan"] as const;

/** Create input for a medical record. Re-validated in the server action. */
export const medicalRecordCreateSchema = z.object({
  pet_id: z.string().uuid(),
  visit_date: z.preprocess(emptyToUndefined, dateString.optional()),
  reason_for_visit: optionalText(2000),
  intake_weight_kg: z.preprocess(emptyToUndefined, weight.optional()),
  intake_temp_c: z.preprocess(emptyToUndefined, temp.optional()),
  // clinical (vet/admin only)
  assessment: optionalText(4000),
  plan: optionalText(4000),
  // Optional link to the AI prediction run this record was drafted from —
  // the vet has already reviewed/edited by the time this is submitted.
  prediction_id: z.string().uuid().nullish(),
  // Opt-in: also write this visit's intake weight onto the pet's profile.
  sync_pet_weight: z.boolean().optional(),
});

export type MedicalRecordCreateInput = z.infer<
  typeof medicalRecordCreateSchema
>;

/** Update input: id plus changeable fields; optional fields clearable (→ NULL). */
export const medicalRecordUpdateSchema = z.object({
  id: z.string().uuid(),
  // visit_date is NOT NULL — optional to change, but never cleared to null.
  visit_date: z.preprocess(emptyToUndefined, dateString.optional()),
  reason_for_visit: clearableText(2000),
  intake_weight_kg: z.preprocess(emptyToNull, weight.nullable().optional()),
  intake_temp_c: z.preprocess(emptyToNull, temp.nullable().optional()),
  // clinical (vet/admin only)
  assessment: clearableText(4000),
  plan: clearableText(4000),
  // Opt-in: also write this visit's intake weight onto the pet's profile.
  sync_pet_weight: z.boolean().optional(),
});

export type MedicalRecordUpdateInput = z.infer<
  typeof medicalRecordUpdateSchema
>;
