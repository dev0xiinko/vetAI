"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPet, updatePet } from "@/server/pets/actions";
import { PET_SEXES } from "@/lib/validation/pets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type OwnerOption = { id: string; full_name: string };

export type PetFormValues = {
  id: string;
  owner_id: string;
  name: string;
  species: string;
  breed: string | null;
  sex: string | null;
  date_of_birth: string | null;
  weight_kg: number | null;
  notes: string | null;
};

type Props = {
  owners: OwnerOption[];
  /** Preselect an owner on create, e.g. arriving from that owner's profile. */
  defaultOwnerId?: string;
} & (
  | { mode: "create"; pet?: undefined }
  | { mode: "edit"; pet: PetFormValues }
);

export function PetForm({ mode, pet, owners, defaultOwnerId }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState({
    owner_id: pet?.owner_id ?? defaultOwnerId ?? owners[0]?.id ?? "",
    name: pet?.name ?? "",
    species: pet?.species ?? "",
    breed: pet?.breed ?? "",
    sex: pet?.sex ?? "",
    date_of_birth: pet?.date_of_birth ?? "",
    weight_kg: pet?.weight_kg != null ? String(pet.weight_kg) : "",
    notes: pet?.notes ?? "",
  });

  const set = (key: keyof typeof values) => (value: string) =>
    setValues((v) => ({ ...v, [key]: value }));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res =
        mode === "edit"
          ? await updatePet({ id: pet.id, ...values })
          : await createPet(values);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/pets");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-lg flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="owner_id">Owner</Label>
        <Select
          id="owner_id"
          required
          value={values.owner_id}
          onChange={(e) => set("owner_id")(e.target.value)}
        >
          <option value="" disabled>
            Select an owner…
          </option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.full_name}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            required
            value={values.name}
            onChange={(e) => set("name")(e.target.value)}
          />
        </div>
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
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="breed">Breed</Label>
          <Input
            id="breed"
            value={values.breed}
            onChange={(e) => set("breed")(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sex">Sex</Label>
          <Select
            id="sex"
            value={values.sex}
            onChange={(e) => set("sex")(e.target.value)}
          >
            <option value="">Unspecified</option>
            {PET_SEXES.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="weight_kg">Weight (kg)</Label>
          <Input
            id="weight_kg"
            type="number"
            step="0.01"
            min="0"
            value={values.weight_kg}
            onChange={(e) => set("weight_kg")(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="date_of_birth">Date of birth</Label>
        <Input
          id="date_of_birth"
          type="date"
          value={values.date_of_birth}
          onChange={(e) => set("date_of_birth")(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={values.notes}
          onChange={(e) => set("notes")(e.target.value)}
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Add pet"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push("/pets")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
