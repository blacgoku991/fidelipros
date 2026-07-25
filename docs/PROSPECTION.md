# Prospection web — trouver des entreprises à équiper d'un site

Module de génération de leads B2B : il repère les entreprises françaises qui ont
**besoin d'un site web** (aucune présence en ligne) ou dont le **site est dépassé**
(non responsive, HTTP, CMS obsolète, contenu abandonné), puis les qualifie selon leur
**capacité budgétaire estimée**.

## Ce qui est livré

| Élément | Chemin |
|---|---|
| Page admin | `/admin/prospection` — `src/pages/admin/AdminProspection.tsx` |
| Edge function | `supabase/functions/prospect-companies/index.ts` |
| Moteur partagé | `supabase/functions/_shared/prospection/` (logique, tests) |
| Script CLI | `scripts/prospect.ts` → `npm run prospect -- --aide` |
| Tables | `public.prospects`, `public.prospection_runs` (migration `20260725101500_prospection_web.sql`) |

Le moteur est **la même source pour les trois surfaces** (UI, edge function, CLI) :
la logique de scoring n'existe qu'une fois et elle est couverte par des tests
(`supabase/functions/_shared/prospection/core.test.ts`).

## Source de données

[API Recherche d'entreprises](https://recherche-entreprises.api.gouv.fr/docs/)
(annuaire-entreprises.data.gouv.fr) : base Sirene en **open data**, sans clé d'API,
limitée à 7 requêtes/seconde. Elle fournit la date de création, l'activité (NAF),
l'effectif, le chiffre d'affaires déclaré, la forme juridique, l'adresse du siège et
les dirigeants — mais **pas le site web** : celui-ci est déduit puis vérifié (voir
« Détection du site »).

> ⚠️ Le domaine `recherche-entreprises.api.gouv.fr` doit être joignable depuis
> l'environnement d'exécution (allowlist réseau côté Supabase ou poste local).

## Utilisation

### Depuis l'admin

`/admin/prospection` (super admin uniquement) :

1. sélectionner un ou plusieurs **secteurs**, un **département** ou un **code postal** ;
2. régler l'**ancienneté** (entreprises récentes = budget de lancement), l'**effectif**
   et le **CA minimum** ;
3. choisir l'**objectif** : *sans site web*, *site à refaire*, ou les deux ;
4. lancer. Les prospects sont enregistrés, dédoublonnés par SIREN, et classés par score.

Le suivi commercial (`statut`, `notes`) n'est **jamais écrasé** par un nouveau run.
Export CSV disponible sur la sélection affichée.

### En ligne de commande (sans base de données)

```bash
npm run prospect -- --departement 33 --secteurs restauration,beaute --depuis 12
npm run prospect -- --cp 75011 --cible site_a_refaire --pages 4 --sortie leads.csv
npm run prospect -- --aide
```

Nécessite Node 22+ (exécution directe des fichiers TypeScript). Produit un CSV
`;` avec BOM, directement ouvrable dans Excel.

### Via l'API

```http
POST /functions/v1/prospect-companies
Authorization: Bearer <jwt super admin>

{ "filters": { "departement": "33", "activitePrincipale": ["56.10A"], "cible": "sans_site" } }
```

## Comment le score est calculé

`score = 55 % × opportunité site + 45 % × capacité budgétaire` (0 à 100).

**Opportunité site** — issue de l'audit de la page d'accueil :

| État | Score |
|---|---|
| Aucun site trouvé | 100 |
| Site injoignable (domaine mort, hébergement en panne) | 90 |
| Site obsolète (score d'obsolescence ≥ 55) | = score d'obsolescence |
| Site à rafraîchir (30 à 54) | idem |
| Site correct (< 30) | idem |
| Non vérifié (audit désactivé) | 50, neutre |

Signaux d'obsolescence pondérés : absence de `viewport` (non responsive), absence de
HTTPS, balises `<font>`/`<center>`/`<frameset>`, mise en page en tableaux, Flash,
jQuery 1.x, WordPress < 6 / Joomla 1-3 / Drupal 6-7, copyright vieux de 3 à 5 ans,
absence d'Open Graph / meta description / favicon, page lente ou très lourde, erreur HTTP.
Chaque signal détecté est affiché tel quel dans la fiche : ce sont les **arguments de vente**.

**Capacité budgétaire** — effectif, chiffre d'affaires du dernier exercice, forme
juridique (SAS/SARL > entreprise individuelle), catégorie INSEE, nombre
d'établissements, bonus pour les entreprises de moins de 18 mois.

Priorité : **chaud** ≥ 70, **tiède** ≥ 50, **froid** en dessous.

## Détection du site

Aucune API payante n'est requise : les domaines probables sont dérivés de la raison
sociale et de l'enseigne (`garagemartin.fr`, `garage-martin.fr`, `.com`…), testés en
HTTPS puis HTTP, et **retenus uniquement si** la page répond, n'est pas une page
parking / « en construction », et mentionne l'entreprise.

Conséquence à connaître : une entreprise dont le site utilise un nom de domaine sans
rapport avec sa raison sociale sera classée « aucun site » à tort. Le statut se corrige
à la main depuis la fiche, et l'audit reste juste pour tous les sites détectés.

## Cadre légal

- Les données d'entreprises proviennent de l'**open data Sirene** (diffusion publique).
  Les entreprises en statut « non diffusible » sont exclues par l'API elle-même.
- Les emails collectés sont des **adresses professionnelles génériques** publiées sur
  le site de l'entreprise. La prospection B2B par email est admise sur la base de
  l'intérêt légitime lorsqu'elle est en rapport avec l'activité du destinataire, à
  condition d'indiquer l'origine des données et d'offrir un **droit d'opposition** dans
  chaque message (position CNIL).
- Les dirigeants sont des personnes physiques : purger les prospects inexploités et
  répondre aux demandes d'accès / d'effacement. Les tables sont en RLS super admin.

## Limites connues

- 25 entreprises par page, 10 pages maximum par run (250 entreprises), budget de 50 s
  par appel d'edge function — au-delà, la réponse est marquée `tronque`.
- Le CA n'est disponible que pour les entreprises qui déposent leurs comptes.
- L'audit ne porte que sur la page d'accueil (pas de parcours complet ni de Lighthouse).
