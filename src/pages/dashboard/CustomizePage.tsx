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
} from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";

/* ────────────────────────── constants ────────────────────────── */

const cardStyles = [
  { value: "classic", label: "Classique", emoji: "🎨" },
  { value: "luxury", label: "Luxe", emoji: "✨" },
  { value: "coffee", label: "Coffee", emoji: "☕" },
  { value: "barber", label: "Barbier", emoji: "💈" },
  { value: "restaurant", label: "Resto", emoji: "🍽️" },
  { value: "neon", label: "Néon", emoji: "💡" },
];

const presetThemes = [
  { label: "Charbon", primary: "#1a1a2e", secondary: "#e94560", style: "neon" },
  { label: "Or", primary: "#92400e", secondary: "#F59E0B", style: "luxury" },
  { label: "Lavande", primary: "#7c3aed", secondary: "#f9a8d4", style: "classic" },
  { label: "Émeraude", primary: "#059669", secondary: "#3b82f6", style: "restaurant" },
  { label: "Océan", primary: "#0e4a6e", secondary: "#38bdf8", style: "classic" },
  { label: "Cerise", primary: "#9f1239", secondary: "#fda4af", style: "luxury" },
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

const sections: { id: SectionId; icon: typeof Store; label: string; desc: string }[] = [
  { id: "identity", icon: Store, label: "Identité", desc: "Logo, nom et infos" },
  { id: "program", icon: Zap, label: "Programme", desc: "Type et règles de points" },
  { id: "design", icon: Palette, label: "Design", desc: "Couleurs et style" },
  { id: "fields", icon: SlidersHorizontal, label: "Affichage", desc: "Champs visibles" },
  { id: "engagement", icon: Sparkles, label: "Engagement", desc: "Relances et alertes" },
  { id: "tools", icon: Layers, label: "Outils", desc: "QR, templates, modules" },
];

/* ────────────────────────── helpers ────────────────────────── */

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

/* ── Reusable section card ── */
function SectionCard({ title, icon: Icon, children, badge }: {
  title: string; icon: typeof Store; children: React.ReactNode; badge?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-2xl bg-card border border-border/50 overflow-hidden"
    >
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-3">
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <h3 className="font-semibold text-sm flex-1">{title}</h3>
        {badge}
      </div>
      <div className="px-5 pb-5 space-y-4">{children}</div>
    </motion.div>
  );
}

/* ── Small field group ── */
function FieldGroup({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/* ────────────────────────── main component ────────────────────────── */

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
    else { toast.success("Sauvegardé ✓"); await refreshBusiness(); }
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

  // Pass fields
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

  /* ────────────── section renderers ────────────── */

  const renderIdentity = () => (
    <SectionCard title="Identité du commerce" icon={Store}>
      {/* Logo + Banner side by side */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs mb-2 block">
            Logo
            {!logoUrl && <Badge variant="secondary" className="ml-2 text-[9px]">Requis</Badge>}
          </Label>
          {business && <LogoUpload currentUrl={logoUrl} businessId={business.id} onUploaded={setLogoUrl} />}
        </div>
        <div>
          <Label className="text-xs mb-2 block">Bannière</Label>
          <div className="space-y-2">
            {stripImageUrl ? (
              <div className="relative group">
                <img src={stripImageUrl} alt="Bannière" className="w-full h-16 rounded-xl object-cover border border-border/50" />
                <button
                  onClick={async () => {
                    setStripImageUrl(null);
                    if (business) {
                      await supabase.from("businesses").update({ card_bg_image_url: null }).eq("id", business.id);
                      toast.success("Supprimée");
                    }
                  }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => stripFileRef.current?.click()}
                className="w-full h-16 rounded-xl border-2 border-dashed border-border/60 flex items-center justify-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
              >
                <ImageIcon className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
            <button
              onClick={() => stripFileRef.current?.click()}
              className="text-[10px] text-primary font-medium hover:underline"
            >
              {stripImageUrl ? "Changer" : "Uploader"} · 640×200px
            </button>
          </div>
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

      <FieldGroup label="Nom du commerce">
        <Input value={form.name} onChange={(e) => update("name", e.target.value)} className="rounded-xl" />
      </FieldGroup>

      <FieldGroup label="Description courte">
        <Textarea value={form.description} onChange={(e) => update("description", e.target.value)} className="rounded-xl" rows={2} />
      </FieldGroup>

      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="Catégorie">
          <Select value={form.category} onValueChange={(v) => update("category", v)}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </FieldGroup>
        <FieldGroup label="Téléphone">
          <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} className="rounded-xl" />
        </FieldGroup>
      </div>
    </SectionCard>
  );

  const renderProgram = () => {
    const isPoints = form.loyalty_type === "points";
    const isStamps = form.loyalty_type === "stamps";
    const isCashback = form.loyalty_type === "cashback";
    const euroMode = isPoints && form.points_per_euro > 0;

    return (
      <SectionCard title="Programme de fidélité" icon={Zap}>
        {/* Type selector */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { val: "points", emoji: "⭐", label: "Points", desc: "Cumul progressif" },
            { val: "stamps", emoji: "🎯", label: "Tampons", desc: "Carte à tamponner" },
            { val: "cashback", emoji: "💰", label: "Cashback", desc: "Cagnotte en euros" },
            { val: "subscription", emoji: "📋", label: "Abonnement", desc: "Statut membre" },
          ].map((type) => (
            <button
              key={type.val}
              onClick={() => update("loyalty_type", type.val as any)}
              className={`relative p-3 rounded-xl border-2 text-left transition-all group ${
                form.loyalty_type === type.val
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border/40 hover:border-primary/20 hover:bg-accent/30"
              }`}
            >
              {form.loyalty_type === type.val && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
              <span className="text-xl">{type.emoji}</span>
              <p className="font-semibold text-xs mt-1.5">{type.label}</p>
              <p className="text-[10px] text-muted-foreground">{type.desc}</p>
            </button>
          ))}
        </div>

        {/* ── Points specifics ── */}
        {isPoints && (
          <>
            {/* Earning mode */}
            <div className="space-y-2.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Calculator className="w-3 h-3" /> Mode d'attribution
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => update("points_per_euro", 0)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    !euroMode ? "border-primary bg-primary/5" : "border-border/40 hover:border-primary/20"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">🚶</span>
                    <span className="font-semibold text-xs">Par visite</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Points fixes à chaque passage</p>
                </button>
                <button
                  onClick={() => { if (!euroMode) update("points_per_euro", 1); }}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    euroMode ? "border-primary bg-primary/5" : "border-border/40 hover:border-primary/20"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">💶</span>
                    <span className="font-semibold text-xs">Par euro</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Selon le montant d'achat</p>
                </button>
              </div>
            </div>

            {/* Per-visit slider */}
            {!euroMode && (
              <SliderField
                label="Points par visite"
                value={form.points_per_visit}
                onChange={(v) => update("points_per_visit", v)}
                min={1} max={20} step={1}
                suffix="pt" pluralSuffix="pts"
              />
            )}

            {/* Per-euro slider + simulation */}
            {euroMode && (
              <div className="space-y-3">
                <SliderField
                  label="Taux de conversion"
                  value={form.points_per_euro}
                  onChange={(v) => update("points_per_euro", v)}
                  min={1} max={20} step={1}
                  prefix="1€ =" suffix="pt" pluralSuffix="pts"
                />

                {/* Simulation */}
                <div className="rounded-xl bg-accent/40 border border-border/30 p-3.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Simulation
                  </p>
                  <div className="space-y-2">
                    {[5, 15, 50].map(a => (
                      <div key={a} className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Achat {a}€</span>
                        <div className="flex items-center gap-1.5">
                          <ArrowRight className="w-3 h-3 text-primary" />
                          <span className="text-xs font-bold">{a * form.points_per_euro} pts</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-start gap-2 text-[10px] text-muted-foreground rounded-lg bg-primary/5 p-2.5 border border-primary/10">
                  <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <span>Le commerçant saisit le montant au moment du scan. Les points sont calculés automatiquement.</span>
                </div>
              </div>
            )}

            {/* Goal */}
            <SliderField
              label="🎁 Objectif récompense"
              value={form.max_points_per_card}
              onChange={(v) => update("max_points_per_card", v)}
              min={5} max={200} step={5}
              suffix="pt" pluralSuffix="pts"
              hint={
                euroMode
                  ? `≈ ${Math.ceil(form.max_points_per_card / form.points_per_euro)}€ d'achats nécessaires`
                  : `= ${Math.ceil(form.max_points_per_card / form.points_per_visit)} visite${Math.ceil(form.max_points_per_card / form.points_per_visit) > 1 ? "s" : ""} nécessaires`
              }
            />
          </>
        )}

        {/* ── Stamps specifics ── */}
        {isStamps && (
          <SliderField
            label="🎯 Tampons pour la récompense"
            value={form.max_points_per_card}
            onChange={(v) => update("max_points_per_card", v)}
            min={3} max={20} step={1}
            suffix="tampon" pluralSuffix="tampons"
          />
        )}

        {/* ── Cashback specifics ── */}
        {isCashback && (
          <>
            <SliderField
              label="Taux de cashback"
              value={form.points_per_euro || 1}
              onChange={(v) => update("points_per_euro", v)}
              min={1} max={20} step={1}
              prefix="1€ =" suffix="pt" pluralSuffix="pts"
            />
            <SliderField
              label="Seuil de récompense"
              value={form.max_points_per_card}
              onChange={(v) => update("max_points_per_card", v)}
              min={10} max={500} step={10}
              suffix="pt" pluralSuffix="pts"
            />
          </>
        )}

        {/* Reward desc */}
        <FieldGroup label="🎁 Récompense offerte">
          <Input value={form.reward_description} onChange={(e) => update("reward_description", e.target.value)} className="rounded-xl" placeholder="Café offert !" />
        </FieldGroup>

        {/* Onboarding mode */}
        <div className="pt-3 border-t border-border/30 space-y-2.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Inscription client</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { val: "instant", emoji: "⚡", label: "Instantané" },
              { val: "email", emoji: "📧", label: "Email" },
              { val: "phone", emoji: "📱", label: "Téléphone" },
            ].map((mode) => (
              <button
                key={mode.val}
                onClick={() => update("onboarding_mode", mode.val as any)}
                className={`p-2.5 rounded-xl border-2 text-center transition-all text-xs ${
                  form.onboarding_mode === mode.val ? "border-primary bg-primary/5" : "border-border/40 hover:border-primary/20"
                }`}
              >
                <span className="text-lg block">{mode.emoji}</span>
                <span className="text-[10px] font-medium">{mode.label}</span>
              </button>
            ))}
          </div>
        </div>
      </SectionCard>
    );
  };

  const renderDesign = () => (
    <SectionCard title="Design de la carte" icon={Palette}>
      {/* Themes grid */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Thèmes rapides</p>
        <div className="grid grid-cols-3 gap-2">
          {presetThemes.map((theme) => (
            <button
              key={theme.label}
              onClick={() => {
                update("primary_color", theme.primary);
                update("secondary_color", theme.secondary);
                update("card_style", theme.style as any);
                toast.success(`Thème "${theme.label}" ✓`);
              }}
              className="group p-2 rounded-xl border border-border/40 hover:border-primary/30 hover:shadow-md transition-all"
            >
              <div className="w-full h-6 rounded-lg shadow-sm group-hover:scale-105 transition-transform" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }} />
              <span className="text-[10px] font-medium mt-1.5 block text-center">{theme.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Color pickers */}
      <div className="space-y-3">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Couleurs personnalisées</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: "primary_color" as const, label: "Fond", value: form.primary_color, fallback: "#6B46C1" },
            { key: "foreground_color" as const, label: "Texte", value: form.foreground_color, fallback: "#ffffff" },
            { key: "label_color" as const, label: "Labels", value: form.label_color, fallback: "#cccccc" },
          ].map(c => (
            <div key={c.key} className="space-y-1.5">
              <Label className="text-[10px]">{c.label}</Label>
              <div className="flex items-center gap-1.5">
                <div className="relative">
                  <input type="color" value={c.value || c.fallback} onChange={e => update(c.key, e.target.value)} className="w-8 h-8 rounded-lg border border-border/50 cursor-pointer" />
                </div>
                <Input
                  value={c.value}
                  onChange={e => update(c.key, e.target.value)}
                  className="rounded-lg text-[10px] h-8 font-mono"
                  placeholder="Auto"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Style + bg type */}
      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="Style de carte">
          <div className="grid grid-cols-3 gap-1.5">
            {cardStyles.map(s => (
              <button
                key={s.value}
                onClick={() => update("card_style", s.value)}
                className={`p-1.5 rounded-lg border text-center transition-all text-[10px] ${
                  form.card_style === s.value ? "border-primary bg-primary/5 font-semibold" : "border-border/40 hover:border-primary/20"
                }`}
              >
                <span className="block text-sm">{s.emoji}</span>
                {s.label}
              </button>
            ))}
          </div>
        </FieldGroup>
        <FieldGroup label="Type de fond">
          <Select value={form.card_bg_type} onValueChange={(v) => update("card_bg_type", v as any)}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="solid">Couleur unie</SelectItem>
              <SelectItem value="gradient">Dégradé</SelectItem>
              <SelectItem value="image">Image</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>
      </div>
    </SectionCard>
  );

  const renderFields = () => (
    <SectionCard title="Champs visibles" icon={SlidersHorizontal}>
      <p className="text-[10px] text-muted-foreground">Activez/désactivez les informations affichées sur la carte wallet.</p>
      <div className="divide-y divide-border/30">
        {[
          { key: "show_customer_name" as const, label: "Nom du client", desc: "Affiché en gros sur la carte", emoji: "👤" },
          { key: "show_qr_code" as const, label: "QR Code", desc: "Pour scanner la carte", emoji: "📱" },
          { key: "show_points" as const, label: "Points / Tampons", desc: "Compteur de progression", emoji: "⭐" },
          { key: "show_expiration" as const, label: "Date d'expiration", desc: "Validité de la carte", emoji: "📅" },
          { key: "show_rewards_preview" as const, label: "Prochaine récompense", desc: "Motivation visuelle", emoji: "🎁" },
        ].map(item => (
          <div key={item.key} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
            <div className="flex items-center gap-3">
              <span className="text-base">{item.emoji}</span>
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
            </div>
            <Switch checked={form[item.key]} onCheckedChange={v => update(item.key, v)} />
          </div>
        ))}
      </div>
    </SectionCard>
  );

  const renderEngagement = () => (
    <SectionCard title="Engagement & relances" icon={Sparkles}>
      {/* Auto reminder */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-base">🔔</span>
          <div>
            <p className="text-sm font-medium">Relance des inactifs</p>
            <p className="text-[10px] text-muted-foreground">Push automatique après X jours</p>
          </div>
        </div>
        <Switch checked={form.auto_reminder_enabled} onCheckedChange={v => update("auto_reminder_enabled", v)} />
      </div>
      {form.auto_reminder_enabled && (
        <SliderField
          label="Jours d'inactivité avant relance"
          value={form.auto_reminder_days}
          onChange={(v) => update("auto_reminder_days", v)}
          min={3} max={30} step={1}
          suffix="jour" pluralSuffix="jours"
        />
      )}

      <div className="border-t border-border/30 pt-3">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-base">🎯</span>
          <div>
            <p className="text-sm font-medium">Alerte de récompense proche</p>
            <p className="text-[10px] text-muted-foreground">Notification quand le client est proche de sa récompense</p>
          </div>
        </div>
        <SliderField
          label="Seuil d'alerte"
          value={form.reward_alert_threshold}
          onChange={(v) => update("reward_alert_threshold", v)}
          min={1} max={10} step={1}
          suffix="pt" pluralSuffix="pts restants"
          hint={`Notification quand il reste ${form.reward_alert_threshold} point${form.reward_alert_threshold > 1 ? "s" : ""}`}
        />
      </div>
    </SectionCard>
  );

  const renderTools = () => (
    <div className="space-y-4">
      {/* QR Code */}
      <SectionCard title="QR Code & Vitrine" icon={QrCode}>
        <div className="flex flex-col items-center space-y-4">
          <div
            id="qr-printable"
            className="relative p-5 rounded-2xl flex flex-col items-center gap-3 w-full max-w-[260px]"
            style={{
              background: `linear-gradient(145deg, ${form.primary_color}12 0%, ${form.secondary_color || form.primary_color}08 100%)`,
              border: `2px solid ${form.primary_color}20`,
            }}
          >
            {logoUrl && <img src={logoUrl} alt={form.name} className="w-10 h-10 rounded-xl object-cover" />}
            <div className="p-2.5 bg-background rounded-xl shadow-sm">
              <QRCodeSVG id="business-qr-svg" value={publicUrl} size={140} level="H" includeMargin={false} fgColor={form.primary_color || "#6B46C1"} />
            </div>
            <div className="text-center">
              <p className="font-semibold text-xs">{form.name || "Mon Commerce"}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">Scannez pour votre carte fidélité</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={downloadQR} variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs h-8">
              <Download className="w-3 h-3" /> PNG
            </Button>
            <Button onClick={copyLink} variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs h-8">
              <Copy className="w-3 h-3" /> Lien
            </Button>
            <Button
              onClick={() => {
                const printContent = document.getElementById("qr-printable");
                if (!printContent) return;
                const w = window.open("", "_blank");
                if (!w) return;
                w.document.write(`<!DOCTYPE html><html><head><title>QR - ${form.name}</title><style>body{display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:system-ui;}</style></head><body>${printContent.outerHTML}</body></html>`);
                w.document.close(); w.focus(); w.print();
              }}
              variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs h-8"
            >
              <Printer className="w-3 h-3" /> Print
            </Button>
          </div>

          <div className="flex items-center gap-2 w-full">
            <code className="text-[10px] bg-secondary/60 px-3 py-1.5 rounded-lg flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{publicUrl}</code>
            <Button size="icon" variant="ghost" className="rounded-lg h-7 w-7 shrink-0" onClick={() => window.open(publicUrl, "_blank")}>
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </SectionCard>

      {/* Templates */}
      <SectionCard title="Template métier" icon={Layout}>
        <TemplatePicker currentTemplate={form.business_template} onSelect={handleTemplateSelect} />
      </SectionCard>

      {/* Modules */}
      <SectionCard title="Modules" icon={Shield}>
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
      </SectionCard>
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

  return (
    <DashboardLayout
      title="Carte de fidélité"
      subtitle="Personnalisez votre carte, vos règles et votre design"
      headerAction={
        <Button onClick={handleSave} disabled={saving} className="bg-gradient-primary text-primary-foreground rounded-xl gap-2 shadow-md">
          <Save className="w-4 h-4" /> {saving ? "Sauvegarde..." : "Sauvegarder"}
        </Button>
      }
    >
      <div className="grid lg:grid-cols-[1fr,340px] gap-6">
        {/* ─── MOBILE PREVIEW (small screens) ─── */}
        <div className="lg:hidden">
          <details className="rounded-2xl bg-card border border-border/50 overflow-hidden">
            <summary className="p-4 cursor-pointer flex items-center justify-between text-sm font-medium">
              <span className="flex items-center gap-2">👁️ Aperçu en temps réel</span>
              <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">Live</Badge>
            </summary>
            <div className="flex justify-center pb-4 px-4">
              {walletPassElement}
            </div>
          </details>
        </div>

        {/* ─── LEFT: Nav + Content ─── */}
        <div className="space-y-4">
          {/* Section navigation — horizontal scroll on mobile */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {sections.map(s => {
              const Icon = s.icon;
              const active = activeSection === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border whitespace-nowrap transition-all text-xs font-medium shrink-0 ${
                    active
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-border/40 text-muted-foreground hover:border-primary/20 hover:text-foreground hover:bg-accent/30"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* Active section content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {sectionRenderers[activeSection]()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ─── RIGHT: Sticky preview ─── */}
        <div className="lg:sticky lg:top-20 self-start space-y-3 hidden lg:block">
          <div className="p-4 rounded-2xl bg-card border border-border/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-sm">Aperçu</h2>
                <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">Live</Badge>
              </div>
              <div className="flex rounded-lg bg-secondary/60 p-0.5">
                <button
                  onClick={() => setPreviewDevice("iphone")}
                  className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                    previewDevice === "iphone" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  🍎 iPhone
                </button>
                <button
                  onClick={() => setPreviewDevice("samsung")}
                  className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
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
            <p className="text-center text-[9px] text-muted-foreground mt-3">
              Rendu identique au {previewDevice === "iphone" ? "Apple" : "Google"} Wallet
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

/* ────────────────────────── SliderField component ────────────────────────── */

function SliderField({ label, value, onChange, min, max, step, suffix, pluralSuffix, prefix, hint }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number;
  suffix: string; pluralSuffix?: string; prefix?: string; hint?: string;
}) {
  const displayVal = `${prefix ? prefix + " " : ""}${value} ${value > 1 && pluralSuffix ? pluralSuffix : suffix}`;
  return (
    <div className="rounded-xl bg-accent/30 border border-border/30 p-3.5 space-y-2.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        <Badge variant="outline" className="text-[10px] tabular-nums font-bold h-5 px-2">{displayVal}</Badge>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} />
      <div className="flex justify-between text-[9px] text-muted-foreground">
        <span>{min} {suffix}</span>
        <span>{max} {pluralSuffix || suffix}</span>
      </div>
      {hint && <p className="text-[10px] text-muted-foreground text-center">{hint}</p>}
    </div>
  );
}

export default CustomizePage;
