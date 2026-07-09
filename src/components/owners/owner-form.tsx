"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOwner, updateOwner } from "@/server/owners/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type OwnerFormValues = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
};

type Props =
  | { mode: "create"; owner?: undefined }
  | { mode: "edit"; owner: OwnerFormValues };

export function OwnerForm({ mode, owner }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState({
    full_name: owner?.full_name ?? "",
    email: owner?.email ?? "",
    phone: owner?.phone ?? "",
    address: owner?.address ?? "",
    notes: owner?.notes ?? "",
  });

  const set = (key: keyof typeof values) => (value: string) =>
    setValues((v) => ({ ...v, [key]: value }));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res =
        mode === "edit"
          ? await updateOwner({ id: owner.id, ...values })
          : await createOwner(values);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/owners");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-lg flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="full_name">Full name</Label>
        <Input
          id="full_name"
          required
          value={values.full_name}
          onChange={(e) => set("full_name")(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={values.email}
            onChange={(e) => set("email")(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={values.phone}
            onChange={(e) => set("phone")(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="address">Address</Label>
        <Textarea
          id="address"
          value={values.address}
          onChange={(e) => set("address")(e.target.value)}
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
          {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Add owner"}
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
