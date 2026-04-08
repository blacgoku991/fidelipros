import { useAuth } from "@/hooks/useAuth";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { SubscriptionGuard } from "@/components/dashboard/SubscriptionGuard";
import { MobileHeader } from "@/components/dashboard/MobileHeader";
import {
  businessSidebarItems, businessSidebarGroups,
  franchiseSidebarGroups,
  locationManagerSidebarGroups,
} from "@/lib/sidebarItems";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
}

export function DashboardLayout({ children, title, subtitle, headerAction }: DashboardLayoutProps) {
  const { contextLoaded, logout, isFranchiseOwner, locationId, locationName } = useAuth();

  const groups = locationId
    ? locationManagerSidebarGroups
    : isFranchiseOwner
      ? franchiseSidebarGroups
      : businessSidebarGroups;
  const items = groups.flatMap(g => g.items);

  if (!contextLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar items={items} groups={groups} onLogout={logout} />
      <main className="lg:ml-64 min-h-screen flex flex-col min-w-0 overflow-x-hidden">
        <MobileHeader onLogout={logout} items={items} groups={groups} />

        {/* Page header */}
        <div className="sticky top-[calc(env(safe-area-inset-top,0px)+68px)] lg:top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border/40 px-5 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <h1 className="text-base sm:text-2xl font-display font-bold tracking-tight truncate">{title}</h1>
              {locationName && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5 mt-0.5">
                  📍 {locationName}
                </span>
              )}
              {subtitle && (
                <p className="text-muted-foreground text-[11px] sm:text-sm mt-0.5 truncate">{subtitle}</p>
              )}
            </div>
            {headerAction && <div className="w-full sm:w-auto shrink-0 self-stretch sm:self-auto">{headerAction}</div>}
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 min-w-0 px-5 sm:px-6 lg:px-8 py-4 sm:py-6 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:pb-6">
          <SubscriptionGuard>
            {children}
          </SubscriptionGuard>
        </div>
      </main>
    </div>
  );
}
