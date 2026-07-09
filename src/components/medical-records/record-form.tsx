"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createMedicalRecord,
  updateMedicalRecord,
} from "@/server/medical-records/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type PetOption = { id: string; name: string };

export type RecordFormValues = {
  id: string;
  pet_id: string;
  pet_name: string;
  visit_date: string | null;
  reason_for_visit: string | null;
  intake_weight_kg: number | null;
  intake_temp_c: number | null;
  assessment: string | null;
  plan: string | null;
};

type Props = {
  pets: PetOption[];
  /** vet/admin may write the clinical fields; staff see them read-only. */
  canEditClinical: boolean;
  /** Preselect a pet on create, e.g. arriving from that pet's profile. */
  defaultPetId?: string;
  /** Seed intake/clinical text on create, e.g. from a prediction draft. */
  prefill?: { reason_for_visit?: string; assessment?: string };
  /** The prediction run this draft was built from, if any (create only). */
  predictionId?: string;
  /** Lock the pet selector (a prediction link is only valid for its own pet). */
  lockPet?: boolean;
} & (
  | { mode: "create"; record?: undefined }
  | { mode: "edit"; record: RecordFormValues }
);

export function RecordForm({
  mode,
  record,
  pets,
  canEditClinical,
  defaultPetId,
  prefill,
  predictionId,
  lockPet,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState({
    pet_id: record?.pet_id ?? defaultPetId ?? pets[0]?.id ?? "",
    visit_date: record?.visit_date ?? "",
    reason_for_visit: record?.reason_for_visit ?? prefill?.reason_for_visit ?? "",
    intake_weight_kg:
      record?.intake_weight_kg != null ? String(record.intake_weight_kg) : "",
    intake_temp_c:
      record?.intake_temp_c != null ? String(record.intake_temp_c) : "",
    assessment: record?.assessment ?? prefill?.assessment ?? "",
    plan: record?.plan ?? "",
    sync_pet_weight: false,
  });

  const set = (key: keyof typeof values) => (value: string) =>
    setValues((v) => ({ ...v, [key]: value }));

  const selectedPetName =
    mode === "edit"
      ? record.pet_name
      : (pets.find((p) => p.id === values.pet_id)?.name ?? "the pet");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const base = {
      visit_date: values.visit_date,
      reason_for_visit: values.reason_for_visit,
      intake_weight_kg: values.intake_weight_kg,
      intake_temp_c: values.intake_temp_c,
      sync_pet_weight: values.sync_pet_weight,
    };
    const clinical = canEditClinical
      ? { assessment: values.assessment, plan: values.plan }
      : {};
    start(async () => {
      const res =
        mode === "edit"
          ? await updateMedicalRecord({ id: record.id, ...base, ...clinical })
          : await createMedicalRecord({
              pet_id: values.pet_id,
              prediction_id: predictionId,
              ...base,
              ...clinical,
            });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/records");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-lg flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pet_id">Pet</Label>
        {mode === "edit" ? (
          <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            {record.pet_name}
          </p>
        ) : (
          <Select
            id="pet_id"
            required
            disabled={Boolean(lockPet)}
            title={
              lockPet
                ? "Locked: this draft is linked to an AI prediction for this pet."
                : undefined
            }
            value={values.pet_id}
            onChange={(e) => set("pet_id")(e.target.value)}
          >
            <option value="" disabled>
              Select a pet…
            </option>
            {pets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      {/* Intake — all clinic staff */}
      <fieldset className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <legend className="px-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
          Intake
        </legend>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="visit_date">Visit date</Label>
          <Input
            id="visit_date"
            type="date"
            value={values.visit_date}
            onChange={(e) => set("visit_date")(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reason_for_visit">Reason for visit</Label>
          <Textarea
            id="reason_for_visit"
            value={values.reason_for_visit}
            onChange={(e) => set("reason_for_visit")(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="intake_weight_kg">Weight (kg)</Label>
            <Input
              id="intake_weight_kg"
              type="number"
              step="0.01"
              min="0"
              value={values.intake_weight_kg}
              onChange={(e) => set("intake_weight_kg")(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="intake_temp_c">Temp (°C)</Label>
            <Input
              id="intake_temp_c"
              type="number"
              step="0.1"
              min="0"
              value={values.intake_temp_c}
              onChange={(e) => set("intake_temp_c")(e.target.value)}
            />
          </div>
        </div>
        {values.intake_weight_kg.trim() !== "" ? (
          <div className="flex items-center gap-2">
            <input
              id="sync_pet_weight"
              type="checkbox"
              checked={values.sync_pet_weight}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  sync_pet_weight: e.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-zinc-300 text-brand focus-visible:ring-2 focus-visible:ring-brand/20 dark:border-zinc-700"
            />
            <Label htmlFor="sync_pet_weight" className="cursor-pointer">
              Also update {selectedPetName}&rsquo;s current weight
            </Label>
          </div>
        ) : null}
      </fieldset>

      {predictionId ? (
        <div
          role="note"
          className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300"
        >
          Draft from an AI prediction — review and edit before saving. This
          is decision support, not a diagnosis.
        </div>
      ) : null}

      {/* Clinical — veterinarian / admin only */}
      <fieldset className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <legend className="px-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
          Clinical {canEditClinical ? "" : "(veterinarian only)"}
        </legend>
        {canEditClinical ? (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assessment">Assessment</Label>
              <Textarea
                id="assessment"
                value={values.assessment}
                onChange={(e) => set("assessment")(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="plan">Plan</Label>
              <Textarea
                id="plan"
                value={values.plan}
                onChange={(e) => set("plan")(e.target.value)}
              />
            </div>
          </>
        ) : (
          <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            <p>
              <span className="font-medium">Assessment:</span>{" "}
              {record?.assessment ?? "—"}
            </p>
            <p>
              <span className="font-medium">Plan:</span> {record?.plan ?? "—"}
            </p>
            <p className="text-xs text-zinc-400">
              Clinical fields are set by the attending veterinarian.
            </p>
          </div>
        )}
      </fieldset>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending
            ? "Saving…"
            : mode === "edit"
              ? "Save changes"
              : "Add record"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push("/records")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
