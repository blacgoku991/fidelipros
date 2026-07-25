-- Un audit qui n'a pas pu observer le site ne conclut rien : on le trace explicitement
-- pour ne jamais présenter ses notes comme un résultat ni en tirer un devis.

ALTER TABLE public.prospect_audits
  ADD COLUMN IF NOT EXISTS concluant boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS accessibilite text NOT NULL DEFAULT 'ok';

ALTER TABLE public.prospect_audits
  DROP CONSTRAINT IF EXISTS prospect_audits_accessibilite_check;
ALTER TABLE public.prospect_audits
  ADD CONSTRAINT prospect_audits_accessibilite_check
  CHECK (accessibilite IN ('ok', 'erreur_serveur', 'bloque', 'injoignable'));

COMMENT ON COLUMN public.prospect_audits.concluant IS
  'Faux quand le site n''a pas pu être observé (pare-feu applicatif, blocage réseau) : les notes ne mesurent rien et aucune proposition n''est générée.';
COMMENT ON COLUMN public.prospect_audits.accessibilite IS
  'ok = page analysée · erreur_serveur = le site répond en erreur · bloque = site non observable · injoignable = domaine qui ne résout pas.';
