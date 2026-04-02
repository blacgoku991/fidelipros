import {
  BarChart3, Users, Settings, Palette, Gift, Send,
  LayoutDashboard, Building2, Globe, Mail, CreditCard, Tag, ScanLine, MessageSquare,
  QrCode, Zap, MapPin, CalendarDays, TrendingUp, Target, Wand2, Shield,
} from "lucide-react";

export interface SidebarItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

export interface SidebarGroup {
  label: string;
  items: SidebarItem[];
}

export const businessSidebarGroups: SidebarGroup[] = [
  {
    label: "",
    items: [
      { icon: BarChart3, label: "Dashboard", path: "/dashboard" },
      { icon: ScanLine, label: "Scanner", path: "/dashboard/scanner" },
    ],
  },
  {
    label: "Fidélité",
    items: [
      { icon: Palette, label: "Carte de fidélité", path: "/dashboard/customize" },
      { icon: Users, label: "Clients", path: "/dashboard/clients" },
      { icon: Gift, label: "Récompenses", path: "/dashboard/rewards" },
    ],
  },
  {
    label: "Marketing",
    items: [
      { icon: Send, label: "Campagnes", path: "/dashboard/campaigns" },
      { icon: Zap, label: "Automations", path: "/dashboard/automations" },
    ],
  },
  {
    label: "Analyse",
    items: [
      { icon: TrendingUp, label: "Statistiques", path: "/dashboard/analytics" },
    ],
  },
  {
    label: "",
    items: [
      { icon: CreditCard, label: "Abonnement", path: "/dashboard/abonnement" },
      { icon: Settings, label: "Paramètres", path: "/dashboard/settings" },
    ],
  },
];

// Flat list for backward compat
export const businessSidebarItems: SidebarItem[] = businessSidebarGroups.flatMap(g => g.items);

export const adminSidebarItems: SidebarItem[] = [
  { icon: LayoutDashboard, label: "Vue d'ensemble", path: "/admin" },
  { icon: Building2, label: "Entreprises", path: "/admin/businesses" },
  { icon: Users, label: "Utilisateurs", path: "/admin/users" },
  { icon: Globe, label: "Contenu du site", path: "/admin/landing" },
  { icon: Tag, label: "Plans & Tarifs", path: "/admin/plans" },
  { icon: Mail, label: "Emails programmés", path: "/admin/digest" },
  { icon: MessageSquare, label: "Messages", path: "/admin/messages" },
  { icon: Wand2, label: "Démo Generator", path: "/admin/demos" },
];
