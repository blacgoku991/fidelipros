import { useState } from "react";
import { Joyride } from "react-joyride";
import { supabase } from "@/integrations/supabase/client";

const steps = [
  {
    target: '[data-tour="scanner"]',
    content: "Scannez les QR codes de vos clients pour ajouter des points ou tampons.",
    title: "Scanner",
  },
  {
    target: '[data-tour="personnaliser"]',
    content: "Personnalisez l'apparence de votre carte : couleurs, logo, style.",
    title: "Personnaliser",
  },
  {
    target: '[data-tour="recompenses"]',
    content: "Configurez vos récompenses : nombre de points nécessaires et offres spéciales.",
    title: "Récompenses",
  },
  {
    target: '[data-tour="campagnes"]',
    content: "Envoyez des notifications push à vos clients pour les faire revenir.",
    title: "Campagnes",
  },
  {
    target: '[data-tour="statistiques"]',
    content: "Suivez vos performances : clients actifs, taux de retour, conversions.",
    title: "Statistiques",
  },
];

interface OnboardingTourProps {
  businessId: string;
}

export function OnboardingTour({ businessId }: OnboardingTourProps) {
  const [run, setRun] = useState(true);

  return (
    <Joyride
      steps={steps as any}
      run={run}
      continuous
      onEvent={async (event: any) => {
        if (event.type === "tour:end") {
          setRun(false);
          await supabase
            .from("businesses")
            .update({ onboarding_completed: true })
            .eq("id", businessId);
        }
      }}
      locale={{
        back: "Retour",
        close: "Fermer",
        last: "Terminer",
        next: "Suivant",
        skip: "Passer",
      }}
    />
  );
}
