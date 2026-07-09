import { createClient } from "@/lib/supabase/server";
import type { OwnerOption } from "@/components/pets/pet-form";

/** Active owners for the pet form's selector, ordered by name. */
export async function listOwnerOptions(): Promise<OwnerOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("owners")
    .select("id, full_name")
    .is("deleted_at", null)
    .order("full_name", { ascending: true });
  return data ?? [];
}
