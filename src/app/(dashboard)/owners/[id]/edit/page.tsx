import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import { OwnerForm } from "@/components/owners/owner-form";

export default async function EditOwnerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;

  const supabase = await createClient();
  const { data: owner } = await supabase
    .from("owners")
    .select("id, full_name, email, phone, address, notes")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!owner) notFound();

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Edit owner
      </h1>
      <p className="mt-1 mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        Update {owner.full_name}&apos;s details.
      </p>
      <OwnerForm mode="edit" owner={owner} />
    </div>
  );
}
