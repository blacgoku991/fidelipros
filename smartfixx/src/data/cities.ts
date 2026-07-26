/**
 * Réseau de pages locales.
 *
 * Chaque commune a ici des données factuelles réelles (code postal, communes
 * limitrophes, transports, tissu économique) ET trois blocs de texte écrits
 * spécifiquement pour elle. C'est indispensable : Google déclasse les « pages
 * satellites », c'est-à-dire les pages locales identiques où seul le nom de la
 * ville change. Une page ajoutée sans texte propre fait plus de mal que de bien.
 *
 * Pour ajouter une commune : dupliquer une entrée, remplacer TOUTES les données
 * factuelles et RÉÉCRIRE les trois blocs. Compter 20 minutes de rédaction par
 * ville. Mieux vaut dix pages solides que cinquante pages creuses.
 */

export type City = {
  slug: string;
  /** Nom exact, tel qu'il s'écrit dans les recherches. */
  name: string;
  postalCode: string;
  department: string;
  departmentCode: string;
  /** Rattachement au hub départemental. */
  hub: string;
  /** Distance depuis le siège d'Asnières, en langage naturel. */
  reach: string;
  /** Communes limitrophes — sert au maillage et au contenu. */
  neighbours: string[];
  transport: string;
  /** Ce qui caractérise le tissu économique local. Unique par ville. */
  fabric: string;
  /** Pourquoi la visibilité locale se joue différemment ici. Unique par ville. */
  searchAngle: string;
  /** Profils de clients typiques sur la commune. */
  clients: string[];
  /** L'angle d'attaque local, propre à la ville. Unique. */
  opportunity: string;
  /** Question fréquente spécifique à la commune — alimente aussi le FAQPage. */
  faq: { q: string; a: string };
};

