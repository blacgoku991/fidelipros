import { useState } from "react";
import { CreditCard, LogOut, Menu } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Link, NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { SidebarItem, SidebarGroup } from "@/lib/sidebarItems";

interface MobileHeaderProps {
  onLogout: () => void;
  items?: SidebarItem[];
  groups?: SidebarGroup[];
}

export function MobileHeader({ onLogout, items = [], groups }: MobileHeaderProps) {
  const [open, setOpen] = useState(false);

  const renderItem = (item: SidebarItem) => (
    <SheetClose asChild key={item.path}>
      <NavLink
        to={item.path}
        end={item.path === "/dashboard"}
        onClick={() => setOpen(false)}
        className={({ isActive }) =>
          cn(
            "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
            isActive
              ? "bg-primary/10 text-primary font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          )
        }
      >
        <item.icon className="w-[18px] h-[18px]" />
        {item.label}
      </NavLink>
    </SheetClose>
  );

  return (
    <div className="lg:hidden sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/40">
      <div className="flex items-center justify-between px-4 py-3">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-sm">
            <CreditCard className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-base">FidéliPro</span>
        </Link>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[80vw] max-w-xs p-0">
            <div className="flex flex-col h-full">
              <SheetHeader className="p-5 pb-4 border-b border-border/40">
                <SheetTitle className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-sm">
                    <CreditCard className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <span className="font-display font-bold">FidéliPro</span>
                </SheetTitle>
              </SheetHeader>

              <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {groups ? (
                  groups.map((group, gi) => (
                    <div key={gi} className={cn(group.label && "mt-4 first:mt-0")}>
                      {group.label && (
                        <p className="px-4 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                          {group.label}
                        </p>
                      )}
                      <div className="space-y-0.5">
                        {group.items.map(renderItem)}
                      </div>
                    </div>
                  ))
                ) : (
                  items.map(renderItem)
                )}
              </nav>

              <div className="p-4 border-t border-border/40 space-y-1">
                <div className="flex items-center justify-between px-3 py-1">
                  <span className="text-xs text-muted-foreground">Thème</span>
                  <ThemeToggle />
                </div>
                <Button
                  variant="ghost"
                  onClick={() => { setOpen(false); onLogout(); }}
                  className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive rounded-xl h-11"
                >
                  <LogOut className="w-4 h-4" />
                  Déconnexion
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
