import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, HelpCircle, Sparkles } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="text-center max-w-lg space-y-6">
        {/* Big 404 */}
        <div className="relative">
          <h1 className="text-[8rem] sm:text-[10rem] font-extrabold leading-none tracking-tighter text-primary/10 select-none">
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
          </div>
        </div>

        {/* Copy */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">
            Page introuvable
          </h2>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            La page <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{location.pathname}</span> n'existe pas ou a été déplacée.
          </p>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button asChild>
            <Link to="/">
              <Home className="mr-2 h-4 w-4" />
              Retour à l'accueil
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/tarifs">
              <Sparkles className="mr-2 h-4 w-4" />
              Découvrir nos offres
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/faq">
              <HelpCircle className="mr-2 h-4 w-4" />
              FAQ
            </Link>
          </Button>
        </div>

        {/* Back link */}
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-1 h-3.5 w-3.5" />
          Revenir en arrière
        </button>
      </div>
    </div>
  );
};

export default NotFound;
