import { Link } from "react-router-dom";
import { CreditCard, ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

interface AuthNavbarProps {
  /** Show a "back to login" or "back to register" link instead of full nav */
  backTo?: "login" | "register";
}

export function AuthNavbar({ backTo }: AuthNavbarProps) {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 h-14 bg-background/80 backdrop-blur-lg border-b border-border/40 flex items-center px-4 sm:px-6">
      <div className="flex items-center gap-2">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <CreditCard className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-sm sm:text-base">FidéliPro</span>
        </Link>
      </div>

      <div className="hidden sm:flex items-center gap-4 ml-8 text-sm text-muted-foreground">
        <Link to="/#features" className="hover:text-foreground transition-colors">Fonctionnalités</Link>
        <Link to="/tarifs" className="hover:text-foreground transition-colors">Tarifs</Link>
        <Link to="/faq" className="hover:text-foreground transition-colors">FAQ</Link>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        {backTo === "login" && (
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            Connexion
          </Link>
        )}
        {backTo === "register" && (
          <Link to="/register" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            S'inscrire
          </Link>
        )}
        {!backTo && (
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            Accueil
          </Link>
        )}
      </div>
    </nav>
  );
}
