import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { SocialProofSection } from "@/components/landing/SocialProofSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { RoiCalculatorSection } from "@/components/landing/RoiCalculatorSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { Footer } from "@/components/landing/Footer";

const Index = () => {
  const navigate = useNavigate();

  // Redirect authenticated users to dashboard (including after Google OAuth callback)
  useEffect(() => {
    const redirectIfAuthenticated = async (userId: string) => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (roles?.some((r) => r.role === "super_admin")) {
        navigate("/admin", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    };

    // Check existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) redirectIfAuthenticated(session.user.id);
    });

    // Listen for OAuth callback (SIGNED_IN event fires after redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        redirectIfAuthenticated(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <SocialProofSection />
      <FeaturesSection />
      <HowItWorksSection />
      <RoiCalculatorSection />
      <PricingSection />
      <FaqSection />
      <Footer />
    </div>
  );
};

export default Index;
