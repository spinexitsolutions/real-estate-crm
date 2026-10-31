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
  ReceiptText,
  PhoneCall,
  FolderOpen,
  Globe,
  UserCheck,
  PlugZap,
  CreditCard,
  type LucideIcon,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/ui/icons";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon | typeof WhatsAppIcon;
  roles?: string[];
  badgeKey?: "followups" | "whatsapp";
  match?: (path: string, search: string) => boolean;
  external?: boolean;
  /** Plan feature key required to show this item (see FEATURES in lib/billing-core). */
  feature?: string;
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
      { href: "/bookings", label: "Bookings & Payments", icon: ReceiptText, feature: "bookings" },
      { href: "/properties", label: "Properties", icon: Building2 },
      { href: "/documents", label: "Documents", icon: FolderOpen, feature: "documents" },
    ],
  },
  {
    title: "Engage",
    items: [
      { href: "/whatsapp", label: "WhatsApp", icon: WhatsAppIcon, badgeKey: "whatsapp" },
      { href: "/calls", label: "Calls", icon: PhoneCall },
      { href: "/site", label: "Public Website", icon: Globe, external: true, feature: "website" },
    ],
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
      { href: "/attendance", label: "Attendance", icon: UserCheck, feature: "attendance" },
      { href: "/team", label: "Team", icon: UserCog, roles: ["ADMIN", "MANAGER"] },
      { href: "/integrations", label: "Integrations", icon: PlugZap, roles: ["ADMIN", "MANAGER"], feature: "portal_integrations" },
      { href: "/billing", label: "Plan & Billing", icon: CreditCard, roles: ["ADMIN", "MANAGER"] },
      { href: "/settings", label: "Settings", icon: Settings, roles: ["ADMIN"] },
    ],
  },
];