export const CITIES: City[] = [
  {
    slug: "clichy",
    name: "Clichy",
    postalCode: "92110",
    department: "Hauts-de-Seine",
    departmentCode: "92",
    hub: "/agence-web-hauts-de-seine",
    reach: "commune limitrophe d'Asnières, dix minutes de nos bureaux",
    neighbours: ["Asnières-sur-Seine", "Levallois-Perret", "Saint-Ouen-sur-Seine", "Paris 17e"],
    transport: "métro 13 (Mairie de Clichy), RER C, nombreuses lignes de bus vers Paris",
    fabric:
      "Clichy a remplacé ses usines par un mélange peu banal : de grands sièges sociaux d'un côté, un tissu très dense de commerces et d'artisans de l'autre, souvent sur la même rue. Cette double nature crée un décalage visible en ligne — les grands groupes ont des sites soignés, les indépendants qui les entourent souvent rien du tout, ou une page Facebook en guise de vitrine.",
    searchAngle:
      "À Clichy, la concurrence sur les recherches locales vient autant de Paris 17e que de la commune elle-même : les habitants cherchent indifféremment des deux côtés du périphérique. Une page qui ne mentionne que « Clichy » se prive de la moitié de son marché ; il faut assumer la proximité parisienne dans le contenu sans pour autant diluer l'ancrage local.",
    clients: [
      "Artisans du bâtiment et de la rénovation",
      "Cabinets d'avocats et d'expertise comptable",
      "Restaurants et commerces de bouche",
      "Agences immobilières de quartier",
    ],
    opportunity:
      "L'opportunité clichoise tient en une observation : les grands sièges attirent chaque jour des milliers de salariés qui déjeunent, se soignent et font leurs courses sur place, mais cherchent tout sur leur téléphone, sans connaître le quartier. Un commerce qui apparaît sur « près de moi » capte ce flux ; celui d'à côté, invisible en ligne, le regarde passer.",
    faq: {
      q: "Faut-il viser Clichy ou Paris 17e ?",
      a: "Les deux, mais pas sur la même page. On travaille Clichy sur la page principale, où la concurrence est tenable, et le 17e sur une page distincte si votre clientèle traverse vraiment le périphérique. Tout mélanger sur une seule page fait perdre les deux.",
    },
  },
  {
    slug: "levallois-perret",
    name: "Levallois-Perret",
    postalCode: "92300",
    department: "Hauts-de-Seine",
    departmentCode: "92",
    hub: "/agence-web-hauts-de-seine",
    reach: "à un pont d'Asnières, quinze minutes",
    neighbours: ["Clichy", "Neuilly-sur-Seine", "Courbevoie", "Paris 17e"],
    transport: "métro 3 (Anatole France, Louise Michel), gare de Clichy-Levallois",
    fabric:
      "L'une des communes les plus denses d'Europe, et cela change tout : à Levallois, votre zone de chalandise réelle tient parfois en trois rues. Le tissu est massivement tertiaire — conseil, finance, communication — avec en dessous un commerce de proximité qui vit du flux de bureaux le midi et des habitants le soir.",
    searchAngle:
      "Ici, le nombre d'entreprises au kilomètre carré fait que les recherches génériques sont ultra-disputées, mais que les requêtes précises restent accessibles. Un cabinet de conseil qui vise « conseil en organisation Levallois » a une vraie chance ; le même sur « conseil Paris » n'en a aucune. Toute la valeur est dans le choix des expressions, pas dans le volume de pages.",
    clients: [
      "Sociétés de conseil et professions du chiffre",
      "Cabinets médicaux et paramédicaux",
      "Salons, instituts et services à la personne",
      "Boutiques et concept stores",
    ],
    opportunity:
      "Levallois a une particularité qui change le calcul : la population double en journée. Un restaurant ou un service de proximité y a deux clientèles distinctes, avec des horaires, des attentes et des mots-clés différents. Un site qui ne parle qu'aux habitants laisse la moitié du chiffre d'affaires sur la table.",
    faq: {
      q: "Mon local est minuscule, un site vaut-il le coup ?",
      a: "À Levallois, oui — précisément parce que la densité fait que vos clients potentiels sont à trois minutes à pied. Ce qui compte n'est pas la taille du local mais d'apparaître quand quelqu'un cherche votre métier dans le quartier. C'est le meilleur retour possible pour un petit commerce.",
    },
  },
  {
    slug: "courbevoie",
    name: "Courbevoie",
    postalCode: "92400",
    department: "Hauts-de-Seine",
    departmentCode: "92",
    hub: "/agence-web-hauts-de-seine",
    reach: "vingt minutes d'Asnières par la Seine",
    neighbours: ["La Garenne-Colombes", "Levallois-Perret", "Nanterre", "Puteaux"],
    transport: "La Défense (RER A, métro 1, transilien L, tramway T2), gare de Bécon-les-Bruyères",
    fabric:
      "Courbevoie vit avec une frontière intérieure nette : d'un côté les tours de La Défense et leurs sièges internationaux, de l'autre des quartiers comme Bécon-les-Bruyères qui fonctionnent comme un village avec ses commerçants et ses professions libérales. Les deux mondes ne se cherchent pas du tout de la même façon sur Google.",
    searchAngle:
      "La proximité de La Défense fausse les intuitions : beaucoup d'entreprises courbevoisiennes se croient obligées de communiquer comme un grand groupe, alors que leur clientèle est de quartier. On voit régulièrement des sites très corporate qui ne convertissent rien, faute d'avoir jamais nommé la commune ni le quartier où le client se trouve vraiment.",
    clients: [
      "Prestataires B2B travaillant avec La Défense",
      "Commerçants et artisans de Bécon-les-Bruyères",
      "Professions libérales et santé",
      "Petites structures de services aux entreprises",
    ],
    opportunity:
      "Le cas courbevoisien le plus fréquent : une entreprise qui vit de La Défense mais dont le site parle comme si elle y avait son siège. Résultat, elle est invisible sur les recherches de quartier et illisible pour les acheteurs des tours, qui cherchent des compétences précises. Séparer les deux discours débloque souvent la situation en quelques semaines.",
    faq: {
      q: "Je travaille avec des grands comptes de La Défense, quel type de site ?",
      a: "Un site qui rassure sur la solidité : références, méthode, conformité, interlocuteur identifié. Les acheteurs de grands groupes ne cherchent pas de l'esthétique, ils cherchent à réduire leur risque. C'est un exercice très différent d'un site grand public.",
    },
  },
  {
    slug: "colombes",
    name: "Colombes",
    postalCode: "92700",
    department: "Hauts-de-Seine",
    departmentCode: "92",
    hub: "/agence-web-hauts-de-seine",
    reach: "quinze minutes d'Asnières, commune voisine",
    neighbours: ["Asnières-sur-Seine", "Bois-Colombes", "Gennevilliers", "Nanterre"],
    transport: "transilien J et L, tramway T2, RER C à Gennevilliers",
    fabric:
      "Colombes est étendue et très hétérogène : des zones d'activité au nord, des quartiers pavillonnaires au centre, un pôle sportif d'envergure autour du stade Yves-du-Manoir. Une entreprise colombienne peut avoir une clientèle strictement locale ou desservir tout le nord-ouest francilien depuis un entrepôt — les deux stratégies de visibilité n'ont rien en commun.",
    searchAngle:
      "L'étendue de la commune est un piège méconnu : un habitant du Petit-Colombes et un habitant du centre ne parcourent pas les mêmes distances et ne tapent pas les mêmes requêtes. Sur une ville comme celle-ci, préciser le quartier dans le contenu pèse parfois plus que répéter le nom de la ville.",
    clients: [
      "Entreprises du bâtiment et de la logistique",
      "Commerces de proximité et franchises",
      "Associations sportives et clubs",
      "Artisans indépendants",
    ],
    opportunity:
      "Colombes est assez grande pour qu'une seule page ne suffise pas. Nous découpons souvent par quartier — centre, Petit-Colombes, Europe, Fossés-Jean — parce qu'un habitant ne franchit pas la commune pour un service de proximité. Cette granularité est le levier le plus rentable sur les villes étendues, et presque personne ne l'exploite.",
    faq: {
      q: "Ma clientèle dépasse Colombes, comment gérer ?",
      a: "On construit une page pour Colombes et une page par commune réellement desservie, chacune avec son contenu propre. Une page unique qui liste dix villes ne ressort sur aucune : Google a besoin de comprendre à quelle localité chaque page répond.",
    },
  },
  {
    slug: "bois-colombes",
    name: "Bois-Colombes",
    postalCode: "92270",
    department: "Hauts-de-Seine",
    departmentCode: "92",
    hub: "/agence-web-hauts-de-seine",
    reach: "dix minutes d'Asnières, à pied depuis certains quartiers",
    neighbours: ["Asnières-sur-Seine", "Colombes", "Courbevoie", "La Garenne-Colombes"],
    transport: "transilien J (gare de Bois-Colombes), bus vers La Défense et Paris",
    fabric:
      "Petite commune résidentielle, essentiellement pavillonnaire, avec une concentration inhabituelle de professions libérales et d'indépendants qui travaillent depuis chez eux ou dans un local de quartier. Le bouche-à-oreille y fonctionne encore très fort — ce qui fait croire, à tort, qu'un site ne sert à rien.",
    searchAngle:
      "Sur une commune de cette taille, le volume de recherches est faible mais l'intention est très forte : quelqu'un qui tape votre métier suivi de « Bois-Colombes » cherche à prendre rendez-vous maintenant. Ce sont les requêtes les plus rentables du web local, et les plus faciles à gagner puisque presque personne ne les travaille sérieusement.",
    clients: [
      "Professions libérales et santé",
      "Coachs, thérapeutes et formateurs indépendants",
      "Artisans à domicile",
      "Petits commerces de quartier",
    ],
    opportunity:
      "L'erreur classique à Bois-Colombes est de conclure que le bouche-à-oreille suffit. Il fonctionne, mais il ne capte pas les nouveaux arrivants — et une commune résidentielle se renouvelle en permanence. Ces familles cherchent un dentiste, un plombier, un professeur particulier sur Google, sans réseau local à interroger.",
    faq: {
      q: "Le volume de recherche est faible, est-ce rentable ?",
      a: "Faible en volume, très fort en intention. Vingt recherches par mois sur votre métier à Bois-Colombes valent mieux que mille visites sans intention d'achat : ce sont des gens qui veulent prendre rendez-vous. Et comme presque personne ne travaille ces requêtes, la première place se prend vite.",
    },
  },
  {
    slug: "gennevilliers",
    name: "Gennevilliers",
    postalCode: "92230",
    department: "Hauts-de-Seine",
    departmentCode: "92",
    hub: "/agence-web-hauts-de-seine",
    reach: "commune limitrophe d'Asnières, dix minutes",
    neighbours: ["Asnières-sur-Seine", "Colombes", "Villeneuve-la-Garenne", "Saint-Ouen-sur-Seine"],
    transport: "métro 13 (Gabriel Péri, Les Agnettes), tramway T1, RER C",
    fabric:
      "Gennevilliers reste l'une des rares communes de la petite couronne à vivre d'industrie et de logistique, autour du port. Cela donne un tissu de PME techniques : transport, négoce, second œuvre, maintenance industrielle. Des métiers où le site sert moins à séduire qu'à rassurer un acheteur professionnel avant un appel d'offres.",
    searchAngle:
      "C'est ici que l'automatisation prend souvent le pas sur le site vitrine. Une entreprise de négoce qui ressaisit ses bons de livraison à la main perd bien plus d'argent qu'elle n'en gagnerait avec une page de plus. On commence donc fréquemment par regarder les flux internes avant de parler design.",
    clients: [
      "PME industrielles et de négoce",
      "Transport, logistique et manutention",
      "Entreprises de second œuvre",
      "Prestataires de maintenance technique",
    ],
    opportunity:
      "À Gennevilliers, le calcul se fait rarement en visiteurs. Une PME de négoce qui ressaisit chaque bon de livraison, chaque commande fournisseur et chaque relance client perd plusieurs journées par mois — un coût bien supérieur à celui d'un site. On commence donc souvent par cartographier les flux internes, et le site vient ensuite.",
    faq: {
      q: "Un site sert-il à quelque chose en B2B industriel ?",
      a: "Oui, mais pas pour la même raison : il sert à passer le filtre. Un acheteur qui reçoit votre devis vérifie votre site avant de vous référencer. S'il n'y a rien, ou un site de 2012, le doute s'installe. Le site ne génère pas la vente, il évite de la perdre.",
    },
  },
  {
    slug: "nanterre",
    name: "Nanterre",
    postalCode: "92000",
    department: "Hauts-de-Seine",
    departmentCode: "92",
    hub: "/agence-web-hauts-de-seine",
    reach: "vingt-cinq minutes d'Asnières",
    neighbours: ["Colombes", "Courbevoie", "Rueil-Malmaison", "Puteaux"],
    transport: "RER A (Nanterre-Ville, Nanterre-Préfecture), transilien L, tramway T2",
    fabric:
      "Préfecture des Hauts-de-Seine, Nanterre cumule administrations, université, grands équipements et une vraie zone d'activité. Résultat : beaucoup de structures y travaillent avec le secteur public ou para-public, ce qui impose des exigences précises — accessibilité, clarté documentaire, traçabilité des échanges.",
    searchAngle:
      "Travailler avec des donneurs d'ordre publics change les priorités : la conformité d'accessibilité et la capacité à produire des pièces justificatives comptent souvent davantage que le référencement pur. Un site nanterrien mal structuré ne perd pas seulement des visiteurs, il perd des dossiers.",
    clients: [
      "Prestataires du secteur public et associatif",
      "Structures de formation et d'insertion",
      "PME de la zone d'activité",
      "Professions libérales du centre-ville",
    ],
    opportunity:
      "Le cas nanterrien tient à la commande publique : marchés, subventions, appels à projets imposent des exigences d'accessibilité et de traçabilité que la plupart des sites ne respectent pas. Un site non accessible peut écarter un dossier avant même son examen — un motif d'échec invisible, jamais expliqué au candidat.",
    faq: {
      q: "L'accessibilité est-elle obligatoire pour mon site ?",
      a: "Elle l'est pour les organismes publics et leurs délégataires, et elle devient un critère d'attribution ailleurs. Au-delà de l'obligation, un site accessible est mieux compris par Google : la structure de titres, les alternatives d'images et le contraste servent les deux objectifs en même temps.",
    },
  },
  {
    slug: "boulogne-billancourt",
    name: "Boulogne-Billancourt",
    postalCode: "92100",
    department: "Hauts-de-Seine",
    departmentCode: "92",
    hub: "/agence-web-hauts-de-seine",
    reach: "trente minutes d'Asnières",
    neighbours: ["Paris 16e", "Issy-les-Moulineaux", "Sèvres", "Saint-Cloud"],
    transport: "métro 9 et 10, tramway T2, nombreuses lignes de bus",
    fabric:
      "La commune la plus peuplée des Hauts-de-Seine, et l'une des plus concurrentielles qui soient sur le web local. Santé, médias, audiovisuel, professions libérales : la densité de prestataires y est telle que presque tous les métiers ont déjà plusieurs dizaines de concurrents correctement référencés.",
    searchAngle:
      "Sur un marché aussi saturé, viser la requête la plus large est une perte de temps et d'argent. Ce qui fonctionne, c'est la spécialisation : une page par spécialité réelle, une par quartier quand la clientèle est de proximité, et un contenu qui répond à des questions précises que les concurrents laissent sans réponse.",
    clients: [
      "Praticiens de santé et cabinets de groupe",
      "Métiers de l'image et de l'audiovisuel",
      "Avocats et conseils",
      "Commerces et services haut de gamme",
    ],
    opportunity:
      "Sur une commune où chaque métier compte des dizaines de concurrents référencés, la seule stratégie qui tient est le contenu que personne n'écrit : les questions précises que les clients posent avant de choisir. Ces pages ne font pas de volume mais amènent des gens décidés, et elles se positionnent en quelques semaines faute de concurrence.",
    faq: {
      q: "Comment sortir du lot à Boulogne-Billancourt ?",
      a: "En arrêtant de viser la requête générique. Une page par spécialité réelle, une par quartier quand la clientèle est de proximité, et des réponses écrites aux questions que vos concurrents laissent en suspens. C'est plus long à construire qu'une page d'accueil, et c'est ce qui produit des résultats durables.",
    },
  },
  {
    slug: "neuilly-sur-seine",
    name: "Neuilly-sur-Seine",
    postalCode: "92200",
    department: "Hauts-de-Seine",
    departmentCode: "92",
    hub: "/agence-web-hauts-de-seine",
    reach: "vingt minutes d'Asnières",
    neighbours: ["Levallois-Perret", "Courbevoie", "Puteaux", "Paris 16e et 17e"],
    transport: "métro 1 (Les Sablons, Pont de Neuilly), RER A à proximité",
    fabric:
      "Tissu très marqué par les professions libérales et la santé : cabinets médicaux, chirurgiens, avocats, family offices. Une clientèle qui juge un prestataire sur la sobriété et la crédibilité, pas sur l'effet visuel — et qui remarque immédiatement un site qui fait bon marché.",
    searchAngle:
      "À Neuilly, le référencement compte moins que la conversion. Le patient ou le client arrive souvent par recommandation, tape le nom du praticien, et décide en trente secondes sur ce qu'il voit. Un site lent, daté ou approximatif fait perdre des rendez-vous déjà acquis — c'est une perte silencieuse, invisible dans les statistiques.",
    clients: [
      "Chirurgiens, praticiens et cabinets de santé",
      "Avocats et conseils patrimoniaux",
      "Cabinets de recrutement",
      "Commerces et services de standing",
    ],
    opportunity:
      "La perte la plus fréquente à Neuilly est invisible : un patient recommandé cherche le nom du praticien, tombe sur un site lent ou daté, et ne rappelle pas. Aucune statistique ne l'enregistre, puisqu'il n'y a jamais eu de contact. C'est pourtant là que se joue le rendement d'un site sur cette commune.",
    faq: {
      q: "Mes patients viennent par recommandation, à quoi bon un site ?",
      a: "Justement à ne pas les perdre au dernier moment. Le recommandé vérifie systématiquement en ligne avant d'appeler : il cherche l'adresse, les horaires, la légitimité. Un site sobre, rapide et à jour transforme cette vérification en prise de rendez-vous plutôt qu'en doute.",
    },
  },
  {
    slug: "issy-les-moulineaux",
    name: "Issy-les-Moulineaux",
    postalCode: "92130",
    department: "Hauts-de-Seine",
    departmentCode: "92",
    hub: "/agence-web-hauts-de-seine",
    reach: "trente minutes d'Asnières",
    neighbours: ["Boulogne-Billancourt", "Vanves", "Clamart", "Paris 15e"],
    transport: "métro 12 (Mairie d'Issy, Corentin Celton), RER C, tramway T2",
    fabric:
      "Pôle numérique et médias installé de longue date, avec un niveau d'exigence technique inhabituel : ici, les interlocuteurs savent ce qu'est un score Lighthouse et posent des questions sur l'architecture. Autour de ces grandes structures vit un écosystème de petites sociétés de services et de commerces.",
    searchAngle:
      "Face à des clients qui maîtrisent le sujet, le discours marketing ne passe pas. Ce qui convainc, ce sont des mesures : temps de chargement avant et après, données structurées validées, contenu réellement indexable sans exécution de JavaScript. C'est exactement la manière dont nos propres sites sont construits.",
    clients: [
      "Startups et éditeurs de logiciels",
      "Agences et studios de production",
      "Sociétés de services aux entreprises",
      "Commerces et restauration du centre",
    ],
    opportunity:
      "Isséen typique : un interlocuteur qui a déjà lu des rapports Lighthouse et repère immédiatement un site fabriqué à la va-vite. C'est exigeant mais confortable — les décisions se prennent sur des mesures, pas sur des impressions. On livre donc les chiffres avant et après, et on les documente.",
    faq: {
      q: "Vous pouvez justifier vos choix techniques ?",
      a: "Oui, et c'est prévu pour. Le contenu est pré-généré côté serveur et donc indexable sans JavaScript, les bibliothèques 3D partent en chargement asynchrone, les polices sont auto-hébergées, les données structurées sont validées. Chaque décision a une raison mesurable, et vous recevez le détail.",
    },
  },
  {
    slug: "saint-ouen-sur-seine",
    name: "Saint-Ouen-sur-Seine",
    postalCode: "93400",
    department: "Seine-Saint-Denis",
    departmentCode: "93",
    hub: "/agence-web-seine-saint-denis",
    reach: "quinze minutes d'Asnières",
    neighbours: ["Clichy", "Gennevilliers", "Saint-Denis", "Paris 17e et 18e"],
    transport: "métro 13 et 14 (Mairie de Saint-Ouen), RER C, tramway T3b",
    fabric:
      "Commune en transformation rapide, entre les Puces historiques, les anciennes friches industrielles reconverties et les nouveaux quartiers d'affaires arrivés avec le Grand Paris. On y trouve côte à côte des brocanteurs installés depuis trois générations et des sociétés créées l'an dernier.",
    searchAngle:
      "Cette recomposition crée une opportunité rare : beaucoup de commerces anciens, très bien connus localement, n'ont aucune existence en ligne, tandis que la population qui arrive cherche exclusivement sur son téléphone. L'écart entre réputation réelle et visibilité numérique y est le plus large que l'on rencontre dans le secteur.",
    clients: [
      "Antiquaires, brocanteurs et métiers d'art",
      "Restaurants et bars",
      "Artisans et ateliers",
      "Jeunes sociétés de services",
    ],
    opportunity:
      "Audonien, l'écart est spectaculaire : des commerces réputés depuis des décennies, connus de tout le quartier, totalement absents de Google — pendant qu'une population nouvelle, arrivée avec les lignes 14 et les nouveaux quartiers, ne cherche que sur mobile. Combler cet écart produit des résultats visibles en quelques semaines.",
    faq: {
      q: "Mon commerce existe depuis trente ans, pourquoi changer ?",
      a: "Parce que vos futurs clients ne vous connaissent pas. Votre réputation locale est un actif réel, mais elle ne circule plus par le voisinage : elle circule par les avis Google et les recherches sur téléphone. Le site sert à rendre visible ce que le quartier sait déjà.",
    },
  },
  {
    slug: "argenteuil",
    name: "Argenteuil",
    postalCode: "95100",
    department: "Val-d'Oise",
    departmentCode: "95",
    hub: "/agence-web-val-d-oise",
    reach: "vingt minutes d'Asnières, de l'autre côté de la Seine",
    neighbours: ["Colombes", "Gennevilliers", "Bezons", "Sartrouville"],
    transport: "transilien J (gare d'Argenteuil), RER A à Sartrouville, nombreux bus",
    fabric:
      "La plus grande commune du Val-d'Oise, avec un commerce de centre-ville dense et un tissu artisanal très étendu. Beaucoup d'entreprises familiales de deuxième ou troisième génération, solides mais peu outillées côté numérique, dont la clientèle se renouvelle désormais par Google plutôt que par la réputation de famille.",
    searchAngle:
      "Argenteuil est nettement moins disputée que les communes du 92 voisines, à volume de recherche pourtant comparable. Pour un artisan ou un commerçant, c'est l'une des configurations les plus favorables d'Île-de-France : un travail sérieux mais sans excès suffit souvent à prendre la première place et à la garder.",
    clients: [
      "Artisans du bâtiment et dépannage",
      "Commerces de centre-ville",
      "Entreprises familiales et TPE",
      "Auto-écoles, garages et services",
    ],
    opportunity:
      "Argenteuil offre la configuration la plus favorable de notre secteur : des volumes de recherche comparables au 92, avec beaucoup moins de concurrents sérieusement référencés. Un artisan qui travaille correctement sa page et sa fiche Google prend souvent la première place en un trimestre, et la garde longtemps faute de challengers.",
    faq: {
      q: "Combien de temps pour être premier sur Argenteuil ?",
      a: "Sur un métier artisanal et une commune peu disputée, comptez un à trois mois après la mise en ligne, à condition que la fiche Google Business Profile soit en place et que les premiers avis arrivent. Personne ne peut garantir un délai — mais ici les conditions sont réunies.",
    },
  },
];

