import { requireSession } from "@/lib/auth/session";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const userName = session.fullName ?? "Clinic staff";

  return (
    <div className="flex h-screen overflow-hidden bg-app">
      <Sidebar role={session.role} userName={userName} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar userName={userName} />
        <main className="flex-1 overflow-y-auto px-8 pb-10 pt-7">
          {children}
        </main>
      </div>
    </div>
  );
}
