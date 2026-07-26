# SmartFixx

Site vitrine de **SmartFixx** — création de sites web, refonte complète et
automatisation de logiciels métiers.

Une page unique, sombre, avec une scène WebGL en fond de hero (shaders GLSL
écrits à la main), des révélations au scroll et un diagramme d'automatisation
animé.

---

## Démarrer

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script              | Effet                                            |
| ------------------- | ------------------------------------------------ |
| `npm run dev`       | Serveur de développement Vite                    |
| `npm run build`     | Typecheck, build, puis pré-rendu des 24 pages     |
| `npm run build:spa` | Build sans pré-rendu (dépannage)                  |
| `npm run preview`   | Sert le build de production localement           |
| `npm run typecheck` | Vérification TypeScript stricte, sans émission   |

## Stack

- **Vite 5** + **React 18** + **TypeScript** (mode strict)
- **Tailwind CSS 3** — jetons de design dans `tailwind.config.ts`
- **three.js** / **@react-three/fiber** / **@react-three/postprocessing** — scène du hero
- **framer-motion** — animations d'interface et effets liés au scroll
- **lenis** — défilement inertiel

## Structure

```
src/
  components/
    three/          Scène WebGL — shaders GLSL, core, particules, caméra
    ui/             Primitives réutilisables (Reveal, TiltCard, Magnetic, Marquee…)
    sections/       Une section de page par fichier
    Nav.tsx  Cursor.tsx  Preloader.tsx
  hooks/            Défilement inertiel, media queries, détection de matériel modeste
  data/site.ts      Coordonnées, listes du formulaire  ← à personnaliser
  fonts.css         Généré — ne pas éditer à la main
public/fonts/       Polices auto-hébergées (woff2)
scripts/            Utilitaires hors build
```

## Architecture SEO

Le site est **pré-rendu au build** : `npm run build` génère un vrai fichier HTML
statique par page, contenu et données structurées inclus. Les robots n'ont pas
besoin d'exécuter du JavaScript, et three.js part dans un chunk asynchrone que
le premier affichage n'attend pas.

**24 pages**, organisées en trois niveaux :

| Niveau | URL | Cible |
| --- | --- | --- |
| Accueil | `/` | Marque + intention large, ancrée Asnières |
| Prestation | `/creation-site-internet-asnieres-sur-seine` | Requête locale principale |
| Prestation | `/creation-site-internet-ile-de-france` | Requête régionale |
| Prestation | `/refonte-site-internet` | Refonte sans perte de référencement |
| Prestation | `/automatisation-informatique` | Automatisation / interconnexion |
| Département | `/agence-web-hauts-de-seine`, `-paris`, `-seine-saint-denis`, `-val-d-oise` | « agence web + département » |
| Commune | `/creation-site-internet-<ville>` × 12 | « création site internet + ville » |
| Index | `/zones-desservies` | Maillage de toutes les communes |
| Légal | `/mentions-legales`, `/politique-de-confidentialite` | Obligations + confiance |

Communes couvertes : Clichy, Levallois-Perret, Courbevoie, Colombes,
Bois-Colombes, Gennevilliers, Nanterre, Boulogne-Billancourt, Neuilly-sur-Seine,
Issy-les-Moulineaux, Saint-Ouen-sur-Seine, Argenteuil.

### Ajouter une commune

Une entrée dans `src/data/cities.ts` suffit : la route, le titre, la
description, le sitemap et le maillage se génèrent tout seuls.

**Mais il faut écrire le contenu.** Chaque commune a quatre champs de texte qui
doivent lui être propres : `fabric` (tissu économique), `searchAngle` (comment
les recherches s'y comportent), `opportunity` (l'angle local concret) et `faq`
(une question spécifique). Compter ~20 minutes de rédaction par ville.

Google déclasse les « pages satellites » — les pages locales identiques où seul
le nom de la ville change. Le recouvrement textuel entre les pages actuelles est
mesuré à **35 % en moyenne** (nav et pied de page compris), ce qui est sain. Si
vous ajoutez des villes en dupliquant le texte, ce chiffre monte et l'ensemble
du réseau se fait déclasser, pas seulement les nouvelles pages.

Vérifier après ajout :

