import { z } from "zod";

/** Login input. Validated in the form AND re-validated in the server action. */
export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
