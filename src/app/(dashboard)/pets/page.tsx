import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { DeletePetButton } from "@/components/pets/delete-pet-button";

const PAGE_SIZE = 20;

function ownerName(owner: { full_name: string } | { full_name: string }[] | null) {
  if (!owner) return "—";
  return Array.isArray(owner) ? (owner[0]?.full_name ?? "—") : owner.full_name;
}

export default async function PetsPage({
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
  const { data: pets, count, error } = await supabase
    .from("pets")
    .select("id, name, species, breed, owner:owners(full_name)", {
      count: "exact",
    })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error("Failed to load pets");

  const total = count ?? 0;
  const hasPrev = page > 1;
  const hasNext = from + (pets?.length ?? 0) < total;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Pets
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {total} {total === 1 ? "pet" : "pets"}
          </p>
        </div>
        <Link href="/pets/new">
          <Button>New pet</Button>
        </Link>
      </div>

      {pets && pets.length > 0 ? (
        <>
          <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Species</th>
                  <th className="px-4 py-3 font-medium">Breed</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {pets.map((p) => (
                  <tr key={p.id} className="text-zinc-800 dark:text-zinc-200">
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={`/pets/${p.id}`}
                        className="text-brand hover:underline dark:text-brand"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                      {p.species}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                      {p.breed ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                      {ownerName(p.owner)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-4">
                        <Link
                          href={`/pets/${p.id}/edit`}
                          className="text-sm text-brand hover:underline dark:text-brand"
                        >
                          Edit
                        </Link>
                        <DeletePetButton id={p.id} name={p.name} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(hasPrev || hasNext) && (
            <div className="mt-4 flex items-center justify-between">
              {hasPrev ? (
                <Link href={`/pets?page=${page - 1}`}>
                  <Button variant="secondary">Previous</Button>
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                Page {page}
              </span>
              {hasNext ? (
                <Link href={`/pets?page=${page + 1}`}>
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
            No pets yet.
          </p>
          <Link href="/pets/new" className="mt-3 inline-block">
            <Button>Add the first pet</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
