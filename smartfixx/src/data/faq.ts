/**
 * Source unique des questions fréquentes : elles alimentent à la fois la section
 * FAQ et le bloc `FAQPage` des données structurées. Les réponses sont écrites
 * pour être utiles telles quelles — c'est ce que Google reprend en extrait.
 */
export const FAQ_ITEMS = [
  {
    q: "Combien coûte la création d'un site web ?",
    a: "À partir de 1 490 € HT pour un site vitrine jusqu'à 5 pages, et à partir de 3 900 € HT pour un site sur-mesure avec direction artistique dédiée, animations et rédaction du contenu. Une automatisation démarre à 890 € HT par connecteur. Le devis final dépend du périmètre réel : il est ferme, détaillé, et il ne bouge plus une fois signé.",
  },
  {
    q: "Combien de temps prend la création d'un site internet ?",
    a: "Entre 2 et 3 semaines pour un site vitrine standard, 4 à 8 semaines pour un projet sur-mesure ou une refonte e-commerce. Vous recevez une première maquette sous 48 h après le cadrage, puis vous suivez l'avancement sur un lien de recette mis à jour en continu.",
  },
  {
    q: "Vous pouvez reprendre un site fait par quelqu'un d'autre ?",
    a: "Oui, c'est une bonne partie de notre activité. On commence par un audit technique et SEO pour savoir ce qui se récupère et ce qui se refait : hébergement, code, contenu, positions Google actuelles. Vous recevez le verdict par écrit avant tout engagement, y compris quand la conclusion est qu'une simple optimisation suffit.",
  },
  {
    q: "Une refonte va-t-elle me faire perdre mon référencement ?",
    a: "Pas si elle est préparée. On relève l'intégralité des URL existantes et leurs positions, on conserve les contenus qui performent, et on met en place un plan de redirections 301 complet avant la bascule. Les données structurées, le sitemap et la Search Console sont repris le jour de la mise en ligne. Une refonte bien menée fait généralement progresser le référencement, parce qu'elle corrige la vitesse et la structure.",
  },
  {
    q: "Concrètement, qu'est-ce que vous pouvez automatiser ?",
    a: "Tout échange régulier entre deux systèmes, et toute tâche répétitive faite à la main : synchroniser des données entre deux logiciels, générer et envoyer des rapports, importer des fichiers déposés sur un serveur ou reçus par mail, créer des alertes sur des seuils, relancer des impayés, alimenter un tableau de bord, remplir des documents, extraire des informations de PDF. La règle est simple : si une tâche revient chaque semaine et suit des règles, elle peut disparaître.",
  },
  {
    q: "Et si mon logiciel n'a pas d'API ?",
    a: "Il reste presque toujours un chemin : exports planifiés, dépôts de fichiers, base de données accessible en lecture, réception par e-mail, ou pilotage direct de l'interface (RPA) quand il n'y a vraiment rien d'autre. On l'évalue pendant le cadrage et on vous dit honnêtement si c'est jouable, à quel coût, et avec quelles limites.",
  },
  {
    q: "Combien de temps une automatisation fait-elle gagner ?",
    a: "Cela dépend du volume, mais un connecteur qui supprime une double saisie quotidienne récupère typiquement plusieurs heures par semaine, et un rapport mensuel automatisé économise souvent une journée complète par mois. On chiffre l'estimation au cadrage à partir du temps réellement passé aujourd'hui, pour que vous puissiez comparer au coût du développement.",
  },
  {
    q: "Mes données sont sensibles. Comment vous les traitez ?",
    a: "Environnement de test d'abord, jamais de bascule sur des données réelles sans validation. Accès limités au strict nécessaire, chiffrement des échanges, journal de chaque exécution, hébergement en Europe. Un accord de traitement des données est signé quand le contexte le demande, et les accès sont révoqués en fin de mission.",
  },
  {
    q: "Le site m'appartient vraiment ?",
    a: "Oui. Code, nom de domaine, hébergement, comptes : tout est à votre nom et vous en gardez les accès. Aucun abonnement n'est nécessaire pour que votre site continue de fonctionner — la maintenance est une option, pas une prise d'otage. Un autre prestataire doit pouvoir reprendre derrière nous, c'est pour ça que le code est documenté.",
  },
  {
    q: "Faites-vous aussi du développement sur-mesure et des applications métier ?",
    a: "Oui. Quand aucun logiciel du marché ne correspond à votre process, on développe l'outil interne : saisie, contrôles, droits par utilisateur, tableaux de bord, exports. C'est souvent moins cher qu'un abonnement à un logiciel qu'il faudrait de toute façon tordre pour l'adapter.",
  },
  {
    q: "Travaillez-vous avec des TPE et des indépendants ?",
    a: "Oui, c'est même le cœur de la clientèle. Le premier échange sert justement à vérifier que le budget et le besoin sont cohérents. Si un site de 5 pages suffit, on ne vous vendra pas une application web.",
  },
  {
    q: "Vous travaillez à distance ou sur site ?",
    a: "À distance par défaut, avec des points en visio réguliers, partout en France et en francophonie. Des rendez-vous sur site sont possibles pour le cadrage et la formation des équipes, notamment sur les projets d'automatisation où il faut voir comment le travail se fait réellement.",
  },
] as const;
