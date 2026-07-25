# Audit de site et proposition commerciale

Chaîne complète : à partir d'un prospect, produire les quatre notes d'audit, la liste des
défauts traduits en arguments de vente, un devis chiffré depuis un catalogue éditable, et les
messages de prise de contact prêts à envoyer.

Ce document décrit l'audit et le livrable commercial. La découverte des entreprises est
décrite dans [PROSPECTION.md](./PROSPECTION.md).

## Ce qui est livré

| Élément | Chemin |
|---|---|
| Moteur d'audit | `supabase/functions/_shared/prospection/audit/` |
| Devis et rédaction | `supabase/functions/_shared/prospection/proposition/` |
| Edge function d'audit | `supabase/functions/audit-prospect/index.ts` |
| Edge function de proposition | `supabase/functions/generate-proposal/index.ts` |
| Fiche prospect | `/admin/prospection/:id` — `src/pages/admin/AdminProspectDetail.tsx` |
| Rapport imprimable | `/admin/prospection/:id/rapport` |
| Catalogue de prix | `/admin/prestations` |
| CLI | `npm run audit -- --aide` |
| Tables | `prestations`, `prospect_audits`, `prospect_documents` |

## Les quatre volets

| Volet | Poids dans la note globale | Ce qui est vérifié |
|---|---|---|
| **Référencement** | 30 % | title, description, H1 et hiérarchie, canonical, `lang`, `noindex`, robots.txt, sitemap, données structurées (fiche établissement), Open Graph, `alt` des images, volume de contenu, page contact, mentions légales, page 404, coordonnées sur la page d'accueil, maillage interne, note SEO Lighthouse |
| **Design & mobile** | 25 % | balise viewport, débordement horizontal, taille des textes, cibles tactiles, contrastes, formats d'images, nombre de polices, technologies datées (jQuery 1.x, Bootstrap 2-3, mise en page en tableaux, Flash), favicon, moyen de contact cliquable, copyright ancien, LCP, CLS, note d'accessibilité Lighthouse |
| **Sécurité** | 25 % | HTTPS et redirection, HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, versions logicielles divulguées, CMS obsolète, bibliothèques à failles connues, cookies sans protection, contenu mixte, formulaire en clair, fichiers publics exposés, listing de répertoire, SPF, DMARC, MX, email en clair, politique de confidentialité |
| **Performance technique** | 20 % | disponibilité, code HTTP, note de performance, poids et nombre de requêtes, compression, cache, HTTP/3, temps de réponse serveur, erreurs console |

Note d'un volet = `100 − somme des poids des défauts constatés`. La note globale est la moyenne
pondérée ci-dessus, et l'urgence (`critique`, `elevee`, `moyenne`, `faible`) découle du nombre
de défauts critiques et de la note globale.

**Règle absolue du moteur : ce qui n'a pas pu être vérifié ne produit aucun constat.** Si le
résolveur DNS est injoignable, l'audit ne conclut pas « aucun SPF » — il inscrit la panne dans
`erreurs`, affichée dans le rapport comme point non vérifiable. C'est ce qui rend le rapport
défendable devant le prospect.

## Sources de données

- **La page d'accueil, une page interne, `robots.txt`, `sitemap.xml`** et une URL inexistante
  (pour tester la page 404) : lecture publique.
- **DNS via DNS-over-HTTPS Cloudflare** : MX, SPF, DMARC (usurpation d'email).
- **Lighthouse via l'API PageSpeed Insights** (`googleapis.com`) : performance,
  accessibilité, SEO, bonnes pratiques, Core Web Vitals et capture d'écran mobile.
  Gratuit ; la clé `PAGESPEED_API_KEY` est optionnelle et augmente le quota.
- **Sondage des fichiers publics** : liste **fixe** de dix chemins classiquement oubliés en
  ligne (`/.env`, `/.git/HEAD`, `/backup.zip`, `/phpinfo.php`, `/server-status`…).

### Cadre du sondage

Lecture seule et non intrusive : requêtes `GET` uniquement, une à la fois, espacées de 300 ms,
timeout de 5 s, sur des chemins publics figés dans le code. Aucune exploitation de faille,
aucun test d'authentification, aucun envoi de données, aucun scan de ports ni de sous-domaines.
Un fichier n'est signalé que si son contenu est caractéristique (une page 404 personnalisée
répondant 200 est écartée). Le sondage se désactive avec `--sans-sonde` (CLI) ou en audit
`rapide`, et le rapport client mentionne explicitement l'absence d'intrusion.

