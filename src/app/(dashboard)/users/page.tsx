import { requireRole } from "@/lib/auth/session";
import { listUsers } from "@/server/users/queries";
import { UserManager } from "@/components/users/user-manager";

export default async function UsersPage() {
  // Admin only — route guard mirrors the RBAC matrix (User Management = admin).
  const session = await requireRole(["admin"]);
  const users = await listUsers();

  return (
    <div className="mx-auto max-w-5xl">
      <UserManager users={users} currentUserId={session.userId} />
    </div>
  );
}
