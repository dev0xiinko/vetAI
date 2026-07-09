import type { Database } from "@/lib/database.types";

/**
 * The app's RBAC role, derived from the generated DB enum so it stays in lockstep
 * with the `user_role` type in Postgres. Import UserRole from here (not from the
 * generated database.types.ts, which `npm run db:types` overwrites).
 */
export type UserRole = Database["public"]["Enums"]["user_role"];

/** Runtime list of roles, sourced from the generated Constants. */
export const USER_ROLES: readonly UserRole[] = [
  "admin",
  "veterinarian",
  "staff",
];
