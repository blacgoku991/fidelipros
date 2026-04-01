import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { FaqSection } from "@/components/landing/FaqSection";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Mail } from "lucide-react";

const FaqPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 pb-8 text-center px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">Centre d'aide</Badge>
          <h1 className="text-4xl sm:text-5xl font-display font-extrabold tracking-tight mb-4">
            Questions fréquentes
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Trouvez rapidement des réponses à vos questions sur FidéliPro.
          </p>
        </motion.div>
      </section>

      {/* FAQ items from DB */}
      <FaqSection />

      {/* Contact CTA */}
      <section className="max-w-2xl mx-auto px-4 pb-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl border border-border/50 bg-card p-8"
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-xl font-display font-bold mb-2">Vous n'avez pas trouvé votre réponse ?</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Notre équipe est disponible pour vous aider. Contactez-nous et nous vous répondrons rapidement.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild className="bg-gradient-primary text-primary-foreground rounded-xl gap-2">
              <Link to="/contact">
                Nous contacter <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/register">Créer mon compte</Link>
            </Button>
          </div>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
};

export default FaqPage;
