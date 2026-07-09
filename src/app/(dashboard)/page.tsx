import Link from "next/link";
import { PawPrint, Contact, ClipboardList, Brain } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";

async function countActive(
  table: "pets" | "owners" | "medical_records",
): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);
  return count ?? 0;
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  icon: LucideIcon;
  tone: "brand" | "success" | "warning" | "purple";
}) {
  const tones = {
    brand: "bg-brand-soft text-brand",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    purple: "bg-purple-soft text-purple",
  } as const;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-muted">{label}</span>
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-[10px] ${tones[tone]}`}
        >
          <Icon size={17} />
        </span>
      </div>
      <div className="mt-2 text-[30px] font-bold text-ink">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-2">{hint}</div>
    </Card>
  );
}

function petName(pet: { name: string } | { name: string }[] | null): string {
  if (!pet) return "—";
  return Array.isArray(pet) ? (pet[0]?.name ?? "—") : pet.name;
}

export default async function DashboardHome() {
  const session = await requireSession();
  const supabase = await createClient();

  const [pets, owners, records, predCount, recent] = await Promise.all([
    countActive("pets"),
    countActive("owners"),
    countActive("medical_records"),
    supabase
      .from("predictions")
      .select("id", { count: "exact", head: true })
      .then((r) => r.count ?? 0),
    supabase
      .from("medical_records")
      .select("id, visit_date, reason_for_visit, assessment, pet:pets(name)")
      .is("deleted_at", null)
      .order("visit_date", { ascending: false })
      .limit(5)
      .then((r) => r.data ?? []),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-lg font-semibold text-ink">
        Welcome back, {session.fullName ?? "Doctor"}!
      </h1>
      <p className="mb-5 text-[13px] text-muted-2">
        Here&apos;s what&apos;s happening at your clinic today.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Pets" value={pets} hint="All registered pets" icon={PawPrint} tone="brand" />
        <StatCard label="Total Owners" value={owners} hint="Registered clients" icon={Contact} tone="success" />
        <StatCard label="Medical Records" value={records} hint="Encounters logged" icon={ClipboardList} tone="warning" />
        <StatCard label="AI Predictions" value={predCount} hint="Runs to date" icon={Brain} tone="purple" />
      </div>

      <Card className="mt-5 p-5">
        <div className="mb-4 text-[15px] font-semibold text-ink">
          Recent Medical Records
        </div>
        {recent.length > 0 ? (
          <div className="flex flex-col">
            {recent.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 border-b border-line py-3 last:border-0"
              >
                <span className="h-10 w-10 flex-none rounded-[11px] bg-gradient-to-br from-brand-soft to-brand/20" />
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-ink">
                    {petName(r.pet)}
                  </div>
                  <div className="text-[11px] text-faint">
                    {r.reason_for_visit ?? "Visit"} ·{" "}
                    {r.assessment ? "Assessed" : "Intake"}
                  </div>
                </div>
                <span className="text-[11px] text-faint">{r.visit_date}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-2">
            No records yet.{" "}
            <Link href="/records/new" className="text-brand hover:underline">
              Add one
            </Link>
            .
          </p>
        )}
      </Card>
    </div>
  );
}
