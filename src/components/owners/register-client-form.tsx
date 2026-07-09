"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registerClient } from "@/server/owners/actions";
import { PET_SEXES } from "@/lib/validation/pets";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/** Client-side form state; server re-validates all of this with zod. */
type FormState = {
  owner: {
    full_name: string;
    email: string;
    phone: string;
    address: string;
    notes: string;
  };
  addPet: boolean;
  pet: {
    name: string;
    species: string;
    breed: string;
    sex: string;
    date_of_birth: string;
    weight_kg: string;
    notes: string;
  };
};

const initialState: FormState = {
  owner: { full_name: "", email: "", phone: "", address: "", notes: "" },
  addPet: true,
  pet: {
    name: "",
    species: "",
    breed: "",
    sex: "",
    date_of_birth: "",
    weight_kg: "",
    notes: "",
  },
};

export function RegisterClientForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedOwnerId, setSavedOwnerId] = useState<string | null>(null);
  const [values, setValues] = useState<FormState>(initialState);

  const setOwnerField =
    (key: keyof FormState["owner"]) => (value: string) =>
      setValues((v) => ({ ...v, owner: { ...v.owner, [key]: value } }));

  const setPetField = (key: keyof FormState["pet"]) => (value: string) =>
    setValues((v) => ({ ...v, pet: { ...v.pet, [key]: value } }));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedOwnerId(null);
    start(async () => {
      const res = await registerClient({
        owner: values.owner,
        skipPet: !values.addPet,
        pet: values.addPet ? values.pet : undefined,
      });

      if (!res.ok) {
        setError(res.error);
        if (res.data?.ownerId) setSavedOwnerId(res.data.ownerId);
        return;
      }

      router.push(`/owners/${res.data.ownerId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-5">
      <Card className="flex flex-col gap-4 p-5">
        <h2 className="text-[15px] font-semibold text-ink">Owner details</h2>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="full_name">Full name</Label>
          <Input
            id="full_name"
            required
            value={values.owner.full_name}
            onChange={(e) => setOwnerField("full_name")(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={values.owner.email}
              onChange={(e) => setOwnerField("email")(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={values.owner.phone}
              onChange={(e) => setOwnerField("phone")(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="address">Address</Label>
          <Textarea
            id="address"
            value={values.owner.address}
            onChange={(e) => setOwnerField("address")(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="owner_notes">Notes</Label>
          <Textarea
            id="owner_notes"
            value={values.owner.notes}
            onChange={(e) => setOwnerField("notes")(e.target.value)}
          />
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-ink">First pet</h2>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-line-strong accent-brand"
              checked={values.addPet}
              onChange={(e) =>
                setValues((v) => ({ ...v, addPet: e.target.checked }))
              }
            />
            Add their first pet now
          </label>
        </div>

        {values.addPet ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pet_name">Name</Label>
                <Input
                  id="pet_name"
                  required={values.addPet}
                  value={values.pet.name}
                  onChange={(e) => setPetField("name")(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="species">Species</Label>
                <Input
                  id="species"
                  required={values.addPet}
                  placeholder="Dog, Cat…"
                  value={values.pet.species}
                  onChange={(e) => setPetField("species")(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="breed">Breed</Label>
                <Input
                  id="breed"
                  value={values.pet.breed}
                  onChange={(e) => setPetField("breed")(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sex">Sex</Label>
                <Select
                  id="sex"
                  value={values.pet.sex}
                  onChange={(e) => setPetField("sex")(e.target.value)}
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
                  value={values.pet.weight_kg}
                  onChange={(e) => setPetField("weight_kg")(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="date_of_birth">Date of birth</Label>
              <Input
                id="date_of_birth"
                type="date"
                value={values.pet.date_of_birth}
                onChange={(e) =>
                  setPetField("date_of_birth")(e.target.value)
                }
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pet_notes">Notes</Label>
              <Textarea
                id="pet_notes"
                value={values.pet.notes}
                onChange={(e) => setPetField("notes")(e.target.value)}
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-2">
            You can add pets for this owner later from their profile page.
          </p>
        )}
      </Card>

      {error ? (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-[10px] border border-danger/30 bg-danger-soft p-3 text-sm text-danger"
        >
          <span>{error}</span>
          {savedOwnerId ? (
            <Button
              type="button"
              variant="secondary"
              className="w-fit"
              onClick={() => router.push(`/owners/${savedOwnerId}`)}
            >
              Go to owner
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Register client"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push("/owners")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
