# Mise en ligne et référencement — plan d'action

À l'écriture de ce document, `smartfixx.fr` sert **un autre site** que celui de
ce dépôt : Google affiche le titre « SmartFixx | Agence Web Créative — Sites
vitrines, SEO & maintenance », alors que ce dépôt produit « Agence web à
Asnières-sur-Seine (92) — Création de site & automatisation ». Aucun travail de
référencement fait ici n'a donc d'effet pour l'instant.

Les étapes sont classées par impact réel, pas par ordre de difficulté.

---

## 1. Déployer ce dépôt sur le domaine

Sans ça, tout le reste est théorique.

```bash
npm install
npm run build      # produit dist/ : 24 pages HTML statiques
```

Sur Vercel ou Netlify, connectez le dépôt : `vercel.json` et `netlify.toml` sont
déjà configurés (commande de build, dossier `dist`, cache long sur les polices).

**Un seul piège, mais il casse tout le référencement :** ne pas activer de
réécriture « toutes les URL vers `/index.html` ». C'est le réglage par défaut de
beaucoup d'hébergeurs pour les applications React. Ici chaque page a son propre
`index.html` dans son dossier ; une réécriture globale servirait l'accueil sur
les 24 URL, et Google verrait 24 fois la même page.

Vérification après déploiement — les titres doivent différer :

```bash
curl -s https://smartfixx.fr/ | grep -o '<title>[^<]*</title>'
curl -s https://smartfixx.fr/creation-site-internet-clichy | grep -o '<title>[^<]*</title>'
```

### Avant de basculer : les redirections

L'ancien site est indexé et le domaine est premier sur « smartfixx ». Chaque
ancienne URL qui renverra une 404 après la bascule perd sa position, et les liens
qui pointaient vers elle ne transmettent plus rien.

Tout se règle dans un seul fichier : **`redirects.json`**, à la racine.

```bash
# 1. Lister les anciennes URL encore indexées
curl -s https://smartfixx.fr/sitemap.xml | grep -o '<loc>[^<]*'
# ou Search Console > Indexation > Pages > Pages indexées > Exporter
# ou une recherche Google : site:smartfixx.fr

# 2. Les reporter dans redirects.json
#    { "from": "/ancienne-page", "to": "/nouvelle-page" }

# 3. Régénérer les configs d'hébergement
npm run build
```

Le build propage la liste vers `vercel.json` et `public/_redirects` : une seule
liste à tenir, les deux hébergeurs couverts, pas de divergence possible. Le
script refuse les boucles, les doublons et les chemins mal formés plutôt que de
produire une configuration silencieusement cassée.

Deux règles :

- Envoyez chaque ancienne URL vers **la page nouvelle la plus proche en
  contenu**. Rediriger tout en bloc vers l'accueil ne transfère rien : Google
  traite ça comme une page d'erreur déguisée.
- L'accueil `/` ne change pas d'adresse, il n'y a rien à rediriger pour lui —
  c'est aussi lui qui porte la position sur « smartfixx », elle est donc
  conservée.

---

## 2. Créer la fiche Google Business Profile

**C'est le levier numéro un, et il ne dépend pas du code.** Dans le classement
du bloc carte, 8 des 10 premiers facteurs viennent de cette fiche.

La fiche visible aujourd'hui sur la recherche « smartfixx » — atelier de
réparation de téléphones à Christchurch, Angleterre, 4,6 étoiles, 188 avis — est
une **entreprise britannique homonyme, sans rapport**. Elle ne peut pas être
récupérée. Il faut créer la vôtre.

Sur <https://business.google.com> :

- Nom : `SmartFixx` — exactement comme sur le site et les mentions légales
- Catégorie principale : **Concepteur de sites Web**
- Catégories secondaires : Service informatique, Consultant en marketing
- Adresse exacte à Asnières-sur-Seine (ou zone de chalandise si pas de local
  recevant du public)
