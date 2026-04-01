import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Smartphone, Send, CheckCircle, XCircle, RefreshCw,
  Plus, Megaphone, Zap, Clock, BellRing, AlertTriangle,
  Shield, Activity, Info,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface WalletDebugPanelProps {
  businessId: string;
}

export const WalletDebugPanel = ({ businessId }: WalletDebugPanelProps) => {
  const [stats, setStats] = useState({
    registrations: 0,
    uniqueDevices: 0,
    uniquePasses: 0,
    lastRegistration: null as string | null,
    lastFetch: null as string | null,
    lastPush: null as string | null,
    lastUpdatedTag: null as string | null,
    recentLogs: [] as any[],
    registrationRows: [] as any[],
    passUpdateRows: [] as any[],
  });
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [webserviceStatus, setWebserviceStatus] = useState<any>(null);

  useEffect(() => {
    fetchStats();
  }, [businessId]);

  const fetchStats = async () => {
    setLoading(true);
    const [regsRes, logsRes, cardsRes, passUpdatesRes] = await Promise.all([
      supabase
        .from("wallet_registrations")
        .select("*")
        .eq("business_id", businessId),
      supabase
        .from("wallet_apns_logs")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("customer_cards")
        .select("wallet_installed_at, wallet_last_fetched_at, wallet_change_message, current_points, max_points, id, card_code")
        .eq("business_id", businessId)
        .not("wallet_installed_at", "is", null)
        .order("wallet_last_fetched_at", { ascending: false })
        .limit(5),
      supabase
        .from("wallet_pass_updates")
        .select("*")
        .order("last_updated", { ascending: false })
        .limit(10),
    ]);

    const regs = regsRes.data || [];
    const logs = logsRes.data || [];
    const uniqueDevices = new Set(regs.map((r) => r.device_library_id)).size;
    const uniquePasses = new Set(regs.map((r) => r.serial_number)).size;
    const lastReg = regs.length > 0
      ? regs.reduce((a, b) => (a.created_at > b.created_at ? a : b)).created_at
      : null;
    const lastPush = logs.length > 0 ? logs[0].created_at : null;
    const lastFetch = cardsRes.data?.[0]?.wallet_last_fetched_at || null;
    const lastUpdatedTag = regs.length > 0
      ? regs.reduce((a, b) => (a.updated_at > b.updated_at ? a : b)).updated_at
      : null;

    setStats({
      registrations: regs.length,
      uniqueDevices,
      uniquePasses,
      lastRegistration: lastReg,
      lastFetch,
      lastPush,
      lastUpdatedTag,
      recentLogs: logs,
      registrationRows: regs,
      passUpdateRows: passUpdatesRes.data || [],
    });
    setLoading(false);
  };

  const pingWebservice = async () => {
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/wallet-webservice/ping`
      );
      const data = await res.json();
      setWebserviceStatus(data);
      toast.success("Webservice ping OK");
    } catch (err: any) {
      setWebserviceStatus({ error: String(err) });
      toast.error("Webservice ping failed");
    }
  };

  const callWalletPush = async (actionType: string, message: string) => {
    setActiveAction(actionType);
    setLastResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/wallet-push`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            business_id: businessId,
            action_type: actionType,
            change_message: message,
            test_mode: false,
          }),
        }
      );
      const result = await res.json();
      setLastResult(result);

      if (result.success) {
        if (actionType === "send_test_notification" && result.test_notification_log) {
          const t = result.test_notification_log;
          toast.success(`✅ Test notif: DB ${t.db_update_status}, APNs ${t.apns_http_status}, token …${t.device_token_last8}`);
        } else {
          toast.success(
            `✅ ${actionType}: ${result.pushed} push réussi(s), ${result.failed} échoué(s) sur ${result.unique_devices} appareil(s)`
          );
        }
      } else {
        toast.error(result.error || "Échec de l'envoi");
      }
      fetchStats();
    } catch (err: any) {
      toast.error("Erreur: " + String(err));
    }
    setActiveAction(null);
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  };

  const noDevices = stats.registrations === 0;

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-primary" />
          <h3 className="font-display font-semibold text-lg">Apple Wallet — Audit Complet</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchStats} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Real device warning */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-xs">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-amber-800 dark:text-amber-300">
          <strong>Les mises à jour Apple Wallet et les changeMessage doivent être testés sur un vrai iPhone, pas un simulateur.</strong>
          {" "}Le simulateur iOS ne supporte pas les notifications push APNs ni les mises à jour de pass en temps réel.
        </p>
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-muted/50 text-center">
          <p className="text-2xl font-display font-bold">{stats.registrations}</p>
          <p className="text-xs text-muted-foreground">Enregistrements</p>
        </div>
        <div className="p-3 rounded-xl bg-muted/50 text-center">
          <p className="text-2xl font-display font-bold">{stats.uniqueDevices}</p>
          <p className="text-xs text-muted-foreground">Appareils</p>
        </div>
        <div className="p-3 rounded-xl bg-muted/50 text-center">
          <p className="text-2xl font-display font-bold">{stats.uniquePasses}</p>
          <p className="text-xs text-muted-foreground">Passes actifs</p>
        </div>
      </div>

      {/* Timestamps */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="w-3 h-3 flex-shrink-0" />
          <div>
            <p className="font-medium">Dernière inscription</p>
            <p>{formatTime(stats.lastRegistration)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="w-3 h-3 flex-shrink-0" />
          <div>
            <p className="font-medium">Dernier fetch .pkpass</p>
            <p>{formatTime(stats.lastFetch)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="w-3 h-3 flex-shrink-0" />
          <div>
            <p className="font-medium">Dernier push APNs</p>
            <p>{formatTime(stats.lastPush)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="w-3 h-3 flex-shrink-0" />
          <div>
            <p className="font-medium">lastUpdated tag</p>
            <p>{formatTime(stats.lastUpdatedTag)}</p>
          </div>
        </div>
      </div>

      {/* Test buttons */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Actions de test</p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => callWalletPush("send_test_notification", "🎁 1 offre ajoutée aujourd'hui")}
            disabled={!!activeAction || noDevices}
            variant="outline"
            className="rounded-xl gap-2 text-xs h-10"
          >
            <BellRing className="w-3.5 h-3.5" />
            {activeAction === "send_test_notification" ? "Envoi..." : "Test notification"}
          </Button>
          <Button
            onClick={() => callWalletPush("points_increment", "☕ +1 point ajouté !")}
            disabled={!!activeAction || noDevices}
            variant="outline"
            className="rounded-xl gap-2 text-xs h-10"
          >
            <Plus className="w-3.5 h-3.5" />
            {activeAction === "points_increment" ? "Envoi..." : "+1 Point (test)"}
          </Button>
          <Button
            onClick={() => callWalletPush("full_test", "🎁 Test complet Wallet")}
            disabled={!!activeAction || noDevices}
            className="rounded-xl gap-2 text-xs h-10 col-span-2 bg-gradient-primary text-primary-foreground"
          >
            <Zap className="w-3.5 h-3.5" />
            {activeAction === "full_test" ? "Envoi..." : "⚡ Tester une mise à jour Wallet complète"}
          </Button>
        </div>
      </div>

      {noDevices && (
        <p className="text-xs text-muted-foreground text-center">
          Aucun appareil enregistré. Installez d'abord une carte dans Apple Wallet sur un vrai iPhone.
        </p>
      )}

      {/* Webservice ping */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={pingWebservice} className="rounded-xl text-xs gap-2">
          <Activity className="w-3.5 h-3.5" />
          Ping Webservice
        </Button>
        {webserviceStatus && (
          <Badge variant={webserviceStatus.alive ? "default" : "destructive"} className="text-[10px]">
            {webserviceStatus.alive ? "✓ Alive" : "✗ Error"}
          </Badge>
        )}
      </div>

      <Accordion type="multiple" className="space-y-1">
        {/* Last result details */}
        {lastResult && (
          <AccordionItem value="last-result" className="border rounded-xl px-3">
            <AccordionTrigger className="text-xs font-medium py-2">
              <span className="flex items-center gap-2">
                <Info className="w-3.5 h-3.5" />
                Dernier résultat — {lastResult.action_type}
              </span>
            </AccordionTrigger>
            <AccordionContent className="text-xs space-y-2 pb-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <span className="text-muted-foreground">Action</span>
                <span className="font-mono">{lastResult.action_type}</span>
                <span className="text-muted-foreground">Push réussis</span>
                <span className="font-mono text-primary">{lastResult.pushed}</span>
                <span className="text-muted-foreground">Push échoués</span>
                <span className="font-mono text-destructive">{lastResult.failed}</span>
                <span className="text-muted-foreground">Appareils uniques</span>
                <span className="font-mono">{lastResult.unique_devices}</span>
                <span className="text-muted-foreground">Passes uniques</span>
                <span className="font-mono">{lastResult.unique_passes}</span>
              </div>

              {/* changeMessage validation */}
              {lastResult.card_updates?.map((cu: any, i: number) => (
                <div key={i} className="p-2 rounded-lg bg-muted/40 space-y-1">
                  <p className="font-mono truncate">{cu.serial_number?.slice(0, 12)}...</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
                    <span className="text-muted-foreground">Valeur changée ?</span>
                    <Badge variant={cu.field_value_changed ? "default" : "destructive"} className="text-[10px] w-fit">
                      {cu.field_value_changed ? "✓ Oui" : "✗ Non — pas de notif"}
                    </Badge>
                    <span className="text-muted-foreground">Points avant</span>
                    <span className="font-mono">{cu.old_points}</span>
                    <span className="text-muted-foreground">Points après</span>
                    <span className="font-mono">{cu.new_points}</span>
                    <span className="text-muted-foreground">Ancien message</span>
                    <span className="font-mono truncate">{cu.old_change_message || "—"}</span>
                    <span className="text-muted-foreground">Nouveau message</span>
                    <span className="font-mono truncate">{cu.new_change_message}</span>
                    <span className="text-muted-foreground">changeMessage (points)</span>
                    <span className="font-mono text-[10px]">{cu.changeMessage_on_points}</span>
                    <span className="text-muted-foreground">changeMessage (offer)</span>
                    <span className="font-mono text-[10px]">{cu.changeMessage_on_offer}</span>
                  </div>
                  <Badge variant={cu.updated ? "default" : "destructive"} className="text-[10px] mt-1">
                    {cu.updated ? "✅ card updated" : `❌ ${cu.error}`}
                  </Badge>
                </div>
              ))}

              {lastResult.test_notification_log && (
                <div className="p-2 rounded-lg bg-muted/40 space-y-1">
                  <p className="font-medium text-[11px]">Test notification log</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                    <span className="text-muted-foreground">DB update</span>
                    <span className="font-mono">{lastResult.test_notification_log.db_update_status}</span>
                    <span className="text-muted-foreground">APNs HTTP</span>
                    <span className="font-mono">{lastResult.test_notification_log.apns_http_status ?? "—"}</span>
                    <span className="text-muted-foreground">Token (last 8)</span>
                    <span className="font-mono">{lastResult.test_notification_log.device_token_last8 ?? "—"}</span>
                  </div>
                </div>
              )}

              {/* APNs results */}
              {lastResult.apns_results?.length > 0 && (
                <div className="space-y-1">
                  <p className="font-medium text-[11px]">Détails APNs</p>
                  {lastResult.apns_results.map((r: any, i: number) => (
                    <div key={i} className="p-2 rounded bg-muted/30 flex items-center justify-between">
                      <span className="font-mono text-[10px]">...{r.token_suffix}</span>
                      <Badge variant={r.success ? "default" : "destructive"} className="text-[10px]">
                        {r.success ? `✓ ${r.status}` : `✗ ${r.status} ${r.reason || ""}`}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Registration details */}
        <AccordionItem value="registrations" className="border rounded-xl px-3">
          <AccordionTrigger className="text-xs font-medium py-2">
            <span className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5" />
              Enregistrements ({stats.registrations})
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-xs space-y-1 pb-3">
            {stats.registrationRows.length === 0 ? (
              <p className="text-muted-foreground">Aucun enregistrement. L'iPhone doit installer le pass dans Wallet.</p>
            ) : (
              stats.registrationRows.map((r: any) => (
                <div key={r.id} className="p-2 rounded-lg bg-muted/30 space-y-0.5">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-[10px] truncate max-w-[160px]">serial: {r.serial_number?.slice(0, 12)}...</span>
                    <span className="text-muted-foreground text-[10px]">{formatTime(r.created_at)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 text-[10px]">
                    <span className="text-muted-foreground">device</span>
                    <span className="font-mono truncate">{r.device_library_id?.slice(0, 12)}...</span>
                    <span className="text-muted-foreground">push token</span>
                    <span className="font-mono">...{r.push_token?.slice(-8)}</span>
                    <span className="text-muted-foreground">pass type</span>
                    <span className="font-mono truncate">{r.pass_type_id}</span>
                    <span className="text-muted-foreground">updated_at</span>
                    <span className="font-mono">{formatTime(r.updated_at)}</span>
                  </div>
                </div>
              ))
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Pass updates */}
        <AccordionItem value="pass-updates" className="border rounded-xl px-3">
          <AccordionTrigger className="text-xs font-medium py-2">
            <span className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" />
              wallet_pass_updates ({stats.passUpdateRows.length})
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-xs space-y-1 pb-3">
            {stats.passUpdateRows.map((u: any) => (
              <div key={u.id} className="p-2 rounded-lg bg-muted/30 flex justify-between items-center">
                <div>
                  <span className="font-mono text-[10px]">{u.serial_number?.slice(0, 12)}...</span>
                  <p className="text-muted-foreground text-[10px] truncate max-w-[200px]">{u.change_message || "—"}</p>
                </div>
                <span className="text-[10px] text-muted-foreground">{formatTime(u.last_updated)}</span>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>

        {/* APNs Logs */}
        {stats.recentLogs.length > 0 && (
          <AccordionItem value="apns-logs" className="border rounded-xl px-3">
            <AccordionTrigger className="text-xs font-medium py-2">
              <span className="flex items-center gap-2">
                <Send className="w-3.5 h-3.5" />
                Logs APNs ({stats.recentLogs.length})
              </span>
            </AccordionTrigger>
            <AccordionContent className="text-xs space-y-1 pb-3">
              {stats.recentLogs.map((log, i) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                >
                  <div className="flex items-center gap-2">
                    {log.status === "sent" ? (
                      <CheckCircle className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-destructive" />
                    )}
                    <div>
                      <span className="font-mono truncate max-w-[100px] block text-[10px]">
                        ...{log.push_token?.slice(-12)}
                      </span>
                      {log.error_message && (
                        <span className="text-destructive text-[10px]">{log.error_message}</span>
                      )}
                      {log.apns_response && (
                        <span className="text-muted-foreground text-[10px] block truncate max-w-[180px]">
                          {log.apns_response}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={log.status === "sent" ? "default" : "destructive"}
                      className="text-[10px] px-1.5"
                    >
                      {log.status}
                    </Badge>
                    <span className="text-muted-foreground text-[10px]">
                      {new Date(log.created_at).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Webservice status */}
        {webserviceStatus && (
          <AccordionItem value="webservice" className="border rounded-xl px-3">
            <AccordionTrigger className="text-xs font-medium py-2">
              <span className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" />
                Webservice Status
              </span>
            </AccordionTrigger>
            <AccordionContent className="text-xs pb-3">
              <pre className="p-2 rounded bg-muted/30 overflow-auto text-[10px] font-mono whitespace-pre-wrap">
                {JSON.stringify(webserviceStatus, null, 2)}
              </pre>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* changeMessage explainer */}
        <AccordionItem value="changeMessage-info" className="border rounded-xl px-3">
          <AccordionTrigger className="text-xs font-medium py-2">
            <span className="flex items-center gap-2">
              <Info className="w-3.5 h-3.5" />
              Comment fonctionne changeMessage ?
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-xs pb-3 space-y-2 text-muted-foreground">
            <p>Pour qu'un <strong>changeMessage</strong> s'affiche sur l'écran de verrouillage :</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Le champ doit avoir un attribut <code className="bg-muted px-1 rounded">changeMessage</code> (ex: <code className="bg-muted px-1 rounded">"Vous avez gagné %@ points !"</code>)</li>
              <li>La <strong>valeur</strong> du champ doit réellement changer entre l'ancien et le nouveau pass</li>
              <li>Le serveur envoie un push APNs silencieux (payload vide <code className="bg-muted px-1 rounded">{"{}"}</code>)</li>
              <li>iOS contacte le webServiceURL pour récupérer les serials mis à jour</li>
              <li>iOS télécharge le nouveau .pkpass et compare champ par champ</li>
              <li>Si une valeur a changé ET que le champ a un changeMessage → notification affichée</li>
            </ol>
            <p className="font-medium text-foreground">Champs avec changeMessage dans ce projet :</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li><code className="bg-muted px-1 rounded">points</code> (headerField) → <code className="bg-muted px-1 rounded">"Vous avez gagné %@ points !"</code></li>
              <li><code className="bg-muted px-1 rounded">offer</code> (secondaryField) → <code className="bg-muted px-1 rounded">"%@"</code> (affiche la valeur brute)</li>
            </ul>
            <p className="text-amber-600 dark:text-amber-400 font-medium">⚠️ Si le push est envoyé mais que la valeur n'a pas changé, iOS ne montrera PAS de notification.</p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};
