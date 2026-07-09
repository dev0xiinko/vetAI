"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { PawPrint, LogOut, User } from "lucide-react";
import { NAV_ITEMS } from "@/components/shell/nav-items";
import { logoutAction } from "@/server/auth/actions";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/roles";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  role,
  userName,
}: {
  role: UserRole;
  userName: string;
}) {
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const items = NAV_ITEMS.filter(
    (i) => i.roles === null || i.roles.includes(role),
  );

  return (
    <aside className="flex w-[250px] flex-none flex-col bg-brand px-3.5 pb-3.5 pt-5 text-white">
      <div className="flex items-center gap-3 px-1.5 pb-5">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[11px] bg-white/15">
          <PawPrint size={21} />
        </span>
        <div className="leading-tight">
          <div className="text-[15px] font-bold">VetiAssist AI</div>
          <div className="text-[10px] text-white/60">Smart Veterinary Care</div>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-[10px] px-3.5 py-2.5 text-[13.5px] font-medium transition-colors",
                active
                  ? "bg-white/20 text-white"
                  : "text-white/75 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon size={19} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-2.5 border-t border-white/15 px-2 pt-3">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-white/15">
          <User size={16} />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-xs font-semibold">{userName}</div>
          <div className="text-[10px] capitalize text-white/60">{role}</div>
        </div>
        <form action={() => start(() => logoutAction())}>
          <button
            type="submit"
            disabled={pending}
            aria-label="Sign out"
            className="text-white/70 transition-colors hover:text-white disabled:opacity-50"
          >
            <LogOut size={16} />
          </button>
        </form>
      </div>
    </aside>
  );
}
