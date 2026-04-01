import { CreditCard, LogOut, Shield } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface SidebarItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

interface DashboardSidebarProps {
  items: SidebarItem[];
  onLogout: () => void;
}

export function DashboardSidebar({ items, onLogout }: DashboardSidebarProps) {
  const { role } = useAuth();
  const isAdmin = role === "super_admin";
  const isAdminPanel = items.some(i => i.path.startsWith("/admin"));

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-card border-r border-border/40 hidden lg:flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-6 py-5 border-b border-border/40">
        <div className={cn(
          "w-9 h-9 rounded-xl flex items-center justify-center shadow-sm",
          isAdminPanel ? "bg-purple-600" : "bg-gradient-primary"
        )}>
          {isAdminPanel ? (
            <Shield className="w-4 h-4 text-white" />
          ) : (
            <CreditCard className="w-4 h-4 text-primary-foreground" />
          )}
        </div>
        <div>
          <span className="text-lg font-display font-bold leading-none">FidéliPro</span>
          {isAdminPanel && <span className="text-[10px] text-purple-500 font-semibold ml-1.5 uppercase tracking-wider">Admin</span>}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/admin" || item.path === "/dashboard"}
            className={({ isActive }) =>
              cn(
                "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative",
                isActive
                  ? isAdminPanel
                    ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold"
                    : "bg-primary/10 text-primary font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className={cn(
                    "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full",
                    isAdminPanel ? "bg-purple-500" : "bg-primary"
                  )} />
                )}
                <item.icon className="w-[18px] h-[18px]" />
                {item.label}
              </>
            )}
          </NavLink>
        ))}

        {/* Switch between admin and merchant panels */}
        {isAdmin && !isAdminPanel && (
          <div className="pt-3 mt-3 border-t border-border/30">
            <NavLink to="/admin"
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-purple-500 hover:bg-purple-500/10 transition-colors">
              <Shield className="w-[18px] h-[18px]" />
              Panel Admin
            </NavLink>
          </div>
        )}
        {isAdminPanel && (
          <div className="pt-3 mt-3 border-t border-border/30">
            <NavLink to="/dashboard"
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-primary hover:bg-primary/10 transition-colors">
              <CreditCard className="w-[18px] h-[18px]" />
              Panel Commerçant
            </NavLink>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-border/40 space-y-1">
        <div className="flex items-center justify-between px-3.5 py-1">
          <span className="text-xs text-muted-foreground">Thème</span>
          <ThemeToggle />
        </div>
        <Button
          variant="ghost"
          onClick={onLogout}
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive rounded-xl h-10"
        >
          <LogOut className="w-4 h-4" />
          Déconnexion
        </Button>
      </div>
    </aside>
  );
}
