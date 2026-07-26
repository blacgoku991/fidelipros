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
| `npm run build`     | Typecheck puis build de production dans `dist/`  |
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

## À personnaliser avant la mise en ligne

1. **`src/data/site.ts`** — e-mail, téléphone, raison sociale, SIREN, adresse,
   liens réseaux sociaux. Le bloc téléphone reste masqué tant que `phone` est vide.
2. **`src/components/sections/Pricing.tsx`** — les montants sont des points de
   départ indicatifs, alignez-les sur votre grille réelle.
3. **`src/components/sections/Work.tsx`** — les trois projets décrivent des
   formats types. Remplacez-les par vos références réelles dès que possible.
4. **`index.html`** — `<link rel="canonical">` et l'URL Open Graph pointent vers
   `https://smartfixx.fr/`.
5. **Mentions légales et politique de confidentialité** — les liens en pied de
   page attendent encore leurs pages.

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

Site statique — `npm run build` puis publiez `dist/`.
`vercel.json` et `netlify.toml` sont déjà configurés (build, dossier de sortie,
cache long sur les polices et les assets versionnés).
