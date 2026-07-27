// Catalogue des règles d'audit.
//
// Chaque règle porte trois informations indissociables :
//   - ce qui est vérifié techniquement (`titre`, `severite`, `poids`)
//   - ce que ça coûte au prospect (`impact`) → argument commercial du rapport
//   - ce qu'il faut lui vendre pour corriger (`prestations`) → lignes du devis
//
// C'est ce dernier champ qui permet au devis de s'écrire tout seul : ajouter une règle
// suffit à enrichir à la fois l'audit, le rapport et la proposition commerciale.

import type { Finding, Pilier, Regle } from "./types.ts";

export const REGLES: Record<string, Regle> = {
  // ── SEO ───────────────────────────────────────────────────────────────────
  seo_title_absent: {
    pilier: "seo", severite: "critique", poids: 20,
    titre: "Aucun titre de page (balise title)",
    impact: "Google affiche l'adresse du site au lieu du nom de l'entreprise dans ses résultats : très peu de clics.",
    effort: "faible", prestations: ["seo_technique"],
  },
  seo_title_court: {
    pilier: "seo", severite: "majeur", poids: 8,
    titre: "Titre de page trop court",
    impact: "Le titre ne contient ni l'activité ni la ville : le site ne ressort pas sur les recherches locales.",
    effort: "faible", prestations: ["seo_technique"],
  },
  seo_title_long: {
    pilier: "seo", severite: "mineur", poids: 4,
    titre: "Titre de page tronqué dans Google",
    impact: "La fin du titre est coupée dans les résultats de recherche : le message perd son accroche.",
    effort: "faible", prestations: ["seo_technique"],
  },
  seo_description_absente: {
    pilier: "seo", severite: "majeur", poids: 12,
    titre: "Aucune description de page",
    impact: "Google improvise le texte affiché sous le lien : aucune promesse commerciale, moins de clics.",
    effort: "faible", prestations: ["seo_technique"],
  },
  seo_description_longueur: {
    pilier: "seo", severite: "mineur", poids: 5,
    titre: "Description mal calibrée",
    impact: "Description trop courte ou tronquée : l'argument de vente n'apparaît pas entièrement dans Google.",
    effort: "faible", prestations: ["seo_technique"],
  },
  seo_h1_absent: {
    pilier: "seo", severite: "majeur", poids: 12,
    titre: "Aucun titre principal (H1) sur la page d'accueil",
    impact: "Google ne comprend pas le sujet de la page : positionnement dégradé sur votre activité.",
    effort: "faible", prestations: ["seo_technique"],
  },
  seo_h1_multiple: {
    pilier: "seo", severite: "mineur", poids: 5,
    titre: "Plusieurs titres principaux (H1)",
    impact: "Le message principal est dilué : Google hésite sur le sujet de la page.",
    effort: "faible", prestations: ["seo_technique"],
  },
  seo_hierarchie_titres: {
    pilier: "seo", severite: "mineur", poids: 4,
    titre: "Hiérarchie des titres incohérente",
    impact: "Structure de page illisible pour Google et pour les lecteurs d'écran.",
    effort: "faible", prestations: ["seo_technique"],
  },
  seo_canonical_absent: {
    pilier: "seo", severite: "mineur", poids: 5,
    titre: "Pas d'adresse canonique déclarée",
    impact: "Risque de contenu dupliqué entre plusieurs adresses du même site, ce qui divise le référencement.",
    effort: "faible", prestations: ["seo_technique"],
  },
  seo_lang_absent: {
    pilier: "seo", severite: "mineur", poids: 4,
    titre: "Langue de la page non déclarée",
    impact: "Google peut proposer votre site à une audience étrangère, et les lecteurs d'écran le prononcent mal.",
    effort: "faible", prestations: ["seo_technique"],
  },
  seo_noindex: {
    pilier: "seo", severite: "critique", poids: 45,
    titre: "Le site demande à Google de ne pas l'indexer",
    impact: "Votre site est volontairement invisible dans Google : aucun client ne peut vous trouver en ligne.",
    effort: "faible", prestations: ["seo_technique"],
  },
  seo_robots_absent: {
    pilier: "seo", severite: "mineur", poids: 4,
    titre: "Fichier robots.txt absent",
    impact: "Aucune consigne donnée aux moteurs de recherche sur ce qu'ils doivent explorer.",
    effort: "faible", prestations: ["seo_technique"],
  },
  seo_robots_bloquant: {
    pilier: "seo", severite: "critique", poids: 35,
    titre: "Le robots.txt interdit l'exploration du site",
    impact: "Google a l'interdiction de lire vos pages : le site ne peut pas apparaître dans les résultats.",
    effort: "faible", prestations: ["seo_technique"],
  },
  seo_sitemap_absent: {
    pilier: "seo", severite: "majeur", poids: 8,
    titre: "Aucun plan de site (sitemap.xml)",
    impact: "Les nouvelles pages mettent des semaines à être découvertes par Google.",
    effort: "faible", prestations: ["seo_technique"],
  },
  seo_donnees_structurees: {
    pilier: "seo", severite: "majeur", poids: 10,
    titre: "Pas de données structurées (fiche établissement)",
    impact: "Ni horaires, ni adresse, ni avis dans Google : votre concurrent avec sa fiche complète est cliqué avant vous.",
    effort: "moyen", prestations: ["seo_technique", "seo_local"],
  },
  seo_og_absent: {
    pilier: "seo", severite: "mineur", poids: 6,
    titre: "Partage sur les réseaux sociaux non configuré",
    impact: "Un lien partagé sur Facebook, WhatsApp ou LinkedIn s'affiche sans image ni titre : il n'est pas cliqué.",
    effort: "faible", prestations: ["seo_technique"],
  },
  seo_alt_manquants: {
    pilier: "seo", severite: "majeur", poids: 8,
    titre: "Images sans description alternative",
    impact: "Vos photos n'apparaissent pas dans Google Images et le site est inutilisable pour les malvoyants.",
    effort: "faible", prestations: ["seo_technique", "accessibilite"],
  },
  seo_contenu_faible: {
    pilier: "seo", severite: "majeur", poids: 12,
    titre: "Trop peu de contenu sur la page d'accueil",
    impact: "Sans texte, Google n'a rien à référencer : impossible de se positionner sur vos prestations.",
    effort: "moyen", prestations: ["redaction_contenu"],
  },
  seo_page_contact_absente: {
    pilier: "seo", severite: "majeur", poids: 8,
    titre: "Pas de page ou de section contact identifiable",
    impact: "Le visiteur intéressé ne sait pas comment vous joindre : les demandes se perdent.",
    effort: "faible", prestations: ["site_vitrine", "refonte_site"],
  },
  seo_mentions_absentes: {
    pilier: "seo", severite: "mineur", poids: 5,
    titre: "Mentions légales introuvables",
    impact: "Obligation légale pour un site professionnel, et signal de sérieux attendu par les visiteurs.",
    effort: "faible", prestations: ["seo_technique"],
  },
  seo_404_non_personnalisee: {
    pilier: "seo", severite: "mineur", poids: 5,
    titre: "Page d'erreur 404 non personnalisée",
    impact: "Un visiteur qui tombe sur un lien mort quitte le site au lieu d'être redirigé vers vos offres.",
    effort: "faible", prestations: ["seo_technique"],
  },
  seo_nap_absent: {
    pilier: "seo", severite: "majeur", poids: 10,
    titre: "Coordonnées absentes de la page d'accueil",
    impact: "Téléphone et adresse invisibles : perte directe d'appels, et référencement local pénalisé.",
    effort: "faible", prestations: ["seo_local"],
  },
  seo_canonical_incoherente: {
    pilier: "seo", severite: "critique", poids: 22,
    titre: "L'adresse canonique désigne une autre page",
    impact: "Vous demandez à Google d'ignorer cette page au profit d'une autre : elle peut disparaître des résultats sans que personne ne comprenne pourquoi.",
    effort: "faible", prestations: ["seo_technique"],
  },

  seo_titre_duplique: {
    pilier: "seo", severite: "majeur", poids: 10,
    titre: "Le même titre sur plusieurs pages",
    impact: "Google ne sait pas laquelle proposer et les affiche moins bien toutes les deux.",
    effort: "faible", prestations: ["seo_technique", "redaction_contenu"],
  },

  seo_urls_illisibles: {
    pilier: "seo", severite: "mineur", poids: 6,
    titre: "Adresses de pages illisibles",
    impact: "Une adresse en « ?p=142 » n'indique rien à Google ni au visiteur, et se partage mal.",
    effort: "moyen", prestations: ["seo_technique"],
  },

  seo_fiche_incomplete: {
    pilier: "seo", severite: "majeur", poids: 10,
    titre: "Fiche établissement incomplète",
    impact: "Sans adresse, téléphone et horaires déclarés dans le code, Google n'affiche pas votre encadré local — celui qui capte les appels.",
    effort: "faible", prestations: ["seo_local", "seo_technique"],
  },

  seo_liens_morts: {
    pilier: "seo", severite: "majeur", poids: 10,
    titre: "Des liens de votre site ne mènent nulle part",
    impact: "Un visiteur qui tombe sur une page d'erreur repart, et Google dégrade la note du site entier.",
    effort: "faible", prestations: ["seo_technique"],
  },

  seo_site_fige: {
    pilier: "seo", severite: "majeur", poids: 12,
    titre: "Site inchangé depuis des années",
    impact: "Google privilégie les sites vivants, et un visiteur qui voit des informations périmées doute que l'entreprise soit encore active.",
    effort: "moyen", prestations: ["redaction_contenu", "refonte_site"],
  },

  seo_www_duplique: {
    pilier: "seo", severite: "majeur", poids: 8,
    titre: "Le site répond sur deux adresses différentes",
    impact: "Avec et sans « www » servent la même page sans redirection : Google divise le référencement entre les deux.",
    effort: "faible", prestations: ["seo_technique"],
  },

  seo_maillage_faible: {
    pilier: "seo", severite: "mineur", poids: 5,
    titre: "Très peu de liens internes",
    impact: "Les visiteurs et Google ne circulent pas dans le site : les autres pages restent invisibles.",
    effort: "faible", prestations: ["seo_technique"],
  },
  seo_lighthouse_faible: {
    pilier: "seo", severite: "majeur", poids: 10,
    titre: "Note SEO Google insuffisante",
    impact: "L'outil d'analyse officiel de Google signale plusieurs blocages sur le référencement du site.",
    effort: "moyen", prestations: ["seo_technique"],
  },

  // ── Design / expérience utilisateur ───────────────────────────────────────
  design_viewport_absent: {
    pilier: "design", severite: "critique", poids: 35,
    titre: "Site non adapté au mobile",
    impact: "Plus de 6 visiteurs sur 10 arrivent depuis un téléphone : ils voient un site minuscule et repartent aussitôt.",
    effort: "moyen", prestations: ["responsive_mobile", "refonte_site"],
  },
  design_debordement_mobile: {
    pilier: "design", severite: "critique", poids: 22,
    titre: "Contenu qui déborde de l'écran sur mobile",
    impact: "Le visiteur doit faire défiler horizontalement pour lire : abandon quasi systématique.",
    effort: "moyen", prestations: ["responsive_mobile"],
  },
  design_polices_petites: {
    pilier: "design", severite: "majeur", poids: 10,
    titre: "Textes trop petits sur mobile",
    impact: "Le visiteur doit zoomer pour lire vos offres : la majorité abandonne avant.",
    effort: "faible", prestations: ["accessibilite", "responsive_mobile"],
  },
  design_cibles_tactiles: {
    pilier: "design", severite: "majeur", poids: 8,
    titre: "Boutons trop petits ou trop rapprochés",
    impact: "Les clics au doigt tombent à côté : les visiteurs n'arrivent pas jusqu'au formulaire de contact.",
    effort: "faible", prestations: ["accessibilite", "responsive_mobile"],
  },
  design_contrastes: {
    pilier: "design", severite: "majeur", poids: 12,
    titre: "Contrastes de couleurs insuffisants",
    impact: "Textes illisibles en plein soleil ou pour une personne malvoyante : information perdue, et non-conformité.",
    effort: "faible", prestations: ["accessibilite"],
  },
  design_image_lourde: {
    pilier: "design", severite: "majeur", poids: 12,
    titre: "Images trop lourdes pour un téléphone",
    impact: "En 4G, chaque méga-octet ajoute environ une seconde d'attente : la moitié des visiteurs partent avant l'affichage.",
    effort: "faible", prestations: ["optimisation_perf"],
  },

  design_images_sans_dimensions: {
    pilier: "design", severite: "mineur", poids: 6,
    titre: "Images sans dimensions déclarées",
    impact: "La page saute pendant le chargement : le visiteur clique au mauvais endroit, et Google pénalise cette instabilité.",
    effort: "faible", prestations: ["optimisation_perf"],
  },

  design_images_non_optimisees: {
    pilier: "design", severite: "mineur", poids: 6,
    titre: "Images dans un format dépassé",
    impact: "Pages lentes à charger, surtout en 4G : chaque seconde d'attente fait perdre des visiteurs.",
    effort: "faible", prestations: ["optimisation_perf"],
  },
  design_images_non_responsives: {
    pilier: "design", severite: "mineur", poids: 6,
    titre: "Images non redimensionnées pour mobile",
    impact: "Le téléphone télécharge des images bien trop grandes : consommation de données et lenteur.",
    effort: "faible", prestations: ["optimisation_perf"],
  },
  design_trop_de_polices: {
    pilier: "design", severite: "mineur", poids: 4,
    titre: "Trop de polices de caractères différentes",
    impact: "Rendu visuel incohérent et chargement ralenti : image de marque brouillée.",
    effort: "faible", prestations: ["refonte_site"],
  },
  design_technos_datees: {
    pilier: "design", severite: "majeur", poids: 15,
    titre: "Technologies d'affichage dépassées",
    impact: "Le site a visiblement plus de dix ans : les visiteurs le perçoivent comme une entreprise à l'abandon.",
    effort: "eleve", prestations: ["refonte_site"],
  },
  design_layout_tableaux: {
    pilier: "design", severite: "majeur", poids: 15,
    titre: "Mise en page construite avec des tableaux HTML",
    impact: "Méthode abandonnée depuis 2010 : affichage cassé sur mobile et impossible à faire évoluer.",
    effort: "eleve", prestations: ["refonte_site"],
  },
  design_flash: {
    pilier: "design", severite: "critique", poids: 30,
    titre: "Contenu Flash",
    impact: "Flash n'est plus lu par aucun navigateur depuis 2021 : cette partie du site est invisible pour tous.",
    effort: "eleve", prestations: ["refonte_site"],
  },
  design_favicon_absent: {
    pilier: "design", severite: "mineur", poids: 3,
    titre: "Pas d'icône de site (favicon)",
    impact: "Onglet et favoris sans logo : le site paraît amateur et se repère mal.",
    effort: "faible", prestations: ["seo_technique"],
  },
  design_cta_absent: {
    pilier: "design", severite: "majeur", poids: 12,
    titre: "Aucun moyen de contact cliquable",
    impact: "Ni téléphone cliquable, ni formulaire, ni email : le visiteur convaincu ne peut pas passer à l'action.",
    effort: "faible", prestations: ["site_vitrine", "refonte_site"],
  },
  design_copyright_date: {
    pilier: "design", severite: "majeur", poids: 10,
    titre: "Site visiblement abandonné",
    impact: "Une date de copyright ancienne fait douter le visiteur que l'entreprise soit encore en activité.",
    effort: "faible", prestations: ["maintenance", "refonte_site"],
  },
  design_lcp_lent: {
    pilier: "design", severite: "majeur", poids: 10,
    titre: "Affichage du contenu principal trop lent",
    impact: "Au-delà de 2,5 secondes d'attente, la moitié des visiteurs mobiles sont déjà partis.",
    effort: "moyen", prestations: ["optimisation_perf"],
  },
  design_cls_eleve: {
    pilier: "design", severite: "mineur", poids: 6,
    titre: "Page qui bouge pendant le chargement",
    impact: "Les éléments se déplacent sous le doigt : clics ratés et sentiment de site cassé.",
    effort: "moyen", prestations: ["optimisation_perf"],
  },
  design_accessibilite_faible: {
    pilier: "design", severite: "majeur", poids: 10,
    titre: "Note d'accessibilité Google insuffisante",
    impact: "Le site exclut une partie des visiteurs et s'expose à une mise en cause pour non-accessibilité.",
    effort: "moyen", prestations: ["accessibilite"],
  },

  // ── Sécurité ──────────────────────────────────────────────────────────────
  sec_https_absent: {
    pilier: "securite", severite: "critique", poids: 40,
    titre: "Site non sécurisé (pas de HTTPS)",
    impact: "Les navigateurs affichent « Non sécurisé » à côté de votre nom, et Google déclasse le site.",
    effort: "faible", prestations: ["mise_https"],
  },
  sec_redirection_https_absente: {
    pilier: "securite", severite: "majeur", poids: 12,
    titre: "L'ancienne adresse non sécurisée reste accessible",
    impact: "Le site existe en double, une version sécurisée et une qui ne l'est pas : référencement divisé et données exposées.",
    effort: "faible", prestations: ["mise_https"],
  },
  sec_hsts_absent: {
    pilier: "securite", severite: "mineur", poids: 6,
    titre: "Protection HSTS non activée",
    impact: "Un visiteur sur un réseau Wi-Fi public peut être détourné vers une fausse version du site.",
    effort: "faible", prestations: ["securisation_entetes"],
  },
  sec_csp_absente: {
    pilier: "securite", severite: "majeur", poids: 10,
    titre: "Aucune politique de sécurité du contenu (CSP)",
    impact: "Si un script malveillant est injecté, rien ne l'empêche de voler les données saisies par vos clients.",
    effort: "moyen", prestations: ["securisation_entetes"],
  },
  sec_xfo_absent: {
    pilier: "securite", severite: "mineur", poids: 6,
    titre: "Site encadrable par un tiers (clickjacking)",
    impact: "Un escroc peut afficher votre site dans le sien pour piéger vos clients en votre nom.",
    effort: "faible", prestations: ["securisation_entetes"],
  },
  sec_nosniff_absent: {
    pilier: "securite", severite: "mineur", poids: 4,
    titre: "En-tête anti-interprétation de fichiers absent",
    impact: "Un fichier déposé par un visiteur peut être exécuté par le navigateur comme du code.",
    effort: "faible", prestations: ["securisation_entetes"],
  },
  sec_referrer_absent: {
    pilier: "securite", severite: "mineur", poids: 3,
    titre: "Politique de référent non définie",
    impact: "Les adresses de vos pages internes fuitent vers les sites tiers que vous liez.",
    effort: "faible", prestations: ["securisation_entetes"],
  },
  sec_divulgation_serveur: {
    pilier: "securite", severite: "mineur", poids: 5,
    titre: "Le serveur annonce ses versions logicielles",
    impact: "Les robots d'attaque ciblent en priorité les versions connues comme vulnérables.",
    effort: "faible", prestations: ["securisation_entetes"],
  },
  sec_version_cms_visible: {
    pilier: "securite", severite: "majeur", poids: 10,
    titre: "Version du CMS visible publiquement",
    impact: "N'importe qui sait exactement quelle faille tenter sur votre site.",
    effort: "faible", prestations: ["mise_a_jour_cms"],
  },
  sec_cms_obsolete: {
    pilier: "securite", severite: "critique", poids: 30,
    titre: "CMS dans une version obsolète",
    impact: "Version plus maintenue : failles publiques exploitées automatiquement, risque réel de défiguration du site.",
    effort: "moyen", prestations: ["mise_a_jour_cms", "maintenance"],
  },
  sec_lib_vulnerable: {
    pilier: "securite", severite: "majeur", poids: 15,
    titre: "Bibliothèque JavaScript à faille connue",
    impact: "Failles documentées publiquement, exploitables pour injecter du code dans les pages vues par vos clients.",
    effort: "moyen", prestations: ["mise_a_jour_cms"],
  },
  sec_cookies_non_securises: {
    pilier: "securite", severite: "majeur", poids: 8,
    titre: "Cookies déposés sans protection",
    impact: "Cookies interceptables ou lisibles par un script : usurpation de session possible.",
    effort: "faible", prestations: ["securisation_entetes"],
  },
  sec_contenu_mixte: {
    pilier: "securite", severite: "majeur", poids: 12,
    titre: "Ressources non sécurisées dans une page sécurisée",
    impact: "Le cadenas disparaît et le navigateur bloque une partie du contenu : le site paraît cassé et dangereux.",
    effort: "faible", prestations: ["mise_https"],
  },
  sec_formulaire_non_chiffre: {
    pilier: "securite", severite: "critique", poids: 25,
    titre: "Formulaire envoyé en clair",
    impact: "Les coordonnées de vos clients circulent sans chiffrement : manquement direct au RGPD.",
    effort: "faible", prestations: ["mise_https", "securisation_entetes"],
  },
  sec_fichier_expose: {
    pilier: "securite", severite: "critique", poids: 35,
    titre: "Fichier sensible accessible publiquement",
    impact: "Sauvegarde, configuration ou code source téléchargeable par n'importe qui : compromission du site à très court terme.",
    effort: "faible", prestations: ["mise_a_jour_cms", "securisation_entetes"],
  },
  sec_listing_repertoire: {
    pilier: "securite", severite: "majeur", poids: 12,
    titre: "Contenu des dossiers listé publiquement",
    impact: "Tous vos fichiers internes sont parcourables : documents privés potentiellement exposés.",
    effort: "faible", prestations: ["securisation_entetes"],
  },
  sec_spf_absent: {
    pilier: "securite", severite: "majeur", poids: 10,
    titre: "Aucune protection SPF sur votre domaine",
    impact: "N'importe qui peut envoyer un email à vos clients en se faisant passer pour vous.",
    effort: "faible", prestations: ["correctif_dns_email"],
  },
  sec_dmarc_absent: {
    pilier: "securite", severite: "majeur", poids: 10,
    titre: "Aucune politique DMARC",
    impact: "Rien n'empêche l'usurpation de votre adresse professionnelle, et vos vrais emails finissent en spam.",
    effort: "faible", prestations: ["correctif_dns_email"],
  },
  sec_dmarc_permissif: {
    pilier: "securite", severite: "mineur", poids: 5,
    titre: "Politique DMARC sans effet (p=none)",
    impact: "La protection est déclarée mais n'est pas appliquée : les emails frauduleux passent toujours.",
    effort: "faible", prestations: ["correctif_dns_email"],
  },
  sec_mx_absent: {
    pilier: "securite", severite: "mineur", poids: 5,
    titre: "Pas d'email professionnel sur votre domaine",
    impact: "Une adresse en @gmail.com sur un devis inspire nettement moins confiance qu'une adresse à votre nom.",
    effort: "faible", prestations: ["hebergement"],
  },
  sec_email_en_clair: {
    pilier: "securite", severite: "mineur", poids: 4,
    titre: "Adresse email exposée en clair",
    impact: "Les robots la récupèrent : boîte noyée de spam, vrais messages clients perdus dedans.",
    effort: "faible", prestations: ["securisation_entetes"],
  },
  sec_confidentialite_absente: {
    pilier: "securite", severite: "majeur", poids: 10,
    titre: "Pas de politique de confidentialité",
    impact: "Obligation RGPD dès qu'un formulaire collecte des données : exposition à une sanction.",
    effort: "faible", prestations: ["seo_technique"],
  },

  sec_logiciel_serveur_eol: {
    pilier: "securite", severite: "critique", poids: 26,
    titre: "Logiciel serveur en fin de vie",
    impact: "Plus aucun correctif de sécurité n'est publié pour cette version : chaque faille découverte depuis reste exploitable définitivement.",
    effort: "eleve", prestations: ["hebergement", "maintenance"],
  },

  sec_dnssec_absent: {
    pilier: "securite", severite: "mineur", poids: 5,
    titre: "Nom de domaine non signé (DNSSEC)",
    impact: "Sans signature DNSSEC, un attaquant sur le réseau peut détourner les visiteurs vers un faux site sans qu'ils s'en aperçoivent.",
    effort: "moyen", prestations: ["correctif_dns_email"],
  },

  sec_spf_permissif: {
    pilier: "securite", severite: "majeur", poids: 12,
    titre: "Protection email contournable (SPF permissif)",
    impact: "La règle se termine par « tout autoriser » : n'importe qui peut envoyer un email en se faisant passer pour votre domaine.",
    effort: "faible", prestations: ["correctif_dns_email"],
  },

  sec_dmarc_sans_rapport: {
    pilier: "securite", severite: "mineur", poids: 4,
    titre: "Usurpation d'email invisible",
    impact: "Aucune adresse de rapport DMARC n'est déclarée : vous ne saurez jamais que votre nom est utilisé pour des arnaques.",
    effort: "faible", prestations: ["correctif_dns_email"],
  },

  sec_securitytxt_absent: {
    pilier: "securite", severite: "mineur", poids: 3,
    titre: "Aucun moyen de signaler une faille (security.txt)",
    impact: "Un chercheur qui découvre un problème n'a aucun contact pour vous prévenir : il le publie ou le revend au lieu de vous alerter.",
    effort: "faible", prestations: ["securisation_entetes"],
  },

  sec_certificat_invalide: {
    pilier: "securite", severite: "critique", poids: 35,
    titre: "Certificat de sécurité invalide",
    impact: "Chrome et Safari affichent un avertissement plein écran avant d'ouvrir le site : la quasi-totalité des visiteurs rebrousse chemin.",
    effort: "faible", prestations: ["mise_https", "maintenance"],
  },

  sec_csp_permissive: {
    pilier: "securite", severite: "majeur", poids: 10,
    titre: "Politique de sécurité du contenu inopérante",
    impact: "La règle existe mais autorise les scripts inline : elle n'arrête pas une injection de code, alors qu'elle donne l'impression d'être protégé.",
    effort: "moyen", prestations: ["securisation_entetes"],
  },

  sec_hsts_faible: {
    pilier: "securite", severite: "mineur", poids: 5,
    titre: "Forçage HTTPS trop court",
    impact: "Une durée courte laisse une fenêtre pour intercepter la première visite d'un client sur un réseau public.",
    effort: "faible", prestations: ["securisation_entetes"],
  },

  sec_cors_permissif: {
    pilier: "securite", severite: "majeur", poids: 15,
    titre: "Partage de ressources ouvert à tous les sites",
    impact: "N'importe quel site peut lire les réponses du vôtre au nom d'un visiteur connecté : c'est un vol de session par un autre chemin.",
    effort: "faible", prestations: ["securisation_entetes"],
  },

  sec_sri_absente: {
    pilier: "securite", severite: "majeur", poids: 10,
    titre: "Scripts externes chargés sans contrôle d'intégrité",
    impact: "Si le serveur qui héberge ces scripts est compromis, le code hostile s'exécute sur votre site — c'est ainsi que des milliers de sites ont été piégés en une nuit.",
    effort: "faible", prestations: ["securisation_entetes"],
  },

  sec_composant_vulnerable: {
    pilier: "securite", severite: "critique", poids: 28,
    titre: "Extension dans une version aux failles connues",
    impact: "Ces versions figurent dans les outils d'attaque automatisés : les sites concernés sont trouvés et exploités sans que personne ne les vise en particulier.",
    effort: "moyen", prestations: ["mise_a_jour_cms", "maintenance"],
  },

  sec_composants_exposes: {
    pilier: "securite", severite: "mineur", poids: 6,
    titre: "Versions des extensions visibles publiquement",
    impact: "Chaque numéro de version affiché indique à un attaquant automatisé quelles failles essayer.",
    effort: "faible", prestations: ["securisation_entetes", "maintenance"],
  },

  sec_traceurs_avant_consentement: {
    pilier: "securite", severite: "majeur", poids: 18,
    titre: "Cookies de suivi déposés avant tout consentement",
    impact: "Constat direct : les cookies publicitaires arrivent dès l'ouverture de la page, sans clic. C'est le manquement que la CNIL sanctionne le plus, jusqu'à 2 % du chiffre d'affaires.",
    effort: "faible", prestations: ["conformite_rgpd"],
  },

  sec_enumeration_comptes: {
    pilier: "securite", severite: "majeur", poids: 15,
    titre: "Liste des comptes accessible publiquement",
    impact: "Les identifiants de connexion sont donnés à qui les demande : il ne reste plus qu'à tester des mots de passe.",
    effort: "faible", prestations: ["securisation_entetes", "maintenance"],
  },

  sec_xmlrpc_ouvert: {
    pilier: "securite", severite: "mineur", poids: 6,
    titre: "Interface XML-RPC ouverte",
    impact: "Point d'entrée classique pour tester des milliers de mots de passe en peu de requêtes, ou pour faire relayer une attaque par votre serveur.",
    effort: "faible", prestations: ["securisation_entetes", "maintenance"],
  },

  sec_certificat_bientot_expire: {
    pilier: "securite", severite: "majeur", poids: 15,
    titre: "Certificat de sécurité bientôt expiré",
    impact: "Le jour de l'expiration, le site devient inaccessible derrière un avertissement rouge : c'est la panne la plus fréquente et la plus évitable.",
    effort: "faible", prestations: ["maintenance"],
  },

  sec_tls_obsolete: {
    pilier: "securite", severite: "majeur", poids: 12,
    titre: "Chiffrement dans une version dépassée",
    impact: "Les navigateurs récents refusent progressivement ces versions, et un audit de sécurité client le relève immédiatement.",
    effort: "moyen", prestations: ["securisation_entetes", "hebergement"],
  },

  sec_traceurs_sans_consentement: {
    pilier: "securite", severite: "majeur", poids: 12,
    titre: "Traceurs déposés sans consentement",
    impact: "La CNIL sanctionne le dépôt de cookies publicitaires avant accord du visiteur : mise en demeure puis amende.",
    effort: "faible", prestations: ["conformite_rgpd"],
  },

  // ── Technique ─────────────────────────────────────────────────────────────
  tech_site_injoignable: {
    pilier: "technique", severite: "critique", poids: 70,
    titre: "Site inaccessible",
    impact: "Le site ne répond pas : chaque visiteur qui tente de vous trouver en ligne est perdu.",
    effort: "moyen", prestations: ["refonte_site", "hebergement", "maintenance"],
  },
  tech_erreur_http: {
    pilier: "technique", severite: "critique", poids: 45,
    titre: "La page d'accueil renvoie une erreur",
    impact: "Les visiteurs et Google tombent sur une erreur au lieu de votre site.",
    effort: "moyen", prestations: ["maintenance", "refonte_site"],
  },
  tech_terrain_lent: {
    pilier: "technique", severite: "majeur", poids: 15,
    titre: "Vos visiteurs réels attendent trop longtemps",
    impact: "Ce n'est pas un test de laboratoire : ce sont les temps mesurés chez vos vrais visiteurs par Google, sur leurs téléphones et leurs réseaux.",
    effort: "moyen", prestations: ["optimisation_perf"],
  },

  tech_perf_faible: {
    pilier: "technique", severite: "majeur", poids: 15,
    titre: "Note de performance Google très basse",
    impact: "Site jugé lent par Google : moins bien positionné et abandonné par les visiteurs mobiles.",
    effort: "moyen", prestations: ["optimisation_perf"],
  },
  tech_page_lourde: {
    pilier: "technique", severite: "majeur", poids: 10,
    titre: "Page d'accueil trop lourde",
    impact: "Chargement long en 4G et consommation de données inutile pour vos visiteurs.",
    effort: "moyen", prestations: ["optimisation_perf"],
  },
  tech_trop_de_requetes: {
    pilier: "technique", severite: "mineur", poids: 6,
    titre: "Trop de fichiers chargés par page",
    impact: "Chaque fichier ajoute un délai : le site paraît lent même avec une bonne connexion.",
    effort: "moyen", prestations: ["optimisation_perf"],
  },
  tech_compression_absente: {
    pilier: "technique", severite: "majeur", poids: 10,
    titre: "Compression des pages désactivée",
    impact: "Les pages transitent 3 à 4 fois plus lourdes que nécessaire.",
    effort: "faible", prestations: ["optimisation_perf"],
  },
  tech_cache_absent: {
    pilier: "technique", severite: "mineur", poids: 6,
    titre: "Pas de mise en cache des fichiers",
    impact: "Tout est retéléchargé à chaque visite : navigation lente pour les clients fidèles.",
    effort: "faible", prestations: ["optimisation_perf"],
  },
  tech_http2_absent: {
    pilier: "technique", severite: "mineur", poids: 4,
    titre: "Protocole HTTP obsolète",
    impact: "Hébergement daté : le site charge plus lentement qu'il ne devrait.",
    effort: "faible", prestations: ["hebergement"],
  },
  tech_ttfb_lent: {
    pilier: "technique", severite: "majeur", poids: 10,
    titre: "Serveur lent à répondre",
    impact: "L'attente commence avant même l'affichage : signe d'un hébergement sous-dimensionné.",
    effort: "faible", prestations: ["hebergement", "optimisation_perf"],
  },
  tech_erreurs_console: {
    pilier: "technique", severite: "mineur", poids: 5,
    titre: "Erreurs JavaScript sur la page",
    impact: "Certaines fonctions du site sont cassées sans que personne ne s'en aperçoive.",
    effort: "moyen", prestations: ["maintenance"],
  },
};

/** Construit un constat à partir d'un identifiant de règle. Lève si la règle est inconnue. */
export function constate(id: string, constat: string): Finding {
  const regle = REGLES[id];
  if (!regle) throw new Error(`Règle d'audit inconnue : ${id}`);
  return { ...regle, regle: id, constat };
}

/** Toutes les règles d'un pilier (utile pour l'affichage et les tests de cohérence). */
export function reglesDuPilier(pilier: Pilier): string[] {
  return Object.keys(REGLES).filter((id) => REGLES[id].pilier === pilier);
}

export const LIBELLES_PILIERS: Record<Pilier, string> = {
  seo: "Référencement",
  design: "Design & mobile",
  securite: "Sécurité",
  technique: "Performance technique",
};

export const LIBELLES_SEVERITE: Record<Finding["severite"], string> = {
  critique: "Critique",
  majeur: "Important",
  mineur: "À corriger",
};

export const LIBELLES_EFFORT: Record<Finding["effort"], string> = {
  faible: "Rapide",
  moyen: "Moyen",
  eleve: "Chantier",
};
