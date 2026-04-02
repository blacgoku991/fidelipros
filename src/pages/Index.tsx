import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { SocialProofSection } from "@/components/landing/SocialProofSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { RoiCalculatorSection } from "@/components/landing/RoiCalculatorSection";
import { Footer } from "@/components/landing/Footer";

const Index = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth("");

  useEffect(() => {
    if (loading || !user) return;
    navigate(role === "super_admin" ? "/admin" : "/dashboard", { replace: true });
  }, [loading, user, role, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <SocialProofSection />
      <FeaturesSection />
      <HowItWorksSection />
      <RoiCalculatorSection />
      <Footer />
    </div>
  );
};

export default Index;
