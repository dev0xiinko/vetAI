import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import { listOwnerOptions } from "@/server/pets/queries";
import { PetForm } from "@/components/pets/pet-form";

export default async function EditPetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;

  const supabase = await createClient();
  const [{ data: pet }, owners] = await Promise.all([
    supabase
      .from("pets")
      .select(
        "id, owner_id, name, species, breed, sex, date_of_birth, weight_kg, notes",
      )
      .eq("id", id)
      .is("deleted_at", null)
      .single(),
    listOwnerOptions(),
  ]);

  if (!pet) notFound();

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Edit pet
      </h1>
      <p className="mt-1 mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        Update {pet.name}&apos;s details.
      </p>
      <PetForm mode="edit" pet={pet} owners={owners} />
    </div>
  );
}
