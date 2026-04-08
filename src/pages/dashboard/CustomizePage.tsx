import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AppleWalletPass } from "@/components/AppleWalletPass";
import { IPhoneMockup } from "@/components/IPhoneMockup";
import { SamsungMockup } from "@/components/SamsungMockup";
import { LogoUpload } from "@/components/dashboard/LogoUpload";
import { TemplatePicker } from "@/components/dashboard/TemplatePicker";
import { FeatureToggles } from "@/components/dashboard/FeatureToggles";
import { defaultConfig, type BusinessConfig, type BusinessTemplate } from "@/lib/businessTemplates";
import { buildCardConfig, buildDemoCustomer, buildApplePassFields } from "@/lib/cardConfig";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { QRCodeSVG } from "qrcode.react";
import {
  Save, Palette, CreditCard, Zap, Eye, Gift, Layout, Download, Copy, Printer, ExternalLink,
  Link as LinkIcon, Shield, X, ImageIcon, ArrowRight, Info, Calculator,
  Store, Sparkles, SlidersHorizontal, QrCode, Layers, ChevronRight, Check,
  Star, TrendingUp, Clock, Bell, Target, Crown, Coins, Stamp, Users,
} from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";

/* ═══════════════════════════ CONSTANTS ═══════════════════════════ */

const cardStyles = [
  { value: "classic", label: "Classique", emoji: "🎨" },
  { value: "luxury", label: "Luxe", emoji: "✨" },
  { value: "coffee", label: "Coffee", emoji: "☕" },
  { value: "barber", label: "Barbier", emoji: "💈" },
  { value: "restaurant", label: "Resto", emoji: "🍽️" },
  { value: "neon", label: "Néon", emoji: "💡" },
];

const presetThemes = [
  { label: "Charbon", primary: "#1a1a2e", secondary: "#e94560", fg: "#ffffff", lbl: "#aaaaaa" },
  { label: "Or Noir", primary: "#92400e", secondary: "#F59E0B", fg: "#ffffff", lbl: "#fde68a" },
  { label: "Lavande", primary: "#7c3aed", secondary: "#f9a8d4", fg: "#ffffff", lbl: "#ddd6fe" },
  { label: "Émeraude", primary: "#059669", secondary: "#3b82f6", fg: "#ffffff", lbl: "#a7f3d0" },
  { label: "Océan", primary: "#0e4a6e", secondary: "#38bdf8", fg: "#ffffff", lbl: "#bae6fd" },
  { label: "Cerise", primary: "#9f1239", secondary: "#fda4af", fg: "#ffffff", lbl: "#fecdd3" },
];

const categories = [
  { value: "general", label: "Général" },
  { value: "boucherie", label: "Boucherie" },
  { value: "boulangerie", label: "Boulangerie" },
  { value: "restaurant", label: "Restaurant" },
  { value: "cafe", label: "Café" },
  { value: "coiffeur", label: "Coiffeur" },
  { value: "barbier", label: "Barbier" },
  { value: "fleuriste", label: "Fleuriste" },
];

type SectionId = "identity" | "program" | "design" | "fields" | "engagement" | "tools";

const sections: { id: SectionId; icon: typeof Store; label: string }[] = [
  { id: "identity", icon: Store, label: "Identité" },
  { id: "program", icon: Zap, label: "Programme" },
  { id: "design", icon: Palette, label: "Design" },
  { id: "fields", icon: Eye, label: "Affichage" },
  { id: "engagement", icon: Bell, label: "Engagement" },
  { id: "tools", icon: Layers, label: "Outils" },
];

/* ═══════════════════════════ HELPERS ═══════════════════════════ */

function buildPassFields(form: any) {
  const pseudoBusiness = {
    id: "preview", name: form.name, logo_url: null, card_bg_image_url: null,
    loyalty_type: form.loyalty_type, max_points_per_card: form.max_points_per_card,
    points_per_visit: form.points_per_visit, points_per_euro: form.points_per_euro,
    reward_description: form.reward_description, primary_color: form.primary_color,
    foreground_color: form.foreground_color, label_color: form.label_color,
    show_customer_name: form.show_customer_name, show_qr_code: form.show_qr_code,
    show_points: form.show_points, show_expiration: form.show_expiration,
    show_rewards_preview: form.show_rewards_preview, card_style: form.card_style,
    card_bg_type: form.card_bg_type,
  };
  const config = buildCardConfig(pseudoBusiness);
  const demoCustomer = buildDemoCustomer(config);
  return buildApplePassFields(config, demoCustomer);
}

/* ═══════════════════════════ SUB-COMPONENTS ═══════════════════════════ */

function Panel({ title, subtitle, icon: Icon, children, action }: {
  title: string; subtitle?: string; icon: typeof Store; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm"
    >
      <div className="px-5 pt-5 pb-2 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center border border-primary/10">
            <Icon className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-[15px] leading-tight">{title}</h3>
            {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="px-5 pb-5 pt-3 space-y-5">{children}</div>
    </motion.div>
  );
}

function Divider({ label }: { label?: string }) {
  if (!label) return <div className="border-t border-border/40" />;
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-border/40" />
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="h-px flex-1 bg-border/40" />
    </div>
  );
}