## Du défaut au devis

Chaque règle du catalogue (`audit/regles.ts`) porte trois informations :

```ts
sec_cms_obsolete: {
  pilier: "securite", severite: "critique", poids: 30,
  titre: "CMS dans une version obsolète",
  impact: "Version plus maintenue : failles publiques exploitées automatiquement…",
  effort: "moyen",
  prestations: ["mise_a_jour_cms", "maintenance"],   // ← lignes de devis
}
```

Le devis est la déduplication des prestations appelées par les défauts **réellement mesurés** :
jamais une liste standard. Chaque ligne affiche les défauts qui la justifient, ce qui permet de
défendre le prix point par point.

Deux bascules :

- **aucun site trouvé** → création de site, référencement local, hébergement, maintenance ;
- **note globale < 45** → refonte complète plutôt qu'une accumulation de correctifs (les
  correctifs absorbés par la refonte ne sont plus facturés en double).

Au-delà de trois forfaits, une remise de 10 % s'applique. Les prestations mensuelles sont
séparées du budget projet. Prix, libellés et activation se règlent dans `/admin/prestations`,
ainsi que l'identité portée sur le devis (raison sociale, SIRET, TVA, validité, mentions).

## Les livrables

`generate-proposal` produit et enregistre cinq documents par prospect :

| Type | Contenu |
|---|---|
| `rapport` | Document HTML A4 : notes par volet, capture mobile, défauts avec impact et effort, devis, mentions. Imprimable en PDF depuis `/admin/prospection/:id/rapport` |
| `devis` | Lignes chiffrées, totaux HT / TVA / TTC, mensuel, validité |
| `email` | Objet + corps, trois arguments maximum, chiffrage, demande de créneau, origine des données et opt-out |
| `sms` | Version courte avec un seul argument |
| `script_appel` | Accroche, points à annoncer, questions de qualification, réponses aux quatre objections courantes, conclusion chiffrée |

Les textes sont d'abord construits par templates déterministes, puis reformulés par le gateway
IA (`LOVABLE_API_KEY`, même appel que `geocode-address`). Le prompt ne reçoit que les défauts
constatés et interdit d'en inventer ; sans clé ou en cas d'erreur, les templates partent tels
quels et l'interface l'indique.

## Utilisation

### Depuis l'admin

1. `/admin/prospection` : bouton **Auditer** sur une ligne, ou **Auditer les 10 meilleurs**
   pour enchaîner les prospects non encore audités (l'onglet doit rester ouvert : chaque audit
   est une invocation séparée de l'edge function, qui a son propre budget de temps).
2. `/admin/prospection/:id` : les quatre notes, les défauts par volet, la capture mobile.
3. **Générer la proposition** : devis chiffré, rapport imprimable, email / SMS / script d'appel
   avec bouton copier. Le suivi commercial (statut, notes) reste sur la même page.

### En ligne de commande

```bash
npm run audit -- --url https://site-du-prospect.fr --nom "Garage Dupont"
npm run audit -- --csv prospects.csv --top 10 --sortie rapports
npm run audit -- --url https://site.fr --rapide --sans-sonde
```

Produit dans `rapports/` : `<siren>-rapport.html`, `-email.txt`, `-appel.txt`, `-devis.json`.
`--tarifs mon-catalogue.json` permet d'utiliser ses propres prix sans base de données.

### Via l'API

```http
POST /functions/v1/audit-prospect      { "prospect_id": "…", "profondeur": "complet" }
POST /functions/v1/generate-proposal   { "prospect_id": "…", "avec_ia": true }
```

## Déploiement

```bash
supabase db push
supabase functions deploy audit-prospect generate-proposal
supabase secrets set PAGESPEED_API_KEY=…   # optionnel
```

Le bucket privé `prospect-audits` (captures d'écran) et le catalogue de prestations sont créés
par la migration. `LOVABLE_API_KEY` est déjà configurée si le géocodage fonctionne.

## Limites connues

- Un audit complet prend 15 à 45 s (dont l'attente de PageSpeed) ; l'edge function s'arrête à
  55 s et renvoie ce qui a été collecté.
- PageSpeed Insights sans clé est limité en quota : au-delà, l'audit continue sans note de
  performance ni capture (mentionné dans le rapport).
- L'analyse porte sur la page d'accueil et une page interne, pas sur un parcours complet.
- Les règles de sécurité sont des constats externes : elles ne remplacent pas un test
  d'intrusion, et le rapport le dit explicitement au prospect.
