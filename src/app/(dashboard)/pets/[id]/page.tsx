import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  PawPrint,
  User,
  Phone,
  Cake,
  Activity,
  ClipboardList,
  Plus,
  Pencil,
  Brain,
  MessageSquare,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AI_ADVISORY_DISCLAIMER } from "@/lib/ai/disclaimer";

const RECORDS_LIMIT = 10;
const PREDICTIONS_LIMIT = 5;

type OwnerRef = { id: string; full_name: string; phone: string | null };

function firstOwner(owner: OwnerRef | OwnerRef[] | null): OwnerRef | null {
  if (!owner) return null;
  return Array.isArray(owner) ? (owner[0] ?? null) : owner;
}

function formatAge(dateOfBirth: string | null): string {
  if (!dateOfBirth) return "—";
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return "—";

  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return "—";

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? "year" : "years"}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? "month" : "months"}`);
  return parts.length > 0 ? parts.join(" ") : "Newborn";
}

const SEX_BADGE: Record<string, string> = {
  male: "bg-brand-soft text-brand",
  female: "bg-danger-soft text-danger",
  unknown: "bg-line text-muted",
};

type PredictionOutputItem = { condition?: string; likelihood?: number };

function topCondition(output: unknown): PredictionOutputItem | null {
  if (!Array.isArray(output) || output.length === 0) return null;
  const first = output[0];
  if (!first || typeof first !== "object") return null;
  return first as PredictionOutputItem;
}

function symptomCount(input: unknown): number {
  if (!input || typeof input !== "object" || Array.isArray(input)) return 0;
  const symptoms = (input as { symptoms?: unknown }).symptoms;
  return Array.isArray(symptoms) ? symptoms.length : 0;
}

export default async function PetProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;
  // Validate at the boundary: a malformed id is a 404, not a DB error.
  if (!z.string().uuid().safeParse(id).success) notFound();

  const supabase = await createClient();

  const { data: pet, error: petError } = await supabase
    .from("pets")
    .select(
      "id, name, species, breed, sex, date_of_birth, weight_kg, notes, owner:owners(id, full_name, phone)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (petError || !pet) notFound();

  const owner = firstOwner(pet.owner);

  const [
    { data: records },
    { count: recordsCount },
    { data: predictions },
  ] = await Promise.all([
    supabase
      .from("medical_records")
      .select("id, visit_date, reason_for_visit, assessment")
      .eq("pet_id", id)
      .is("deleted_at", null)
      .order("visit_date", { ascending: false })
      .limit(RECORDS_LIMIT),
    supabase
      .from("medical_records")
      .select("id", { count: "exact", head: true })
      .eq("pet_id", id)
      .is("deleted_at", null),
    supabase
      .from("predictions")
      .select("id, created_at, input, output")
      .eq("pet_id", id)
      .order("created_at", { ascending: false })
      .limit(PREDICTIONS_LIMIT),
  ]);

  const recordRows = records ?? [];
  const predictionRows = predictions ?? [];
  const hasMoreRecords = (recordsCount ?? 0) > recordRows.length;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
        {/* Left column: profile card */}
        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <div className="flex flex-col items-center text-center">
              <span className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-brand-soft to-brand/20">
                <PawPrint size={36} className="text-brand" />
              </span>
              <div className="mt-3 flex items-center gap-2">
                <h1 className="text-lg font-semibold text-ink">{pet.name}</h1>
                {pet.sex && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                      SEX_BADGE[pet.sex] ?? SEX_BADGE.unknown
                    }`}
                  >
                    {pet.sex}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[13px] text-muted-2">
                {pet.species}
                {pet.breed ? ` · ${pet.breed}` : ""}
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] bg-warning-soft text-warning">
                  <Cake size={15} />
                </span>
                <div>
                  <div className="text-[11px] text-faint">Age</div>
                  <div className="text-[13px] text-ink">
                    {formatAge(pet.date_of_birth)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] bg-success-soft text-success">
                  <Activity size={15} />
                </span>
                <div>
                  <div className="text-[11px] text-faint">Weight</div>
                  <div className="text-[13px] text-ink">
                    {pet.weight_kg != null ? `${pet.weight_kg} kg` : "—"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] bg-brand-soft text-brand">
                  <User size={15} />
                </span>
                <div>
                  <div className="text-[11px] text-faint">Owner</div>
                  <div className="text-[13px]">
                    {owner ? (
                      <Link
                        href={`/owners/${owner.id}`}
                        className="text-brand hover:underline"
                      >
                        {owner.full_name}
                      </Link>
                    ) : (
                      <span className="text-ink">—</span>
                    )}
                  </div>
                </div>
              </div>
              {owner?.phone && (
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] bg-purple-soft text-purple">
                    <Phone size={15} />
                  </span>
                  <div>
                    <div className="text-[11px] text-faint">Owner phone</div>
                    <div className="text-[13px] text-ink">{owner.phone}</div>
                  </div>
                </div>
              )}
            </div>

            <Link href={`/pets/${pet.id}/edit`} className="mt-5 block">
              <Button variant="secondary" className="w-full gap-2">
                <Pencil size={15} />
                Edit Profile
              </Button>
            </Link>
          </Card>

          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
            <Link href={`/records/new?pet=${pet.id}`} className="flex-1">
              <Button className="w-full gap-2">
                <Plus size={15} />
                New record
              </Button>
            </Link>
            <Link href={`/prediction?pet=${pet.id}`} className="flex-1">
              <Button variant="secondary" className="w-full gap-2">
                <Brain size={15} />
                Run prediction
              </Button>
            </Link>
            <Link href={`/chatbot?pet=${pet.id}`} className="flex-1">
              <Button variant="secondary" className="w-full gap-2">
                <MessageSquare size={15} />
                Ask AI
              </Button>
            </Link>
          </div>
        </div>

        {/* Right column: records + predictions */}
        <div className="flex flex-col gap-5">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                <ClipboardList size={16} className="text-muted-2" />
                Medical Records
              </div>
              {hasMoreRecords && (
                <Link
                  href="/records"
                  className="text-[12px] text-brand hover:underline"
                >
                  View all
                </Link>
              )}
            </div>
            {recordRows.length > 0 ? (
              <div className="flex flex-col">
                {recordRows.map((r) => (
                  <Link
                    key={r.id}
                    href={`/records/${r.id}/edit`}
                    className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-0 hover:bg-app/60"
                  >
                    <div>
                      <div className="text-[13px] font-medium text-ink">
                        {r.reason_for_visit ?? "Visit"}
                      </div>
                      <div className="text-[11px] text-faint">
                        {r.visit_date}
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        r.assessment
                          ? "bg-success-soft text-success"
                          : "bg-warning-soft text-warning"
                      }`}
                    >
                      {r.assessment ? "Assessed" : "Pending"}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted-2">
                No medical records yet.{" "}
                <Link
                  href={`/records/new?pet=${pet.id}`}
                  className="text-brand hover:underline"
                >
                  New record
                </Link>
              </p>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-1 flex items-center gap-2 text-[15px] font-semibold text-ink">
              <Brain size={16} className="text-muted-2" />
              AI Predictions
            </div>
            <p className="mb-4 text-[11px] text-faint">
              {AI_ADVISORY_DISCLAIMER}
            </p>
            {predictionRows.length > 0 ? (
              <div className="flex flex-col">
                {predictionRows.map((p) => {
                  const top = topCondition(p.output);
                  const symptoms = symptomCount(p.input);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-0"
                    >
                      <div>
                        <div className="text-[13px] font-medium text-ink">
                          {top?.condition ?? "No suggestion"}
                          {typeof top?.likelihood === "number" && (
                            <span className="ml-1.5 text-[11px] font-normal text-purple">
                              {Math.round(top.likelihood)}%
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-faint">
                          {symptoms} {symptoms === 1 ? "symptom" : "symptoms"}{" "}
                          reported
                        </div>
                      </div>
                      <span className="text-[11px] text-faint">
                        {new Date(p.created_at).toLocaleDateString("en-PH", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted-2">
                No predictions run for this pet yet.{" "}
                <Link
                  href={`/prediction?pet=${pet.id}`}
                  className="text-brand hover:underline"
                >
                  Run one
                </Link>
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
