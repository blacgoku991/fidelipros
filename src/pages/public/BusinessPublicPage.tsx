import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppleWalletPass } from "@/components/AppleWalletPass";
import { buildCardConfig, buildCustomerData, buildApplePassFields, getLoyaltyLabels } from "@/lib/cardConfig";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Phone, Globe, Star, Sparkles, CreditCard, AlertCircle, RefreshCw, Download, Share, X } from "lucide-react";
import { toast } from "sonner";
import addToWalletBadge from "@/assets/add-to-apple-wallet-fr.png";

type Step = "landing" | "register" | "card";

// ── Validation helpers ──
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PHONE_RE = /^(\+?\d{1,4}[\s.-]?)?(\(?\d{1,4}\)?[\s.-]?)?[\d\s.-]{4,14}$/;
const DISPOSABLE_DOMAINS = ["yopmail.com","mailinator.com","guerrillamail.com","tempmail.com","throwaway.email","fakeinbox.com","sharklasers.com","guerrillamailblock.com","grr.la","dispostable.com","maildrop.cc","10minutemail.com"];

function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return DISPOSABLE_DOMAINS.includes(domain);
}

function isValidName(name: string): boolean {
  // At least 2 chars, contains at least one letter, no pure numbers/symbols
  return name.trim().length >= 2 && /[a-zA-ZÀ-ÿ]/.test(name);
}

