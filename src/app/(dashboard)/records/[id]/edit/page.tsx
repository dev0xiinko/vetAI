import { notFound } from "next/navigation";
import Link from "next/link";
import { Activity } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import { listPetOptions } from "@/server/medical-records/queries";
import { RecordForm } from "@/components/medical-records/record-form";

function petName(pet: { name: string } | { name: string }[] | null): string {
  if (!pet) return "—";
  return Array.isArray(pet) ? (pet[0]?.name ?? "—") : pet.name;
}

export default async function EditRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const canEditClinical =
    session.role === "admin" || session.role === "veterinarian";
  const { id } = await params;

  const supabase = await createClient();
  const [{ data: record }, pets] = await Promise.all([
    supabase
      .from("medical_records")
      .select(
        "id, pet_id, visit_date, reason_for_visit, intake_weight_kg, intake_temp_c, assessment, plan, pet:pets(name)",
      )
      .eq("id", id)
      .is("deleted_at", null)
      .single(),
    listPetOptions(),
  ]);

  if (!record) notFound();

  const { pet, ...rest } = record;

  return (
    <div className="mx-auto max-w-lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Record
          </h1>
          <p className="mt-1 mb-6 text-sm text-zinc-500 dark:text-zinc-400">
            {petName(pet)} · {record.visit_date}
          </p>
        </div>
        {canEditClinical ? (
          <Link
            href={`/prediction?pet=${record.pet_id}&record=${record.id}`}
            className="mt-1 inline-flex flex-none items-center gap-1.5 text-xs font-medium text-brand hover:underline"
          >
            <Activity size={14} />
            Run prediction from this visit
          </Link>
        ) : null}
      </div>
      <RecordForm
        mode="edit"
        record={{ ...rest, pet_name: petName(pet) }}
        pets={pets}
        canEditClinical={canEditClinical}
      />
    </div>
  );
}
