import {
  BarChart3, Users, Settings, Palette, Gift, Send,
  LayoutDashboard, Building2, Globe, Mail, CreditCard, Tag, ScanLine, MessageSquare,
  QrCode, Zap, MapPin, CalendarDays, TrendingUp, Target, Wand2, Shield, GitCompareArrows, UserCog,
} from "lucide-react";

export interface SidebarItem {
  icon: React.ElementType;
  label: string;
  path: string;
  dataTour?: string;
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
      { icon: ScanLine, label: "Scanner", path: "/dashboard/scanner", dataTour: "scanner" },
    ],
  },
  {
    label: "Fidélité",
    items: [
      { icon: Palette, label: "Carte de fidélité", path: "/dashboard/customize", dataTour: "personnaliser" },
      { icon: Users, label: "Clients", path: "/dashboard/clients" },
      { icon: Gift, label: "Récompenses", path: "/dashboard/rewards", dataTour: "recompenses" },
    ],
  },
  {
    label: "Marketing",
    items: [
      { icon: Send, label: "Campagnes", path: "/dashboard/campaigns", dataTour: "campagnes" },
      { icon: Zap, label: "Automations", path: "/dashboard/automations" },
    ],
  },
  {
    label: "Analyse",
    items: [
      { icon: TrendingUp, label: "Statistiques", path: "/dashboard/analytics", dataTour: "statistiques" },
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

// Franchise owner sidebar
export const franchiseSidebarGroups: SidebarGroup[] = [
  {
    label: "",
    items: [
      { icon: BarChart3, label: "Vue d'ensemble", path: "/dashboard" },
      { icon: ScanLine, label: "Scanner", path: "/dashboard/scanner" },
    ],
  },
  {
    label: "Franchise",
    items: [
      { icon: Building2, label: "Établissements", path: "/dashboard/locations" },
      { icon: GitCompareArrows, label: "Comparaison", path: "/dashboard/locations/compare" },
      { icon: UserCog, label: "Managers", path: "/dashboard/managers" },
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

// Location manager sidebar (scoped view)
export const locationManagerSidebarGroups: SidebarGroup[] = [
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
      { icon: Users, label: "Clients", path: "/dashboard/clients" },
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
      { icon: Settings, label: "Paramètres", path: "/dashboard/settings" },
    ],
  },
];

export const adminSidebarItems: SidebarItem[] = [
  { icon: LayoutDashboard, label: "Vue d'ensemble", path: "/admin" },
  { icon: Building2, label: "Entreprises", path: "/admin/businesses" },
  { icon: Users, label: "Utilisateurs", path: "/admin/users" },
  { icon: Globe, label: "Contenu du site", path: "/admin/landing" },
  { icon: Tag, label: "Plans & Tarifs", path: "/admin/plans" },
  { icon: Mail, label: "Emails programmés", path: "/admin/digest" },
  { icon: MessageSquare, label: "Messages", path: "/admin/messages" },
  { icon: Wand2, label: "Démo Generator", path: "/admin/demos" },
  { icon: Shield, label: "Journal d'audit", path: "/admin/audit" },
];
