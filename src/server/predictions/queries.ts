import { createClient } from "@/lib/supabase/server";

export type PetOption = {
  id: string;
  name: string;
  species: string;
  date_of_birth: string | null;
  weight_kg: number | null;
};

/** Active pets to optionally link a prediction run to. */
export async function listPetOptions(): Promise<PetOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pets")
    .select("id, name, species, date_of_birth, weight_kg")
    .is("deleted_at", null)
    .order("name", { ascending: true });
  return data ?? [];
}

export type PredictionHistoryItem = {
  id: string;
  created_at: string;
  species: string;
  symptomCount: number;
  topCondition: string | null;
  topLikelihood: number | null;
  petName: string | null;
};

type StoredInput = { species?: string; symptoms?: string[] };
type StoredCondition = { condition?: string; likelihood?: number };

function petName(pet: { name: string } | { name: string }[] | null): string | null {
  if (!pet) return null;
  return Array.isArray(pet) ? (pet[0]?.name ?? null) : pet.name;
}

/** Recent prediction runs for the history panel (newest first). */
export async function listRecentPredictions(
  limit = 10,
): Promise<PredictionHistoryItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("predictions")
    .select("id, created_at, input, output, pet:pets(name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => {
    const input = (row.input ?? {}) as StoredInput;
    const output = (row.output ?? []) as StoredCondition[];
    const top = output[0];
    return {
      id: row.id,
      created_at: row.created_at,
      species: input.species ?? "—",
      symptomCount: input.symptoms?.length ?? 0,
      topCondition: top?.condition ?? null,
      topLikelihood: top?.likelihood ?? null,
      petName: petName(row.pet),
    };
  });
}
