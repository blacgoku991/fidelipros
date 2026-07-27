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
npm test                   # 249 tests (moteur + stockage)
npm run verif              # vérification des types
```

Le serveur écoute sur `127.0.0.1` uniquement : il n'y a pas d'authentification, il ne doit
donc pas être exposé sur le réseau.

## Les quatre écrans

| Écran | À quoi ça sert |
|---|---|
| **Prospects** | Rechercher des entreprises (secteur, département, dates de création, effectif, CA), liste classée par opportunité, audit de 10 prospects en un clic, statut commercial, export CSV de ce qui est affiché |
| **Auditer un site** | Coller l'adresse d'un site : audit complet en 15 à 45 s, coordonnées relevées, enregistrement comme prospect |
| **Fiche prospect** | Contact (email, téléphone, fiche Google, réseaux), notes par volet, défauts avec leur impact, **email d'approche HTML sans devis** (rapport en PDF joint), devis, email HTML de relance, SMS, script d'appel, rapport client imprimable, correction manuelle du site, suppression |
| **Prestations & devis** | Prix du catalogue (15 prestations), activation, identité portée sur le devis et les emails (raison sociale, **site web**, email, téléphone…) |

## Les sources : gratuites, sans clé, sans compte

| Source | Ce qu'elle apporte | Clé |
|---|---|---|
| [API Recherche d'entreprises](https://recherche-entreprises.api.gouv.fr/docs/) (Sirene) | Toutes les entreprises françaises : activité, effectif, CA déposé, dirigeant, date de création | aucune |
| [OpenStreetMap / Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API) | Les commerces tels qu'ils existent sur le terrain : adresse exacte, téléphone, site quand il y en a un | aucune |
| [PageSpeed Insights](https://developers.google.com/speed/docs/insights/v5/get-started) | Lighthouse **et** les mesures des visiteurs réels (Chrome UX Report) | facultative |
| [Internet Archive](https://archive.org/help/wayback_api.php) | Depuis quand le site existe, et depuis quand il n'a pas changé | aucune |
| DNS-over-HTTPS (Cloudflare) | MX, SPF, DMARC : usurpation d'email | aucune |
| Le site lui-même | Coordonnées, liens morts, poids réel des images, certificat TLS, plateforme | — |

Aucune de ces sources n'est facturée, aucune ne demande de compte. La seule clé possible
(`PAGESPEED_API_KEY`) est gratuite et sert uniquement à augmenter un quota.

### Deux façons de trouver des prospects

**Par les entreprises (Sirene)** : tout le tissu économique, filtrable par secteur,
département, ancienneté, effectif et chiffre d'affaires — mais sans téléphone ni site web,
qu'il faut donc déduire.

**Par les commerces (OpenStreetMap)** : les établissements cartographiés dans une commune,
avec leur adresse, leur téléphone et, quand elle existe, leur adresse de site. Cocher
« seulement les commerces sans site web déclaré » donne directement une liste de candidats.
L'absence d'étiquette `website` reste un **indice** : la fiche est créée en « non vérifié », et
c'est l'audit qui cherchera réellement un site avant de conclure.

Les deux sources se complètent et se rejoignent : un commerce déjà connu par Sirene n'est pas
dupliqué, sa fiche gagne simplement le téléphone et l'adresse relevés sur le terrain.

> Données © les contributeurs OpenStreetMap, sous licence ODbL. Overpass est un service
> bénévole : l'outil envoie une requête par recherche. `OVERPASS_URL` permet de basculer sur
> un miroir si le serveur principal sature.

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
> sociale sera classée « aucun site » à tort. Le bloc **Corriger le site** de la fiche permet
> de saisir la bonne adresse et l'état constaté ; le score d'opportunité est recalculé, et un
> nouvel audit part sur la bonne adresse.

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

La **plateforme** est également identifiée quand elle se déclare (Wix, WordPress, Shopify,
Squarespace, Webflow, PrestaShop…). Ce n'est pas un défaut, c'est un angle de discussion : un
site fait sur un éditeur en ligne ne s'exporte pas, un WordPress demande un suivi. Elle
apparaît sur la fiche et dans le script d'appel.

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

Les critères sont envoyés à l'API **et revérifiés sur chaque entreprise reçue** : département,
code postal, dates de création, tranches d'effectif, CA minimum et maximum.

L'API n'applique pas tout ce qu'on lui demande — la date de création, en particulier, semble
ignorée. La recherche **tourne donc les pages jusqu'à réunir le nombre de prospects conformes
demandé** (« Nombre de prospects visés », 250 entreprises examinées au maximum) au lieu de
rendre une page filtrée à zéro. Le bilan sous le tableau dit combien ont été écartés et
pourquoi (« 180 × créée avant la date demandée »), et si aucun prospect ne passe, le message
nomme le critère à assouplir.

Le cas à connaître : l'API ne connaît le **chiffre d'affaires** que des entreprises qui
déposent leurs comptes. Filtrer sur un CA minimum écarte donc toutes les autres — l'interface
le rappelle sous le champ, et le bilan le compte à part.

### Les traitements longs sont suivis pas à pas

Une recherche sur dix pages, ou l'audit de dix sites à la suite, prend des minutes. Ces
traitements tournent en tâche de fond et l'interface affiche l'étape en cours
(« page 3 — 412 entreprises correspondent aux critères », « analyse des sites 24 / 50 »,
« audit de Garage Dupont — 4 / 10 ») plutôt qu'une page figée.

Le bouton **Auditer 10 prospects** porte sur ce qui est affiché, filtres compris, et commence
par ceux qui n'ont jamais été audités. Un audit dure 15 à 45 s : comptez quelques minutes pour
dix, et laissez l'onglet ouvert.

Une recherche sans aucun critère de localisation ou d'activité est refusée avec un message
clair : l'API la rejetterait de toute façon.

## Comment un site est audité

| Volet | Poids | Ce qui est vérifié |
|---|---|---|
| **Référencement** | 30 % | **adresse canonique incohérente**, **titre dupliqué entre pages**, **fiche établissement incomplète**, **adresses illisibles**, liens morts vérifiés un par un, site figé depuis des années (Internet Archive), title, description, H1 et hiérarchie, canonical, `lang`, `noindex`, robots.txt, sitemap, données structurées, Open Graph, `alt` des images, volume de contenu, page contact, mentions légales, page 404, coordonnées en page d'accueil, maillage interne, **duplication avec / sans « www »**, note SEO Lighthouse |
| **Design & mobile** | 25 % | **poids réel des images mesuré une par une**, viewport, débordement horizontal, taille des textes, cibles tactiles, contrastes, formats d'images, nombre de polices, technologies datées, favicon, contact cliquable, copyright ancien, LCP, CLS, note d'accessibilité Lighthouse |
| **Sécurité** | 25 % | **extensions à failles publiques connues** (référence CVE citée), **cookies de suivi déposés avant consentement**, **scripts externes sans contrôle d'intégrité**, **qualité réelle des en-têtes** (CSP permissive, HSTS trop court, CORS ouvert aux identifiants), **points d'entrée WordPress** (liste des comptes, XML-RPC), **certificat lu directement** (émetteur, date d'expiration, version TLS négociée), certificat invalide (expiré, mauvais domaine, auto-signé), HTTPS et redirection, HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, versions divulguées, CMS obsolète, bibliothèques à failles connues, cookies non protégés, contenu mixte, formulaire en clair, fichiers publics exposés, listing de répertoire, SPF, DMARC, MX, email en clair, politique de confidentialité, **traceurs déposés sans bandeau de consentement** (risque CNIL) |
| **Performance** | 20 % | disponibilité, code HTTP, note de performance, **temps vécus par les visiteurs réels** (Chrome UX Report), poids et nombre de requêtes, compression, cache, HTTP/3, temps de réponse, erreurs console |

Note d'un volet = `100 − somme des poids des défauts constatés`. L'urgence découle du nombre
de défauts critiques et de la note globale.

**Règle absolue du moteur : ce qui n'a pas pu être vérifié ne produit aucun constat.** Si le
résolveur DNS est injoignable, l'audit n'écrit pas « aucun SPF » : il inscrit la panne dans
les points non vérifiables, affichés comme tels. C'est ce qui rend le rapport défendable
devant le prospect.

Conséquence assumée : une note se calcule en retirant des points par défaut constaté, donc un
volet dont une source a manqué ressort **trop favorable**. Ces volets sont marqués **« mesure
partielle »** dans l'interface et dans le rapport client — sans Lighthouse, « Performance
technique 100/100 » ne veut rien dire, et le dire est plus utile que de le cacher.

La page d'accueil bénéficie d'une **seconde tentative** avant tout verdict : un incident réseau
isolé ne doit pas transformer un site vivant en « analyse impossible ».

Un **certificat HTTPS invalide** n'est pas non plus un site injoignable : c'est un site que
tout visiteur voit barré d'un avertissement plein écran. Le motif exact est nommé (expiré,
délivré pour un autre domaine, auto-signé), le contenu est lu en HTTP quand c'est possible, et
le défaut part en tête du devis. Sans cette distinction, ces sites ressortaient « non
analysables » et sortaient du fichier — alors que ce sont les meilleurs prospects.

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

### Ce que l'audit fait, et ce qu'il ne fait pas

**101 règles** réparties en quatre volets : 40 sécurité, 31 référencement, 19 design et mobile,
11 performance technique. Toutes reposent sur une observation directe et reproductible.

Côté sécurité, l'audit va au-delà de la présence des en-têtes :

- **les extensions et bibliothèques sont relevées avec leur version** — c'est ce que lit un
  scanner automatisé — et confrontées à une courte liste de failles publiques massivement
  exploitées (Slider Revolution, WP File Manager, Duplicator, Elementor, Contact Form 7,
  jQuery, Lodash…). Le constat cite la version, la version corrigée, la conséquence et **la
  référence CVE**, pour que le prospect vérifie lui-même ;
- **la qualité des en-têtes** compte autant que leur présence : une CSP en `unsafe-inline`
  n'arrête aucune injection, un HSTS d'un jour ne protège personne, un
  `Access-Control-Allow-Origin: *` combiné à `Allow-Credentials: true` ouvre les réponses du
  site à n'importe quel autre site ;
- **les cookies de suivi déposés dès l'ouverture** sont constatés dans la réponse elle-même,
  pas déduits : c'est une preuve, et c'est le manquement que la CNIL sanctionne le plus ;
- **les scripts externes sans `integrity`** sont signalés : si le serveur qui les héberge est
  compromis, le code hostile s'exécute sur le site du prospect ;
- **deux points d'entrée WordPress publics** sont interrogés, uniquement sur un WordPress :
  `/wp-json/wp/v2/users`, qui publie souvent les identifiants de connexion, et `/xmlrpc.php` ;
- **le logiciel serveur en fin de vie** est déduit des en-têtes : un `PHP/5.6` ou un
  `Apache/2.2` ne reçoit plus aucun correctif, chaque faille découverte depuis reste ouverte ;
- **la protection email complète** : SPF absent ou permissif (`+all`/`?all`), DMARC absent,
  en `p=none` ou sans adresse de rapport, MX, et **DNSSEC** (domaine signé ou non) ;
- **l'absence de `security.txt`** : un chercheur qui trouve une faille n'a aucun moyen de
  prévenir, il la publie ou la revend.

Chaque constat de faille de composant cite **la version trouvée, la version corrigée, la
conséquence en clair et un lien de vérification** (base WPScan pour les extensions, Snyk pour
les bibliothèques, site officiel pour les logiciels serveur) : le dirigeant, ou son
prestataire, ouvre le lien et confirme lui-même.

**Ce que l'audit ne fait pas, volontairement.** L'objectif est d'**alerter** le dirigeant pour
qu'il se protège — c'est de la défense. Mais **vérifier qu'une faille est exploitable** veut
dire lui envoyer l'attaque (injection, dépôt de fichier, test de mot de passe, contournement de
pare-feu) : sur un site qu'on ne possède pas et sans mandat écrit, c'est un accès non autorisé,
puni par l'article 323-1 du code pénal, et le rapport serait de toute façon inutilisable
(« comment savez-vous ça ? — j'ai attaqué votre site »). L'outil s'arrête donc à la
**détection** : il constate une version vulnérable et renvoie vers l'avis public, il ne
l'exploite pas. La démarche crédible est de vendre l'audit → faire signer un mandat → réaliser
*ensuite* le test d'intrusion. Quand un pare-feu bloque l'analyse, l'outil le dit et s'arrête ;
il ne cherche pas à passer outre. Le rapport client énonce cette limite noir sur blanc.

### Ce qui rend un audit défendable

Trois mesures ne dépendent d'aucune API et se vérifient devant le prospect en quelques
secondes — ce sont les plus convaincantes :

- **les liens morts** : jusqu'à douze liens du site sont suivis un par un, et le rapport cite
  l'adresse et le code d'erreur (« /devis (404) ») ;
- **le poids réel des images** : lu dans l'en-tête `content-length` de chaque image, sans
  Lighthouse. « Votre photo d'accueil pèse 4,2 Mo » se comprend sans explication ;
- **le certificat TLS** : lu dans la poignée de main, comme le cadenas du navigateur —
  émetteur, date d'expiration, version du protocole.

Deux autres viennent de sources publiques que le prospect peut consulter lui-même :

- **l'Internet Archive** : « votre page d'accueil n'a pas changé depuis le 20 juin 2015 »,
  avec la capture d'archive à l'appui ;
- **les mesures terrain de Google** (Chrome UX Report, incluses dans la réponse PageSpeed) :
  ce que vivent ses visiteurs réels sur 28 jours, pas un test en laboratoire.

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

Deux moments, deux emails distincts.

### Le premier contact : l'email d'approche

C'est l'email de démarchage, **sans devis ni prix**. Il vous présente comme agence de création
de sites web, annonce en une note globale que le site du prospect « mérite mieux », résume les
**trois défauts les plus graves réellement constatés** en cartes lisibles, et **renvoie au rapport
d'audit joint en PDF** — sans le coller dans le corps du message. La mise en page reprend votre
identité (**SmartFixx**, `smartfixx.fr`) : en-tête de marque, bande de notes, encadré vert
« l'audit complet est joint à cet email (PDF) », bouton « Échanger 15 minutes », pied de page
avec l'origine des données et le droit d'opposition CNIL (« Répondez STOP »). Le devis vient
**plus tard**, en relance, une fois le contact établi.

Depuis la fiche prospect, la carte **Email d'approche** propose le flux d'envoi en trois étapes :
*ouvrez le rapport → enregistrez-le en PDF (bouton dédié sur la page du rapport) → joignez le PDF
à l'email*. L'email lui-même se **copie avec sa mise en forme**, se **télécharge en .html** ou
s'**ouvre dans un onglet**. Quand l'audit n'est pas concluant, aucun email d'approche n'est
fabriqué.

### La relance : l'email avec devis

Une fois le prospect intéressé, la seconde forme reprend l'audit **et** le chiffrage. Elle
existe en deux versions :

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
OVERPASS_URL=…        # miroir OpenStreetMap (le serveur par défaut sature aux heures pleines)
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
dans n'importe quel éditeur. La version précédente est conservée en `prospection.json.bak` à
chaque écriture. Pour repartir de zéro : supprimez le dossier. Pour sauvegarder : copiez-le.
`DONNEES=/chemin/autre.json npm start` permet de travailler sur plusieurs bases.

## Structure

```
src/moteur/          recherche Sirene et OpenStreetMap, détection de site, audit, devis, rédaction
  ├── audit/         collecte HTTP/DNS/TLS/Lighthouse, coordonnées, 101 règles des quatre volets
  └── proposition/   devis, rapport, email texte et HTML, SMS, script d'appel, reformulation IA
