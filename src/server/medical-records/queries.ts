import { createClient } from "@/lib/supabase/server";

export type PetOption = { id: string; name: string };

/** Active pets for the record form's selector, ordered by name. */
export async function listPetOptions(): Promise<PetOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pets")
    .select("id, name")
    .is("deleted_at", null)
    .order("name", { ascending: true });
  return data ?? [];
}
