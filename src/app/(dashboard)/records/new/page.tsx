import Link from "next/link";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listPetOptions } from "@/server/medical-records/queries";
import { RecordForm } from "@/components/medical-records/record-form";
import { Button } from "@/components/ui/button";

const uuidSchema = z.string().uuid();

type PredictionCondition = {
  condition?: string;
  likelihood?: number;
  recommended_next_step?: string;
};

/**
 * Build the "draft medical record" prefill from a prediction run: the
 * symptoms become the reason for visit, and (vet/admin only) a draft
 * assessment lists each suggested condition with an explicit confirmation
 * header. This is a starting point for the vet to edit — nothing here is
 * ever saved as-is. See ai-features.md.
 */
async function loadPredictionPrefill(
  predictionId: string,
  petId: string | undefined,
  canEditClinical: boolean,
): Promise<{
  prefill: { reason_for_visit?: string; assessment?: string };
  predictionId: string;
  petId: string | null;
} | null> {
  const supabase = await createClient();
  const { data: prediction } = await supabase
    .from("predictions")
    .select("id, input, output, pet_id")
    .eq("id", predictionId)
    .maybeSingle();

  if (!prediction) return null;
  // If a pet param is present, it must match the prediction's own pet —
  // otherwise ignore the prediction rather than mixing records across pets.
  if (petId && prediction.pet_id !== petId) return null;

  const input = (prediction.input ?? {}) as { symptoms?: string[] };
  const symptoms = input.symptoms ?? [];
  const prefill: { reason_for_visit?: string; assessment?: string } = {
    reason_for_visit: symptoms.length > 0 ? symptoms.join(", ") : undefined,
  };

  if (canEditClinical) {
    const output = (prediction.output ?? []) as PredictionCondition[];
    const lines = output.map((c, i) => {
      const pct = Math.round((c.likelihood ?? 0) * 100);
      return `${i + 1}. ${c.condition ?? "Unknown condition"} (${pct}%) — next step: ${c.recommended_next_step ?? "—"}`;
    });
    prefill.assessment = [
      "[AI-suggested — requires veterinarian confirmation]",
      ...lines,
    ].join("\n");
  }

  return { prefill, predictionId: prediction.id, petId: prediction.pet_id };
}

export default async function NewRecordPage({
  searchParams,
}: {
  searchParams: Promise<{ pet?: string; prediction?: string }>;
}) {
  const session = await requireSession();
  const canEditClinical =
    session.role === "admin" || session.role === "veterinarian";
  const pets = await listPetOptions();

  const sp = await searchParams;
  const petParam = uuidSchema.safeParse(sp.pet).success ? sp.pet : undefined;
  const predictionParam = uuidSchema.safeParse(sp.prediction).success
    ? sp.prediction
    : undefined;

  const loaded = predictionParam
    ? await loadPredictionPrefill(predictionParam, petParam, canEditClinical)
    : null;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        New record
      </h1>
      <p className="mt-1 mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        Open a clinical encounter for a patient.
      </p>

      {pets.length > 0 ? (
        <RecordForm
          mode="create"
          pets={pets}
          canEditClinical={canEditClinical}
          defaultPetId={petParam ?? loaded?.petId ?? undefined}
          prefill={loaded?.prefill}
          predictionId={loaded?.predictionId}
          // The audit link is only valid for the prediction's own pet — lock
          // the selector so the pair can't be mismatched from the UI.
          lockPet={Boolean(loaded?.predictionId && loaded?.petId)}
        />
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Add a pet first — every record belongs to one.
          </p>
          <Link href="/pets/new" className="mt-3 inline-block">
            <Button>Add a pet</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
