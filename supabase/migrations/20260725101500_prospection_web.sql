-- Module de prospection : entreprises à démarcher pour la création ou la refonte d'un site web.
-- Données issues de l'open data Sirene (API Recherche d'entreprises) + audit technique du site.
-- Accès strictement réservé aux super admins.

CREATE TABLE IF NOT EXISTS public.prospection_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lance_par uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  filtres jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_disponible integer NOT NULL DEFAULT 0,
  nb_resultats integer NOT NULL DEFAULT 0,
  nb_nouveaux integer NOT NULL DEFAULT 0,
  nb_sites_audites integer NOT NULL DEFAULT 0,
  duree_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identité (open data Sirene)
  siren text NOT NULL UNIQUE,
  siret_siege text,
  nom text NOT NULL,
  enseigne text,
  activite_code text,
  activite_section text,
  nature_juridique text,
  categorie_entreprise text,
  date_creation date,
  tranche_effectif text,
  effectif_estime integer,
  chiffre_affaires numeric,
  annee_finances integer,

  -- Localisation
  adresse text,
  code_postal text,
  ville text,
  departement text,
  latitude double precision,
  longitude double precision,
  dirigeant text,

  -- Site web audité
  site_web text,
  site_statut text NOT NULL DEFAULT 'non_verifie'
    CHECK (site_statut IN ('non_verifie','aucun_site','site_injoignable','site_obsolete','site_a_rafraichir','site_recent')),
  site_score integer CHECK (site_score IS NULL OR site_score BETWEEN 0 AND 100),
  site_signaux jsonb NOT NULL DEFAULT '[]'::jsonb,
  site_verifie_le timestamptz,
  email_contact text,
  telephone text,

  -- Qualification
  budget_score integer NOT NULL DEFAULT 0 CHECK (budget_score BETWEEN 0 AND 100),
  score integer NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  priorite text NOT NULL DEFAULT 'froid' CHECK (priorite IN ('chaud','tiede','froid')),

  -- Suivi commercial (jamais écrasé par un nouveau run)
  statut text NOT NULL DEFAULT 'nouveau'
    CHECK (statut IN ('nouveau','a_contacter','contacte','rdv','gagne','perdu','ignore')),
  notes text,

  source text NOT NULL DEFAULT 'recherche-entreprises',
  run_id uuid REFERENCES public.prospection_runs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospects_score ON public.prospects (score DESC);
CREATE INDEX IF NOT EXISTS idx_prospects_statut ON public.prospects (statut);
CREATE INDEX IF NOT EXISTS idx_prospects_site_statut ON public.prospects (site_statut);
CREATE INDEX IF NOT EXISTS idx_prospects_departement ON public.prospects (departement);
CREATE INDEX IF NOT EXISTS idx_prospects_date_creation ON public.prospects (date_creation DESC);
CREATE INDEX IF NOT EXISTS idx_prospection_runs_created_at ON public.prospection_runs (created_at DESC);

DROP TRIGGER IF EXISTS trg_prospects_updated_at ON public.prospects;
CREATE TRIGGER trg_prospects_updated_at
BEFORE UPDATE ON public.prospects
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ── RLS : super admins uniquement ───────────────────────────────────────────
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospection_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can manage prospects" ON public.prospects;
CREATE POLICY "Super admins can manage prospects" ON public.prospects
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Super admins can manage prospection runs" ON public.prospection_runs;
CREATE POLICY "Super admins can manage prospection runs" ON public.prospection_runs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

COMMENT ON TABLE public.prospects IS
  'Prospects B2B issus de l''open data Sirene, qualifiés pour une création ou une refonte de site web.';
COMMENT ON COLUMN public.prospects.score IS
  'Score global 0-100 : 55 % opportunité liée au site web, 45 % capacité budgétaire estimée.';
