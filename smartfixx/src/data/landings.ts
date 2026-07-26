/**
 * Contenu des pages d'atterrissage. Chaque page a son propre texte, écrit pour
 * elle : c'est la condition pour que Google les traite comme des pages utiles
 * et non comme des pages satellites dupliquées.
 */

export type LandingBlock = { h2: string; paragraphs: string[]; bullets?: string[] };

export type Landing = {
  eyebrow: string;
  h1: string;
  h1Accent: string;
  intro: string;
  /** Chiffres affichés sous l'intro. */
  facts: { value: string; label: string }[];
  blocks: LandingBlock[];
  /** Liens contextuels vers les autres pages — le maillage interne compte. */
  related: { label: string; href: string }[];
  ctaTitle: string;
  ctaBody: string;
};

export const LANDINGS: Record<string, Landing> = {
  "/creation-site-internet-asnieres-sur-seine": {
    eyebrow: "Asnières-sur-Seine · Hauts-de-Seine",
    h1: "Création de site internet à",
    h1Accent: "Asnières-sur-Seine.",
    intro:
      "SmartFixx est installé à Asnières-sur-Seine (92600). On conçoit des sites internet sur-mesure pour les commerces, artisans, professions libérales et PME de la commune et des villes voisines — avec la possibilité de se voir sur place plutôt que de tout régler par e-mail.",
    facts: [
      { value: "92600", label: "Basé à Asnières-sur-Seine" },
      { value: "2 à 3 sem.", label: "Site vitrine livré" },
      { value: "1 490 €", label: "À partir de, HT" },
    ],
    blocks: [
      {
        h2: "Un prestataire que vous pouvez rencontrer",
        paragraphs: [
          "La plupart des sites vendus à Asnières le sont par des agences qui n'y sont pas. On travaille l'inverse : le cadrage peut se faire dans vos locaux, sur la Grande Rue, aux Bourguignons, à Gennevilliers ou aux Grésillons, en regardant comment vous travaillez vraiment plutôt qu'en remplissant un questionnaire.",
          "C'est particulièrement utile quand le site doit refléter un lieu physique — un cabinet, un atelier, une boutique. On photographie, on écrit les textes avec vous, et on repart avec ce qu'il faut pour livrer.",
        ],
      },
      {
        h2: "Ce qu'un site local doit faire pour être trouvé",
        paragraphs: [
          "À Asnières, un client ne tape presque jamais votre nom : il tape votre métier suivi de la ville, ou il cherche « près de moi » depuis son téléphone. Sur ces requêtes, Google affiche d'abord une carte avec trois fiches, puis les résultats classiques. Être bien placé demande deux choses distinctes : une fiche Google Business Profile complète et un site qui confirme l'ancrage local.",
          "On s'occupe du second, et on vous met la fiche en place avec vous — parce que sans elle, le meilleur site du monde reste invisible sur les recherches géolocalisées.",
        ],
        bullets: [
          "Adresse, horaires et zone d'intervention lisibles par Google (données structurées LocalBusiness)",
          "Une page par prestation réellement proposée, avec un contenu propre",
          "Chargement rapide sur mobile — la majorité des recherches locales s'y font",
          "Création et paramétrage de votre fiche Google Business Profile",
          "Suivi des avis clients, qui pèsent lourd dans le classement de la carte",
        ],
      },
      {
        h2: "Communes couvertes autour d'Asnières",
        paragraphs: [
          "Bois-Colombes, Clichy, Colombes, Courbevoie, Gennevilliers, Levallois-Perret, Villeneuve-la-Garenne et les arrondissements du nord-ouest de Paris. Au-delà, on travaille très bien à distance : visio pour les points d'étape, lien de recette accessible en permanence.",
        ],
      },
      {
        h2: "Combien ça coûte, concrètement",
        paragraphs: [
          "Un site vitrine jusqu'à cinq pages démarre à 1 490 € HT. Un site sur-mesure avec direction artistique dédiée, animations et rédaction du contenu démarre à 3 900 € HT. La maintenance est facultative, à partir de 79 €/mois — votre site fonctionne sans elle.",
          "Le devis est ferme : une fois signé, le prix ne bouge plus. Et si votre besoin réel est plus petit que ce que vous imaginiez, on vous le dit.",
        ],
      },
    ],
    related: [
      { label: "Création de site en Île-de-France", href: "/creation-site-internet-ile-de-france" },
      { label: "Refonte sans perdre son référencement", href: "/refonte-site-internet" },
      { label: "Automatisation informatique", href: "/automatisation-informatique" },
    ],
    ctaTitle: "Un projet à Asnières ou dans le 92 ?",
    ctaBody:
      "Décrivez votre besoin en quelques lignes. On répond sous 24 h ouvrées, et le premier échange ne coûte rien.",
  },

  "/creation-site-internet-ile-de-france": {
    eyebrow: "Île-de-France · Hauts-de-Seine · Paris",
    h1: "Création de site internet en",
    h1Accent: "Île-de-France.",
    intro:
      "Depuis Asnières-sur-Seine, SmartFixx conçoit et refond des sites internet pour les entreprises franciliennes. Une particularité : on ne s'arrête pas au site. Une bonne partie de notre travail consiste à automatiser ce qui se passe derrière — devis, factures, plannings, données qui circulent entre deux logiciels.",
    facts: [
      { value: "48 h", label: "Première maquette" },
      { value: "3 jours", label: "Devis ferme et détaillé" },
      { value: "100 %", label: "Code livré et documenté" },
    ],
    blocks: [
      {
        h2: "Le marché francilien est saturé de sites qui se ressemblent",
        paragraphs: [
          "En Île-de-France, la concurrence sur presque tous les métiers est dense, et la plupart des sites sortent du même moule : un thème acheté, trois photos de banque d'images, un formulaire. Ils ne coûtent pas cher et ils ne servent pas à grand-chose, parce qu'ils ne donnent aucune raison de choisir cette entreprise plutôt qu'une autre.",
          "On travaille autrement : direction artistique propre à chaque client, textes écrits pour le métier réel, et une structure pensée pour les requêtes sur lesquelles vous pouvez sérieusement espérer être trouvé — pas pour « agence web Paris ».",
        ],
      },
      {
        h2: "Le référencement se joue d'abord sur la technique",
        paragraphs: [
          "Beaucoup de sites franciliens perdent des positions pour des raisons purement techniques : pages lentes, structure de titres incohérente, absence de données structurées, images non compressées, contenu chargé en JavaScript que les robots lisent mal.",
          "Chaque site qu'on livre part avec un HTML pré-généré (le contenu est lisible sans exécuter de JavaScript), des données structurées schema.org, un sitemap, des polices auto-hébergées et un budget de chargement tenu. Ce n'est pas une option facturée en plus : c'est le socle.",
        ],
        bullets: [
          "HTML pré-généré au build : le contenu est indexable immédiatement",
          "Données structurées LocalBusiness, Service et FAQPage",
          "Core Web Vitals mesurés avant et après la mise en ligne",
          "Polices auto-hébergées : aucune requête tierce, rien à déclarer en RGPD",
          "Sitemap, robots.txt et Search Console configurés le jour du lancement",
        ],
      },
      {
        h2: "Zones où l'on intervient sur place",
        paragraphs: [
          "Hauts-de-Seine en priorité — Asnières-sur-Seine, Clichy, Levallois-Perret, Courbevoie, Colombes, Gennevilliers, Bois-Colombes — ainsi que Paris. Sur le reste de l'Île-de-France, on travaille à distance avec des points en visio, ce qui convient à la grande majorité des projets.",
        ],
      },
    ],
    related: [
      {
        label: "Création de site à Asnières-sur-Seine",
        href: "/creation-site-internet-asnieres-sur-seine",
      },
      { label: "Refonte de site internet", href: "/refonte-site-internet" },
      { label: "Automatisation informatique", href: "/automatisation-informatique" },
    ],
    ctaTitle: "Parlons de votre projet francilien",
    ctaBody:
      "Un site à créer, un site à reprendre, ou des outils à faire dialoguer : on vous donne un premier avis honnête sous 24 h ouvrées.",
  },

  "/refonte-site-internet": {
    eyebrow: "Refonte · Reprise de l'existant",
    h1: "Refondre son site sans",
    h1Accent: "perdre son référencement.",
    intro:
      "C'est la peur légitime de tout le monde : refaire son site et voir le trafic s'effondrer. Ça arrive, et presque toujours pour la même raison — les anciennes URL ont disparu sans redirection. Une refonte préparée fait généralement l'inverse : elle fait progresser le référencement, parce qu'elle corrige la vitesse et la structure.",
    facts: [
      { value: "301", label: "Redirections planifiées" },
      { value: "0", label: "URL perdue en route" },
      { value: "4 à 8 sem.", label: "Refonte complète" },
    ],
    blocks: [
      {
        h2: "On commence par l'audit, pas par le design",
        paragraphs: [
          "Avant de dessiner quoi que ce soit, on relève l'état réel de l'existant : liste complète des URL, positions actuelles sur Google, pages qui apportent du trafic, erreurs techniques, poids des pages, structure des titres, données structurées présentes ou absentes.",
          "Ce relevé sert deux fois. Il dit ce qui mérite d'être conservé — un article qui ramène du monde depuis trois ans ne se jette pas — et il devient la référence contre laquelle on mesure l'après.",
        ],
      },
      {
        h2: "Le plan de redirections, la pièce qui évite la catastrophe",
        paragraphs: [
          "Chaque ancienne URL est associée à sa nouvelle destination avant la bascule, en redirection permanente 301. Les pages sans équivalent sont redirigées vers la page la plus proche, jamais vers l'accueil en bloc — Google traite ça comme une page d'erreur déguisée.",
          "Le jour de la mise en ligne, le nouveau sitemap est soumis, la Search Console est vérifiée, et on surveille les erreurs d'exploration pendant les semaines qui suivent.",
        ],
        bullets: [
          "Inventaire exhaustif des URL et de leurs positions actuelles",
          "Correspondance ancienne → nouvelle URL validée avant bascule",
          "Redirections 301 en place dès la mise en ligne",
          "Contenus performants conservés et retravaillés, pas supprimés",
          "Surveillance des erreurs d'exploration après le lancement",
        ],
      },
      {
        h2: "« Personne ne sait plus modifier mon site »",
        paragraphs: [
          "C'est l'autre motif de refonte le plus fréquent, et parfois le plus urgent : le prestataire d'origine a disparu, les accès sont perdus, ou le site tourne sur une version si ancienne qu'elle n'est plus sécurisée.",
          "Dans ce cas, on récupère ce qui est récupérable — contenu, images, données clients, commandes — et on reconstruit sur une base que vous maîtrisez. Code, domaine, hébergement, comptes : tout à votre nom, avec les accès. Un autre prestataire doit pouvoir reprendre derrière nous, c'est pour ça que le code est documenté.",
        ],
      },
    ],
    related: [
      {
        label: "Création de site à Asnières-sur-Seine",
        href: "/creation-site-internet-asnieres-sur-seine",
      },
      { label: "Création de site en Île-de-France", href: "/creation-site-internet-ile-de-france" },
      { label: "Automatisation informatique", href: "/automatisation-informatique" },
    ],
    ctaTitle: "Faites auditer votre site avant de le refaire",
    ctaBody:
      "On vous dit par écrit ce qui se récupère, ce qui se refait, et ce que ça coûte — avant tout engagement.",
  },

  "/automatisation-informatique": {
    eyebrow: "Automatisation · Interconnexion",
    h1: "Automatisation informatique et",
    h1Accent: "interconnexion de logiciels.",
    intro:
      "La double saisie coûte plus cher qu'un développement. Si vos équipes recopient les mêmes informations d'un logiciel à l'autre, retapent des chiffres dans un tableur chaque lundi ou renvoient les mêmes rapports à la main, il y a presque toujours moyen de supprimer ce travail.",
    facts: [
      { value: "≈ 6 h", label: "Récupérées par semaine" },
      { value: "890 €", label: "Par connecteur, à partir de" },
      { value: "24/7", label: "Sans intervention humaine" },
    ],
    blocks: [
      {
        h2: "Ce qui s'automatise vraiment",
        paragraphs: [
          "La règle est simple : si une tâche revient régulièrement et suit des règles qu'on peut écrire, elle peut disparaître. Peu importe le logiciel — outil métier, ERP, CRM, logiciel de caisse, tableur partagé, boîte mail, service en ligne.",
        ],
        bullets: [
          "Synchroniser des données entre deux logiciels qui s'ignorent",
          "Générer un rapport, le mettre en forme et l'envoyer aux bonnes personnes",
          "Importer des fichiers déposés sur un serveur ou reçus par e-mail",
          "Extraire des informations de PDF ou de factures scannées",
          "Déclencher une alerte quand un seuil est dépassé ou une échéance approche",
          "Relancer automatiquement les impayés",
          "Alimenter un tableau de bord consolidé, à jour en permanence",
        ],
      },
      {
        h2: "Et si mon logiciel n'a pas d'API ?",
        paragraphs: [
          "C'est la question qu'on nous pose le plus. Il reste presque toujours un chemin : un export planifié, un dépôt de fichiers, une base de données accessible en lecture, une réception par e-mail, ou en dernier recours le pilotage direct de l'interface — un robot qui refait vos manipulations, à l'heure, sans se tromper.",
          "On l'évalue pendant le cadrage et on vous dit franchement si c'est jouable, à quel coût, et avec quelles limites. Il arrive qu'on réponde que le jeu n'en vaut pas la chandelle.",
        ],
      },
      {
        h2: "Des données sensibles, traitées comme telles",
        paragraphs: [
          "Rien ne touche vos données réelles avant validation : on branche d'abord un environnement de test. Les accès sont limités au strict nécessaire et révoqués en fin de mission, les échanges sont chiffrés, chaque exécution laisse un journal consultable, et l'hébergement reste en Europe.",
          "Quand le contexte l'exige — données de santé, données RH, informations clients — un accord de traitement des données est signé avant le démarrage.",
        ],
      },
      {
        h2: "Ce que vous récupérez à la fin",
        paragraphs: [
          "L'automatisation en production, son environnement de test, le journal d'exécution, les alertes en cas d'échec, la documentation du fonctionnement et des règles appliquées. Le tout sur des comptes qui vous appartiennent.",
          "Aucun abonnement n'est nécessaire pour que ça continue de tourner. La supervision est une option, pas une dépendance.",
        ],
      },
    ],
    related: [
      {
        label: "Création de site à Asnières-sur-Seine",
        href: "/creation-site-internet-asnieres-sur-seine",
      },
      { label: "Création de site en Île-de-France", href: "/creation-site-internet-ile-de-france" },
      { label: "Refonte de site internet", href: "/refonte-site-internet" },
    ],
    ctaTitle: "Décrivez la tâche qui vous fait perdre du temps",
    ctaBody:
      "On vous dit si elle est automatisable, combien d'heures elle représente et ce que coûterait sa suppression.",
  },
};
