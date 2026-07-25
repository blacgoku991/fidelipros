-- Permet d'enregistrer un site audité à la main comme prospect, sans SIREN.
-- PostgreSQL autorise plusieurs NULL dans une contrainte d'unicité : la contrainte UNIQUE sur
-- `siren` reste donc valable pour les prospects issus de Sirene (et `ON CONFLICT (siren)` de
-- l'edge function prospect-companies continue de fonctionner à l'identique).

ALTER TABLE public.prospects ALTER COLUMN siren DROP NOT NULL;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS domaine text;

-- Les prospects manuels se dédoublonnent sur le domaine ; `domaine` reste NULL côté Sirene.
CREATE UNIQUE INDEX IF NOT EXISTS idx_prospects_domaine ON public.prospects (domaine);

COMMENT ON COLUMN public.prospects.domaine IS
  'Domaine du site pour les prospects créés depuis l''écran « Auditer une URL » (source = manuel). NULL pour les prospects issus de l''open data Sirene.';
COMMENT ON COLUMN public.prospects.siren IS
  'NULL pour un site audité à la main, sans entreprise identifiée dans Sirene.';
