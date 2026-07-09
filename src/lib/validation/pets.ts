import { z } from "zod";

const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;
const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

const optionalText = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());
const clearableText = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable().optional());

/** Matches the `pet_sex` enum in the DB. Also drives the form's select. */
export const PET_SEXES = ["male", "female", "unknown"] as const;
const sexEnum = z.enum(PET_SEXES);

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const weight = z.coerce.number().positive().max(2000);

/** Create input for a pet. Re-validated in the server action. */
export const petCreateSchema = z.object({
  owner_id: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required").max(120),
  species: z.string().trim().min(1, "Species is required").max(60),
  breed: optionalText(80),
  sex: z.preprocess(emptyToUndefined, sexEnum.optional()),
  date_of_birth: z.preprocess(emptyToUndefined, dateString.optional()),
  weight_kg: z.preprocess(emptyToUndefined, weight.optional()),
  notes: optionalText(2000),
});

export type PetCreateInput = z.infer<typeof petCreateSchema>;

/** Update input: id plus changeable fields. Optional fields are clearable (→ NULL). */
export const petUpdateSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Name is required").max(120).optional(),
  species: z.string().trim().min(1, "Species is required").max(60).optional(),
  breed: clearableText(80),
  sex: z.preprocess(emptyToNull, sexEnum.nullable().optional()),
  date_of_birth: z.preprocess(emptyToNull, dateString.nullable().optional()),
  weight_kg: z.preprocess(emptyToNull, weight.nullable().optional()),
  notes: clearableText(2000),
});

export type PetUpdateInput = z.infer<typeof petUpdateSchema>;
