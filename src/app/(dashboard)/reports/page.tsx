import { FileText, Users, TrendingUp, Activity, FileDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getReportStats } from "@/server/reports/queries";
import { Card } from "@/components/ui/card";

function ReportTypeCard({
  title,
  hint,
  icon: Icon,
  tone,
}: {
  title: string;
  hint: string;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-[11px] ${tone}`}
      >
        <Icon size={21} />
      </span>
      <div>
        <div className="text-sm font-semibold text-ink">{title}</div>
        <div className="mt-0.5 text-[11px] text-faint">{hint}</div>
      </div>
    </Card>
  );
}

function BarList({
  items,
}: {
  items: { label: string; count: number }[];
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  if (items.length === 0) {
    return <p className="text-sm text-muted-2">No data yet.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-3 text-sm">
          <span className="w-40 flex-none truncate text-ink">{i.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${Math.round((i.count / max) * 100)}%` }}
            />
          </div>
          <span className="w-8 flex-none text-right tabular-nums text-muted">
            {i.count}
          </span>
        </div>
      ))}
    </div>
  );
}

export default async function ReportsPage() {
  const session = await requireSession();
  const canExport =
    session.role === "admin" || session.role === "veterinarian";
  const stats = await getReportStats();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ReportTypeCard title="Medical Reports" hint="Full patient histories" icon={FileText} tone="bg-brand-soft text-brand" />
        <ReportTypeCard title="Patient Reports" hint="Visit summaries" icon={Users} tone="bg-purple-soft text-purple" />
        <ReportTypeCard title="Disease Trends" hint="Prediction analytics" icon={TrendingUp} tone="bg-success-soft text-success" />
        <ReportTypeCard title="Clinic Activity" hint="Operations overview" icon={Activity} tone="bg-warning-soft text-warning" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-4">
        {[
          { label: "Pets", value: stats.pets },
          { label: "Owners", value: stats.owners },
          { label: "Records", value: stats.records },
          { label: "Predictions", value: stats.predictions },
        ].map((s) => (
          <Card key={s.label} className="p-5">
            <div className="text-[13px] text-muted">{s.label}</div>
            <div className="mt-1 text-[26px] font-bold text-ink">{s.value}</div>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 text-[15px] font-semibold text-ink">
            Top Predicted Conditions
          </div>
          <BarList
            items={stats.topConditions.map((c) => ({
              label: c.condition,
              count: c.count,
            }))}
          />
        </Card>
        <Card className="p-5">
          <div className="mb-4 text-[15px] font-semibold text-ink">
            Species Mix
          </div>
          <BarList
            items={stats.speciesMix.map((s) => ({
              label: s.species,
              count: s.count,
            }))}
          />
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap gap-3" hidden={!canExport}>
        <a href="/api/reports/export?type=records" download>
          <span className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-line-strong bg-surface px-5 text-sm font-semibold text-muted hover:bg-app">
            <FileDown size={16} /> Export Records (CSV)
          </span>
        </a>
        <a href="/api/reports/export?type=predictions" download>
          <span className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-line-strong bg-surface px-5 text-sm font-semibold text-muted hover:bg-app">
            <FileDown size={16} /> Export Predictions (CSV)
          </span>
        </a>
      </div>
    </div>
  );
}
