import Link from "next/link";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { listOwnerOptions } from "@/server/pets/queries";
import { PetForm } from "@/components/pets/pet-form";
import { Button } from "@/components/ui/button";

export default async function NewPetPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string }>;
}) {
  await requireSession();
  const owners = await listOwnerOptions();
  const { owner } = await searchParams;
  const defaultOwnerId = z.string().uuid().safeParse(owner).success
    ? owner
    : undefined;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        New pet
      </h1>
      <p className="mt-1 mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        Register a patient under its owner.
      </p>

      {owners.length > 0 ? (
        <PetForm mode="create" owners={owners} defaultOwnerId={defaultOwnerId} />
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Add an owner first — every pet belongs to one.
          </p>
          <Link href="/owners/new" className="mt-3 inline-block">
            <Button>Add an owner</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