const BusinessPublicPage = () => {
  const { businessId } = useParams();
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("landing");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthday, setBirthday] = useState("");
  const [customer, setCustomer] = useState<any>(null);
  const [card, setCard] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [googleWalletLoading, setGoogleWalletLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isAppleDevice = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone;

  const handleAddToWallet = (cardCode: string) => {
    setWalletLoading(true);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    window.location.href = `${supabaseUrl}/functions/v1/generate-pass?card_code=${encodeURIComponent(cardCode)}`;
  };

  const [googleAvailable, setGoogleAvailable] = useState(true);

  const handleAddToGoogleWallet = async (cardCode: string) => {
    setGoogleWalletLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(
        `${supabaseUrl}/functions/v1/generate-google-pass?card_code=${encodeURIComponent(cardCode)}`
      );
      const data = await res.json();
      if (data.saveUrl) {
        window.open(data.saveUrl, "_blank");
      } else if (data.unavailable) {
        setGoogleAvailable(false);
        toast.info("Google Wallet n'est pas encore disponible pour ce commerce.");
      } else {
        toast.error("Impossible de générer la carte Google Wallet");
      }
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setGoogleWalletLoading(false);
    }
  };

  const fetchBusiness = async () => {
    setLoading(true);
    setFetchError(null);

    if (!businessId) {
      setFetchError("Aucun identifiant de commerce dans l'URL.");
      setLoading(false);
      return;
    }

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(
        `${supabaseUrl}/rest/v1/businesses?id=eq.${encodeURIComponent(businessId)}&select=id,name,description,primary_color,secondary_color,accent_color,card_style,card_bg_type,card_bg_image_url,max_points_per_card,reward_description,address,city,phone,website,category,logo_url,loyalty_type,points_per_visit,show_customer_name,show_qr_code,show_points,show_expiration,show_rewards_preview,promo_text,birthday_notif_enabled`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        }
      );

      if (!response.ok) {
        setFetchError(`Erreur serveur (${response.status}). Réessayez.`);
        setLoading(false);
        return;
      }

      const data = await response.json();
      if (data && data.length > 0) {
        setBusiness(data[0]);
      } else {
        setFetchError("Ce commerce n'existe pas ou le lien est invalide.");
      }
    } catch (err: any) {
      setFetchError("Erreur de connexion. Vérifiez votre réseau.");
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchBusiness();
  }, [businessId]);

  useEffect(() => {
    if (!card?.card_code) return;
    localStorage.setItem("customer_last_card_path", `/card/${card.card_code}`);
    document.cookie = `customer_last_card_code=${encodeURIComponent(card.card_code)}; path=/; max-age=31536000; SameSite=Lax`;
  }, [card?.card_code]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!isValidName(name)) {
      errs.name = "Entrez votre vrai nom (prénom et nom)";
    }

    if (!email.trim() && !phone.trim()) {
      errs.email = "Email ou téléphone requis";
      errs.phone = "Email ou téléphone requis";
    }

    if (email.trim()) {
      if (!EMAIL_RE.test(email.trim())) {
        errs.email = "Adresse email invalide (ex: jean@gmail.com)";
      } else if (isDisposableEmail(email.trim())) {
        errs.email = "Les adresses email temporaires ne sont pas acceptées";
      }
    }

    if (phone.trim()) {
      if (!PHONE_RE.test(phone.trim())) {
        errs.phone = "Numéro de téléphone invalide (ex: 06 12 34 56 78)";
      } else if (phone.replace(/\D/g, "").length < 8) {
        errs.phone = "Numéro trop court";
      }
    }

    if (birthday) {
      const d = new Date(birthday);
      const now = new Date();
      const age = (now.getTime() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (isNaN(d.getTime())) {
        errs.birthday = "Date invalide";
      } else if (age < 13) {
        errs.birthday = "Vous devez avoir au moins 13 ans";
      } else if (age > 120) {
        errs.birthday = "Date invalide";
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    if (!business) return;
    setSubmitting(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const headers = {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      };

      // Check if customer already exists
      let existingCustomer = null;
      if (email.trim()) {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/customers?business_id=eq.${business.id}&email=eq.${encodeURIComponent(email.trim())}&select=*,customer_cards(*)`,
          { headers }
        );
        if (res.ok) {
          const data = await res.json();
          if (data?.length > 0) existingCustomer = data[0];
        }
      }
      if (!existingCustomer && phone.trim()) {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/customers?business_id=eq.${business.id}&phone=eq.${encodeURIComponent(phone.trim())}&select=*,customer_cards(*)`,
          { headers }
        );
        if (res.ok) {
          const data = await res.json();
          if (data?.length > 0) existingCustomer = data[0];
        }
      }

      if (existingCustomer) {
        setCustomer(existingCustomer);
        const existingCard = existingCustomer.customer_cards?.[0];
        if (existingCard) setCard(existingCard);
        setStep("card");
        setSubmitting(false);
        toast.success("Bon retour parmi nous ! 🎉");
        return;
      }

      const customerId = crypto.randomUUID();

      const custRes = await fetch(`${supabaseUrl}/rest/v1/customers`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({
          id: customerId,
          business_id: business.id,
          full_name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          birthday: birthday || null,
        }),
      });

      if (!custRes.ok) {
        toast.error("Erreur lors de l'inscription. Réessayez.");
        setSubmitting(false);
        return;
      }

      const newCustomer = {
        id: customerId,
        full_name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        birthday: birthday || null,
      };

      const cardRes = await fetch(`${supabaseUrl}/rest/v1/customer_cards`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({
          customer_id: customerId,
          business_id: business.id,
          max_points: business.max_points_per_card || 10,
        }),
      });

      if (!cardRes.ok) {
        toast.error("Erreur lors de la création de la carte. Réessayez.");
        setSubmitting(false);
        return;
      }

      const newCards = await cardRes.json();
      const newCard = newCards?.[0];

      setCustomer(newCustomer);
      setCard(newCard);
      setStep("card");
      toast.success("Bienvenue ! Votre carte de fidélité est prête 🎉");
    } catch {
      toast.error("Erreur lors de l'inscription. Vérifiez votre connexion.");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (fetchError || !business) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-display font-bold">Commerce introuvable</h1>
          <p className="text-muted-foreground text-sm">{fetchError || "Ce lien n'est pas valide."}</p>
          <Button onClick={fetchBusiness} variant="outline" className="gap-2 rounded-xl">
            <RefreshCw className="w-4 h-4" /> Réessayer
          </Button>
        </div>
      </div>
    );
  }

  const showBirthday = business.birthday_notif_enabled;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{
        background: `linear-gradient(135deg, ${business.primary_color}15 0%, ${business.secondary_color}15 100%)`,
      }}
    >
      <AnimatePresence mode="wait">
        {step === "landing" && (
          <motion.div
            key="landing"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="w-full max-w-md text-center space-y-6"
          >
            {business.logo_url ? (
              <img src={business.logo_url} alt={business.name} className="w-20 h-20 rounded-2xl mx-auto object-cover" />
            ) : (
              <div
                className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center text-white font-display font-bold text-2xl"
                style={{ background: `linear-gradient(135deg, ${business.primary_color}, ${business.secondary_color})` }}
              >
                {business.name.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-3xl font-display font-bold">{business.name}</h1>
              {business.description && <p className="text-muted-foreground mt-2">{business.description}</p>}
            </div>
            <div className="flex flex-wrap justify-center gap-3 text-sm text-muted-foreground">
              {business.city && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{business.city}</span>}
              {business.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{business.phone}</span>}
              {business.website && <span className="flex items-center gap-1"><Globe className="w-3.5 h-3.5" />{business.website}</span>}
            </div>

            <div className="p-6 rounded-2xl bg-card border border-border/50 text-left space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Star className="w-4 h-4 text-accent" />
                <span>
                  {business.loyalty_type === "stamps" ? "Gagnez des tampons à chaque visite"
                    : business.loyalty_type === "cashback" ? "Cumulez du cashback sur vos achats"
                    : "Gagnez des points à chaque visite"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CreditCard className="w-4 h-4 text-primary" />
                <span>Carte de fidélité digitale</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-accent" />
                <span>{business.reward_description || "Récompense offerte !"}</span>
              </div>
            </div>

            <Button
              onClick={() => setStep("register")}
              className="w-full h-14 text-lg rounded-2xl text-white font-semibold"
              style={{ background: `linear-gradient(135deg, ${business.primary_color}, ${business.secondary_color})` }}
            >
              Obtenir ma carte de fidélité
            </Button>
          </motion.div>
        )}

        {step === "register" && (
          <motion.div
            key="register"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="w-full max-w-md space-y-6"
          >
            <div className="text-center">
              <h2 className="text-2xl font-display font-bold">Inscrivez-vous</h2>
              <p className="text-muted-foreground text-sm mt-1">Quelques infos pour créer votre carte</p>
            </div>
            <div className="p-6 rounded-2xl bg-card border border-border/50 space-y-4">
              {/* Nom */}
              <div className="space-y-1.5">
                <Label>Prénom et Nom <span className="text-destructive">*</span></Label>
                <Input
                  value={name}
                  onChange={(e) => { setName(e.target.value); setErrors(prev => ({ ...prev, name: "" })); }}
                  placeholder="Jean Dupont"
                  className={`rounded-xl h-12 ${errors.name ? "border-destructive" : ""}`}
                  autoComplete="name"
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label>Adresse email <span className="text-destructive">*</span></Label>
                <Input
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors(prev => ({ ...prev, email: "" })); }}
                  placeholder="jean.dupont@gmail.com"
                  className={`rounded-xl h-12 ${errors.email ? "border-destructive" : ""}`}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                {!errors.email && <p className="text-[10px] text-muted-foreground">Pour recevoir vos offres exclusives</p>}
              </div>

              {/* Téléphone */}
              <div className="space-y-1.5">
                <Label>Téléphone</Label>
                <Input
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setErrors(prev => ({ ...prev, phone: "" })); }}
                  placeholder="06 12 34 56 78"
                  className={`rounded-xl h-12 ${errors.phone ? "border-destructive" : ""}`}
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
              </div>

              {/* Anniversaire */}
              {showBirthday && (
                <div className="space-y-1.5">
                  <Label>Date d'anniversaire 🎂</Label>
                  <Input
                    value={birthday}
                    onChange={(e) => { setBirthday(e.target.value); setErrors(prev => ({ ...prev, birthday: "" })); }}
                    className={`rounded-xl h-12 ${errors.birthday ? "border-destructive" : ""}`}
                    type="date"
                    max={new Date().toISOString().split("T")[0]}
                  />
                  {errors.birthday && <p className="text-xs text-destructive">{errors.birthday}</p>}
                  {!errors.birthday && <p className="text-[10px] text-muted-foreground">Pour recevoir un cadeau le jour J !</p>}
                </div>
              )}

              <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                En créant votre carte, vous acceptez que vos données soient traitées par {business.name} via FidéliPro pour la gestion de votre programme de fidélité.{" "}
                <a href="/privacy" target="_blank" rel="noopener" className="underline hover:text-foreground">Politique de confidentialité</a>
              </p>
              <Button
                onClick={handleRegister}
                disabled={submitting}
                className="w-full h-14 text-lg rounded-2xl text-white font-semibold"
                style={{ background: `linear-gradient(135deg, ${business.primary_color}, ${business.secondary_color})` }}
              >
                {submitting ? "Création..." : "Créer ma carte 🎉"}
              </Button>
              <button onClick={() => setStep("landing")} className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors">
                ← Retour
              </button>
            </div>
          </motion.div>
        )}

        {step === "card" && customer && card && (
          <motion.div
            key="card"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md space-y-6 text-center"
          >
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }} className="text-5xl">
              🎉
            </motion.div>
            <h2 className="text-2xl font-display font-bold">Votre carte est prête !</h2>

            <AppleWalletPass
              backgroundColor={business.primary_color || "#6B46C1"}
              logoUrl={business.logo_url || undefined}
              logoText={business.name}
              {...(() => {
                const config = buildCardConfig(business);
                const cData = buildCustomerData(card, customer);
                const fields = buildApplePassFields(config, cData);
                return {
                  headerFields: fields.headerFields,
                  primaryFields: fields.primaryFields,
                  secondaryFields: fields.secondaryFields,
                  auxiliaryFields: fields.auxiliaryFields,
                  barcodeValue: config.showQrCode ? cData.cardCode : undefined,
                  footerText: cData.cardCode.slice(0, 12),
                };
              })()}
              width={320}
            />

            {/* Apple Wallet */}
            {isAppleDevice && card.card_code && (
              <button onClick={() => handleAddToWallet(card.card_code)} disabled={walletLoading} className="w-full flex justify-center">
                <img src={addToWalletBadge} alt="Ajouter à Apple Cartes" className="h-14 hover:opacity-80 transition-opacity" style={{ filter: walletLoading ? "grayscale(1) opacity(0.5)" : "none" }} />
              </button>
            )}

            {/* Google Wallet */}
            {!isAppleDevice && googleAvailable && card.card_code && (
              <button onClick={() => handleAddToGoogleWallet(card.card_code)} disabled={googleWalletLoading} className="w-full flex justify-center">
                <div className="h-14 px-6 rounded-lg flex items-center gap-3 hover:opacity-80 transition-opacity" style={{ backgroundColor: "#1f1f1f", filter: googleWalletLoading ? "grayscale(1) opacity(0.5)" : "none" }}>
                  <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none">
                    <path d="M21.4 11.3l-1-1.6-2.1 1.2.1-2.4h-1.9l.1 2.4-2.1-1.2-1 1.6 2.1 1.2-2.1 1.2 1 1.6 2.1-1.2-.1 2.4h1.9l-.1-2.4 2.1 1.2 1-1.6-2.1-1.2 2.1-1.2z" fill="#FBBC04"/>
                    <path d="M7.5 20C4.5 20 2 17.5 2 14.5S4.5 9 7.5 9c1.7 0 3 .6 4 1.7l-1.6 1.5c-.6-.6-1.4-.9-2.4-.9-2 0-3.6 1.6-3.6 3.6s1.6 3.6 3.6 3.6c1.5 0 2.3-.6 2.8-1.1.4-.4.7-1 .8-1.8H7.5v-2.1h5.8c.1.3.1.7.1 1.1 0 1.3-.4 3-1.5 4.1-1.1 1.2-2.5 1.8-4.4 1.8z" fill="#4285F4"/>
                  </svg>
                  <div className="text-left">
                    <p className="text-[10px] text-gray-400 leading-none">Ajouter à</p>
                    <p className="text-white font-medium text-base leading-tight">Google Wallet</p>
                  </div>
                </div>
              </button>
            )}

            <p className="text-center text-xs text-muted-foreground">
              Code : <span className="font-mono">{card.card_code}</span>
            </p>
            <p className="text-center text-xs text-muted-foreground">
              Propulsé par <span className="font-semibold text-primary">FidéliPro</span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BusinessPublicPage;