src/serveur/         serveur node:http (API JSON + fichiers statiques) et stockage
src/cli/             prospect.ts et audit.ts, pour le traitement par lot
public/              interface : trois fichiers, sans bundler
```

249 tests couvrent le moteur (scoring, règles, coordonnées, devis, rédaction) et le stockage
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

## À l'échelle

Mesuré sur un millier de prospects, chacun avec un audit complet (fichier de 6,9 Mo) :
relecture au démarrage 55 ms, une modification (statut, notes) 31 ms, liste chargée en 0,03 s,
export CSV 0,02 s, premier affichage du tableau 0,3 s. Le tableau dessine 100 lignes à la fois
— « Afficher 100 de plus » ou « Tout afficher » en dessous — parce qu'un millier de lignes
d'un coup coûtait deux secondes de construction au navigateur pour rien : on travaille le haut
de la liste, celui qui a le meilleur score d'opportunité.

## Limites connues

- Un audit complet prend 15 à 45 s, dont l'attente de PageSpeed.
- L'analyse porte sur la page d'accueil et une page interne, pas sur un parcours complet.
- 25 entreprises par page de recherche, 10 pages maximum par lancement.
- Le chiffre d'affaires n'est connu que pour les entreprises qui déposent leurs comptes.
- `recherche-entreprises.api.gouv.fr`, `googleapis.com` et `cloudflare-dns.com` doivent être
  joignables depuis le poste (pare-feu d'entreprise, VPN).
