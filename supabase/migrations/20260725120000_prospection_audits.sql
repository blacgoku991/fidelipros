-- Audits (SEO, design, sécurité, technique) et propositions commerciales pour les prospects.
-- Complète la migration 20260725101500_prospection_web.sql. Accès super admin uniquement.

-- ── Catalogue de prestations (éditable depuis l'admin) ───────────────────────
CREATE TABLE IF NOT EXISTS public.prestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  libelle text NOT NULL,
  description text,
  prix numeric NOT NULL DEFAULT 0 CHECK (prix >= 0),
  unite text NOT NULL DEFAULT 'forfait' CHECK (unite IN ('forfait', 'mois')),
  categorie text NOT NULL DEFAULT 'creation'
    CHECK (categorie IN ('creation', 'refonte', 'seo', 'securite', 'design', 'maintenance')),
  actif boolean NOT NULL DEFAULT true,
  ordre integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.prestations (code, libelle, description, prix, unite, categorie, ordre) VALUES
  ('site_vitrine', 'Création d''un site vitrine (5 pages)', 'Site responsive sur mesure : accueil, présentation, services, galerie, contact. Nom de domaine et mise en ligne inclus.', 1200, 'forfait', 'creation', 10),
  ('refonte_site', 'Refonte complète du site existant', 'Nouvelle maquette responsive, reprise des contenus, redirections SEO pour conserver le référencement acquis.', 2500, 'forfait', 'refonte', 20),
  ('responsive_mobile', 'Adaptation mobile et tablette', 'Reprise de la mise en page pour un affichage correct sur téléphone, sans refonte complète.', 690, 'forfait', 'design', 30),
  ('accessibilite', 'Mise en accessibilité', 'Correction des contrastes, des tailles de texte et des zones cliquables trop petites.', 390, 'forfait', 'design', 40),
  ('optimisation_perf', 'Optimisation de la vitesse', 'Compression des images, mise en cache, réduction du poids des pages.', 490, 'forfait', 'design', 50),
  ('seo_technique', 'SEO technique', 'Balises title et description, structure des titres, sitemap, données structurées, correction de l''indexation.', 590, 'forfait', 'seo', 60),
  ('redaction_contenu', 'Rédaction de contenu (5 pages)', 'Textes optimisés pour la recherche locale, écrits pour vos clients et pour Google.', 550, 'forfait', 'seo', 70),
  ('seo_local', 'Référencement local', 'Fiche Google Business, cohérence des coordonnées, collecte d''avis, suivi des positions.', 450, 'mois', 'seo', 80),
  ('mise_https', 'Passage en HTTPS', 'Certificat SSL, redirection de l''ancienne adresse, correction du contenu non sécurisé.', 190, 'forfait', 'securite', 90),
  ('securisation_entetes', 'Sécurisation du site', 'En-têtes de sécurité (CSP, HSTS, anti-clickjacking), cookies conformes, masquage des versions logicielles.', 390, 'forfait', 'securite', 100),
  ('correctif_dns_email', 'Protection de vos emails', 'Configuration SPF, DKIM et DMARC pour empêcher l''usurpation de votre adresse professionnelle.', 290, 'forfait', 'securite', 110),
  ('mise_a_jour_cms', 'Mise à jour et nettoyage du CMS', 'Montée de version, suppression des fichiers exposés, sauvegardes automatiques.', 450, 'forfait', 'securite', 120),
  ('maintenance', 'Maintenance et surveillance', 'Mises à jour, sauvegardes, surveillance de disponibilité, petites modifications incluses.', 79, 'mois', 'maintenance', 130),
  ('hebergement', 'Hébergement et nom de domaine', 'Hébergement en France, certificat SSL, boîte email professionnelle.', 15, 'mois', 'maintenance', 140)
ON CONFLICT (code) DO NOTHING;

DROP TRIGGER IF EXISTS trg_prestations_updated_at ON public.prestations;
CREATE TRIGGER trg_prestations_updated_at
BEFORE UPDATE ON public.prestations
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ── Audits ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.prospect_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid REFERENCES public.prospects(id) ON DELETE CASCADE,
  siren text,
  url text NOT NULL,
  profondeur text NOT NULL DEFAULT 'complet' CHECK (profondeur IN ('rapide', 'complet')),

  score_global integer NOT NULL DEFAULT 0 CHECK (score_global BETWEEN 0 AND 100),
  score_seo integer NOT NULL DEFAULT 0 CHECK (score_seo BETWEEN 0 AND 100),
  score_design integer NOT NULL DEFAULT 0 CHECK (score_design BETWEEN 0 AND 100),
  score_securite integer NOT NULL DEFAULT 0 CHECK (score_securite BETWEEN 0 AND 100),
  score_technique integer NOT NULL DEFAULT 0 CHECK (score_technique BETWEEN 0 AND 100),
  urgence text NOT NULL DEFAULT 'moyenne' CHECK (urgence IN ('critique', 'elevee', 'moyenne', 'faible')),

  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  lighthouse jsonb,
  fichiers_exposes jsonb NOT NULL DEFAULT '[]'::jsonb,
  capture_path text,
  erreurs jsonb NOT NULL DEFAULT '[]'::jsonb,
  duree_ms integer,
  cree_par uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospect_audits_prospect ON public.prospect_audits (prospect_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prospect_audits_created_at ON public.prospect_audits (created_at DESC);

-- ── Documents commerciaux générés ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.prospect_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  audit_id uuid REFERENCES public.prospect_audits(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('rapport', 'devis', 'email', 'sms', 'script_appel')),
  titre text,
  contenu_md text,
  contenu_html text,
  lignes jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_ht numeric,
  total_ttc numeric,
  mensuel_ht numeric,
  taux_tva numeric,
  valide_jusqu_au date,
  genere_par_ia boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prospect_id, type)
);

