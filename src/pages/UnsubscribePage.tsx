import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type UnsubscribeState = "loading" | "ready" | "success" | "already" | "invalid" | "error";

export default function UnsubscribePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [state, setState] = useState<UnsubscribeState>("loading");
  const [submitting, setSubmitting] = useState(false);

  const message = useMemo(() => {
    switch (state) {
      case "loading":
        return "Vérification du lien…";
      case "ready":
        return "Confirmez votre désinscription des emails applicatifs FidéliPro.";
      case "success":
        return "Votre adresse a bien été désinscrite.";
      case "already":
        return "Cette adresse est déjà désinscrite.";
      case "invalid":
        return "Ce lien est invalide ou expiré.";
      default:
        return "Impossible de vérifier ce lien pour le moment.";
    }
  }, [state]);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setState("invalid");
        return;
      }

      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          {
            headers: {
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
          },
        );

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          setState(response.status === 404 ? "invalid" : "error");
          return;
        }

        if (payload.valid === false && payload.reason === "already_unsubscribed") {
          setState("already");
          return;
        }

        setState(payload.valid ? "ready" : "invalid");
      } catch {
        setState("error");
      }
    };

    validateToken();
  }, [token]);

  const handleConfirm = async () => {
    if (!token) return;
    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });

      if (error) throw error;

      if (data?.success) {
        setState("success");
      } else if (data?.reason === "already_unsubscribed") {
        setState("already");
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-6 py-16 text-foreground">
      <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center">
        <Card className="w-full border-border bg-card shadow-lg">
          <CardHeader className="space-y-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">FidéliPro</p>
            <CardTitle className="text-3xl font-extrabold">
              {state === "success" ? "Désinscription confirmée" : "Gestion des emails"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-center">
            <p className="text-base leading-7 text-muted-foreground">{message}</p>

            {state === "ready" ? (
              <Button className="w-full sm:w-auto" onClick={handleConfirm} disabled={submitting}>
                {submitting ? "Confirmation…" : "Confirmer la désinscription"}
              </Button>
            ) : null}

            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link to="/">Retour à l’accueil</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}