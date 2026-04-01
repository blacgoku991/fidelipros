import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Trash2, Copy, ExternalLink, Plus, X, Wand2, Loader2, BarChart3, Users, CheckCircle, CreditCard, Rocket } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BUSINESS_TYPES = [
  { value: "restaurant", label: "Restaurant", emoji: "🍽️", color: "#DC2626" },
  { value: "coffee", label: "Coffee Shop", emoji: "☕", color: "#78350F" },
  { value: "beauty", label: "Salon de beauté", emoji: "💅", color: "#BE185D" },
  { value: "barber", label: "Barbier", emoji: "💈", color: "#1E293B" },
  { value: "bakery", label: "Boulangerie", emoji: "🥖", color: "#92400E" },
  { value: "retail", label: "Commerce", emoji: "🛍️", color: "#059669" },
];

const SAMPLE_REWARDS = {
  restaurant: ["Dessert offert", "Boisson offerte", "Repas offert"],
  coffee: ["Café offert", "Pâtisserie offerte", "Formule petit-déj offerte"],
  beauty: ["Soin offert", "Produit offert", "Massage 30min offert"],
  barber: ["Coupe offerte", "Barbe offerte", "Soin cheveux offert"],
  bakery: ["Baguette offerte", "Viennoiserie offerte", "Gâteau offert"],
  retail: ["10% de réduction", "Article offert", "Bon de 20€"],
};

