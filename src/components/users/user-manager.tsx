"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, User } from "lucide-react";
import { createUser, setUserRole } from "@/server/users/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { USER_ROLES, type UserRole } from "@/lib/roles";

export type UserRow = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
};

export function UserManager({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    role: "staff" as UserRole,
    password: "",
  });

  const filtered = users.filter((u) => {
    const q = query.toLowerCase();
    return (
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await createUser(form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setForm({ email: "", full_name: "", role: "staff", password: "" });
      setShowAdd(false);
      router.refresh();
    });
  }

  function changeRole(userId: string, role: UserRole) {
    setError(null);
    start(async () => {
      const res = await setUserRole({ userId, role });
      if (!res.ok) setError(res.error);
      router.refresh();
    });
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users…"
            className="pr-9"
          />
          <Search
            size={16}
            className="absolute right-3 top-3.5 text-faint"
          />
        </div>
        <Button
          type="button"
          className="ml-auto"
          onClick={() => setShowAdd((s) => !s)}
        >
          <Plus size={15} /> Add User
        </Button>
      </div>

      {error ? (
        <p role="alert" className="mb-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {showAdd ? (
        <form
          onSubmit={submitAdd}
          className="mb-5 grid grid-cols-1 gap-3 rounded-[12px] border border-line bg-app/50 p-4 sm:grid-cols-2"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nu-name">Full name</Label>
            <Input
              id="nu-name"
              required
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nu-email">Email</Label>
            <Input
              id="nu-email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nu-role">Role</Label>
            <Select
              id="nu-role"
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value as UserRole })
              }
            >
              {USER_ROLES.map((r) => (
                <option key={r} value={r} className="capitalize">
                  {r}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nu-pass">Temporary password</Label>
            <Input
              id="nu-pass"
              type="text"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create user"}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="grid grid-cols-[1.4fr_1fr_1.6fr_0.5fr] border-b border-line px-1.5 pb-3 text-xs font-semibold text-faint">
        <span>Name</span>
        <span>Role</span>
        <span>Email</span>
        <span>Created</span>
      </div>
      {filtered.map((u) => (
        <div
          key={u.id}
          className="grid grid-cols-[1.4fr_1fr_1.6fr_0.5fr] items-center border-b border-line px-1.5 py-3 text-[13px]"
        >
          <span className="flex items-center gap-2.5 font-medium text-ink">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-line text-muted-2">
              <User size={15} />
            </span>
            {u.name || "—"}
            {u.id === currentUserId ? (
              <span className="text-[10px] text-faint">(you)</span>
            ) : null}
          </span>
          <span>
            <Select
              value={u.role}
              disabled={pending}
              onChange={(e) => changeRole(u.id, e.target.value as UserRole)}
              className="h-8 w-36 capitalize"
            >
              {USER_ROLES.map((r) => (
                <option key={r} value={r} className="capitalize">
                  {r}
                </option>
              ))}
            </Select>
          </span>
          <span className="truncate text-muted">{u.email}</span>
          <span className="text-faint">
            {new Date(u.createdAt).toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
      ))}
      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-2">No users found.</p>
      ) : null}
    </Card>
  );
}
