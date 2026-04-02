import { useState } from "react";
import { Joyride, STATUS } from "react-joyride";
import type { CallBackProps, Step } from "react-joyride";
import { supabase } from "@/integrations/supabase/client";

const steps: Step[] = [
  {
    target: '[data-tour="scanner"]',
    content: "Scannez les QR codes de vos clients pour ajouter des points ou tampons. C'est le coeur de votre programme de fidélité !",
    title: "Scanner",
    disableBeacon: true,
  },
  {
    target: '[data-tour="personnaliser"]',
    content: "Personnalisez l'apparence de votre carte : couleurs, logo, style. Rendez-la unique à votre image !",
    title: "Personnaliser",
  },
  {
    target: '[data-tour="recompenses"]',
    content: "Configurez vos récompenses : nombre de points nécessaires, description, et offres spéciales.",
    title: "Récompenses",
  },
  {
    target: '[data-tour="campagnes"]',
    content: "Envoyez des notifications push à vos clients pour les faire revenir. Programmez-les à l'avance !",
    title: "Campagnes",
  },
  {
    target: '[data-tour="statistiques"]',
    content: "Suivez vos performances : clients actifs, taux de retour, conversions. Tout est ici !",
    title: "Statistiques",
  },
];

interface OnboardingTourProps {
  businessId: string;
}

export function OnboardingTour({ businessId }: OnboardingTourProps) {
  const [run, setRun] = useState(true);

  const handleCallback = async (data: CallBackProps) => {
    const { status } = data;
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status as any)) {
      setRun(false);
      await supabase
        .from("businesses")
        .update({ onboarding_tour_completed: true } as any)
        .eq("id", businessId);
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showProgress
      showSkipButton
      callback={handleCallback}
      styles={{
        options: {
          primaryColor: "#7c3aed",
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: 16,
          padding: 20,
        },
        buttonNext: {
          borderRadius: 12,
          padding: "8px 20px",
          fontWeight: 600,
        },
        buttonBack: {
          borderRadius: 12,
          marginRight: 8,
        },
        buttonSkip: {
          borderRadius: 12,
        },
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
