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
import { buildCardConfig, buildDemoCustomer, buildApplePassFields, getLoyaltyLabels, type UnifiedCardConfig } from "@/lib/cardConfig";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QRCodeSVG } from "qrcode.react";
import {
  Save, Palette, CreditCard, Zap, Eye, Gift, Layout, Download, Copy, Printer, ExternalLink, Link as LinkIcon, Shield,
} from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";

/* ── Stamp grid for preview ── */
function StampGrid({ filled, total, s = 1 }: { filled: number; total: number; s?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(5, 1fr)`, gap: `${6 * s}px`, padding: `${10 * s}px ${16 * s}px` }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: `${28 * s}px`, height: `${28 * s}px`, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: `${14 * s}px`, color: "#fff",
            background: i < filled ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)",
            border: `${1.5 * s}px solid ${i < filled ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.15)"}`,
          }}
        >
          {i < filled ? "✓" : ""}
        </div>
      ))}
    </div>
  );
}

const cardStyles = [
  { value: "classic", label: "Classique" },
  { value: "luxury", label: "Luxe" },
  { value: "coffee", label: "Coffee Shop" },
  { value: "barber", label: "Barbier" },
  { value: "restaurant", label: "Restaurant" },
  { value: "neon", label: "Néon" },
];

const presetThemes = [
  { label: "Dark", emoji: "🌑", primary: "#1a1a2e", secondary: "#e94560", style: "neon" },
  { label: "Gold", emoji: "✨", primary: "#92400e", secondary: "#F59E0B", style: "luxury" },
  { label: "Pastel", emoji: "🌸", primary: "#7c3aed", secondary: "#f9a8d4", style: "classic" },
  { label: "Coloré", emoji: "🎨", primary: "#059669", secondary: "#3b82f6", style: "restaurant" },
];

/** Build PassKit field arrays from form state using unified config */
function buildPassFields(form: any) {
  // Build a pseudo-business object from form to use unified config
  const pseudoBusiness = {
    id: "preview",
    name: form.name,
    logo_url: null,
    card_bg_image_url: null,
    loyalty_type: form.loyalty_type,
    max_points_per_card: form.max_points_per_card,
    points_per_visit: form.points_per_visit,
    points_per_euro: form.points_per_euro,
    reward_description: form.reward_description,
    primary_color: form.primary_color,
    foreground_color: form.foreground_color,
    label_color: form.label_color,
    show_customer_name: form.show_customer_name,
    show_qr_code: form.show_qr_code,
    show_points: form.show_points,
    show_expiration: form.show_expiration,
    show_rewards_preview: form.show_rewards_preview,
    card_style: form.card_style,
    card_bg_type: form.card_bg_type,
  };
  const config = buildCardConfig(pseudoBusiness);
  const demoCustomer = buildDemoCustomer(config);
  return buildApplePassFields(config, demoCustomer);
}

