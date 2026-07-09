import { z } from "zod";
import { petCreateSchema } from "@/lib/validation/pets";

/** On create, an empty form string means "not provided" → omit the column. */
const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

/**
 * On update, an empty form string means "clear this field" → write NULL.
 * (undefined would be dropped from the PATCH body, silently keeping the old
 * value — a data-correction bug for PII fields.)
 */
const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

const optionalText = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

const clearableText = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable().optional());

/** Create input for an owner. Re-validated in the server action. */
export const ownerCreateSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(200),
  email: z.preprocess(
    emptyToUndefined,
    z.string().trim().email().max(320).optional(),
  ),
  phone: optionalText(40),
  address: optionalText(500),
  notes: optionalText(2000),
});

export type OwnerCreateInput = z.infer<typeof ownerCreateSchema>;

/**
 * Update input: the row id plus any fields to change. Optional contact fields
 * are *clearable* — an empty value writes NULL so corrections actually persist.
 */
export const ownerUpdateSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().trim().min(1, "Name is required").max(200).optional(),
  email: z.preprocess(
    emptyToNull,
    z.string().trim().email().max(320).nullable().optional(),
  ),
  phone: clearableText(40),
  address: clearableText(500),
  notes: clearableText(2000),
});

export type OwnerUpdateInput = z.infer<typeof ownerUpdateSchema>;

/**
 * The pet half of one-step client registration: every `petCreateSchema`
 * field except `owner_id`, which the server action fills in once the new
 * owner row exists. Reuses `petCreateSchema`'s empty-string/coercion rules
 * so the two forms stay in sync.
 */
const petForRegistrationSchema = petCreateSchema.omit({ owner_id: true });

/**
 * Composed input for the "register client" flow: an owner plus an optional
 * first pet in a single submit. `skipPet: true` means the vet chose to add
 * the owner only — the pet section is not required in that case.
 */
export const registerClientSchema = z
  .object({
    owner: ownerCreateSchema,
    pet: petForRegistrationSchema.optional(),
    skipPet: z.boolean().optional(),
  })
  .superRefine((val, ctx) => {
    if (!val.skipPet && !val.pet) {
      ctx.addIssue({
        code: "custom",
        path: ["pet"],
        message:
          'Add the pet\'s details, or turn off "Add their first pet now".',
      });
    }
  });

export type RegisterClientInput = z.infer<typeof registerClientSchema>;
