"use client";

import { usePathname } from "next/navigation";
import { Bell, User } from "lucide-react";
import { titleForPath } from "@/components/shell/nav-items";

export function Topbar({ userName }: { userName: string }) {
  const pathname = usePathname();
  return (
    <header className="flex h-[66px] flex-none items-center justify-between border-b border-line bg-surface px-8">
      <div className="text-[19px] font-semibold text-ink">
        {titleForPath(pathname)}
      </div>
      <div className="flex items-center gap-5">
        <div className="relative">
          <Bell size={19} className="text-muted-2" />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-[1.5px] border-white bg-danger" />
        </div>
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand">
            <User size={17} />
          </span>
          <span className="text-[13px] font-medium text-ink">{userName}</span>
        </div>
      </div>
    </header>
  );
}