```bash
npm run build   # échoue si une page rend moins de 3 000 caractères
```

N'ajoutez une commune que si vous y avez réellement des clients ou une présence.

Données structurées produites : `LocalBusiness` (adresse, coordonnées GPS,
horaires, zones desservies), `Service` rattaché à la `City` sur chaque page
commune, `FAQPage` (12 questions sur l'accueil + une question locale par
commune), `BreadcrumbList` à trois niveaux, `WebSite`, `WebPage`.

### Ce qui reste à faire hors du code

Le référencement local ne se gagne pas uniquement dans le HTML. Dans le
classement de la carte Google, **8 des 10 premiers facteurs viennent de la fiche
Google Business Profile**, et les avis pèsent environ 17 %. Par ordre d'impact :

1. **Créer et vérifier la fiche Google Business Profile** — catégorie
   « Concepteur de sites Web », adresse exacte, horaires, photos, description.
   Sans elle, aucune visibilité sur les recherches « près de moi ».
2. **Collecter des avis Google** régulièrement, et y répondre.
3. **Renseigner `src/data/site.ts`** : SIREN, adresse précise, téléphone,
   coordonnées GPS du siège. La cohérence nom / adresse / téléphone entre le
   site, la fiche et les annuaires est un signal direct.
4. **S'inscrire dans les annuaires locaux** (Pages Jaunes, annuaires du 92).
5. **Soumettre le sitemap** dans la Google Search Console.
6. **Publier régulièrement** : chaque page utile de plus élargit la surface de
   captation.

## À personnaliser avant la mise en ligne

1. **`src/data/site.ts`** — e-mail, téléphone, SIREN, adresse exacte,
   coordonnées GPS, liens réseaux sociaux. Le bloc téléphone reste masqué tant
   que `phone` est vide. `url` alimente canonical, Open Graph et sitemap.
2. **`src/components/sections/Pricing.tsx`** — les montants sont des points de
   départ indicatifs, alignez-les sur votre grille réelle.
3. **`src/components/sections/Work.tsx`** — les trois projets décrivent des
   formats types. Remplacez-les par vos références réelles dès que possible.
4. **`index.html`** — `<link rel="canonical">` et l'URL Open Graph pointent vers
   `https://smartfixx.fr/`.
5. **Mentions légales et confidentialité** — les pages existent ; complétez les
   champs marqués « à compléter » (hébergeur, médiateur, SIREN).
6. **`public/robots.txt`** et `scripts/prerender.mjs` reprennent `site.url` :
   changez le domaine à un seul endroit.

### Formulaire de contact

Sans back-end, l'envoi compose un e-mail pré-rempli dans le client du visiteur
(`mailto:`). Pour un envoi direct, remplacez `window.location.href` dans
`src/components/sections/Contact.tsx` par un appel à votre endpoint (Formspree,
Resend, fonction serverless…).

## Polices

Les polices sont auto-hébergées : aucune requête vers un tiers au chargement,
donc rien à déclarer côté RGPD, et une passe de latence en moins.

Pour les régénérer (après un changement de graisse ou de famille) :

```bash
node scripts/fetch-fonts.mjs
```

Le script télécharge les woff2 dans `public/fonts/` et réécrit `src/fonts.css`.

## Performance et accessibilité

- La scène WebGL réduit son nombre de particules, sa résolution et coupe le
  post-processing sur mobile, en `prefers-reduced-motion` et sur les machines
  modestes (peu de cœurs ou peu de mémoire).
- Le canvas cesse complètement de rendre une fois le hero dépassé.
- `prefers-reduced-motion` désactive aussi le défilement inertiel, le curseur
  personnalisé et les animations en boucle.
- Contrastes tenus sur fond sombre, navigation au clavier préservée, libellés
  ARIA sur les contrôles sans texte.

## Déploiement

Site statique — `npm run build` puis publiez `dist/`. Chaque page a son propre
`index.html` dans un dossier : aucune règle de réécriture n'est nécessaire, et
il ne faut **pas** activer de repli SPA vers `/index.html` (cela servirait
l'accueil sur toutes les URL et casserait le référencement).
`vercel.json` et `netlify.toml` sont déjà configurés (build, dossier de sortie,
cache long sur les polices et les assets versionnés).
