import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Zap, Crown, ArrowRight, ChevronDown, Building2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

const plans = [
  {
    key: "starter",
    name: "Starter",
    price: 29,
    icon: Zap,
    color: "from-blue-500 to-cyan-500",
    description: "L'essentiel pour lancer votre fidélisation.",
    features: [
      "Scanner QR code",
      "Cartes de fidélité digitales",
      "Apple Wallet & Google Wallet",
      "Jusqu'à 200 clients",
      "Gestion récompenses",
      "Personnalisation carte (logo, couleurs)",
      "Vitrine publique",
      "Mode hors-ligne (PWA)",
      "Export CSV",
      "Support par email",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    price: 59,
    icon: Crown,
    color: "from-violet-500 to-purple-600",
    popular: true,
    description: "Tout pour fidéliser et faire revenir vos clients.",
    features: [
      "Tout Starter +",
      "Clients illimités",
      "Notifications push ciblées",
      "Campagnes marketing",
      "Automations (relance, anniversaire, win-back)",
      "Analytics avancés (tendances, conversion)",
      "Scoring client (Bronze/Silver/Gold)",
      "Gamification (streaks, niveaux)",
      "Notifications de proximité (géofencing)",
      "Avis clients & Google Reviews",
      "Webhooks API",
      "Widget d'inscription intégrable",
      "Support prioritaire",
    ],
  },
  {
    key: "franchise",
    name: "Franchise",
    price: 149,
    icon: Building2,
    color: "from-emerald-500 to-teal-600",
    description: "Pour les enseignes multi-sites. Un programme, plusieurs points de vente.",
    features: [
      "Tout Pro +",
      "Jusqu'à 5 établissements inclus",
      "Dashboard master multi-sites",
      "Comparaison entre points de vente",
      "Managers dédiés par établissement",
      "Carte fidélité unifiée (1 carte = tous les sites)",
      "+29€/établissement supplémentaire",
      "Support dédié",
    ],
  },
];

const comparison = [
  { feature: "Scanner QR code", starter: true, pro: true, franchise: true },
  { feature: "Cartes de fidélité digitales", starter: true, pro: true, franchise: true },
  { feature: "Apple Wallet & Google Wallet", starter: true, pro: true, franchise: true },
  { feature: "Personnalisation carte", starter: true, pro: true, franchise: true },
  { feature: "Vitrine publique", starter: true, pro: true, franchise: true },
  { feature: "Mode hors-ligne (PWA)", starter: true, pro: true, franchise: true },
  { feature: "Export CSV", starter: true, pro: true, franchise: true },
  { feature: "Clients", starter: "200 max", pro: "Illimités", franchise: "Illimités" },
  { feature: "Notifications push", starter: false, pro: true, franchise: true },
  { feature: "Campagnes marketing", starter: false, pro: true, franchise: true },
  { feature: "Automations", starter: false, pro: true, franchise: true },
  { feature: "Analytics avancés", starter: false, pro: true, franchise: true },
  { feature: "Scoring client", starter: false, pro: true, franchise: true },
  { feature: "Gamification", starter: false, pro: true, franchise: true },
  { feature: "Avis clients", starter: false, pro: true, franchise: true },
  { feature: "Google Reviews", starter: false, pro: true, franchise: true },
  { feature: "Notifications de proximité", starter: false, pro: true, franchise: true },
  { feature: "Webhooks API", starter: false, pro: true, franchise: true },
  { feature: "Multi-établissements", starter: false, pro: false, franchise: "5 inclus" },
  { feature: "Dashboard master", starter: false, pro: false, franchise: true },
  { feature: "Comparaison sites", starter: false, pro: false, franchise: true },
  { feature: "Managers par site", starter: false, pro: false, franchise: true },
  { feature: "Carte unifiée", starter: false, pro: false, franchise: true },
  { feature: "Support", starter: "Email", pro: "Prioritaire", franchise: "Dédié" },
];

const faqs = [
  {
    q: "Puis-je changer de plan à tout moment ?",
    a: "Oui, vous pouvez upgrader ou downgrader votre plan à tout moment depuis votre dashboard. La facturation est ajustée au prorata.",
  },
  {
    q: "Y a-t-il un engagement minimum ?",
    a: "Non. Tous nos plans sont facturés mensuellement. Vous pouvez annuler à tout moment depuis votre espace abonnement.",
  },
  {
    q: "Les cartes Apple Wallet fonctionnent-elles sur tous les iPhone ?",
    a: "Oui, les cartes Apple Wallet fonctionnent sur tous les iPhone sous iOS 6 et supérieur.",
  },
  {
    q: "Mes données clients sont-elles sécurisées ?",
    a: "Oui. Toutes les données sont hébergées en Europe, conformes au RGPD. Vos clients peuvent demander la suppression de leurs données.",
  },
  {
    q: "Y a-t-il des frais sur les transactions ?",
    a: "Non. FidéliPro est un abonnement mensuel fixe. Aucun frais caché ni commission sur vos ventes.",
  },
  {
    q: "Puis-je essayer avant de m'abonner ?",
    a: "Contactez-nous pour une démo personnalisée. Nous serons ravis de vous présenter FidéliPro en détail.",
  },
];

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="w-4 h-4 text-emerald-500 mx-auto" />;
  if (value === false) return <X className="w-4 h-4 text-muted-foreground/30 mx-auto" />;
  return <span className="text-sm font-medium text-foreground">{value}</span>;
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border/50 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-secondary/40 transition-colors"
      >
        <span className="font-medium text-sm">{q}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
        </motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5">
              <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const Tarifs = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 pb-16 text-center px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">Tarifs transparents</Badge>
          <h1 className="text-4xl sm:text-5xl font-display font-extrabold tracking-tight mb-4">
            Un plan pour chaque commerçant
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Facturation mensuelle, sans frais cachés. Changez de plan à tout moment.
          </p>
        </motion.div>
      </section>

      {/* Plan cards */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, i) => {
            const Icon = plan.icon;
            return (
              <motion.div
                key={plan.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={`relative rounded-3xl border p-6 flex flex-col ${
                  plan.popular
                    ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                    : "border-border/50 bg-card"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground shadow-sm px-3">Populaire</Badge>
                  </div>
                )}
                <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${plan.color} flex items-center justify-center mb-4`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-display font-bold">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">{plan.description}</p>
                <div className="mb-6">
                  <span className="text-4xl font-display font-extrabold">{plan.price}€</span>
                  <span className="text-muted-foreground text-sm">/mois</span>
                </div>
                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-sm">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className={`w-full rounded-xl gap-1.5 ${plan.popular ? "bg-gradient-primary text-primary-foreground" : ""}`}
                  variant={plan.popular ? "default" : "outline"}
                >
                  <Link to={`/register?plan=${plan.key}`}>
                    Commencer <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Comparison table */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <motion.h2
          className="text-2xl font-display font-bold text-center mb-8"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          Comparatif détaillé
        </motion.h2>
        <motion.div
          className="rounded-2xl border border-border/50 overflow-hidden bg-card"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-left p-4 font-semibold">Fonctionnalité</th>
                {plans.map(p => (
                  <th key={p.key} className={`p-4 text-center font-semibold ${p.popular ? "text-primary" : ""}`}>
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.map((row, i) => (
                <motion.tr
                  key={row.feature}
                  className={`border-b border-border/40 ${i % 2 === 0 ? "" : "bg-muted/20"}`}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.03 }}
                >
                  <td className="p-4 text-muted-foreground">{row.feature}</td>
                  <td className="p-4 text-center"><Cell value={row.starter} /></td>
                  <td className={`p-4 text-center ${plans[1].popular ? "bg-primary/5" : ""}`}><Cell value={row.pro} /></td>
                  <td className="p-4 text-center"><Cell value={(row as any).franchise} /></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </section>

      {/* FAQ */}
      <section className="max-w-2xl mx-auto px-4 pb-24">
        <motion.h2
          className="text-2xl font-display font-bold text-center mb-8"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          Questions fréquentes
        </motion.h2>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={faq.q}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <FaqItem {...faq} />
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <motion.section
        className="bg-gradient-card py-16 text-center px-4 mb-0"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        <motion.h2
          className="text-3xl font-display font-bold text-primary-foreground mb-3"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          Prêt à fidéliser vos clients ?
        </motion.h2>
        <p className="text-primary-foreground/70 mb-6">Commencez dès aujourd'hui et fidélisez vos clients.</p>
        <Button asChild size="lg" className="bg-white text-primary font-bold rounded-xl gap-2 hover:bg-white/90">
          <Link to="/register">Créer mon compte <ArrowRight className="w-4 h-4" /></Link>
        </Button>
      </motion.section>

      <Footer />
    </div>
  );
};

export default Tarifs;
