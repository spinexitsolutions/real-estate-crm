import {
  Calculator,
  CalendarClock,
  ChartColumn,
  Handshake,
  Kanban,
  LayoutDashboard,
  Settings,
  Building2,
  Users,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/ui/icons";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon | typeof WhatsAppIcon;
  roles?: string[];
  badgeKey?: "followups";
  match?: (path: string, search: string) => boolean;
};

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Sales",
    items: [
      { href: "/leads", label: "Leads", icon: Users, match: (p, s) => p.startsWith("/leads") && !s.includes("view=board") },
      { href: "/leads?view=board", label: "Pipeline", icon: Kanban, match: (p, s) => p === "/leads" && s.includes("view=board") },
      { href: "/follow-ups", label: "Follow-ups", icon: CalendarClock, badgeKey: "followups" },
      { href: "/deals", label: "Deals", icon: Handshake },
      { href: "/properties", label: "Properties", icon: Building2 },
    ],
  },
  {
    title: "Engage",
    items: [{ href: "/whatsapp", label: "WhatsApp", icon: WhatsAppIcon }],
  },
  {
    title: "Insights",
    items: [
      { href: "/reports", label: "Reports", icon: ChartColumn },
      { href: "/tools/emi", label: "EMI Calculator", icon: Calculator },
    ],
  },
  {
    title: "Workspace",
    items: [
      { href: "/team", label: "Team", icon: UserCog, roles: ["ADMIN", "MANAGER"] },
      { href: "/settings", label: "Settings", icon: Settings, roles: ["ADMIN"] },
    ],
  },
];
