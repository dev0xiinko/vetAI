import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const typeSchema = z.enum(["records", "predictions"]);

function csvCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  // Neutralize spreadsheet formula injection on free-text fields.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}

/**
 * Export a report as CSV. Reads go through the caller's session (RLS), so users
 * only export rows they may see. No PII beyond what the report already shows.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // Clinical exports (records/predictions carry assessments) are vet/admin only,
  // per the RBAC matrix (staff get activity views, not clinical exports).
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || (profile.role !== "admin" && profile.role !== "veterinarian")) {
    return new Response("Forbidden", { status: 403 });
  }

  const parsedType = typeSchema.safeParse(req.nextUrl.searchParams.get("type"));
  if (!parsedType.success) {
    return new Response("Unknown report type", { status: 400 });
  }
  const type = parsedType.data;

  let filename: string;
  let csv: string;

  if (type === "records") {
    const { data } = await supabase
      .from("medical_records")
      .select("visit_date, reason_for_visit, assessment, pet:pets(name)")
      .is("deleted_at", null)
      .order("visit_date", { ascending: false });
    const rows = (data ?? []).map((r) => {
      const pet = r.pet as { name?: string } | { name?: string }[] | null;
      const petName = Array.isArray(pet) ? pet[0]?.name : pet?.name;
      return [r.visit_date, petName ?? "", r.reason_for_visit ?? "", r.assessment ?? ""];
    });
    csv = toCsv(["Visit date", "Pet", "Reason", "Assessment"], rows);
    filename = "medical-records.csv";
  } else if (type === "predictions") {
    const { data } = await supabase
      .from("predictions")
      .select("created_at, input, output")
      .order("created_at", { ascending: false });
    const rows = (data ?? []).map((r) => {
      const input = r.input as { species?: string } | null;
      const output = r.output as Array<{ condition?: string; likelihood?: number }> | null;
      const top = Array.isArray(output) ? output[0] : undefined;
      return [
        r.created_at,
        input?.species ?? "",
        top?.condition ?? "",
        top?.likelihood != null ? `${Math.round(top.likelihood * 100)}%` : "",
      ];
    });
    csv = toCsv(["Run at", "Species", "Top suggestion", "Likelihood"], rows);
    filename = "predictions.csv";
  } else {
    return new Response("Unknown report type", { status: 400 });
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
