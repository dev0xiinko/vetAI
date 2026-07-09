import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { DeleteRecordButton } from "@/components/medical-records/delete-record-button";

const PAGE_SIZE = 20;

type PetRef = { id: string; name: string };

function petRef(pet: PetRef | PetRef[] | null): PetRef | null {
  if (!pet) return null;
  return Array.isArray(pet) ? (pet[0] ?? null) : pet;
}

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireSession();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const { data: records, count, error } = await supabase
    .from("medical_records")
    .select(
      "id, visit_date, reason_for_visit, assessment, pet:pets(id, name)",
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order("visit_date", { ascending: false })
    .range(from, to);

  if (error) throw new Error("Failed to load records");

  const total = count ?? 0;
  const hasPrev = page > 1;
  const hasNext = from + (records?.length ?? 0) < total;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Medical Records
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {total} {total === 1 ? "record" : "records"}
          </p>
        </div>
        <Link href="/records/new">
          <Button>New record</Button>
        </Link>
      </div>

      {records && records.length > 0 ? (
        <>
          <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Pet</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 font-medium">Clinical</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {records.map((r) => {
                  const pet = petRef(r.pet);
                  return (
                  <tr key={r.id} className="text-zinc-800 dark:text-zinc-200">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.visit_date}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {pet ? (
                        <Link
                          href={`/pets/${pet.id}`}
                          className="text-brand hover:underline dark:text-brand"
                        >
                          {pet.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-zinc-500 dark:text-zinc-400">
                      {r.reason_for_visit ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {r.assessment ? (
                        <span className="text-brand dark:text-brand">
                          Assessed
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-4">
                        <Link
                          href={`/records/${r.id}/edit`}
                          className="text-sm text-brand hover:underline dark:text-brand"
                        >
                          Open
                        </Link>
                        <DeleteRecordButton id={r.id} />
                      </span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {(hasPrev || hasNext) && (
            <div className="mt-4 flex items-center justify-between">
              {hasPrev ? (
                <Link href={`/records?page=${page - 1}`}>
                  <Button variant="secondary">Previous</Button>
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                Page {page}
              </span>
              {hasNext ? (
                <Link href={`/records?page=${page + 1}`}>
                  <Button variant="secondary">Next</Button>
                </Link>
              ) : (
                <span />
              )}
            </div>
          )}
        </>
      ) : (
        <div className="mt-6 rounded-lg border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No records yet.
          </p>
          <Link href="/records/new" className="mt-3 inline-block">
            <Button>Add the first record</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
