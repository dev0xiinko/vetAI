import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  listPetOptions,
  listRecentPredictions,
} from "@/server/predictions/queries";
import { PredictionRunner } from "@/components/predictions/prediction-runner";
import { DisclaimerBanner } from "@/components/ai/disclaimer-banner";

const uuidSchema = z.string().uuid();

export default async function PredictionPage({
  searchParams,
}: {
  searchParams: Promise<{ pet?: string; record?: string }>;
}) {
  const session = await requireSession();
  const canRun =
    session.role === "admin" || session.role === "veterinarian";

  const sp = await searchParams;
  const initialPetId = uuidSchema.safeParse(sp.pet).success
    ? sp.pet
    : undefined;
  const recordId = uuidSchema.safeParse(sp.record).success
    ? sp.record
    : undefined;

  const [pets, history, initialSymptoms] = await Promise.all([
    canRun ? listPetOptions() : Promise.resolve([]),
    listRecentPredictions(),
    recordId ? fetchRecordReason(recordId) : Promise.resolve(undefined),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Disease Prediction
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Enter symptoms to get suggested conditions to investigate.
        </p>
      </div>

      {canRun ? (
        <PredictionRunner
          pets={pets}
          initialPetId={initialPetId}
          initialSymptoms={initialSymptoms}
        />
      ) : (
        <>
          <DisclaimerBanner />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Viewing history only — running a prediction is limited to
            veterinarians.
          </p>
        </>
      )}

      <section aria-label="Recent predictions" className="mt-2">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Recent runs
        </h2>
        {history.length > 0 ? (
          <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-2 font-medium">When</th>
                  <th className="px-4 py-2 font-medium">Species</th>
                  <th className="px-4 py-2 font-medium">Symptoms</th>
                  <th className="px-4 py-2 font-medium">Top suggestion</th>
                  <th className="px-4 py-2 font-medium">Pet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {history.map((h) => (
                  <tr key={h.id} className="text-zinc-800 dark:text-zinc-200">
                    <td className="px-4 py-2 whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                      {new Date(h.created_at).toLocaleDateString("en-PH", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2 capitalize">{h.species}</td>
                    <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">
                      {h.symptomCount}
                    </td>
                    <td className="px-4 py-2">
                      {h.topCondition ? (
                        <>
                          {h.topCondition}
                          {h.topLikelihood != null ? (
                            <span className="ml-1 text-xs text-zinc-400">
                              ({Math.round(h.topLikelihood * 100)}%)
                            </span>
                          ) : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">
                      {h.petName ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-400 dark:text-zinc-500">
            No prediction runs yet.
          </p>
        )}
      </section>
    </div>
  );
}

/**
 * Seed the symptoms textarea from an existing visit's reason for the record
 * "Run prediction from this visit" handoff. RLS-scoped — returns undefined if
 * the record doesn't exist or isn't visible to this caller.
 */
async function fetchRecordReason(recordId: string): Promise<string | undefined> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("medical_records")
    .select("reason_for_visit")
    .eq("id", recordId)
    .is("deleted_at", null)
    .maybeSingle();
  return data?.reason_for_visit ?? undefined;
}
