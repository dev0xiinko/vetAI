import { z } from "zod";

export const userRoleSchema = z.enum(["admin", "veterinarian", "staff"]);

/** Admin-provisioned new user. */
export const createUserSchema = z.object({
  email: z.string().trim().email().max(320),
  full_name: z.string().trim().min(1, "Name is required").max(200),
  role: userRoleSchema,
  password: z.string().min(8, "At least 8 characters").max(200),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const setUserRoleSchema = z.object({
  userId: z.string().uuid(),
  role: userRoleSchema,
});

export type SetUserRoleInput = z.infer<typeof setUserRoleSchema>;