CREATE INDEX IF NOT EXISTS idx_prospect_documents_prospect ON public.prospect_documents (prospect_id);

DROP TRIGGER IF EXISTS trg_prospect_documents_updated_at ON public.prospect_documents;
CREATE TRIGGER trg_prospect_documents_updated_at
BEFORE UPDATE ON public.prospect_documents
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ── Scores d'audit reportés sur la fiche prospect ───────────────────────────
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS dernier_audit_id uuid REFERENCES public.prospect_audits(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS score_seo integer,
  ADD COLUMN IF NOT EXISTS score_design integer,
  ADD COLUMN IF NOT EXISTS score_securite integer,
  ADD COLUMN IF NOT EXISTS score_technique integer,
  ADD COLUMN IF NOT EXISTS score_audit integer,
  ADD COLUMN IF NOT EXISTS audit_le timestamptz;

-- ── RLS : super admins uniquement ───────────────────────────────────────────
ALTER TABLE public.prestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can manage prestations" ON public.prestations;
CREATE POLICY "Super admins can manage prestations" ON public.prestations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Super admins can manage prospect audits" ON public.prospect_audits;
CREATE POLICY "Super admins can manage prospect audits" ON public.prospect_audits
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Super admins can manage prospect documents" ON public.prospect_documents;
CREATE POLICY "Super admins can manage prospect documents" ON public.prospect_documents
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- ── Stockage des captures d'écran (bucket privé) ────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('prospect-audits', 'prospect-audits', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Super admins can read audit captures" ON storage.objects;
CREATE POLICY "Super admins can read audit captures" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'prospect-audits' AND has_role(auth.uid(), 'super_admin'::app_role));

-- ── Identité utilisée sur les devis ─────────────────────────────────────────
INSERT INTO public.site_settings (key, value) VALUES
  ('devis_raison_sociale', 'FideliPro'),
  ('devis_siret', ''),
  ('devis_adresse', ''),
  ('devis_email', 'contact@fidelipro.com'),
  ('devis_telephone', ''),
  ('devis_taux_tva', '20'),
  ('devis_validite_jours', '30'),
  ('devis_mentions', 'Devis gratuit et sans engagement. Acompte de 30 % à la commande, solde à la livraison. TVA non applicable si le régime de l''émetteur le prévoit.')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.prospect_audits IS
  'Audits SEO / design / sécurité / technique du site d''un prospect, base des arguments commerciaux.';
COMMENT ON TABLE public.prospect_documents IS
  'Livrables générés pour démarcher un prospect : rapport d''audit, devis, email, SMS, script d''appel.';
