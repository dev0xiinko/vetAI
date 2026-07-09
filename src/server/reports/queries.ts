import { createClient } from "@/lib/supabase/server";

export type ReportStats = {
  pets: number;
  owners: number;
  records: number;
  predictions: number;
  topConditions: { condition: string; count: number }[];
  speciesMix: { species: string; count: number }[];
};

async function count(
  table: "pets" | "owners" | "medical_records",
): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);
  return count ?? 0;
}

/** Aggregate clinic stats for the Reports dashboard (RLS-scoped reads). */
export async function getReportStats(): Promise<ReportStats> {
  const supabase = await createClient();
  const [pets, owners, records, preds, petRows] = await Promise.all([
    count("pets"),
    count("owners"),
    count("medical_records"),
    supabase.from("predictions").select("output"),
    supabase.from("pets").select("species").is("deleted_at", null),
  ]);

  const condCounts = new Map<string, number>();
  for (const row of preds.data ?? []) {
    const output = row.output as Array<{ condition?: string }> | null;
    const top = Array.isArray(output) ? output[0] : undefined;
    if (top?.condition) {
      condCounts.set(top.condition, (condCounts.get(top.condition) ?? 0) + 1);
    }
  }
  const topConditions = [...condCounts.entries()]
    .map(([condition, count]) => ({ condition, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const speciesCounts = new Map<string, number>();
  for (const row of petRows.data ?? []) {
    const s = row.species || "Unknown";
    speciesCounts.set(s, (speciesCounts.get(s) ?? 0) + 1);
  }
  const speciesMix = [...speciesCounts.entries()]
    .map(([species, count]) => ({ species, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return {
    pets,
    owners,
    records,
    predictions: preds.data?.length ?? 0,
    topConditions,
    speciesMix,
  };
}