export type Hub = {
  slug: string;
  name: string;
  code: string;
  title: string;
  description: string;
  intro: string;
  /** Ce qui distingue le département. Unique par hub. */
  angle: string;
};

export const HUBS: Hub[] = [
  {
    slug: "/agence-web-hauts-de-seine",
    name: "Hauts-de-Seine",
    code: "92",
    title: "Agence web dans les Hauts-de-Seine (92) | Création de site — SmartFixx",
    description:
      "Agence web installée à Asnières-sur-Seine : création de site internet, refonte et automatisation dans tous les Hauts-de-Seine. Intervention sur place, devis ferme sous 3 jours.",
    intro:
      "SmartFixx est basé à Asnières-sur-Seine, au cœur du 92. C'est le département où nous intervenons le plus, et le seul où le rendez-vous sur place est la règle plutôt que l'exception.",
    angle:
      "Les Hauts-de-Seine concentrent une densité d'entreprises unique en France, et une concurrence en ligne à l'échelle. La conséquence est contre-intuitive : viser large y est presque toujours une erreur. Un artisan de Bois-Colombes n'a aucun intérêt à se battre sur « plombier Hauts-de-Seine », alors qu'il peut légitimement prendre la première place sur sa commune et les deux voisines. Notre travail consiste d'abord à identifier le périmètre que vous pouvez réellement gagner, puis à le tenir.",
  },
  {
    slug: "/agence-web-paris",
    name: "Paris",
    code: "75",
    title: "Agence web à Paris | Création et refonte de site internet — SmartFixx",
    description:
      "Création de site internet et automatisation à Paris, depuis Asnières-sur-Seine (92). Approche par arrondissement et par spécialité plutôt que sur les requêtes généralistes saturées.",
    intro:
      "Nous sommes à dix minutes du périphérique, et une bonne partie de nos projets sont parisiens. Paris demande néanmoins une stratégie différente du reste de l'Île-de-France.",
    angle:
      "Sur Paris, les requêtes généralistes sont hors d'atteinte pour une entreprise qui démarre : elles sont occupées par des acteurs installés depuis quinze ans, avec des milliers de liens entrants. La seule voie praticable est la précision — l'arrondissement, le quartier, la spécialité exacte, la question précise que se pose le client. « Ostéopathe Paris » est perdu d'avance ; « ostéopathe du sport Paris 17e » se gagne. Nous construisons les sites parisiens autour de cette logique, avec une page par intention réelle.",
  },
  {
    slug: "/agence-web-seine-saint-denis",
    name: "Seine-Saint-Denis",
    code: "93",
    title: "Agence web en Seine-Saint-Denis (93) | Création de site — SmartFixx",
    description:
      "Création de site internet, refonte et automatisation en Seine-Saint-Denis depuis Asnières-sur-Seine. Un marché local encore peu disputé, où les premières places restent accessibles.",
    intro:
      "Le 93 commence à quinze minutes de nos bureaux. C'est, de tous les départements franciliens, celui où l'écart entre la réalité des entreprises et leur visibilité en ligne est le plus grand.",
    angle:
      "Beaucoup d'entreprises de Seine-Saint-Denis sont excellentes et parfaitement connues dans leur quartier, sans aucune présence en ligne structurée. Dans le même temps, la population se renouvelle et cherche presque exclusivement sur mobile. Cette combinaison — forte demande, faible concurrence numérique — rend les premières places bien plus accessibles ici que dans le 92. Pour un artisan ou un commerçant, c'est souvent le meilleur rapport entre effort et résultat de toute l'Île-de-France.",
  },
  {
    slug: "/agence-web-val-d-oise",
    name: "Val-d'Oise",
    code: "95",
    title: "Agence web dans le Val-d'Oise (95) | Création de site — SmartFixx",
    description:
      "Création de site internet et automatisation dans le Val-d'Oise depuis Asnières-sur-Seine. Zone moins concurrentielle que la petite couronne, à volume de recherche comparable.",
    intro:
      "Le Val-d'Oise est de l'autre côté de la Seine, à vingt minutes. Nous y intervenons surtout sur la frange sud, la plus proche et la plus dense.",
    angle:
      "Le Val-d'Oise a une particularité économique nette : un tissu d'entreprises familiales et artisanales solide, mais un équipement numérique en retard sur la petite couronne. Les volumes de recherche y sont pourtant comparables à ceux du 92 sur beaucoup de métiers. Autrement dit, la même demande avec beaucoup moins de concurrents référencés — la configuration où un investissement mesuré produit les résultats les plus rapides.",
  },
];

export const cityBySlug = (slug: string) => CITIES.find((city) => city.slug === slug);
export const citiesInHub = (hub: string) => CITIES.filter((city) => city.hub === hub);
export const hubBySlug = (slug: string) => HUBS.find((h) => h.slug === slug);
