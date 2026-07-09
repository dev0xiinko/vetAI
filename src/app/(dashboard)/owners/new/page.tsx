import { requireSession } from "@/lib/auth/session";
import { RegisterClientForm } from "@/components/owners/register-client-form";

export default async function NewOwnerPage() {
  await requireSession();
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold text-ink">Register client</h1>
      <p className="mt-1 mb-6 text-sm text-muted-2">
        Add an owner and, optionally, their first pet in one step.
      </p>
      <RegisterClientForm />
    </div>
  );
}
