# Assistant IA de facturation électronique — dossier de travail

Branche orpheline `facturation-ia` : aucun historique partagé avec le projet
de carte de fidélité qui occupe `main`. Destinée à être migrée telle quelle
vers un dépôt dédié.

## Contenu

- [`00-analyse-strategique.md`](00-analyse-strategique.md) — analyse stratégique,
  technique et critique complète : verdict investisseur, état réglementaire au
  26/07/2026 (calendrier 2026-2027, Plateformes Agréées, e-reporting, ViDA),
  analyse concurrentielle, repositionnement recommandé, MVP 3 mois,
  architecture technique, modèles de données SQL, API, agents IA, écrans,
  business model et économie unitaire, coûts de développement, marché
  France/Europe, roadmap 24 mois, acquisition des 100 premiers clients,
  16 faiblesses avec correctifs, kill criteria.

## Migration vers un dépôt dédié

```bash
git remote add facturation git@github.com:<compte>/<nouveau-depot>.git
git push facturation facturation-ia:main
```

L'arbre de cette branche ne contient que ce dossier — rien à nettoyer après
migration. Remonter les fichiers à la racine du nouveau dépôt si souhaité :

```bash
git mv docs/facturation-ia/* . && rmdir -p docs/facturation-ia
```

## Prochaines étapes (hors dépôt)

Dans cet ordre, avant d'écrire du code :

1. 10 entretiens terrain avec des artisans du bâtiment (négoce de matériaux, 7h30).
2. 3 appels à des experts-comptables spécialisés BTP.
3. Grilles tarifaires réelles de 3 Plateformes Agréées proposant une API
   (elles déterminent l'économie unitaire, donc le pricing).
4. 1 h d'avocat : périmètre de l'ordonnance du 19/09/1945 (exercice illégal
   de la profession d'expert-comptable) et responsabilité en cas d'erreur de l'IA.
5. Gel du périmètre du MVP (§7 de l'analyse), puis démarrage.