function OptionCard({ selected, onClick, icon, emoji, title, desc, badge }: {
  selected: boolean; onClick: () => void; icon?: typeof Store; emoji?: string;
  title: string; desc?: string; badge?: string;
}) {
  const Icon = icon;
  return (
    <button onClick={onClick} className={`relative p-3.5 rounded-xl border-2 text-left transition-all group w-full ${
      selected ? "border-primary bg-primary/5 shadow-sm shadow-primary/10" : "border-border/40 hover:border-primary/25 hover:bg-accent/20"
    }`}>
      {selected && (
        <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-sm">
          <Check className="w-3 h-3 text-primary-foreground" />
        </div>
      )}
      <div className="flex items-center gap-2.5">
        {emoji && <span className="text-xl">{emoji}</span>}
        {Icon && <Icon className="w-5 h-5 text-primary" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs">{title}</span>
            {badge && <Badge variant="secondary" className="text-[8px] h-4 px-1.5">{badge}</Badge>}
          </div>
          {desc && <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>}
        </div>
      </div>
    </button>
  );
}

function SmartSlider({ label, value, onChange, min, max, step = 1, suffix, pluralSuffix, prefix, hint, icon: Icon, accentColor }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step?: number;
  suffix: string; pluralSuffix?: string; prefix?: string; hint?: string;
  icon?: typeof Star; accentColor?: string;
}) {
  const displayVal = `${prefix ? prefix + " " : ""}${value} ${value > 1 && pluralSuffix ? pluralSuffix : suffix}`;
  const pct = Math.round(((value - min) / (max - min)) * 100);
  return (
    <div className="rounded-xl bg-accent/20 border border-border/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-3.5 h-3.5 text-primary" />}
          <Label className="text-xs font-semibold">{label}</Label>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">{pct}%</span>
          <Badge className="text-[10px] tabular-nums font-bold h-5.5 px-2.5 bg-primary/10 text-primary border-primary/20 hover:bg-primary/15">{displayVal}</Badge>
        </div>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} />
      <div className="flex justify-between text-[9px] text-muted-foreground font-medium">
        <span>{min}</span>
        <span>{max} {pluralSuffix || suffix}</span>
      </div>
      {hint && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-background/60 rounded-lg px-2.5 py-1.5 border border-border/20">
          <Info className="w-3 h-3 shrink-0 text-primary/60" />
          <span>{hint}</span>
        </div>
      )}
    </div>
  );
}