export default function AdminDemoGenerator() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState("restaurant");
  const [color, setColor] = useState("#DC2626");
  const [rewards, setRewards] = useState<string[]>(["Dessert offert"]);
  const [generating, setGenerating] = useState(false);

  const { data: demos = [], isLoading } = useQuery({
    queryKey: ["admin-demos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("businesses")
        .select("id, name, slug, primary_color, category, created_at, logo_url")
        .eq("is_demo", true)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Fetch demo session stats
  const { data: sessionStats = {} } = useQuery({
    queryKey: ["admin-demo-sessions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("demo_sessions")
        .select("*")
        .order("created_at", { ascending: false });
      if (!data) return {};

      const stats: Record<string, {
        total: number;
        installed: number;
        demoStarted: number;
        completed: number;
        clickedSignup: number;
        clickedPricing: number;
        converted: number;
      }> = {};

      for (const s of data) {
        const bid = s.business_id;
        if (!stats[bid]) stats[bid] = { total: 0, installed: 0, demoStarted: 0, completed: 0, clickedSignup: 0, clickedPricing: 0, converted: 0 };
        stats[bid].total++;
        if (s.pass_installed) stats[bid].installed++;
        if (s.demo_started) stats[bid].demoStarted++;
        if (s.current_step >= 3) stats[bid].completed++;
        if (s.clicked_signup) stats[bid].clickedSignup++;
        if (s.clicked_pricing) stats[bid].clickedPricing++;
        if (s.converted) stats[bid].converted++;
      }
      return stats;
    },
  });

  const handleTypeChange = (val: string) => {
    setType(val);
    const found = BUSINESS_TYPES.find((b) => b.value === val);
    if (found) setColor(found.color);
    const sample = SAMPLE_REWARDS[val as keyof typeof SAMPLE_REWARDS];
    if (sample) setRewards([sample[0]]);
  };

  const addReward = () => {
    if (rewards.length >= 3) return;
    const sample = SAMPLE_REWARDS[type as keyof typeof SAMPLE_REWARDS] ?? [];
    const next = sample.find((r) => !rewards.includes(r)) ?? "Récompense bonus";
    setRewards([...rewards, next]);
  };

  const generateDemo = async () => {
    if (!name.trim()) {
      toast({ title: "Nom requis", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const slug = `demo-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36)}`;
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Non authentifié");

      const { data: biz, error: bizErr } = await supabase
        .from("businesses")
        .insert({
          name,
          owner_id: user.user.id,
          slug,
          primary_color: color,
          secondary_color: color + "80",
          category: type,
          business_template: type,
          loyalty_type: "stamps",
          max_points_per_card: 10,
          points_per_visit: 1,
          reward_description: rewards[0] ?? "Récompense offerte !",
          is_demo: true,
          subscription_status: "active",
          subscription_plan: "pro",
          onboarding_completed: true,
        })
        .select("id")
        .single();

      if (bizErr) throw bizErr;

      for (let i = 0; i < rewards.length; i++) {
        await supabase.from("rewards").insert({
          business_id: biz.id,
          title: rewards[i],
          description: `Récompense de démonstration`,
          points_required: (i + 1) * 5,
          is_active: true,
        });
      }

      const { data: cust } = await supabase
        .from("customers")
        .insert({
          business_id: biz.id,
          full_name: "Marie Dupont",
          email: "demo@fidelispro.app",
          phone: "+33 6 12 34 56 78",
          total_points: 6,
          total_visits: 6,
          level: "silver",
        })
        .select("id")
        .single();

      if (cust) {
        await supabase.from("customer_cards").insert({
          business_id: biz.id,
          customer_id: cust.id,
          current_points: 6,
          max_points: 10,
          is_active: true,
        });
      }

      toast({ title: "Démo créée !", description: `Lien : /demo/${slug}` });
      queryClient.invalidateQueries({ queryKey: ["admin-demos"] });
      setName("");
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const deleteDemo = useMutation({
    mutationFn: async (bizId: string) => {
      await supabase.from("demo_sessions").delete().eq("business_id", bizId);
      await supabase.from("rewards").delete().eq("business_id", bizId);
      await supabase.from("customer_cards").delete().eq("business_id", bizId);
      await supabase.from("customers").delete().eq("business_id", bizId);
      await supabase.from("businesses").delete().eq("id", bizId);
    },
    onSuccess: () => {
      toast({ title: "Démo supprimée" });
      queryClient.invalidateQueries({ queryKey: ["admin-demos"] });
      queryClient.invalidateQueries({ queryKey: ["admin-demo-sessions"] });
    },
  });

  const appBase = window.location.origin;

  return (
    <AdminLayout title="Générateur de démos" subtitle="Créer des expériences de démonstration avec funnel de conversion">
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Generator form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              Nouvelle démo
            </CardTitle>
            <CardDescription>Remplissez le formulaire pour générer une démo complète avec funnel de conversion</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nom du commerce</Label>
              <Input placeholder="Ex: Boulangerie Martin" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Type de commerce</Label>
              <Select value={type} onValueChange={handleTypeChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BUSINESS_TYPES.map((bt) => (
                    <SelectItem key={bt.value} value={bt.value}>
                      {bt.emoji} {bt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Couleur de marque</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-14 rounded border cursor-pointer" />
                <Input value={color} onChange={(e) => setColor(e.target.value)} className="flex-1 font-mono" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Récompenses (1-3)</Label>
              {rewards.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={r} onChange={(e) => { const n = [...rewards]; n[i] = e.target.value; setRewards(n); }} />
                  {rewards.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => setRewards(rewards.filter((_, j) => j !== i))}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {rewards.length < 3 && (
                <Button variant="outline" size="sm" onClick={addReward}>
                  <Plus className="h-4 w-4 mr-1" /> Ajouter
                </Button>
              )}
            </div>

            <Button className="w-full" onClick={generateDemo} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />}
              Générer la démo
            </Button>
          </CardContent>
        </Card>

        {/* Existing demos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Démos & Conversions
            </CardTitle>
            <CardDescription>{demos.length} démo(s) créée(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : demos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucune démo créée</p>
            ) : (
              <div className="space-y-4">
                {demos.map((d: any) => {
                  const demoUrl = `${appBase}/demo/${d.slug}`;
                  const stats = (sessionStats as any)[d.id];
                  return (
                    <div key={d.id} className="p-4 rounded-xl border bg-card space-y-3">
                      {/* Header */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.primary_color }} />
                            <span className="font-medium text-sm truncate">{d.name}</span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">/demo/{d.slug}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(demoUrl); toast({ title: "Lien copié !" }); }}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" asChild>
                            <a href={`/demo/${d.slug}`} target="_blank" rel="noopener">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteDemo.mutate(d.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Funnel stats */}
                      {stats && stats.total > 0 && (
                        <div className="grid grid-cols-4 gap-2">
                          <div className="text-center p-2 rounded-lg bg-muted/50">
                            <p className="text-lg font-bold">{stats.total}</p>
                            <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                              <Users className="w-3 h-3" /> Visiteurs
                            </p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-muted/50">
                            <p className="text-lg font-bold">{stats.installed}</p>
                            <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                              <CreditCard className="w-3 h-3" /> Pass ajouté
                            </p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-muted/50">
                            <p className="text-lg font-bold">{stats.completed}</p>
                            <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Démo finie
                            </p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-muted/50">
                            <p className="text-lg font-bold">{stats.clickedSignup + stats.clickedPricing}</p>
                            <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                              <Rocket className="w-3 h-3" /> CTA clics
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Conversion badges */}
                      {stats && stats.total > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {stats.installed > 0 && (
                            <Badge variant="outline" className="text-[10px]">
                              {Math.round((stats.installed / stats.total) * 100)}% install
                            </Badge>
                          )}
                          {stats.completed > 0 && (
                            <Badge variant="outline" className="text-[10px]">
                              {Math.round((stats.completed / stats.total) * 100)}% démo complète
                            </Badge>
                          )}
                          {(stats.clickedSignup + stats.clickedPricing) > 0 && (
                            <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">
                              {Math.round(((stats.clickedSignup + stats.clickedPricing) / stats.total) * 100)}% intéressés
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