- Horaires, téléphone, lien vers `https://smartfixx.fr`
- Photos réelles : bureau, écran de travail, vous

La vérification prend quelques jours (courrier, téléphone ou vidéo).

**Sur l'homonymie :** Google sépare les résultats par zone, donc une recherche
française ne remontera pas l'atelier anglais dans le bloc local. Le panneau de
marque peut rester ambigu quelque temps ; il se corrige à mesure que votre fiche
gagne en signaux (avis, photos, cohérence avec le site).

---

## 3. Récolter des avis Google

Environ **17 % du poids du classement local**. Deuxième facteur après la fiche
elle-même.

Demandez un avis à chaque client livré, avec le lien direct fourni par la fiche.
Répondez à tous, y compris les négatifs. Dix avis sincères valent mieux que
cinquante avis douteux, que Google filtre.

---

## 4. Compléter `src/data/site.ts`

```ts
phone: "",              // votre numéro
geo: { … },             // coordonnées du siège exact, pas celles de la mairie
legal: { siren: "", address: "" },
```

Le nom, l'adresse et le téléphone doivent être **identiques** sur le site, la
fiche Google et les annuaires. Toute divergence dilue le signal local. Les
mentions légales affichent « à compléter » tant que ces champs sont vides — c'est
visible par vos visiteurs et par Google.

---

## 5. Search Console

Sur <https://search.google.com/search-console> : ajoutez la propriété, soumettez
`https://smartfixx.fr/sitemap.xml`, puis demandez l'indexation de l'accueil et
des quatre pages prestations. Les pages communes suivront par le sitemap.

Revenez au bout de deux semaines vérifier le rapport de couverture.

---

## 6. Annuaires et citations

Pages Jaunes, annuaires des Hauts-de-Seine, CCI, LinkedIn d'entreprise. Toujours
la même fiche d'identité qu'au point 4. C'est peu spectaculaire et ça compte.

---

## Sur « agence web » et « création site web » sans ville

Ces deux requêtes fonctionnent différemment selon qui les tape.

**Depuis Asnières ou les environs**, Google géolocalise automatiquement : il
affiche un bloc carte et des résultats locaux. C'est exactement là que la fiche
du point 2 vous fait apparaître. Autrement dit, « agence web » tapé par un voisin
est une requête locale, et elle est atteignable.

**À l'échelle nationale**, « agence web » et « création site web » sont parmi les
requêtes les plus disputées du marché français : les premières places sont
tenues par des sites installés depuis dix ou quinze ans, avec des milliers de
liens entrants. Aucun travail sur le code ne compense cet écart, et personne ne
peut promettre le contraire dans un délai raisonnable.

L'ordre réaliste :

1. `smartfixx` — déjà premier
2. `agence web asnières`, `création site internet asnières` — atteignable en
   quelques mois avec les points 1 à 3
3. `agence web 92`, `agence web hauts-de-seine` — ensuite, via les pages
   départementales
4. `agence web` géolocalisé autour d'Asnières — dépend surtout de la fiche
5. `agence web` / `création site web` au national — hors de portée à court terme

Le site est construit pour gagner les niveaux 2 et 3, et pour ne pas être
l'obstacle sur le 4.

---

## Ce qui a déjà été fait dans le code

- 24 pages HTML statiques pré-rendues : contenu indexable sans JavaScript
- `LocalBusiness` avec adresse, coordonnées GPS, horaires, zones desservies
- `Service` rattaché à une `City` sur chaque page commune
- `FAQPage` (12 questions sur l'accueil, une par commune), `BreadcrumbList`
- Titre, description, canonical, hreflang et Open Graph propres à chaque page
- `robots.txt`, `sitemap.xml` généré, image de partage 1200 × 630
- three.js en chargement asynchrone, polices auto-hébergées, intro raccourcie —
  pour les Core Web Vitals
- Recouvrement textuel entre pages communes mesuré à 35 % (nav et pied de page
  compris), sous le seuil où Google traite des pages locales comme dupliquées
