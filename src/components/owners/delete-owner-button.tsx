"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { softDeleteOwner } from "@/server/owners/actions";

export function DeleteOwnerButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    if (!window.confirm(`Remove ${name}? Their history is preserved.`)) return;
    setError(null);
    start(async () => {
      const res = await softDeleteOwner(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="text-sm text-red-600 hover:underline disabled:opacity-60 dark:text-red-400"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </span>
  );
}