function ToggleRow({ emoji, label, desc, checked, onChange }: {
  emoji: string; label: string; desc: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3.5 group">
      <div className="flex items-center gap-3">
        <span className="text-lg w-7 text-center">{emoji}</span>
        <div>
          <p className="text-[13px] font-medium leading-tight">{label}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SimulationBox({ pointsPerEuro, label }: { pointsPerEuro: number; label?: string }) {
  const amounts = [5, 10, 25, 50, 100];
  return (
    <div className="rounded-xl overflow-hidden border border-border/30">
      <div className="bg-primary/5 px-4 py-2.5 flex items-center gap-2 border-b border-border/20">
        <Calculator className="w-3.5 h-3.5 text-primary" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-primary">{label || "Simulateur"}</span>
      </div>
      <div className="p-3 space-y-0">
        {amounts.map((a, i) => (
          <div key={a} className={`flex items-center justify-between py-2 ${i < amounts.length - 1 ? "border-b border-border/15" : ""}`}>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium w-12 text-right tabular-nums">{a} €</span>
              <ArrowRight className="w-3 h-3 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] font-bold tabular-nums">{a * pointsPerEuro}</span>
              <span className="text-[10px] text-muted-foreground">pts</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════ MAIN COMPONENT ═══════════════════════════ */

const CustomizePage = () => {
  const { user, business, refreshBusiness } = useAuth();
  const [activeSection, setActiveSection] = useState<SectionId>("identity");
  const [form, setForm] = useState<BusinessConfig & { name: string; description: string; address: string; city: string; phone: string; website: string; latitude: number | null; longitude: number | null; geofence_message: string; foreground_color: string; label_color: string }>(
    { ...defaultConfig, name: "", description: "", address: "", city: "", phone: "", website: "", latitude: null, longitude: null, geofence_message: "Passez nous voir, on vous attend ! 🎉", foreground_color: "", label_color: "" }
  );
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [stripImageUrl, setStripImageUrl] = useState<string | null>(null);
  const stripFileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"iphone" | "samsung">("iphone");

  useEffect(() => {
    if (!business) return;
    setForm({
      name: business.name || "",
      description: business.description || "",
      address: business.address || "",
      city: business.city || "",
      phone: business.phone || "",
      website: business.website || "",
      loyalty_type: (business.loyalty_type || "points") as BusinessConfig["loyalty_type"],
      max_points_per_card: business.max_points_per_card || 10,
      points_per_visit: business.points_per_visit || 1,
      points_per_euro: business.points_per_euro || 0,
      reward_description: business.reward_description || "Récompense offerte !",
      reward_next_visit_only: (business as any).reward_next_visit_only ?? false,
      reward_min_purchase: (business as any).reward_min_purchase ?? 0,
      primary_color: business.primary_color || "#6B46C1",
      secondary_color: business.secondary_color || "#F6AD55",
      card_style: business.card_style || "classic",
      card_bg_type: (business.card_bg_type || "gradient") as BusinessConfig["card_bg_type"],
      show_customer_name: business.show_customer_name ?? true,
      show_qr_code: business.show_qr_code ?? true,
      show_points: business.show_points ?? true,
      show_expiration: business.show_expiration ?? false,
      show_rewards_preview: business.show_rewards_preview ?? true,
      notif_frequency: (business.notif_frequency || "daily") as BusinessConfig["notif_frequency"],
      notif_time_start: business.notif_time_start || "09:00",
      notif_time_end: business.notif_time_end || "20:00",
      notif_custom_interval_hours: business.notif_custom_interval_hours || 24,
      auto_notifications: business.auto_notifications ?? false,
      auto_reminder_enabled: business.auto_reminder_enabled ?? false,
      auto_reminder_days: business.auto_reminder_days || 7,
      reward_alert_threshold: business.reward_alert_threshold || 2,
      geofence_enabled: business.geofence_enabled ?? false,
      geofence_radius: business.geofence_radius || 200,
      onboarding_mode: (business.onboarding_mode || "instant") as BusinessConfig["onboarding_mode"],
      feature_gamification: business.feature_gamification ?? true,
      feature_notifications: business.feature_notifications ?? true,
      feature_wallet: business.feature_wallet ?? false,
      feature_analytics: business.feature_analytics ?? true,
      category: business.category || "general",
      business_template: business.business_template || "custom",
      latitude: business.latitude || null,
      longitude: business.longitude || null,
      geofence_message: business.geofence_message || "Passez nous voir, on vous attend ! 🎉",
      foreground_color: business.foreground_color || "",
      label_color: business.label_color || "",
    });
    setLogoUrl(business.logo_url || null);
    setStripImageUrl(business.card_bg_image_url || null);
  }, [business]);

  const handleSave = async () => {
    if (!business) { toast.error("Commerce non chargé"); return; }
    setSaving(true);
    const { name, description, address, city, phone, website, latitude, longitude, geofence_message, foreground_color, label_color, ...config } = form;
    const { error } = await supabase.from("businesses").update({
      name, description, address, city, phone, website, latitude, longitude, geofence_message,
      foreground_color: foreground_color || null,
      label_color: label_color || null,
      ...config,
    } as any).eq("id", business.id);
    if (error) { toast.error("Erreur : " + error.message); }
    else { toast.success("Modifications sauvegardées ✓"); await refreshBusiness(); }
    setSaving(false);
  };

  const handleTemplateSelect = (template: BusinessTemplate) => {
    setForm(prev => ({ ...prev, ...template.config }));
    toast.success(`Template "${template.label}" appliqué !`);
  };

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const appBase = import.meta.env.VITE_APP_URL || window.location.origin;
  const publicUrl = `${appBase}/b/${business?.id}`;
  const copyLink = () => { navigator.clipboard.writeText(publicUrl); toast.success("Lien copié !"); };
  const downloadQR = () => {
    const svg = document.getElementById("business-qr-svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    canvas.width = 1024; canvas.height = 1024;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => { ctx?.drawImage(img, 0, 0, 1024, 1024); const a = document.createElement("a"); a.download = `qr-${business?.name || "fidelipro"}.png`; a.href = canvas.toDataURL("image/png"); a.click(); };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const { headerFields, primaryFields, secondaryFields, auxiliaryFields } = buildPassFields(form);
  const cardPreviewId = `preview-${user?.id?.slice(0, 8) || "demo"}`;
  const previewWidth = 240;

  const walletPassElement = (
    <AppleWalletPass
      backgroundColor={form.primary_color}
      foregroundColor={form.foreground_color || undefined}
      labelColor={form.label_color || undefined}
      logoUrl={logoUrl || undefined}
      logoText={form.name || "Mon Commerce"}
      stripImageUrl={stripImageUrl || undefined}
      loyaltyType={form.loyalty_type || "points"}
      currentStamps={7}
      maxStamps={form.max_points_per_card || 10}
      headerFields={headerFields}
      primaryFields={primaryFields}
      secondaryFields={secondaryFields}
      auxiliaryFields={auxiliaryFields}
      barcodeValue={form.show_qr_code ? cardPreviewId : undefined}
      footerText={cardPreviewId.slice(0, 12)}
      width={previewWidth}
    />
  );

  /* ═══════════════ SECTION: IDENTITÉ ═══════════════ */

  const renderIdentity = () => (
    <div className="space-y-4">
      <Panel title="Votre commerce" subtitle="Logo, bannière et informations" icon={Store}>
        {/* Logo & Banner */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs font-semibold">Logo</Label>
              {!logoUrl && <Badge variant="destructive" className="text-[8px] h-4 px-1.5 animate-pulse">Requis</Badge>}
            </div>
            {business && <LogoUpload currentUrl={logoUrl} businessId={business.id} onUploaded={setLogoUrl} />}
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Bannière</Label>
            {stripImageUrl ? (
              <div className="relative group">
                <img src={stripImageUrl} alt="Bannière" className="w-full h-20 rounded-xl object-cover border border-border/50" />
                <button
                  onClick={async () => {
                    setStripImageUrl(null);
                    if (business) {
                      await supabase.from("businesses").update({ card_bg_image_url: null }).eq("id", business.id);
                      toast.success("Bannière supprimée");
                    }
                  }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => stripFileRef.current?.click()}
                className="w-full h-20 rounded-xl border-2 border-dashed border-border/50 flex flex-col items-center justify-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all gap-1"
              >
                <ImageIcon className="w-5 h-5 text-muted-foreground/60" />
                <span className="text-[9px] text-muted-foreground">640×200px</span>
              </div>
            )}
            <input ref={stripFileRef} type="file" accept="image/*" className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !business) return;
                if (file.size > 2 * 1024 * 1024) { toast.error("Max 2 Mo"); return; }
                const ext = file.name.split(".").pop();
                const path = `${business.id}/strip.${ext}`;
                const { error } = await supabase.storage.from("business-logos").upload(path, file, { upsert: true });
                if (error) { toast.error("Erreur upload"); return; }
                const { data: { publicUrl: pUrl } } = supabase.storage.from("business-logos").getPublicUrl(path);
                const url = `${pUrl}?t=${Date.now()}`;
                setStripImageUrl(url);
                await supabase.from("businesses").update({ card_bg_image_url: url }).eq("id", business.id);
                toast.success("Bannière mise à jour !");
              }}
            />
          </div>
        </div>

        <Divider />

        {/* Name & Description */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Nom du commerce</Label>
          <Input value={form.name} onChange={(e) => update("name", e.target.value)} className="rounded-xl h-11 font-medium" placeholder="Mon Super Commerce" />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Description</Label>
          <Textarea value={form.description} onChange={(e) => update("description", e.target.value)} className="rounded-xl resize-none" rows={2} placeholder="Une phrase qui décrit votre commerce..." />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Catégorie</Label>
            <Select value={form.category} onValueChange={(v) => update("category", v)}>
              <SelectTrigger className="rounded-xl h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Téléphone</Label>
            <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} className="rounded-xl h-10" placeholder="01 23 45 67 89" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Adresse</Label>
            <Input value={form.address} onChange={(e) => update("address", e.target.value)} className="rounded-xl h-10" placeholder="12 rue..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Ville</Label>
            <Input value={form.city} onChange={(e) => update("city", e.target.value)} className="rounded-xl h-10" placeholder="Paris" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Site web</Label>
          <Input value={form.website} onChange={(e) => update("website", e.target.value)} className="rounded-xl h-10" placeholder="https://mon-commerce.fr" />
        </div>
      </Panel>
    </div>
  );

  /* ═══════════════ SECTION: PROGRAMME ═══════════════ */

  const renderProgram = () => {
    const isPoints = form.loyalty_type === "points";
    const isStamps = form.loyalty_type === "stamps";
    const isCashback = form.loyalty_type === "cashback";
    const isSub = form.loyalty_type as string === "subscription";
    const euroMode = isPoints && form.points_per_euro > 0;

    return (
      <div className="space-y-4">
        {/* Type Selector */}
        <Panel title="Type de programme" subtitle="Choisissez comment récompenser vos clients" icon={Zap}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <OptionCard
              selected={isPoints}
              onClick={() => update("loyalty_type", "points")}
              emoji="⭐"
              title="Points"
              desc="Cumul progressif de points à chaque achat"
            />
            <OptionCard
              selected={isStamps}
              onClick={() => update("loyalty_type", "stamps")}
              emoji="🎯"
              title="Tampons"
              desc="Carte à tamponner à chaque visite"
            />
            <OptionCard
              selected={isCashback}
              onClick={() => update("loyalty_type", "cashback")}
              emoji="💰"
              title="Cashback"
              desc="Cagnotte en euros sur les achats"
            />
            <OptionCard
              selected={isSub}
              onClick={() => update("loyalty_type", "subscription" as any)}
              emoji="👑"
              title="Abonnement"
              desc="Statut membre avec avantages"
            />
          </div>
        </Panel>

        {/* Configuration based on type */}
        {isPoints && (
          <Panel title="Configuration des points" subtitle="Réglez les paramètres de votre programme" icon={Star}>
            {/* Attribution mode */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold flex items-center gap-2">
                <Calculator className="w-3.5 h-3.5 text-primary" />
                Mode d'attribution des points
              </Label>
              <div className="grid grid-cols-2 gap-2.5">
                <OptionCard
                  selected={!euroMode}
                  onClick={() => update("points_per_euro", 0)}
                  emoji="🚶"
                  title="Par visite"
                  desc="Points fixes à chaque passage"
                />
                <OptionCard
                  selected={euroMode}
                  onClick={() => { if (!euroMode) update("points_per_euro", 1); }}
                  emoji="💶"
                  title="Par euro dépensé"
                  desc="Selon le montant d'achat"
                  badge="PRO"
                />
              </div>
            </div>

            <Divider />

            {/* Per-visit config */}
            {!euroMode && (
              <SmartSlider
                label="Points par visite"
                icon={TrendingUp}
                value={form.points_per_visit}
                onChange={(v) => update("points_per_visit", v)}
                min={1} max={20}
                suffix="pt" pluralSuffix="pts"
                hint={`Chaque scan = ${form.points_per_visit} point${form.points_per_visit > 1 ? "s" : ""}`}
              />
            )}

            {/* Per-euro config */}
            {euroMode && (
              <>
                <SmartSlider
                  label="Taux de conversion"
                  icon={Coins}
                  value={form.points_per_euro}
                  onChange={(v) => update("points_per_euro", v)}
                  min={1} max={20}
                  prefix="1€ ="
                  suffix="pt" pluralSuffix="pts"
                />
                <SimulationBox pointsPerEuro={form.points_per_euro} label="Combien gagne votre client ?" />
                <div className="flex items-start gap-2.5 text-[11px] text-muted-foreground bg-primary/5 rounded-xl p-3 border border-primary/10">
                  <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>Au moment du scan, le commerçant saisit le montant de l'achat. Les points sont calculés automatiquement selon le taux configuré.</span>
                </div>
              </>
            )}
          </Panel>
        )}

        {isStamps && (
          <Panel title="Configuration des tampons" subtitle="Réglez le nombre de tampons par visite" icon={Stamp}>
            <div className="flex items-start gap-2.5 text-[11px] text-muted-foreground bg-primary/5 rounded-xl p-3 border border-primary/10">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>Les récompenses et leurs seuils se configurent dans l'onglet <strong>Récompenses</strong> du menu.</span>
            </div>
          </Panel>
        )}

        {isCashback && (
          <Panel title="Configuration du cashback" subtitle="Taux de retour en points" icon={Coins}>
            <SmartSlider
              label="Taux de conversion"
              icon={TrendingUp}
              value={form.points_per_euro || 1}
              onChange={(v) => update("points_per_euro", v)}
              min={1} max={20}
              prefix="1€ ="
              suffix="pt" pluralSuffix="pts"
            />
            <SimulationBox pointsPerEuro={form.points_per_euro || 1} label="Gains par achat" />
            <div className="flex items-start gap-2.5 text-[11px] text-muted-foreground bg-primary/5 rounded-xl p-3 border border-primary/10">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>Les seuils de récompense se configurent dans l'onglet <strong>Récompenses</strong> du menu.</span>
            </div>
          </Panel>
        )}

        {/* Reward redemption conditions */}
        <Panel title="Conditions de récompense" subtitle="Protégez-vous des passages sans achat" icon={Shield}>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-accent/10 border border-border/20">
              <div className="flex-1">
                <p className="text-xs font-semibold">Récompense au prochain passage</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Le client doit revenir pour récupérer sa récompense</p>
              </div>
              <Switch
                checked={form.reward_next_visit_only}
                onCheckedChange={(v) => update("reward_next_visit_only", v)}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-accent/10 border border-border/20">
              <div className="flex-1">
                <p className="text-xs font-semibold">Minimum d'achat requis</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Montant minimum pour réclamer la récompense</p>
              </div>
              <Switch
                checked={form.reward_min_purchase > 0}
                onCheckedChange={(v) => update("reward_min_purchase", v ? 15 : 0)}
              />
            </div>

            {form.reward_min_purchase > 0 && (
              <div className="pl-3">
                <SmartSlider
                  label="Montant minimum"
                  icon={Coins}
                  value={form.reward_min_purchase}
                  onChange={(v) => update("reward_min_purchase", v)}
                  min={1} max={100}
                  suffix="€" pluralSuffix="€"
                  hint={`Le client devra acheter pour au moins ${form.reward_min_purchase}€`}
                />
              </div>
            )}

            <div className="flex items-start gap-2.5 text-[11px] text-muted-foreground bg-primary/5 rounded-xl p-3 border border-primary/10">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Exemple :</strong> Le client cumule 90 pts → seuil atteint.
                {form.reward_next_visit_only && " Il devra revenir une prochaine fois."}
                {form.reward_min_purchase > 0 && ` Son achat devra être d'au moins ${form.reward_min_purchase}€.`}
                {!form.reward_next_visit_only && form.reward_min_purchase === 0 && " La récompense est immédiate."}
              </span>
            </div>
          </div>
        </Panel>

        {/* Rewards are managed in the dedicated Récompenses page */}

        {/* Onboarding */}
        <Panel title="Inscription client" subtitle="Comment les nouveaux clients rejoignent votre programme" icon={Users}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { val: "instant", emoji: "⚡", title: "Instantané", desc: "Scan & go" },
              { val: "email", emoji: "📧", title: "Email", desc: "Avec email" },
              { val: "phone", emoji: "📱", title: "Téléphone", desc: "Avec numéro" },
            ].map(m => (
              <OptionCard
                key={m.val}
                selected={form.onboarding_mode === m.val}
                onClick={() => update("onboarding_mode", m.val as any)}
                emoji={m.emoji}
                title={m.title}
                desc={m.desc}
              />
            ))}
          </div>
        </Panel>
      </div>
    );
  };

  /* ═══════════════ SECTION: DESIGN ═══════════════ */

  const renderDesign = () => (
    <div className="space-y-4">
      {/* Quick Themes */}
      <Panel title="Thèmes rapides" subtitle="Appliquez un style en un clic" icon={Sparkles}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {presetThemes.map((theme) => (
            <button
              key={theme.label}
              onClick={() => {
                update("primary_color", theme.primary);
                update("secondary_color", theme.secondary);
                update("foreground_color", theme.fg);
                update("label_color", theme.lbl);
                toast.success(`Thème "${theme.label}" appliqué ✓`);
              }}
              className="group p-3 rounded-xl border border-border/40 hover:border-primary/30 hover:shadow-lg transition-all text-center"
            >
              <div
                className="w-full h-8 rounded-lg shadow-sm group-hover:scale-105 transition-transform mb-2"
                style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}
              />
              <span className="text-[11px] font-semibold">{theme.label}</span>
            </button>
          ))}
        </div>
      </Panel>

      {/* Custom Colors */}
      <Panel title="Couleurs personnalisées" subtitle="Affinez les couleurs de votre carte" icon={Palette}>
        <div className="space-y-4">
          {[
            { key: "primary_color" as const, label: "Couleur de fond", value: form.primary_color, fallback: "#6B46C1", desc: "La couleur principale de votre carte" },
            { key: "secondary_color" as const, label: "Couleur secondaire", value: form.secondary_color, fallback: "#F6AD55", desc: "Utilisée pour les dégradés" },
            { key: "foreground_color" as const, label: "Couleur du texte", value: form.foreground_color, fallback: "#ffffff", desc: "Couleur des valeurs affichées" },
            { key: "label_color" as const, label: "Couleur des labels", value: form.label_color, fallback: "#cccccc", desc: "Couleur des petits titres" },
          ].map(c => (
            <div key={c.key} className="flex items-center gap-3 p-3 rounded-xl bg-accent/20 border border-border/20">
              <div className="relative shrink-0">
                <input
                  type="color"
                  value={c.value || c.fallback}
                  onChange={e => update(c.key, e.target.value)}
                  className="w-10 h-10 rounded-xl border-2 border-border/50 cursor-pointer appearance-none bg-transparent"
                  style={{ WebkitAppearance: "none" }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold">{c.label}</p>
                <p className="text-[10px] text-muted-foreground">{c.desc}</p>
              </div>
              <Input
                value={c.value || ""}
                onChange={e => update(c.key, e.target.value)}
                className="w-24 rounded-lg text-[10px] h-8 font-mono text-center"
                placeholder="Auto"
              />
            </div>
          ))}
        </div>
      </Panel>

      {/* Card Style */}
      <Panel title="Style de carte" subtitle="Apparence visuelle" icon={CreditCard}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {cardStyles.map(s => (
            <button
              key={s.value}
              onClick={() => update("card_style", s.value)}
              className={`p-3 rounded-xl border-2 text-center transition-all ${
                form.card_style === s.value
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border/40 hover:border-primary/20"
              }`}
            >
              <span className="text-xl block mb-1">{s.emoji}</span>
              <span className="text-[11px] font-medium">{s.label}</span>
            </button>
          ))}
        </div>

        <Divider />

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Type de fond</Label>
          <Select value={form.card_bg_type} onValueChange={(v) => update("card_bg_type", v as any)}>
            <SelectTrigger className="rounded-xl h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="solid">Couleur unie</SelectItem>
              <SelectItem value="gradient">Dégradé</SelectItem>
              <SelectItem value="image">Image personnalisée</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Panel>
    </div>
  );

  /* ═══════════════ SECTION: AFFICHAGE ═══════════════ */

  const renderFields = () => (
    <Panel title="Champs de la carte" subtitle="Choisissez ce qui est visible sur la carte wallet" icon={Eye}>
      <div className="divide-y divide-border/30">
        <ToggleRow emoji="👤" label="Nom du client" desc="Affiché en gros sur la carte" checked={form.show_customer_name} onChange={v => update("show_customer_name", v)} />
        <ToggleRow emoji="📱" label="QR Code" desc="Permet de scanner la carte" checked={form.show_qr_code} onChange={v => update("show_qr_code", v)} />
        <ToggleRow emoji="⭐" label="Points / Tampons" desc="Le compteur de progression" checked={form.show_points} onChange={v => update("show_points", v)} />
        <ToggleRow emoji="📅" label="Date d'expiration" desc="Validité de la carte" checked={form.show_expiration} onChange={v => update("show_expiration", v)} />
        <ToggleRow emoji="🎁" label="Prochaine récompense" desc="Motivation pour le client" checked={form.show_rewards_preview} onChange={v => update("show_rewards_preview", v)} />
      </div>
    </Panel>
  );

  /* ═══════════════ SECTION: ENGAGEMENT ═══════════════ */

  const renderEngagement = () => (
    <div className="space-y-4">
      <Panel title="Relance des inactifs" subtitle="Ramenez vos clients automatiquement" icon={Bell}>
        <ToggleRow
          emoji="🔔"
          label="Activer la relance automatique"
          desc="Envoie un push quand un client est inactif"
          checked={form.auto_reminder_enabled}
          onChange={v => update("auto_reminder_enabled", v)}
        />
        {form.auto_reminder_enabled && (
          <SmartSlider
            label="Jours avant relance"
            icon={Clock}
            value={form.auto_reminder_days}
            onChange={(v) => update("auto_reminder_days", v)}
            min={3} max={30}
            suffix="jour" pluralSuffix="jours"
            hint={`Un push sera envoyé après ${form.auto_reminder_days} jours sans visite`}
          />
        )}
      </Panel>

      <Panel title="Alerte de récompense" subtitle="Motivez vos clients proches du but" icon={Target}>
        <SmartSlider
          label="Seuil d'alerte"
          icon={Gift}
          value={form.reward_alert_threshold}
          onChange={(v) => update("reward_alert_threshold", v)}
          min={1} max={10}
          suffix="pt" pluralSuffix="pts restants"
          hint={`Notification quand il reste ${form.reward_alert_threshold} point${form.reward_alert_threshold > 1 ? "s" : ""} avant la récompense`}
        />
      </Panel>
    </div>
  );

  /* ═══════════════ SECTION: OUTILS ═══════════════ */

  const renderTools = () => (
    <div className="space-y-4">
      {/* QR Code */}
      <Panel title="QR Code & Vitrine" subtitle="Partagez votre programme de fidélité" icon={QrCode}>
        <div className="flex flex-col items-center space-y-4">
          <div
            id="qr-printable"
            className="relative p-6 rounded-2xl flex flex-col items-center gap-3 w-full max-w-[280px]"
            style={{
              background: `linear-gradient(145deg, ${form.primary_color}15 0%, ${form.secondary_color || form.primary_color}08 100%)`,
              border: `2px solid ${form.primary_color}20`,
            }}
          >
            {logoUrl && <img src={logoUrl} alt={form.name} className="w-12 h-12 rounded-xl object-cover shadow-sm" />}
            <div className="p-3 bg-background rounded-xl shadow-sm border border-border/30">
              <QRCodeSVG id="business-qr-svg" value={publicUrl} size={150} level="H" includeMargin={false} fgColor={form.primary_color || "#6B46C1"} />
            </div>
            <div className="text-center">
              <p className="font-bold text-sm">{form.name || "Mon Commerce"}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Scannez pour rejoindre le programme fidélité</p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={downloadQR} variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs h-9">
              <Download className="w-3.5 h-3.5" /> PNG
            </Button>
            <Button onClick={copyLink} variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs h-9">
              <Copy className="w-3.5 h-3.5" /> Lien
            </Button>
            <Button
              onClick={() => {
                const el = document.getElementById("qr-printable");
                if (!el) return;
                const printOverlay = document.createElement("div");
                printOverlay.id = "pwa-print-overlay";
                printOverlay.innerHTML = `<style>#pwa-print-overlay{position:fixed;inset:0;z-index:99999;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center}#pwa-print-overlay .qr-wrap{text-align:center;display:flex;flex-direction:column;align-items:center;gap:16px}#pwa-print-overlay .qr-wrap img{width:60px;height:60px;border-radius:12px;object-fit:contain}#pwa-print-overlay .qr-wrap svg{width:240px;height:240px}#pwa-print-overlay .qr-wrap>div{background:none!important;box-shadow:none!important;border:none!important;padding:0!important;border-radius:0!important}#pwa-print-overlay .pwa-print-actions{position:fixed;bottom:24px;left:0;right:0;display:flex;gap:10px;justify-content:center}#pwa-print-overlay .pwa-print-actions button{padding:12px 28px;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer}</style><div class="qr-wrap">${el.innerHTML}</div><div class="pwa-print-actions"><button style="background:#333;color:#fff" onclick="window.print()">Imprimer</button><button style="background:#e5e5e5;color:#333" onclick="document.getElementById('pwa-print-overlay')?.remove()">Retour</button></div>`;
                document.body.appendChild(printOverlay);
                const cleanup = () => { document.getElementById('pwa-print-overlay')?.remove(); window.removeEventListener('afterprint', cleanup); };
                window.addEventListener('afterprint', cleanup);
              }}
              variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs h-9"
            >
              <Printer className="w-3.5 h-3.5" /> Imprimer</Button>
          </div>

          <div className="flex items-center gap-2 w-full">
            <code className="text-[10px] bg-accent/40 px-3 py-2 rounded-lg flex-1 overflow-hidden text-ellipsis whitespace-nowrap border border-border/20">{publicUrl}</code>
            <Button size="icon" variant="ghost" className="rounded-lg h-8 w-8 shrink-0" onClick={() => window.open(publicUrl, "_blank")}>
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </Panel>

      {/* Templates */}
      <Panel title="Template métier" subtitle="Pré-configurations par secteur d'activité" icon={Layout}>
        <TemplatePicker currentTemplate={form.business_template} onSelect={handleTemplateSelect} />
      </Panel>

      {/* Modules */}
      <Panel title="Modules actifs" subtitle="Activez ou désactivez des fonctionnalités" icon={Shield}>
        <FeatureToggles
          config={{
            feature_gamification: form.feature_gamification,
            feature_notifications: form.feature_notifications,
            feature_wallet: form.feature_wallet,
            feature_analytics: form.feature_analytics,
          }}
          onChange={(key, value) => update(key as keyof typeof form, value as any)}
          plan={business?.subscription_plan || "starter"}
        />
      </Panel>
    </div>
  );

  const sectionRenderers: Record<SectionId, () => React.ReactNode> = {
    identity: renderIdentity,
    program: renderProgram,
    design: renderDesign,
    fields: renderFields,
    engagement: renderEngagement,
    tools: renderTools,
  };

  /* ═══════════════ LAYOUT ═══════════════ */

  return (
    <DashboardLayout
      title="Carte de fidélité"
      subtitle="Personnalisez entièrement votre programme"
      headerAction={
        <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto justify-center bg-gradient-primary text-primary-foreground rounded-xl gap-2 shadow-md hover:shadow-lg transition-shadow">
          <Save className="w-4 h-4" /> {saving ? "Sauvegarde..." : "Sauvegarder"}
        </Button>
      }
    >
      {/* ─── MOBILE PREVIEW ─── */}
      <div className="lg:hidden">
        <details open className="rounded-2xl bg-card border border-border/50 overflow-hidden shadow-sm">
          <summary className="p-4 cursor-pointer flex items-center justify-between text-sm font-medium">
            <span className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              Aperçu en temps réel
            </span>
            <Badge variant="outline" className="text-[9px] border-primary/30 text-primary animate-pulse">● Live</Badge>
          </summary>
          <div className="px-4 pb-4 space-y-3">
            <div className="flex justify-center">
              <div className="flex rounded-xl bg-accent/40 p-0.5 border border-border/30">
                <button
                  onClick={() => setPreviewDevice("iphone")}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                    previewDevice === "iphone" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  🍎 iPhone
                </button>
                <button
                  onClick={() => setPreviewDevice("samsung")}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                    previewDevice === "samsung" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  🤖 Android
                </button>
              </div>
            </div>
            <div className="flex justify-center overflow-hidden">
              <div className="transform scale-[0.85] sm:scale-100 origin-top">
                {previewDevice === "iphone" ? (
                  <IPhoneMockup width={previewWidth + 20}>{walletPassElement}</IPhoneMockup>
                ) : (
                  <SamsungMockup width={previewWidth + 20}>{walletPassElement}</SamsungMockup>
                )}
              </div>
            </div>
            <p className="text-center text-[10px] text-muted-foreground font-medium">
              Rendu identique au {previewDevice === "iphone" ? "Apple" : "Google"} Wallet
            </p>
          </div>
        </details>
      </div>

      {/* ─── TABS NAVIGATION ─── */}
      <div className="overflow-x-auto lg:hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="flex gap-1 bg-accent/30 rounded-2xl p-1.5 border border-border/30 w-max">
          {sections.map(s => {
            const Icon = s.icon;
            const active = activeSection === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`relative flex items-center gap-1.5 px-3 py-2.5 rounded-xl whitespace-nowrap transition-all text-xs font-medium shrink-0 ${
                  active
                    ? "bg-card text-foreground shadow-md border border-border/50"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? "text-primary" : ""}`} />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr),340px] gap-6 min-w-0">
        {/* ─── LEFT: Nav + Content ─── */}
        <div className="space-y-4 min-w-0">
          {/* Desktop Navigation */}
          <div className="hidden lg:block">
            <div className="flex gap-1 bg-accent/30 rounded-2xl p-1.5 border border-border/30 w-max">
              {sections.map(s => {
                const Icon = s.icon;
                const active = activeSection === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveSection(s.id)}
                    className={`relative flex items-center gap-1.5 px-3 py-2.5 rounded-xl whitespace-nowrap transition-all text-xs font-medium shrink-0 ${
                      active
                        ? "bg-card text-foreground shadow-md border border-border/50"
                        : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${active ? "text-primary" : ""}`} />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active section */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {sectionRenderers[activeSection]()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ─── RIGHT: Sticky preview ─── */}
        <div className="lg:sticky lg:top-20 self-start space-y-3 hidden lg:block">
          <div className="p-4 rounded-2xl bg-card border border-border/50 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <h2 className="font-bold text-sm">Aperçu</h2>
              </div>
              <div className="flex rounded-xl bg-accent/40 p-0.5 border border-border/30">
                <button
                  onClick={() => setPreviewDevice("iphone")}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                    previewDevice === "iphone" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  🍎 iPhone
                </button>
                <button
                  onClick={() => setPreviewDevice("samsung")}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                    previewDevice === "samsung" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  🤖 Android
                </button>
              </div>
            </div>
            <div className="flex justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={previewDevice}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.2 }}
                >
                  {previewDevice === "iphone" ? (
                    <IPhoneMockup width={previewWidth + 20}>{walletPassElement}</IPhoneMockup>
                  ) : (
                    <SamsungMockup width={previewWidth + 20}>{walletPassElement}</SamsungMockup>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
            <p className="text-center text-[10px] text-muted-foreground mt-3 font-medium">
              Rendu identique au {previewDevice === "iphone" ? "Apple" : "Google"} Wallet
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CustomizePage;
