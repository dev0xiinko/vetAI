"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  runPrediction,
  type RunPredictionResult,
} from "@/server/predictions/actions";
import { DisclaimerBanner } from "@/components/ai/disclaimer-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type PetOption = {
  id: string;
  name: string;
  species: string;
  date_of_birth: string | null;
  weight_kg: number | null;
};

/** Whole months between a date of birth and now — floors partial months, never negative. */
function monthsSinceBirth(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return 0;
  const now = new Date();
  let months =
    (now.getFullYear() - dob.getFullYear()) * 12 +
    (now.getMonth() - dob.getMonth());
  if (now.getDate() < dob.getDate()) months -= 1;
  return Math.max(0, months);
}

function ConfidenceBar({ likelihood }: { likelihood: number }) {
  const pct = Math.round(likelihood * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-32 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-brand"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
        {pct}%
      </span>
    </div>
  );
}

type Props = {
  pets: PetOption[];
  /** Preselect a pet, e.g. arriving from that pet's profile. */
  initialPetId?: string;
  /** Seed the symptoms textarea, e.g. arriving from a visit's reason. */
  initialSymptoms?: string;
};

export function PredictionRunner({
  pets,
  initialPetId,
  initialSymptoms,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<RunPredictionResult | null>(null);
  const [resultPetId, setResultPetId] = useState<string | null>(null);
  const [values, setValues] = useState(() => {
    const initialPet = initialPetId
      ? pets.find((p) => p.id === initialPetId)
      : undefined;
    return {
      pet_id: initialPetId ?? "",
      species: initialPet?.species ?? "",
      ageMonths: initialPet?.date_of_birth
        ? String(monthsSinceBirth(initialPet.date_of_birth))
        : "",
      symptoms: initialSymptoms ?? "",
      notes: "",
    };
  });

  const selectedPet = pets.find((p) => p.id === values.pet_id);

  const set = (key: keyof typeof values) => (value: string) =>
    setValues((v) => ({ ...v, [key]: value }));

  // Prefill species/age from the linked pet's profile — editable afterward,
  // not locked. Fires on pet selection, not as a side effect of rendering.
  function onPetChange(petId: string) {
    const pet = pets.find((p) => p.id === petId);
    setValues((v) => ({
      ...v,
      pet_id: petId,
      species: pet?.species || v.species,
      ageMonths: pet?.date_of_birth
        ? String(monthsSinceBirth(pet.date_of_birth))
        : v.ageMonths,
    }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    const symptoms = values.symptoms
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const pet_id = values.pet_id || undefined;
    start(async () => {
      const res = await runPrediction({
        pet_id,
        species: values.species,
        ageMonths: Number(values.ageMonths),
        symptoms,
        notes: values.notes || undefined,
      });
      setResult(res);
      setResultPetId(pet_id ?? null);
      if (res.ok) router.refresh(); // reflect the new history row
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <DisclaimerBanner />

      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="species">Species</Label>
            <Input
              id="species"
              required
              placeholder="Dog, Cat…"
              value={values.species}
              onChange={(e) => set("species")(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ageMonths">Age (months)</Label>
            <Input
              id="ageMonths"
              type="number"
              min="0"
              required
              value={values.ageMonths}
              onChange={(e) => set("ageMonths")(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pet_id">Link to pet (optional)</Label>
            <Select
              id="pet_id"
              value={values.pet_id}
              onChange={(e) => onPetChange(e.target.value)}
            >
              <option value="">None</option>
              {pets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            {selectedPet ? (
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Species/age filled from {selectedPet.name}&rsquo;s profile.
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="symptoms">Symptoms</Label>
          <Textarea
            id="symptoms"
            required
            placeholder="One per line, e.g.&#10;vomiting&#10;lethargy"
            value={values.symptoms}
            onChange={(e) => set("symptoms")(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Input
            id="notes"
            value={values.notes}
            onChange={(e) => set("notes")(e.target.value)}
          />
        </div>

        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Analyzing…" : "Suggest conditions"}
        </Button>
      </form>

      {result && !result.ok ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {result.message}
        </p>
      ) : null}

      {result && result.ok ? (
        <section aria-label="Suggested conditions" className="flex flex-col gap-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {result.data.conditions.length} possibilities to investigate,
            ordered by likelihood. Confirm with clinical judgment.
          </p>
          <ol className="flex flex-col gap-3">
            {result.data.conditions.map((c, i) => (
              <li
                key={`${c.condition}-${i}`}
                className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
                    {c.condition}
                  </h3>
                  <ConfidenceBar likelihood={c.likelihood} />
                </div>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {c.rationale}
                </p>
                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <span className="font-medium">Suggested next step: </span>
                  {c.recommended_next_step}
                </p>
              </li>
            ))}
          </ol>
          {resultPetId && result.data.id ? (
            <div className="flex flex-col items-start gap-1.5">
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  router.push(
                    `/records/new?pet=${resultPetId}&prediction=${result.data.id}`,
                  )
                }
              >
                Draft medical record
              </Button>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Prefills a draft for the vet to review and edit — nothing is
                saved until submitted.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
