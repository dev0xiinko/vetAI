import {
  Home,
  Contact,
  PawPrint,
  ClipboardList,
  Activity,
  MessageSquare,
  BarChart3,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/lib/roles";

export type NavEntry = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Roles allowed to see it; null = everyone. */
  roles: readonly UserRole[] | null;
};

export const NAV_ITEMS: NavEntry[] = [
  { label: "Dashboard", href: "/", icon: Home, roles: null },
  { label: "Owners", href: "/owners", icon: Contact, roles: null },
  { label: "Pets", href: "/pets", icon: PawPrint, roles: null },
  { label: "Medical Records", href: "/records", icon: ClipboardList, roles: null },
  { label: "Disease Prediction", href: "/prediction", icon: Activity, roles: null },
  { label: "AI Assistant", href: "/chatbot", icon: MessageSquare, roles: null },
  { label: "Reports", href: "/reports", icon: BarChart3, roles: null },
  { label: "User Management", href: "/users", icon: Users, roles: ["admin"] },
];

/** Page title for the topbar, longest-prefix match. */
export function titleForPath(pathname: string): string {
  const titles: Array<[string, string]> = [
    ["/owners", "Owners"],
    ["/pets", "Pet Profiles"],
    ["/records", "Medical Records"],
    ["/prediction", "AI Disease Prediction"],
    ["/chatbot", "AI Assistant"],
    ["/reports", "Reports"],
    ["/users", "User Management"],
    ["/", "Dashboard"],
  ];
  for (const [prefix, title] of titles) {
    if (pathname === prefix || (prefix !== "/" && pathname.startsWith(prefix))) {
      return title;
    }
  }
  return "Dashboard";
}
