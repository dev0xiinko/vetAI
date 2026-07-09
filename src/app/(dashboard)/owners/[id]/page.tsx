import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  User,
  Mail,
  Phone,
  MapPin,
  StickyNote,
  PawPrint,
  Plus,
  Pencil,
  Cake,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

export default async function OwnerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;
  // Validate at the boundary: a malformed id is a 404, not a DB error.
  if (!z.string().uuid().safeParse(id).success) notFound();

  const supabase = await createClient();

  const [{ data: owner, error: ownerError }, { data: pets }] =
    await Promise.all([
      supabase
        .from("owners")
        .select("id, full_name, email, phone, address, notes")
        .eq("id", id)
        .is("deleted_at", null)
        .single(),
      supabase
        .from("pets")
        .select("id, name, species, breed, date_of_birth")
        .eq("owner_id", id)
        .is("deleted_at", null)
        .order("name", { ascending: true }),
    ]);

  if (ownerError || !owner) notFound();

  const petRows = pets ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-gradient-to-br from-brand-soft to-brand/20">
              <User size={24} className="text-brand" />
            </span>
            <div>
              <h1 className="text-lg font-semibold text-ink">
                {owner.full_name}
              </h1>
              <p className="text-[13px] text-muted-2">Client / owner</p>
            </div>
          </div>
          <Link href={`/owners/${owner.id}/edit`}>
            <Button variant="secondary" className="gap-2">
              <Pencil size={15} />
              Edit
            </Button>
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-line pt-4 sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] bg-brand-soft text-brand">
              <Mail size={15} />
            </span>
            <div>
              <div className="text-[11px] text-faint">Email</div>
              <div className="text-[13px] text-ink">{owner.email ?? "—"}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] bg-purple-soft text-purple">
              <Phone size={15} />
            </span>
            <div>
              <div className="text-[11px] text-faint">Phone</div>
              <div className="text-[13px] text-ink">{owner.phone ?? "—"}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] bg-success-soft text-success">
              <MapPin size={15} />
            </span>
            <div>
              <div className="text-[11px] text-faint">Address</div>
              <div className="text-[13px] text-ink">
                {owner.address ?? "—"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] bg-warning-soft text-warning">
              <StickyNote size={15} />
            </span>
            <div>
              <div className="text-[11px] text-faint">Notes</div>
              <div className="text-[13px] text-ink">{owner.notes ?? "—"}</div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="mt-5 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <PawPrint size={16} className="text-muted-2" />
            Pets
          </div>
          <Link href={`/pets/new?owner=${owner.id}`}>
            <Button variant="secondary" className="gap-2">
              <Plus size={15} />
              Add pet
            </Button>
          </Link>
        </div>

        {petRows.length > 0 ? (
          <div className="flex flex-col">
            {petRows.map((p) => (
              <Link
                key={p.id}
                href={`/pets/${p.id}`}
                className="flex items-center gap-3 border-b border-line py-3 last:border-0 hover:bg-app/60"
              >
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px] bg-gradient-to-br from-brand-soft to-brand/20">
                  <PawPrint size={17} className="text-brand" />
                </span>
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-ink">
                    {p.name}
                  </div>
                  <div className="text-[11px] text-faint">
                    {p.species}
                    {p.breed ? ` · ${p.breed}` : ""}
                  </div>
                </div>
                <span className="flex items-center gap-1 text-[11px] text-faint">
                  <Cake size={12} />
                  {formatAge(p.date_of_birth)}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-2">
            No pets on file yet.{" "}
            <Link
              href={`/pets/new?owner=${owner.id}`}
              className="text-brand hover:underline"
            >
              Add the first pet
            </Link>
            .
          </p>
        )}
      </Card>
    </div>
  );
}