const CustomizePage = () => {
  const { user, business, refreshBusiness } = useAuth();
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
    if (!business) { toast.error("Impossible de sauvegarder : commerce non chargé"); return; }
    setSaving(true);
    const { name, description, address, city, phone, website, latitude, longitude, geofence_message, foreground_color, label_color, ...config } = form;
    const { error } = await supabase.from("businesses").update({
      name, description, address, city, phone, website, latitude, longitude, geofence_message,
      foreground_color: foreground_color || null,
      label_color: label_color || null,
      ...config,
    } as any).eq("id", business.id);
    if (error) { console.error("Save error:", error); toast.error("Erreur de sauvegarde : " + error.message); }
    else {
      toast.success("Configuration sauvegardée !");
      await refreshBusiness();
    }
    setSaving(false);
  };

  const handleTemplateSelect = (template: BusinessTemplate) => {
    setForm(prev => ({ ...prev, ...template.config }));
    toast.success(`Template "${template.label}" appliqué ! N'oubliez pas de sauvegarder.`);
  };

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

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

  // Build PassKit fields
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
      headerFields={headerFields}
      primaryFields={primaryFields}
      secondaryFields={secondaryFields}
      auxiliaryFields={auxiliaryFields}
      barcodeValue={form.show_qr_code ? cardPreviewId : undefined}
      footerText={cardPreviewId.slice(0, 12)}
      width={previewWidth}
    >
      {form.loyalty_type === "stamps" && (
        <StampGrid filled={7} total={form.max_points_per_card} s={previewWidth / 320} />
      )}
    </AppleWalletPass>
  );

  return (
    <DashboardLayout
      title="Carte de fidélité"
      subtitle="Configurez design, type, récompenses et aperçu"
      headerAction={
        <Button onClick={handleSave} disabled={saving} className="bg-gradient-primary text-primary-foreground rounded-xl gap-2">
          <Save className="w-4 h-4" /> {saving ? "..." : "Sauvegarder"}
        </Button>
      }
    >
      <div className="grid lg:grid-cols-[1fr,360px] gap-6">
        {/* ─── MOBILE PREVIEW (visible on small screens only) ─── */}
        <div className="lg:hidden">
          <details className="rounded-2xl bg-card border border-border/50 overflow-hidden" open>
            <summary className="p-4 cursor-pointer flex items-center justify-between font-display font-semibold text-sm">
              <span className="flex items-center gap-2">👁️ Aperçu carte en temps réel</span>
              <Badge variant="outline" className="text-[9px] text-emerald-600 border-emerald-300">Live</Badge>
            </summary>
            <div className="flex justify-center pb-4 px-4">
              {walletPassElement}
            </div>
          </details>
        </div>

        {/* ─── LEFT: Configuration accordion ─── */}
        <div className="space-y-4">
          <Tabs defaultValue="branding" className="space-y-4">
            <TabsList className="bg-card border border-border/40 rounded-xl p-1 h-auto flex-wrap">
              <TabsTrigger value="branding" className="rounded-lg text-xs gap-1.5 px-3 py-2"><Palette className="w-3.5 h-3.5" /> Identité & Logo</TabsTrigger>
              <TabsTrigger value="type" className="rounded-lg text-xs gap-1.5 px-3 py-2"><Zap className="w-3.5 h-3.5" /> Type</TabsTrigger>
              <TabsTrigger value="design" className="rounded-lg text-xs gap-1.5 px-3 py-2"><CreditCard className="w-3.5 h-3.5" /> Design</TabsTrigger>
              <TabsTrigger value="fields" className="rounded-lg text-xs gap-1.5 px-3 py-2"><Eye className="w-3.5 h-3.5" /> Champs</TabsTrigger>
              <TabsTrigger value="rewards" className="rounded-lg text-xs gap-1.5 px-3 py-2"><Gift className="w-3.5 h-3.5" /> Récompenses</TabsTrigger>
              <TabsTrigger value="more" className="rounded-lg text-xs gap-1.5 px-3 py-2"><Layout className="w-3.5 h-3.5" /> Plus</TabsTrigger>
            </TabsList>

            {/* ── BRANDING ── */}
            <TabsContent value="branding" className="rounded-2xl bg-card border border-border/50 p-5 space-y-4">
              <div>
                <Label className="mb-2 block text-xs">
                  Logo
                  {!logoUrl && <Badge variant="outline" className="ml-2 text-[10px] text-amber-600 border-amber-300">⚠️ À configurer</Badge>}
                </Label>
                {business && <LogoUpload currentUrl={logoUrl} businessId={business.id} onUploaded={(url) => setLogoUrl(url)} />}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nom du commerce</Label>
                <Input value={form.name} onChange={(e) => update("name", e.target.value)} className="rounded-xl text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Description</Label>
                <Textarea value={form.description} onChange={(e) => update("description", e.target.value)} className="rounded-xl text-sm" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Catégorie</Label>
                  <Select value={form.category} onValueChange={(v) => update("category", v)}>
                    <SelectTrigger className="rounded-xl text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["general","boucherie","boulangerie","restaurant","cafe","coiffeur","barbier","fleuriste"].map(c => (
                        <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Téléphone</Label>
                  <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} className="rounded-xl text-sm" />
                </div>
              </div>
            </TabsContent>

            {/* ── CARD TYPE ── */}
            <TabsContent value="type" className="rounded-2xl bg-card border border-border/50 p-5 space-y-4">
              <div className="grid grid-cols-4 gap-2">
                {[
                  { val: "points", emoji: "⭐", label: "Points" },
                  { val: "stamps", emoji: "🎯", label: "Tampons" },
                  { val: "cashback", emoji: "💰", label: "Cashback" },
                  { val: "subscription", emoji: "📋", label: "Abonnement" },
                ].map((type) => (
                  <button
                    key={type.val}
                    onClick={() => update("loyalty_type", type.val as any)}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      form.loyalty_type === type.val ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/30"
                    }`}
                  >
                    <span className="text-xl block">{type.emoji}</span>
                    <p className="font-semibold text-[11px] mt-1">{type.label}</p>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{form.loyalty_type === "stamps" ? "Tampons pour récompense" : "Points max par carte"}</Label>
                  <Input type="number" value={form.max_points_per_card} onChange={(e) => update("max_points_per_card", parseInt(e.target.value) || 10)} className="rounded-xl text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{form.loyalty_type === "cashback" ? "Points par euro" : "Points par visite"}</Label>
                  <Input
                    type="number"
                    value={form.loyalty_type === "cashback" ? form.points_per_euro : form.points_per_visit}
                    onChange={(e) => update(form.loyalty_type === "cashback" ? "points_per_euro" : "points_per_visit", parseInt(e.target.value) || 1)}
                    className="rounded-xl text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Récompense</Label>
                <Input value={form.reward_description} onChange={(e) => update("reward_description", e.target.value)} className="rounded-xl text-sm" placeholder="Café offert !" />
              </div>
              <div className="pt-3 border-t border-border/50 space-y-3">
                <Label className="text-xs">Mode d'inscription client</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: "instant", emoji: "⚡", label: "Instantané" },
                    { val: "email", emoji: "📧", label: "Email requis" },
                    { val: "phone", emoji: "📱", label: "Tél. requis" },
                  ].map((mode) => (
                    <button
                      key={mode.val}
                      onClick={() => update("onboarding_mode", mode.val as any)}
                      className={`p-2 rounded-xl border-2 text-center transition-all text-xs ${
                        form.onboarding_mode === mode.val ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/30"
                      }`}
                    >
                      <span className="text-lg block">{mode.emoji}</span>
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* ── DESIGN ── */}
            <TabsContent value="design" className="rounded-2xl bg-card border border-border/50 p-5 space-y-4">
              {/* Preset themes */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Thèmes rapides</p>
                <div className="grid grid-cols-4 gap-2">
                  {presetThemes.map((theme) => (
                    <button
                      key={theme.label}
                      onClick={() => {
                        update("primary_color", theme.primary);
                        update("secondary_color", theme.secondary);
                        update("card_style", theme.style as any);
                        toast.success(`Thème "${theme.label}" appliqué !`);
                      }}
                      className="group flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-border/50 hover:border-primary/30 hover:shadow-md transition-all"
                    >
                      <div className="w-full h-8 rounded-lg shadow-sm group-hover:scale-105 transition-transform" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }} />
                      <span className="text-[10px] font-semibold">{theme.emoji} {theme.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              {/* Colors */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Fond</Label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={form.primary_color} onChange={(e) => update("primary_color", e.target.value)} className="w-8 h-8 rounded-lg border cursor-pointer" />
                    <Input value={form.primary_color} onChange={(e) => update("primary_color", e.target.value)} className="rounded-xl text-[11px]" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Texte</Label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={form.foreground_color || "#ffffff"} onChange={(e) => update("foreground_color", e.target.value)} className="w-8 h-8 rounded-lg border cursor-pointer" />
                    <Input value={form.foreground_color} onChange={(e) => update("foreground_color", e.target.value)} className="rounded-xl text-[11px]" placeholder="Auto" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Labels</Label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={form.label_color || "#cccccc"} onChange={(e) => update("label_color", e.target.value)} className="w-8 h-8 rounded-lg border cursor-pointer" />
                    <Input value={form.label_color} onChange={(e) => update("label_color", e.target.value)} className="rounded-xl text-[11px]" placeholder="Auto" />
                  </div>
                </div>
              </div>
              {/* Style */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Style</Label>
                  <Select value={form.card_style} onValueChange={(v) => update("card_style", v)}>
                    <SelectTrigger className="rounded-xl text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {cardStyles.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Type de fond</Label>
                  <Select value={form.card_bg_type} onValueChange={(v) => update("card_bg_type", v as any)}>
                    <SelectTrigger className="rounded-xl text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solid">Couleur unie</SelectItem>
                      <SelectItem value="gradient">Dégradé</SelectItem>
                      <SelectItem value="image">Image</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Strip/Banner image upload */}
              {form.card_bg_type === "image" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Image bannière (strip)</Label>
                  {stripImageUrl ? (
                    <div className="relative group">
                      <img src={stripImageUrl} alt="Strip" className="w-full h-20 object-cover rounded-xl border border-border/50" />
                      <button
                        onClick={async () => {
                          setStripImageUrl(null);
                          if (business) {
                            await supabase.from("businesses").update({ card_bg_image_url: null }).eq("id", business.id);
                          }
                        }}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => stripFileRef.current?.click()}
                      className="w-full h-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                    >
                      <span className="text-xs text-muted-foreground">+ Ajouter une image</span>
                    </button>
                  )}
                  <input
                    ref={stripFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !business) return;
                      if (file.size > 2 * 1024 * 1024) { toast.error("Max 2 Mo"); return; }
                      const ext = file.name.split(".").pop();
                      const path = `${business.id}/strip.${ext}`;
                      const { error } = await supabase.storage.from("business-logos").upload(path, file, { upsert: true });
                      if (error) { toast.error("Erreur upload"); return; }
                      const { data: { publicUrl } } = supabase.storage.from("business-logos").getPublicUrl(path);
                      const url = `${publicUrl}?t=${Date.now()}`;
                      setStripImageUrl(url);
                      await supabase.from("businesses").update({ card_bg_image_url: url }).eq("id", business.id);
                      toast.success("Image bannière mise à jour !");
                    }}
                  />
                  <p className="text-[10px] text-muted-foreground">Idéal : 640×200px · PNG/JPG · max 2 Mo</p>
                </div>
              )}
            </TabsContent>

            {/* ── VISIBLE FIELDS ── */}
            <TabsContent value="fields" className="rounded-2xl bg-card border border-border/50 p-5 space-y-2.5">
              {[
                { key: "show_customer_name" as const, label: "Nom du client" },
                { key: "show_qr_code" as const, label: "QR Code" },
                { key: "show_points" as const, label: "Points / Tampons" },
                { key: "show_expiration" as const, label: "Date d'expiration" },
                { key: "show_rewards_preview" as const, label: "Récompense" },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between py-1">
                  <span className="text-sm">{item.label}</span>
                  <Switch checked={form[item.key]} onCheckedChange={(v) => update(item.key, v)} />
                </div>
              ))}
            </TabsContent>

            {/* ── REWARDS ── */}
            <TabsContent value="rewards" className="rounded-2xl bg-card border border-border/50 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">Relance des inactifs</p>
                  <p className="text-xs text-muted-foreground">Notification push après X jours</p>
                </div>
                <Switch checked={form.auto_reminder_enabled} onCheckedChange={(v) => update("auto_reminder_enabled", v)} />
              </div>
              {form.auto_reminder_enabled && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Jours d'inactivité</Label>
                  <Input type="number" value={form.auto_reminder_days} onChange={(e) => update("auto_reminder_days", parseInt(e.target.value) || 7)} className="rounded-xl text-sm" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Seuil d'alerte récompense</Label>
                <Input type="number" value={form.reward_alert_threshold} onChange={(e) => update("reward_alert_threshold", parseInt(e.target.value) || 2)} className="rounded-xl text-sm" />
                <p className="text-[11px] text-muted-foreground">Rappel quand le client est à {form.reward_alert_threshold} points de sa récompense</p>
              </div>
            </TabsContent>

            {/* ── MORE: QR, Template, Modules ── */}
            <TabsContent value="more" className="space-y-4">
              {/* QR Code */}
              <div className="rounded-2xl bg-card border border-border/50 p-5">
                <h3 className="font-display font-semibold text-sm mb-4 flex items-center gap-2"><LinkIcon className="w-4 h-4 text-primary" /> QR Code & Vitrine</h3>
                <div className="flex flex-col items-center space-y-4">
                  <div
                    id="qr-printable"
                    className="relative p-6 rounded-2xl flex flex-col items-center gap-3"
                    style={{
                      background: `linear-gradient(145deg, ${form.primary_color}12 0%, ${form.secondary_color || form.primary_color}08 100%)`,
                      border: `2px solid ${form.primary_color}20`,
                    }}
                  >
                    {logoUrl && <img src={logoUrl} alt={form.name} className="w-10 h-10 rounded-xl object-cover" />}
                    <div className="p-3 bg-background rounded-xl shadow-sm">
                      <QRCodeSVG id="business-qr-svg" value={publicUrl} size={160} level="H" includeMargin={false} fgColor={form.primary_color || "#6B46C1"} />
                    </div>
                    <div className="text-center">
                      <p className="font-display font-bold text-sm">{form.name || "Mon Commerce"}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Scannez pour votre carte de fidélité</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <Button onClick={downloadQR} variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs">
                      <Download className="w-3.5 h-3.5" /> PNG
                    </Button>
                    <Button onClick={copyLink} variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs">
                      <Copy className="w-3.5 h-3.5" /> Lien
                    </Button>
                    <Button
                      onClick={() => {
                        const printContent = document.getElementById("qr-printable");
                        if (!printContent) return;
                        const w = window.open("", "_blank");
                        if (!w) return;
                        w.document.write(`<!DOCTYPE html><html><head><title>QR Code - ${form.name}</title><style>body{display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:system-ui,sans-serif;}</style></head><body>${printContent.outerHTML}</body></html>`);
                        w.document.close();
                        w.focus();
                        w.print();
                      }}
                      variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs"
                    >
                      <Printer className="w-3.5 h-3.5" /> Imprimer
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 w-full">
                    <code className="text-[11px] bg-secondary px-3 py-2 rounded-xl flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{publicUrl}</code>
                    <Button size="icon" variant="outline" className="rounded-xl h-8 w-8 shrink-0" onClick={copyLink}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="outline" className="rounded-xl h-8 w-8 shrink-0" onClick={() => window.open(publicUrl, "_blank")}>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Template */}
              <div className="rounded-2xl bg-card border border-border/50 p-5">
                <h3 className="font-display font-semibold text-sm mb-4 flex items-center gap-2"><Layout className="w-4 h-4 text-primary" /> Template métier</h3>
                <TemplatePicker currentTemplate={form.business_template} onSelect={handleTemplateSelect} />
              </div>

              {/* Modules */}
              <div className="rounded-2xl bg-card border border-border/50 p-5">
                <h3 className="font-display font-semibold text-sm mb-4 flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> Modules</h3>
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
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* ─── RIGHT: Sticky device preview ─── */}
        <div className="lg:sticky lg:top-20 self-start space-y-4">
          <div className="p-4 rounded-2xl bg-card border border-border/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="font-display font-semibold text-sm">Aperçu réel</h2>
                <Badge variant="outline" className="text-[9px] text-emerald-600 border-emerald-300">1:1</Badge>
              </div>
              <div className="flex rounded-lg bg-secondary/60 p-0.5">
                <button
                  onClick={() => setPreviewDevice("iphone")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    previewDevice === "iphone" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  🍎 iPhone
                </button>
                <button
                  onClick={() => setPreviewDevice("samsung")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    previewDevice === "samsung" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  🤖 Samsung
                </button>
              </div>
            </div>
            <div className="flex justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={previewDevice}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25 }}
                >
                  {previewDevice === "iphone" ? (
                    <IPhoneMockup width={previewWidth + 20}>
                      {walletPassElement}
                    </IPhoneMockup>
                  ) : (
                    <SamsungMockup width={previewWidth + 20}>
                      {walletPassElement}
                    </SamsungMockup>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
            <p className="text-center text-[10px] text-muted-foreground mt-3">
              ✅ Rendu identique au {previewDevice === "iphone" ? "Apple" : "Google"} Wallet réel
            </p>
          </div>

          {/* PassKit field reference */}
          <div className="p-3 rounded-xl bg-secondary/30 border border-border/30">
            <p className="text-[10px] font-semibold text-muted-foreground mb-1">📋 Structure PassKit</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
              <span>headerFields →</span><span>{form.loyalty_type === "stamps" ? "Tampons" : form.loyalty_type === "cashback" ? "Cagnotte" : "Points"}</span>
              <span>primaryFields →</span><span>Nom du client</span>
              <span>secondaryFields →</span><span>Progression / Récompense</span>
              <span>auxiliaryFields →</span><span>Niveau / Expiration</span>
              <span>barcode →</span><span>QR Code client</span>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CustomizePage;
