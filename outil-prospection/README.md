# Prospection web

> **Ce dossier est destiné à vivre dans son propre dépôt.** Il ne dépend de rien de
> l'application FidéliPro : il est ici uniquement pour vous être transmis. Pour le publier
> comme dépôt `prospection` (le dépôt doit être créé vide sur GitHub au préalable) :
>
> ```bash
> cp -r outil-prospection ~/Bureau/prospection    # Windows : Copy-Item -Recurse
> cd ~/Bureau/prospection
> git init -b main && git add . && git commit -m "Outil de prospection web"
> git remote add origin https://github.com/<votre-compte>/prospection.git
> git push -u origin main
> ```

Outil local de prospection B2B pour une activité de création de sites : il trouve des
entreprises françaises qui **n'ont pas de site** ou dont le **site est dépassé**, en fait
l'audit (référencement, design et mobile, sécurité, performance), puis produit le **devis
chiffré** et les **messages de prise de contact** prêts à envoyer.

Tout tourne sur votre poste : une interface web sombre à `http://127.0.0.1:4000`, un fichier
de données JSON, **aucun compte, aucune base de données, aucune dépendance d'exécution**.

## Installation

Il faut **Node 22.18 ou plus récent** (`node --version`) — l'outil exécute directement ses
fichiers TypeScript. [Téléchargement](https://nodejs.org/fr/download).

```bash
git clone https://github.com/blacgoku991/prospection.git
cd prospection
npm install     # installe vitest et typescript, rien d'autre
npm start
```

Puis ouvrez **http://127.0.0.1:4000**. Pour arrêter : `Ctrl+C` dans le terminal.

```bash
PORT=4100 npm start        # autre port
npm test                   # 167 tests (moteur + stockage)
npm run verif              # vérification des types
```

Le serveur écoute sur `127.0.0.1` uniquement : il n'y a pas d'authentification, il ne doit
donc pas être exposé sur le réseau.

## Les quatre écrans

| Écran | À quoi ça sert |
|---|---|
| **Prospects** | Rechercher des entreprises (secteur, département, dates de création, effectif, CA), liste classée par opportunité, statut commercial, export CSV de ce qui est affiché |
| **Auditer un site** | Coller l'adresse d'un site : audit complet en 15 à 45 s, coordonnées relevées, enregistrement comme prospect |
| **Fiche prospect** | Contact (email, téléphone, fiche Google, réseaux), notes par volet, défauts avec leur impact, devis, email HTML prêt à envoyer, SMS, script d'appel, rapport client imprimable |
| **Prestations & devis** | Prix du catalogue (15 prestations), activation, identité portée sur le devis et les emails |

## Comment un prospect est trouvé

Source : [API Recherche d'entreprises](https://recherche-entreprises.api.gouv.fr/docs/)
(base Sirene en **open data**, sans clé, 7 requêtes/seconde). Elle fournit la date de
création, l'activité (NAF), l'effectif, le chiffre d'affaires déposé, la forme juridique,
l'adresse et les dirigeants — mais **pas le site web**.

Le site est donc **déduit puis vérifié** : les domaines probables sont dérivés de la raison
sociale et de l'enseigne (`garagemartin.fr`, `garage-martin.fr`, `.com`…), testés en HTTPS
puis HTTP, et retenus seulement si la page répond, n'est pas une page parking, et mentionne
l'entreprise.

> Conséquence à connaître : une entreprise dont le domaine n'a aucun rapport avec sa raison
> sociale sera classée « aucun site » à tort. Le statut se corrige à la main depuis la fiche.

### Les coordonnées et la fiche Google

Sans coordonnées, un prospect ne sert à rien. L'audit relève donc, sur les **pages publiques**
du site (accueil, première page interne, « Contact » et « Mentions légales » quand elles sont
liées depuis l'accueil) :

- les **emails**, y compris ceux écrits contre les robots (`contact (at) site (point) fr`) et
  ceux masqués par Cloudflare — c'est exactement ce qu'un visiteur voit à l'écran ;
- les **téléphones** français, normalisés (`05 56 78 12 34`), numéros surtaxés écartés ;
- le lien de la **fiche Google** (Maps, `g.page`, carte intégrée) **s'il est publié sur le
  site** — c'est la seule preuve qu'une fiche existe. Sinon, l'interface propose une
  **recherche** Google Maps et le dit explicitement : jamais une fiche « trouvée » à tort ;
- les pages **Facebook, Instagram, LinkedIn**.

Les adresses sont classées : celle du domaine du site avant une adresse Gmail, une adresse
générique (`contact@…`) avant l'adresse personnelle d'un salarié. Chaque fiche indique **sur
quelle page** les coordonnées ont été lues, pour pouvoir le justifier.

Le `robots.txt` du site est respecté : un chemin qu'il interdit n'est ni sondé, ni lu.

### Le score

`score = 55 % × opportunité site + 45 % × capacité budgétaire`, de 0 à 100.
**Chaud** ≥ 70, **tiède** ≥ 50, **froid** en dessous.

- **Opportunité** : aucun site = 100, site injoignable = 90, sinon le score d'obsolescence
  mesuré (absence de viewport, HTTP, `<font>`/`<center>`, mise en page en tableaux, Flash,
  jQuery 1.x, WordPress < 6, copyright ancien, pas d'Open Graph, page très lourde…).
- **Capacité budgétaire** : effectif, chiffre d'affaires, forme juridique (SAS/SARL >
  entreprise individuelle), catégorie INSEE, nombre d'établissements, bonus aux entreprises
  de moins de 18 mois (budget de lancement).

### Les critères sont respectés, et ce qui est écarté est expliqué

Les critères sont envoyés à l'API **et revérifiés sur chaque résultat** : département, code
postal, dates de création, tranches d'effectif, CA minimum et maximum. Un prospect qui ne les
respecte pas est écarté, et le bilan sous le tableau dit combien et pourquoi
(« 12 × chiffre d'affaires non publié », « 3 × créée avant la date demandée »).

Le cas à connaître : l'API ne connaît le **chiffre d'affaires** que des entreprises qui
déposent leurs comptes. Filtrer sur un CA minimum écarte donc toutes les autres — l'interface
le rappelle sous le champ, et le bilan le compte à part.

## Comment un site est audité

| Volet | Poids | Ce qui est vérifié |
|---|---|---|
| **Référencement** | 30 % | title, description, H1 et hiérarchie, canonical, `lang`, `noindex`, robots.txt, sitemap, données structurées, Open Graph, `alt` des images, volume de contenu, page contact, mentions légales, page 404, coordonnées en page d'accueil, maillage interne, **duplication avec / sans « www »**, note SEO Lighthouse |
| **Design & mobile** | 25 % | viewport, débordement horizontal, taille des textes, cibles tactiles, contrastes, formats d'images, nombre de polices, technologies datées, favicon, contact cliquable, copyright ancien, LCP, CLS, note d'accessibilité Lighthouse |
| **Sécurité** | 25 % | HTTPS et redirection, HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, versions divulguées, CMS obsolète, bibliothèques à failles connues, cookies non protégés, contenu mixte, formulaire en clair, fichiers publics exposés, listing de répertoire, SPF, DMARC, MX, email en clair, politique de confidentialité, **traceurs déposés sans bandeau de consentement** (risque CNIL) |
| **Performance** | 20 % | disponibilité, code HTTP, note de performance, poids et nombre de requêtes, compression, cache, HTTP/3, temps de réponse, erreurs console |

Note d'un volet = `100 − somme des poids des défauts constatés`. L'urgence découle du nombre
de défauts critiques et de la note globale.

**Règle absolue du moteur : ce qui n'a pas pu être vérifié ne produit aucun constat.** Si le
résolveur DNS est injoignable, l'audit n'écrit pas « aucun SPF » : il inscrit la panne dans
les points non vérifiables, affichés comme tels. C'est ce qui rend le rapport défendable
devant le prospect.

### Audit non concluant

Un site que nous n'arrivons pas à voir n'est pas un site en panne :

| Situation | Conséquence |
|---|---|
| page récupérée | audit normal |
| serveur en 4xx/5xx sans signature de pare-feu | défaut réel : « la page d'accueil renvoie une erreur » |
| pare-feu applicatif (Cloudflare, Sucuri, Akamai…) ou site injoignable alors que le domaine résout | **audit non concluant** |
| aucune réponse **et** domaine qui ne résout pas | défaut réel : « aucun site en ligne » |

Un audit non concluant n'émet aucun défaut, n'affiche aucune note, ne produit aucun devis,
remplace l'email par une note de travail interne, et **ne requalifie pas le prospect**. C'est
fréquent : beaucoup de sites de PME sont derrière Cloudflare et répondent 403 à un client non
navigateur. Relancez depuis un autre réseau, ou vérifiez à la main.

### Cadre du sondage des fichiers publics

Lecture seule et non intrusive : requêtes `GET` uniquement, une à la fois, espacées de
300 ms, timeout de 5 s, sur une liste **fixe** de dix chemins classiquement oubliés en ligne
(`/.env`, `/.git/HEAD`, `/backup.zip`, `/phpinfo.php`, `/server-status`…). Aucune
exploitation de faille, aucun test d'authentification, aucun scan de ports ni de
sous-domaines. Le sondage se désactive avec l'option « audit rapide ».

## Du défaut au devis

Chaque règle d'audit référence les prestations qui la corrigent :

```ts
sec_cms_obsolete: {
  pilier: "securite", severite: "critique", poids: 30,
  titre: "CMS dans une version obsolète",
  impact: "Version plus maintenue : failles publiques exploitées automatiquement…",
  effort: "moyen",
  prestations: ["mise_a_jour_cms", "maintenance"],   // ← lignes de devis
}
```

Le devis est donc la déduplication des prestations appelées par les défauts **réellement
mesurés**, jamais une liste standard : chaque ligne affiche les défauts qui la justifient, ce
qui permet de défendre le prix point par point.

Deux bascules : **aucun site** → création, référencement local, hébergement, maintenance ;
**note globale < 45** → refonte complète plutôt qu'une accumulation de correctifs (les
correctifs absorbés par la refonte ne sont plus facturés). Au-delà de trois forfaits, une
remise de 10 % s'applique. Les prestations mensuelles sont séparées du budget projet.

Prix, libellés, activation et identité du devis se règlent dans **Prestations & devis**.

## L'email envoyé au prospect

Chaque proposition produit le même message en deux formes :

- une **version HTML** mise en page (notes de l'audit, défauts en cartes avec la mesure et ce
  qu'elle coûte, chiffrage, bouton de réponse, mentions CNIL). Elle est construite pour les
  clients mail : tableaux, styles en ligne, 600 px, fond clair, **aucune image distante**.
  Trois façons de l'utiliser : **Copier avec la mise en forme** (collez dans Gmail ou Outlook,
  l'habillage suit), **Télécharger .html**, ou **Ouvrir dans un onglet** ;
- une **version texte**, pour un envoi sans mise en forme.

L'objet reprend le **défaut le plus grave réellement constaté** (« Garage Dupont : site non
adapté au mobile ») plutôt qu'un décompte : c'est vérifiable, donc crédible. Le message
demande une seule chose — l'envoi du rapport — et rappelle l'origine des données et le droit
d'opposition. Quand l'audit n'est pas concluant, **aucun email commercial n'est fabriqué** :
vous recevez une note de travail interne.

## Options

Deux clés facultatives, à passer en variables d'environnement :

```bash
PAGESPEED_API_KEY=…   # Lighthouse : augmente le quota (l'API est gratuite sans clé)
LOVABLE_API_KEY=…     # reformule l'email et la synthèse par IA
```

Sans `PAGESPEED_API_KEY`, l'audit fonctionne mais peut tomber sur le quota public : la note de
performance et la capture mobile manquent alors, et le rapport le signale.
Sans `LOVABLE_API_KEY`, les textes déterministes partent tels quels — l'interface l'indique.

```bash
# Linux / macOS
PAGESPEED_API_KEY=xxx npm start
# Windows PowerShell
$env:PAGESPEED_API_KEY="xxx"; npm start
```

## En ligne de commande (traitement par lot)

Utile pour traiter un CSV entier ; l'interface reste préférable pour un site isolé.

```bash
npm run prospect -- --departement 33 --secteurs restauration,beaute --depuis 12
npm run prospect -- --cp 75011 --cible site_a_refaire --pages 4 --sortie leads.csv
npm run prospect -- --aide

npm run audit -- --url https://site-du-prospect.fr --nom "Garage Dupont"
npm run audit -- --csv leads.csv --top 10 --sortie rapports
npm run audit -- --aide
```

`npm run audit` produit dans `rapports/` : `<nom>-rapport.html`, `-email.txt`, `-email.html`,
`-appel.txt`, `-devis.json`. Ces commandes n'utilisent pas le fichier de données : elles écrivent des
fichiers, avec le catalogue de prix par défaut (`--tarifs mon-catalogue.json` pour le vôtre).

## Où sont les données

Tout est dans `donnees/`, ignoré par git :

```
donnees/prospection.json   prospects, audits, documents générés, catalogue, identité
donnees/captures/          captures mobiles Lighthouse (hors du JSON, qui reste léger)
```

Un seul fichier JSON, écrit de façon atomique (fichier temporaire puis renommage), lisible
dans n'importe quel éditeur. Pour repartir de zéro : supprimez le dossier. Pour sauvegarder :
copiez-le. `DONNEES=/chemin/autre.json npm start` permet de travailler sur plusieurs bases.

## Structure

```
src/moteur/          recherche, détection de site, audit, devis, rédaction
  ├── audit/         collecte HTTP/DNS/Lighthouse, coordonnées, ~70 règles des quatre volets
  └── proposition/   devis, rapport, email texte et HTML, SMS, script d'appel, reformulation IA
src/serveur/         serveur node:http (API JSON + fichiers statiques) et stockage
src/cli/             prospect.ts et audit.ts, pour le traitement par lot
public/              interface : trois fichiers, sans bundler
```

167 tests couvrent le moteur (scoring, règles, coordonnées, devis, rédaction) et le stockage
(dédoublonnage, suivi commercial préservé, écriture atomique, migration d'une base ancienne).

Le moteur est **la même source pour les trois surfaces** (interface, API, CLI) : la logique de
scoring et de chiffrage n'existe qu'une fois, et elle est couverte par des tests.

## Cadre légal

- Les données d'entreprises viennent de l'**open data Sirene** (diffusion publique). Les
  entreprises en statut « non diffusible » sont exclues par l'API elle-même.
- Les emails collectés sont des **adresses professionnelles génériques publiées** sur le site
  de l'entreprise. La prospection B2B par email est admise au titre de l'intérêt légitime
  lorsqu'elle est en rapport avec l'activité du destinataire, à condition d'indiquer
  **l'origine des données** et d'offrir un **droit d'opposition** dans chaque message
  (position CNIL) : les modèles d'email et de SMS le font.
- Les dirigeants sont des personnes physiques : purgez les prospects inexploités et répondez
  aux demandes d'accès ou d'effacement — le bouton **Supprimer ce prospect** efface la fiche,
  ses audits, ses captures et ses documents. Les données restent sur votre poste et ne sont
  envoyées à personne.
- Les traceurs et le consentement sont **constatés** dans le code de la page, pas testés en
  conditions réelles : le rapport le formule comme un constat, pas comme un verdict juridique.
- L'audit est un **constat externe** en lecture seule : ce n'est pas un test d'intrusion, et
  le rapport client le précise.

## Limites connues

- Un audit complet prend 15 à 45 s, dont l'attente de PageSpeed.
- L'analyse porte sur la page d'accueil et une page interne, pas sur un parcours complet.
- 25 entreprises par page de recherche, 10 pages maximum par lancement.
- Le chiffre d'affaires n'est connu que pour les entreprises qui déposent leurs comptes.
- `recherche-entreprises.api.gouv.fr`, `googleapis.com` et `cloudflare-dns.com` doivent être
  joignables depuis le poste (pare-feu d'entreprise, VPN).
