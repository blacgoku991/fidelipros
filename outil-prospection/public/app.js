// Interface de l'outil de prospection : JavaScript natif, sans bundler ni framework.
// Quatre vues, routées par le fragment d'URL : prospects, audit d'une adresse, fiche
// prospect, catalogue de prestations.
//
// Règle appliquée partout : tout ce qui vient d'un site tiers (raison sociale, constat
// d'audit, email, URL) passe par esc() avant d'entrer dans le HTML.

const vue = document.getElementById("vue");
const notifications = document.getElementById("notifications");

/** Référentiels envoyés par le serveur au démarrage (secteurs, libellés, clés présentes). */
let config = null;
/** Dernière liste chargée, réutilisée par les filtres d'affichage sans rappeler le serveur. */
let prospects = [];
/** Filtres d'affichage de la liste, conservés entre deux rendus. */
const tri = { texte: "", statut: "", priorite: "", contact: "", relance: "" };
/** Nombre de lignes dessinées : au-delà, le navigateur passe des secondes à construire le DOM. */
const PAS_AFFICHAGE = 100;
let limiteAffichage = PAS_AFFICHAGE;
/** Dernier bilan de recherche, affiché sous le tableau. */
let dernierBilan = null;

const PILIERS = ["seo", "design", "securite", "technique"];
const CLE_CRITERES = "prospection.criteres";
const CLE_PANNEAU = "prospection.panneauOuvert";

const LIBELLES_STATUT = {
  nouveau: "Nouveau",
  a_contacter: "À contacter",
  contacte: "Contacté",
  rdv: "Rendez-vous",
  gagne: "Gagné",
  perdu: "Perdu",
  ignore: "Ignoré",
};

const LIBELLES_SITE = {
  non_verifie: "Non vérifié",
  aucun_site: "Aucun site",
  site_injoignable: "Site injoignable",
  site_obsolete: "Site obsolète",
  site_a_rafraichir: "Site à rafraîchir",
  site_recent: "Site récent",
};

const LIBELLES_URGENCE = {
  critique: ["Urgence critique", "et-rouge"],
  elevee: ["Urgence élevée", "et-orange"],
  moyenne: ["Urgence moyenne", "et-ambre"],
  faible: ["Pas d'urgence", "et-vert"],
};

const LIBELLES_ACCESSIBILITE = {
  ok: ["Site analysé", "et-vert"],
  erreur_serveur: ["Site en erreur", "et-rouge"],
  bloque: ["Audit non concluant", ""],
  injoignable: ["Domaine hors ligne", "et-rouge"],
};

const CLASSES_SEVERITE = { critique: "et-rouge", majeur: "et-orange", mineur: "" };
const CLASSES_PRIORITE = { chaud: "et-rouge", tiede: "et-ambre", froid: "" };

// ── Utilitaires ─────────────────────────────────────────────────────────────

function esc(valeur) {
  if (valeur === null || valeur === undefined) return "";
  return String(valeur)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Les messages du moteur n'ont pas de ponctuation finale : on la remet avant d'enchaîner. */
const phrase = (texte) => (/[.!?…]$/.test(texte.trim()) ? texte.trim() : `${texte.trim()}.`);

const euros = (montant) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
    .format(Number(montant) || 0);

const nombre = (valeur) => new Intl.NumberFormat("fr-FR").format(Number(valeur) || 0);

function dateHeure(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

function dateCourte(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : new Intl.DateTimeFormat("fr-FR").format(date);
}

/** Note d'audit : vert = site sain, rouge = site à refaire. */
function classeScore(score) {
  if (score >= 80) return "s-vert";
  if (score >= 55) return "s-ambre";
  if (score >= 35) return "s-orange";
  return "s-rouge";
}

function couleurScore(score) {
  if (score >= 80) return "var(--vert)";
  if (score >= 55) return "var(--ambre)";
  if (score >= 35) return "var(--orange)";
  return "var(--rouge)";
}

/** Un score de prospect élevé = grosse opportunité : la couleur est donc inversée. */
function classeOpportunite(score) {
  if (score >= 70) return "s-rouge";
  if (score >= 50) return "s-ambre";
  return "s-vert";
}

function notifie(message, genre = "info") {
  const element = document.createElement("div");
  element.className = `notification ${genre}`;
  element.textContent = message;
  notifications.append(element);
  setTimeout(() => element.remove(), genre === "erreur" ? 10000 : 5000);
}

async function api(chemin, options = {}) {
  const reponse = await fetch(chemin, {
    method: options.methode ?? "GET",
    headers: options.corps ? { "Content-Type": "application/json" } : undefined,
    body: options.corps ? JSON.stringify(options.corps) : undefined,
  });
  const donnees = await reponse.json().catch(() => ({}));
  if (!reponse.ok) throw new Error(donnees.error || `Erreur ${reponse.status}`);
  return donnees;
}

/** Passe un bouton en attente pendant un traitement long (audit, recherche, proposition). */
async function pendant(bouton, libelleAttente, travail) {
  const libelle = bouton.textContent;
  bouton.disabled = true;
  bouton.textContent = libelleAttente;
  try {
    return await travail();
  } finally {
    bouton.disabled = false;
    bouton.textContent = libelle;
  }
}

function copie(texte, quoi = "Texte") {
  navigator.clipboard.writeText(texte)
    .then(() => notifie(`${quoi} copié`, "succes"))
    .catch(() => notifie("Copie impossible : sélectionnez le texte à la main", "erreur"));
}

/**
 * Copie l'email en conservant la mise en forme : collé dans Gmail ou Outlook, il garde son
 * habillage. Si le navigateur refuse le presse-papier riche, on retombe sur le code source.
 */
async function copieRiche(html, texteBrut, quoi) {
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([texteBrut], { type: "text/plain" }),
      }),
    ]);
    notifie(`${quoi} copié avec sa mise en forme — collez-le dans votre messagerie`, "succes");
  } catch {
    copie(html, `${quoi} (code HTML)`);
  }
}

function telecharge(nomFichier, contenu, type = "text/html;charset=utf-8") {
  const lien = document.createElement("a");
  lien.href = URL.createObjectURL(new Blob([contenu], { type }));
  lien.download = nomFichier;
  lien.click();
  setTimeout(() => URL.revokeObjectURL(lien.href), 2000);
}

/**
 * Suit un traitement lancé en tâche de fond (recherche, audits par lot) et rend compte de son
 * avancement : sans cela, l'interface paraît figée pendant plusieurs minutes.
 */
async function suit(travailId, surAvancement) {
  for (;;) {
    const etat = await api(`/api/travaux/${encodeURIComponent(travailId)}`);
    surAvancement(etat);
    if (etat.fini) {
      if (etat.erreur) throw new Error(etat.erreur);
      return etat.resultat;
    }
    await new Promise((resolu) => setTimeout(resolu, 1200));
  }
}

/** Barre d'avancement d'un traitement : étape en cours et compteur. */
function afficheAvancement(cible, etat, titre) {
  const pourcentage = etat.total ? Math.min(100, Math.round((etat.faits / etat.total) * 100)) : null;
  cible.innerHTML = `
    <div class="carte serree">
      <div class="entre-deux">
        <strong style="font-size:14px">${esc(titre)}</strong>
        <span class="aide-mini" style="margin:0">${esc(etat.etape)}${
          etat.total ? ` — ${etat.faits} / ${etat.total}` : ""}</span>
      </div>
      ${pourcentage === null
        ? `<div class="progression"></div>`
        : `<div class="jauge" style="height:5px"><span style="width:${pourcentage}%;background:var(--accent)"></span></div>`}
    </div>`;
}

/** Bloc de texte avec bouton « copier ». */
function blocCopiable(titre, texte, cle) {
  return `<div class="copiable">
    <div class="entre-deux" style="margin-bottom:6px">
      <label style="margin:0">${esc(titre)}</label>
      <button class="petit" data-copie="${esc(cle)}" data-quoi="${esc(titre)}">Copier</button>
    </div>
    <pre>${esc(texte)}</pre>
  </div>`;
}

function brancheCopies(racine, textes) {
  racine.querySelectorAll("[data-copie]").forEach((bouton) => {
    bouton.addEventListener("click", () =>
      copie(textes[bouton.dataset.copie] ?? "", bouton.dataset.quoi ?? "Texte"));
  });
}

/**
 * Le navigateur refuse d'envoyer un formulaire contenant un champ invalide, sans rien afficher
 * si le champ est hors écran. On le dit explicitement, en nommant le champ.
 */
function brancheValidation(formulaire) {
  formulaire.addEventListener("invalid", (evenement) => {
    const champ = evenement.target;
    const intitule = formulaire.querySelector(`label[for="${champ.id}"]`)?.textContent?.trim() ?? champ.id;
    notifie(`« ${intitule} » : ${champ.validationMessage}`, "erreur");
    champ.scrollIntoView({ block: "center", behavior: "smooth" });
  }, true);
}

function brancheCopiesTexte(racine) {
  racine.querySelectorAll("[data-copier-texte]").forEach((bouton) => {
    bouton.addEventListener("click", () => copie(bouton.dataset.copierTexte, "Email"));
  });
}

function nomFichierProspect(prospect) {
  return (prospect.nom || "prospect")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

// ── Coordonnées et fiche Google ─────────────────────────────────────────────

function ligneCoordonnee(cle, valeurHtml) {
  return `<div class="coordonnee"><span class="cle">${esc(cle)}</span><span class="valeur">${valeurHtml}</span></div>`;
}

/**
 * Ce qu'on a pour joindre l'entreprise. La fiche Google n'est présentée comme « trouvée » que
 * si le site en publie le lien ; sinon on propose une recherche, en le disant.
 */
function blocCoordonnees(prospect) {
  const lignes = [];

  if (prospect.email_contact) {
    const autres = (prospect.emails ?? []).filter((e) => e !== prospect.email_contact);
    lignes.push(ligneCoordonnee("Email", `
      <a href="mailto:${esc(prospect.email_contact)}">${esc(prospect.email_contact)}</a>
      <button class="petit discret" data-copier-texte="${esc(prospect.email_contact)}">copier</button>
      ${autres.length ? `<div class="autres-emails">Aussi : ${autres.map((e) => esc(e)).join(", ")}</div>` : ""}`));
  } else {
    lignes.push(ligneCoordonnee("Email", `<span class="aide" style="margin:0">aucun email publié sur le site</span>`));
  }

  if (prospect.telephone) {
    lignes.push(ligneCoordonnee("Téléphone",
      `<a href="tel:${esc(prospect.telephone.replace(/\s/g, ""))}">${esc(prospect.telephone)}</a>`));
  }
  if (prospect.dirigeant) lignes.push(ligneCoordonnee("Dirigeant", esc(prospect.dirigeant)));

  const adresse = [prospect.adresse, prospect.code_postal, prospect.ville].filter(Boolean).join(" ");
  if (adresse) lignes.push(ligneCoordonnee("Adresse", esc(adresse)));

  lignes.push(ligneCoordonnee("Fiche Google", prospect.google_maps_url
    ? `<a href="${esc(prospect.google_maps_url)}" target="_blank" rel="noreferrer noopener">Fiche publiée sur le site ↗</a>
       <div class="aide-mini">Lien relevé sur le site : la fiche existe.</div>`
    : `<a href="${esc(prospect.google_recherche)}" target="_blank" rel="noreferrer noopener">Chercher sur Google Maps ↗</a>
       <div class="aide-mini">Le site ne publie aucun lien : ceci est une recherche, pas une fiche confirmée.</div>`));

  const reseaux = Object.entries(prospect.reseaux ?? {}).filter(([, url]) => url);
  if (reseaux.length) {
    lignes.push(ligneCoordonnee("Réseaux", reseaux
      .map(([nom, url]) => `<a href="${esc(url)}" target="_blank" rel="noreferrer noopener">${esc(nom)} ↗</a>`)
      .join(" · ")));
  }

  const sources = prospect.audit?.contacts?.sources ?? [];
  return `<div class="carte">
    <h2>Contact</h2>
    <p class="aide">Coordonnées relevées sur les pages publiques du site — rien n'est deviné.</p>
    <div class="coordonnees">${lignes.join("")}</div>
    ${sources.length ? `<p class="aide-mini">Lues sur : ${sources.map((s) => esc(s)).join(", ")}</p>` : ""}
  </div>`;
}

// ── Rendu d'un audit ────────────────────────────────────────────────────────

function blocAudit(audit) {
  if (!audit) {
    return `<div class="carte"><h2>Audit du site</h2>
      <p class="aide">Aucun audit pour ce prospect. Lancez-en un pour obtenir les notes, les
      défauts constatés et le devis correspondant.</p></div>`;
  }

  const [libelleAcces, classeAcces] = LIBELLES_ACCESSIBILITE[audit.accessibilite] ?? ["", ""];
  const capture = audit.captureDataUri || audit.capture;

  // Un audit non concluant n'affiche aucune note : elles ne mesureraient rien.
  if (!audit.concluant) {
    return `<div class="carte">
      <div class="entre-deux"><h2>Audit non concluant</h2>
        <span class="etiquette ${classeAcces}">${esc(libelleAcces)}</span></div>
      <p class="alerte">${esc(phrase(audit.erreurs?.[0] ?? "Le site n'a pas pu être analysé"))}
        Aucun défaut n'est affirmé et aucun chiffrage n'est proposé : relancez l'audit depuis un
        réseau qui accède au site, ou vérifiez-le à la main.</p>
      <p class="aide-mini">Adresse testée : <code>${esc(audit.urlFinale || audit.url)}</code>
        — ${dateHeure(audit.cree_le)}</p>
    </div>`;
  }

  const [libelleUrgence, classeUrgence] = LIBELLES_URGENCE[audit.scores.urgence] ?? ["", ""];
  const pireVolet = [...PILIERS].sort((a, b) => audit.scores[a] - audit.scores[b])[0];

  const notes = `<div class="notes-audit">
    <div class="note-volet globale">
      <div class="valeur ${classeScore(audit.scores.global)}">${audit.scores.global}</div>
      <div class="nom">Note globale</div>
      <div class="jauge"><span style="width:${audit.scores.global}%;background:${couleurScore(audit.scores.global)}"></span></div>
    </div>
    ${PILIERS.map((pilier) => {
      // Une source manquante rend la note optimiste : on le dit sur la carte du volet.
      const partiel = (audit.scores.partiels ?? []).includes(pilier);
      return `
      <div class="note-volet"${partiel
        ? ` title="Mesure partielle : une source n'a pas répondu (voir « non vérifiable » ci-dessous). La note est donc optimiste."`
        : ""}>
        <div class="valeur ${classeScore(audit.scores[pilier])}">${audit.scores[pilier]}</div>
        <div class="nom">${esc(config.piliers[pilier])}</div>
        <div class="jauge"><span style="width:${audit.scores[pilier]}%;background:${couleurScore(audit.scores[pilier])}"></span></div>
        ${partiel ? `<div class="partiel">mesure partielle</div>` : ""}
      </div>`;
    }).join("")}
  </div>`;

  const onglets = PILIERS.map((pilier) => {
    const compte = audit.findings.filter((f) => f.pilier === pilier).length;
    return `<button data-volet-cible="${pilier}" class="${pilier === pireVolet ? "actif" : ""}">
      ${esc(config.piliers[pilier])} <span class="etiquette">${compte}</span></button>`;
  }).join("");

  const sections = PILIERS.map((pilier) => {
    const findings = audit.findings.filter((f) => f.pilier === pilier);
    const contenu = findings.length
      ? findings.map((f) => `
        <div class="defaut">
          <h4>${esc(f.titre)}
            <span class="etiquette ${CLASSES_SEVERITE[f.severite] ?? ""}">${esc(config.severites[f.severite])}</span>
            <span class="etiquette">Effort ${esc(config.efforts[f.effort])}</span>
          </h4>
          <p class="constat">${esc(f.constat)}</p>
          <p>${esc(f.impact)}</p>
        </div>`).join("")
      : `<p class="aide">Aucun défaut relevé sur ce volet.</p>`;
    return `<div data-volet="${pilier}" ${pilier === pireVolet ? "" : "hidden"}>${contenu}</div>`;
  }).join("");

  const nonVerifie = audit.erreurs?.length
    ? `<p class="aide-mini"><strong>Non vérifiable :</strong> ${esc(audit.erreurs.join(" · "))} —
       aucun défaut n'est affirmé sur ces points.</p>`
    : "";
  const fichiers = audit.fichiersExposes?.length
    ? `<p class="aide-mini"><strong>Fichiers accessibles publiquement :</strong>
       ${esc(audit.fichiersExposes.map((f) => `${f.chemin} (${f.indice})`).join(" · "))}</p>`
    : "";

  return `<div class="carte" id="bloc-audit">
    <div class="entre-deux">
      <h2>Audit du site</h2>
      <div class="ligne">
        ${audit.technologie ? `<span class="etiquette et-accent" title="Plateforme repérée dans le code de la page">${esc(audit.technologie)}</span>` : ""}
        <span class="etiquette ${classeAcces}">${esc(libelleAcces)}</span>
        <span class="etiquette ${classeUrgence}">${esc(libelleUrgence)}</span>
      </div>
    </div>
    <p class="aide">
      <code>${esc(audit.urlFinale || audit.url)}</code> — analysé le ${dateHeure(audit.cree_le)}${
        audit.profondeur === "rapide" ? " (audit rapide : sans Lighthouse ni sondage des fichiers)" : ""}
    </p>
    ${notes}
    ${blocMesures(audit)}
    ${capture ? `<div class="capture" style="margin-top:16px"><img src="${esc(capture)}" alt="Aperçu mobile du site"></div>` : ""}
    ${nonVerifie}
    ${fichiers}
    <h3>${audit.findings.length} défaut(s) constaté(s)</h3>
    <div class="onglets">${onglets}</div>
    ${sections}
  </div>`;
}

/**
 * Faits mesurés qui ne sont pas des défauts mais qui appuient l'argumentaire : depuis quand le
 * site existe, quand il a changé pour la dernière fois, son certificat, et ce que vivent ses
 * visiteurs réels.
 */
function blocMesures(audit) {
  const faits = [];
  if (audit.archive?.premiereCapture) {
    faits.push(`<strong>En ligne depuis ${dateCourte(audit.archive.premiereCapture)}</strong>` +
      (audit.archive.inchangeDepuis
        ? ` · page d'accueil inchangée depuis le ${dateCourte(audit.archive.inchangeDepuis)}`
        : "") +
      ` <span class="aide-mini" style="margin:0">(Internet Archive)</span>`);
  }
  if (audit.certificat?.expireLe) {
    faits.push(`Certificat ${esc(audit.certificat.emetteur ?? "inconnu")}, expire le ${dateCourte(audit.certificat.expireLe)}` +
      (audit.certificat.protocole ? ` · ${esc(audit.certificat.protocole)}` : ""));
  }
  const terrain = audit.lighthouse?.terrain;
  if (terrain?.lcpMs) {
    faits.push(`Visiteurs réels : affichage en ${(terrain.lcpMs / 1000).toFixed(1).replace(".", ",")} s` +
      (terrain.inpMs ? ` · réaction au clic ${terrain.inpMs} ms` : "") +
      ` <span class="aide-mini" style="margin:0">(mesure Google sur 28 jours)</span>`);
  }
  if (!faits.length) return "";
  return `<div class="mesures">${faits.map((fait) => `<div>${fait}</div>`).join("")}</div>`;
}

/** Onglets : un groupe de boutons `data-volet-cible` pilote les `data-volet` voisins. */
function brancheOnglets(racine) {
  if (!racine) return;
  racine.querySelectorAll(".onglets").forEach((barre) => {
    const boutons = [...barre.querySelectorAll("[data-volet-cible]")];
    const conteneur = barre.parentElement;
    boutons.forEach((bouton) => {
      bouton.addEventListener("click", () => {
        boutons.forEach((b) => b.classList.remove("actif"));
        bouton.classList.add("actif");
        conteneur.querySelectorAll("[data-volet]").forEach((section) => {
          section.hidden = section.dataset.volet !== bouton.dataset.voletCible;
        });
      });
    });
  });
}

// ── Vue : liste des prospects ───────────────────────────────────────────────

function criteresSauvegardes() {
  try {
    return JSON.parse(localStorage.getItem(CLE_CRITERES) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

async function vueProspects() {
  const criteres = criteresSauvegardes();
  const valeur = (cle, defaut = "") => esc(criteres[cle] ?? defaut);
  const coche = (cle, defaut = false) => ((criteres[cle] ?? defaut) ? "checked" : "");

  vue.innerHTML = `
    <div id="rappel-haut"></div>
    <details class="panneau" ${localStorage.getItem(CLE_PANNEAU) === "0" ? "" : "open"} id="panneau-recherche">
      <summary>Trouver des entreprises</summary>
      <div class="corps">
        <p class="aide">Base Sirene en open data : entreprises récentes (budget de lancement) ou
          établies dont le site est à refaire. Chaque critère ci-dessous est revérifié sur chaque
          résultat — ce qui s'affiche y répond, et ce qui a été écarté est expliqué sous le tableau.</p>
        <form id="recherche">
          <h3 style="margin-top:4px">Où chercher</h3>
          <div class="grille">
            <div>
              <label for="departement">Département</label>
              <input type="text" id="departement" placeholder="33" maxlength="3" value="${valeur("departement")}">
            </div>
            <div>
              <label for="codePostal">Code postal</label>
              <input type="text" id="codePostal" placeholder="33000" maxlength="5" value="${valeur("codePostal")}">
            </div>
            <div>
              <label for="q">Recherche libre</label>
              <input type="text" id="q" placeholder="nom, activité…" value="${valeur("q")}">
            </div>
          </div>

          <h3>Secteurs</h3>
          <div class="cases" id="secteurs">
            ${config.secteurs.map((s) => `
              <label class="case"><input type="checkbox" value="${esc(s.id)}"
                ${(criteres.secteurs ?? []).includes(s.id) ? "checked" : ""}> ${esc(s.label)}</label>`).join("")}
          </div>

          <h3>Ancienneté, taille et budget</h3>
          <div class="grille">
            <div>
              <label for="depuis">Créées depuis moins de</label>
              <select id="depuis">
                ${[["", "peu importe"], ["1", "1 mois (toutes neuves)"], ["2", "2 mois"], ["3", "3 mois"],
                   ["6", "6 mois"], ["12", "12 mois"], ["18", "18 mois"], ["24", "2 ans"], ["60", "5 ans"]]
                  .map(([v, l]) => `<option value="${v}" ${String(criteres.depuis ?? "12") === v ? "selected" : ""}>${l}</option>`).join("")}
              </select>
              <p class="aide-mini">Une entreprise jeune a un budget de lancement.
                <button type="button" id="preset-neuves" class="lien-mini">Sociétés créées ces 2 derniers mois</button></p>
            </div>
            <div>
              <label for="creeApres">…ou créée après le</label>
              <input type="date" id="creeApres" value="${valeur("creeApres")}">
              <p class="aide-mini">Une date explicite remplace le choix ci-contre.</p>
            </div>
            <div>
              <label for="creeAvant">et avant le</label>
              <input type="date" id="creeAvant" value="${valeur("creeAvant")}">
            </div>
            <div>
              <label for="caMin">CA minimum (€)</label>
              <input type="number" id="caMin" placeholder="0" min="0" value="${valeur("caMin")}">
              <p class="aide-mini">Connu seulement pour les entreprises qui déposent leurs comptes :
                filtrer dessus écarte les autres.</p>
            </div>
            <div>
              <label for="caMax">CA maximum (€)</label>
              <input type="number" id="caMax" placeholder="illimité" min="0" value="${valeur("caMax")}">
            </div>
          </div>

          <h3>Effectif</h3>
          <div class="cases" id="effectifs">
            ${config.tranches.map((t) => `
              <label class="case"><input type="checkbox" value="${esc(t.code)}"
                ${(criteres.trancheEffectif ?? []).includes(t.code) ? "checked" : ""}> ${esc(t.label)}</label>`).join("")}
          </div>

          <h3>Objectif</h3>
          <div class="grille">
            <div>
              <label for="cible">Ce que je cherche</label>
              <select id="cible">
                ${[["tous", "Les deux : sans site ou site à refaire"], ["sans_site", "Entreprises sans site web"], ["site_a_refaire", "Sites web à refaire"]]
                  .map(([v, l]) => `<option value="${v}" ${(criteres.cible ?? "tous") === v ? "selected" : ""}>${esc(l)}</option>`).join("")}
              </select>
            </div>
            <div>
              <label for="objectif">Nombre de prospects visés</label>
              <input type="number" id="objectif" value="${valeur("objectif", "50")}" min="1" max="250" step="1">
              <p class="aide-mini">L'outil tourne les pages jusqu'à réunir ce nombre de prospects
                <em>conformes à vos critères</em> (250 entreprises examinées au maximum).</p>
            </div>
            <div class="pleine-largeur">
              <label class="case"><input type="checkbox" id="auditSites" ${coche("auditSites", true)}>
                Détecter et analyser les sites web (plus lent, mais c'est ce qui qualifie le prospect
                et relève les coordonnées)</label>
            </div>
          </div>

          <div class="ligne ligne-fin" style="margin-top:16px">
            <button type="button" class="discret" id="vider-criteres">Réinitialiser</button>
            <button type="submit" class="primaire">Lancer la recherche</button>
          </div>
          <div id="progression-recherche"></div>
        </form>
      </div>
    </details>

    <details class="panneau" id="panneau-osm">
      <summary>Chercher des commerces sur le terrain (OpenStreetMap)</summary>
      <div class="corps">
        <p class="aide">Source complémentaire et gratuite : OpenStreetMap décrit les commerces
          tels qu'ils existent — nom, adresse exacte, téléphone, et site web quand il y en a un.
          Un commerce cartographié sans site, c'est exactement le prospect recherché. Sirene, à
          l'inverse, connaît toutes les entreprises mais ni leur téléphone ni leur site.</p>
        <form id="recherche-osm">
          <div class="grille">
            <div>
              <label for="osm-ville">Commune</label>
              <input type="text" id="osm-ville" placeholder="Bordeaux" value="${valeur("osmVille")}">
              <p class="aide-mini">Nom exact de la commune.</p>
            </div>
            <div>
              <label for="osm-cp">…ou code postal</label>
              <input type="text" id="osm-cp" placeholder="33000" maxlength="5" value="${valeur("osmCodePostal")}">
            </div>
            <div>
              <label for="osm-limite">Nombre maximum de commerces</label>
              <input type="number" id="osm-limite" value="${valeur("osmLimite", "200")}" min="10" max="500" step="1">
            </div>
          </div>

          <h3>Types de commerces</h3>
          <div class="cases" id="osm-categories">
            ${(config.categories_osm ?? []).map((c) => `
              <label class="case"><input type="checkbox" value="${esc(c.id)}"
                ${(criteres.osmCategories ?? []).includes(c.id) ? "checked" : ""}> ${esc(c.label)}</label>`).join("")}
          </div>

          <div class="ligne" style="margin-top:16px">
            <label class="case"><input type="checkbox" id="osm-sans-site" ${coche("osmSansSite", true)}>
              Seulement les commerces sans site web déclaré (l'audit vérifiera ensuite pour de vrai)</label>
          </div>
          <div class="ligne ligne-fin" style="margin-top:16px">
            <button type="submit" class="primaire">Chercher sur OpenStreetMap</button>
          </div>
          <p class="aide-mini">Données © les contributeurs OpenStreetMap, sous licence ODbL.
            Service bénévole : une requête par recherche, soyez patient si elle est saturée.</p>
          <div id="progression-osm"></div>
        </form>
      </div>
    </details>

    <div id="indicateurs" class="indicateurs"></div>

    <div class="carte">
      <div class="entre-deux">
        <h2>Prospects <span class="etiquette" id="compte"></span></h2>
        <div class="ligne">
          <input type="text" id="filtre-texte" aria-label="Filtrer les prospects"
                 placeholder="Filtrer : nom, ville, email…" style="width:220px" value="${esc(tri.texte)}">
          <select id="filtre-statut" class="compact" aria-label="Filtrer par statut" style="width:auto"><option value="">Tous les statuts</option>
            ${config.statuts.map((s) => `<option value="${esc(s)}" ${tri.statut === s ? "selected" : ""}>${esc(LIBELLES_STATUT[s] ?? s)}</option>`).join("")}
          </select>
          <select id="filtre-priorite" class="compact" aria-label="Filtrer par priorité" style="width:auto"><option value="">Toutes priorités</option>
            ${["chaud", "tiede", "froid"].map((p) => `<option value="${p}" ${tri.priorite === p ? "selected" : ""}>${p}</option>`).join("")}
          </select>
          <select id="filtre-relance" class="compact" aria-label="Filtrer par relance" style="width:auto">
            ${[["", "Toutes les relances"], ["du_jour", "À relancer (aujourd'hui ou en retard)"],
               ["retard", "En retard uniquement"], ["planifiee", "Relance planifiée"], ["sans", "Sans relance prévue"]]
              .map(([v, l]) => `<option value="${v}" ${tri.relance === v ? "selected" : ""}>${l}</option>`).join("")}
          </select>
          <select id="filtre-contact" class="compact" aria-label="Filtrer par moyen de contact" style="width:auto">
            ${[["", "Tous les contacts"], ["joignable", "Joignables (tél. ou email)"],
               ["telephone", "Avec téléphone"], ["email", "Avec email"], ["aucun", "Sans coordonnée"]]
              .map(([v, l]) => `<option value="${v}" ${tri.contact === v ? "selected" : ""}>${l}</option>`).join("")}
          </select>
          <button type="button" id="auditer-lot">Auditer 10 prospects</button>
          <button type="button" id="exporter">Exporter en CSV</button>
          <button type="button" id="vider-prospects" class="discret">Tout supprimer</button>
        </div>
      </div>
      <div id="progression-audits"></div>
      <div class="deroule" id="tableau"><p class="attente">Chargement…</p></div>
      <div id="bilan"></div>
    </div>`;

  const panneau = vue.querySelector("#panneau-recherche");
  panneau.addEventListener("toggle", () => localStorage.setItem(CLE_PANNEAU, panneau.open ? "1" : "0"));

  const formulaireOsm = vue.querySelector("#recherche-osm");
  brancheValidation(formulaireOsm);
  formulaireOsm.addEventListener("submit", (evenement) => {
    evenement.preventDefault();
    lanceRechercheOsm(formulaireOsm);
  });

  const formulaire = vue.querySelector("#recherche");
  brancheValidation(formulaire);
  formulaire.addEventListener("submit", (evenement) => {
    evenement.preventDefault();
    lanceRecherche(formulaire);
  });
  vue.querySelector("#vider-criteres").addEventListener("click", () => {
    localStorage.removeItem(CLE_CRITERES);
    vueProspects();
  });

  // Repartir de zéro. Irréversible et non filtré : on demande confirmation en annonçant le
  // nombre exact, et on rappelle que le catalogue et l'identité sont conservés.
  vue.querySelector("#vider-prospects").addEventListener("click", async (evenement) => {
    if (!prospects.length) {
      notifie("La liste est déjà vide", "info");
      return;
    }
    const message = `Supprimer définitivement les ${prospects.length} prospect(s), leurs audits ` +
      `et leurs documents ?\n\nVos prestations et votre identité sont conservées.`;
    if (!window.confirm(message)) return;
    try {
      const { supprimes } = await pendant(evenement.currentTarget, "Suppression…", () =>
        api("/api/prospects", { methode: "DELETE" }));
      dernierBilan = null;
      await chargeEtAffiche();
      notifie(`${supprimes} prospect(s) supprimé(s)`, "succes");
    } catch (erreur) {
      notifie(erreur.message, "erreur");
    }
  });

  // Raccourci « sociétés toutes neuves » : deux mois d'ancienneté, et on efface les dates
  // explicites qui, sinon, prendraient le pas sur le choix ci-dessus.
  vue.querySelector("#preset-neuves")?.addEventListener("click", () => {
    vue.querySelector("#depuis").value = "2";
    vue.querySelector("#creeApres").value = "";
    vue.querySelector("#creeAvant").value = "";
    notifie("Critère posé : créées il y a moins de 2 mois — lancez la recherche", "info");
  });

  ["texte", "statut", "priorite", "contact", "relance"].forEach((clef) => {
    const champ = vue.querySelector(`#filtre-${clef}`);
    champ.addEventListener("input", () => {
      tri[clef] = champ.value;
      // Un nouveau filtre repart du début de la liste.
      limiteAffichage = PAS_AFFICHAGE;
      dessineTableau();
    });
  });

  // Audit en lot : sur ce qui est affiché, jamais audités d'abord. Traitement le plus long,
  // donc suivi pas à pas.
  vue.querySelector("#auditer-lot").addEventListener("click", async (evenement) => {
    const affiches = prospectsAffiches();
    const ids = [
      ...affiches.filter((p) => !p.audit_le),
      ...affiches.filter((p) => p.audit_le).sort((a, b) => (a.audit_le ?? "").localeCompare(b.audit_le ?? "")),
    ].slice(0, 10).map((p) => p.id);
    if (!ids.length) {
      notifie("Aucun prospect affiché à auditer", "erreur");
      return;
    }
    const progression = vue.querySelector("#progression-audits");
    progression.innerHTML = `<div class="carte serree"><p class="aide" style="margin:0">Démarrage…</p>
      <div class="progression"></div></div>`;
    try {
      const bilan = await pendant(evenement.currentTarget, "Audits en cours…", async () => {
        const { travail } = await api("/api/audits", { methode: "POST", corps: { ids } });
        return suit(travail, (etat) => afficheAvancement(progression, etat, "Audit des sites"));
      });
      notifie(
        `${bilan.audites} site(s) audité(s)` +
          (bilan.non_concluants ? `, ${bilan.non_concluants} non concluant(s)` : "") +
          (bilan.sans_site ? `, ${bilan.sans_site} sans site` : "") +
          (bilan.echecs.length ? `, ${bilan.echecs.length} échec(s)` : ""),
        "succes",
      );
      await chargeEtAffiche();
    } catch (erreur) {
      notifie(erreur.message, "erreur");
    } finally {
      progression.innerHTML = "";
    }
  });

  // L'export reprend les filtres d'affichage : on exporte ce qu'on voit.
  vue.querySelector("#exporter").addEventListener("click", () => {
    const parametres = new URLSearchParams();
    if (tri.texte.trim()) parametres.set("q", tri.texte.trim());
    if (tri.statut) parametres.set("statut", tri.statut);
    if (tri.priorite) parametres.set("priorite", tri.priorite);
    if (tri.contact) parametres.set("contact", tri.contact);
    location.href = `/api/export.csv${parametres.size ? `?${parametres}` : ""}`;
  });

  await chargeEtAffiche();
}

/** Lit le formulaire, lance la recherche, puis rend compte de ce qui a été écarté. */
async function lanceRecherche(formulaire) {
  const lire = (id) => vue.querySelector(`#${id}`).value.trim();
  const corps = {
    departement: lire("departement"),
    codePostal: lire("codePostal"),
    q: lire("q"),
    depuis: Number(lire("depuis")) || undefined,
    creeApres: lire("creeApres") || undefined,
    creeAvant: lire("creeAvant") || undefined,
    caMin: Number(lire("caMin")) || undefined,
    caMax: Number(lire("caMax")) || undefined,
    cible: lire("cible"),
    objectif: Number(lire("objectif")) || 50,
    secteurs: [...vue.querySelectorAll("#secteurs input:checked")].map((c) => c.value),
    trancheEffectif: [...vue.querySelectorAll("#effectifs input:checked")].map((c) => c.value),
    auditSites: vue.querySelector("#auditSites").checked,
  };
  localStorage.setItem(CLE_CRITERES, JSON.stringify(corps));

  const progression = vue.querySelector("#progression-recherche");
  progression.innerHTML = `<div class="carte serree"><p class="aide" style="margin:0">Démarrage…</p>
    <div class="progression"></div></div>`;
  try {
    const resultat = await pendant(
      formulaire.querySelector("button[type=submit]"),
      "Recherche…",
      async () => {
        const { travail } = await api("/api/prospection", { methode: "POST", corps });
        return suit(travail, (etat) => afficheAvancement(progression, etat, "Recherche en cours"));
      },
    );
    dernierBilan = resultat;
    notifie(messageRecherche(resultat), resultat.retenus ? "succes" : "erreur");
    vue.querySelector("#panneau-recherche").open = false;
    localStorage.setItem(CLE_PANNEAU, "0");
    await chargeEtAffiche();
  } catch (erreur) {
    notifie(erreur.message, "erreur");
  } finally {
    progression.innerHTML = "";
  }
}

/** Recherche OpenStreetMap : même mécanique de suivi que la recherche Sirene. */
async function lanceRechercheOsm(formulaire) {
  const lire = (id) => vue.querySelector(`#${id}`).value.trim();
  const corps = {
    ville: lire("osm-ville"),
    codePostal: lire("osm-cp"),
    limite: Number(lire("osm-limite")) || 200,
    categories: [...vue.querySelectorAll("#osm-categories input:checked")].map((c) => c.value),
    sansSiteSeulement: vue.querySelector("#osm-sans-site").checked,
  };
  if (!corps.ville && !corps.codePostal) {
    notifie("Précisez une commune ou un code postal", "erreur");
    return;
  }
  // On mémorise ces critères à côté de ceux de la recherche Sirene.
  const memoire = criteresSauvegardes();
  localStorage.setItem(CLE_CRITERES, JSON.stringify({
    ...memoire,
    osmVille: corps.ville, osmCodePostal: corps.codePostal, osmLimite: corps.limite,
    osmCategories: corps.categories, osmSansSite: corps.sansSiteSeulement,
  }));

  const progression = vue.querySelector("#progression-osm");
  progression.innerHTML = `<div class="carte serree"><p class="aide" style="margin:0">Interrogation
    d'OpenStreetMap — le service peut mettre une trentaine de secondes.</p>
    <div class="progression"></div></div>`;
  try {
    const resultat = await pendant(
      formulaire.querySelector("button[type=submit]"),
      "Recherche…",
      async () => {
        const { travail } = await api("/api/prospection-osm", { methode: "POST", corps });
        return suit(travail, (etat) => afficheAvancement(progression, etat, "OpenStreetMap"));
      },
    );
    notifie(
      `${resultat.trouves} commerce(s) trouvé(s), ${resultat.nouveaux} nouveau(x) — ` +
        `${resultat.sans_site} sans site déclaré, ${resultat.avec_telephone} avec téléphone`,
      "succes",
    );
    vue.querySelector("#panneau-osm").open = false;
    await chargeEtAffiche();
  } catch (erreur) {
    notifie(erreur.message, "erreur");
  } finally {
    progression.innerHTML = "";
  }
}

/**
 * Un « 0 retenu » sans explication est inutilisable : on nomme le critère qui a écarté le plus
 * d'entreprises, puisque c'est celui qu'il faut assouplir.
 */
function raisonDominante(bilan) {
  return (bilan.raisons_ecart ?? []).slice().sort((a, b) => b.nombre - a.nombre)[0] ?? null;
}

function messageRecherche(bilan) {
  if (bilan.retenus) {
    return `${bilan.retenus} prospect(s) retenu(s) — ${bilan.nouveaux} nouveau(x)` +
      (bilan.hors_criteres ? `, ${bilan.hors_criteres} écarté(s) par vos critères` : "");
  }
  // Le filtre d'âge est celui qui vide le plus souvent l'écran : on montre alors le gisement
  // réel (les plus jeunes trouvées) plutôt que de renvoyer l'utilisateur deviner un chiffre.
  const jeunes = bilan.plus_jeunes ?? [];
  if (jeunes.length) {
    const ages = jeunes.map((j) => j.age_mois).filter((m) => typeof m === "number");
    const plusJeune = ages.length ? Math.min(...ages) : null;
    return `Aucune entreprise assez récente : ${bilan.analyses} examinée(s), la plus jeune a ` +
      `${plusJeune ?? "?"} mois. Élargissez l'ancienneté — le détail est sous le tableau.`;
  }
  const raison = raisonDominante(bilan);
  if (raison) {
    return `Aucun prospect retenu : ${bilan.analyses} entreprise(s) examinée(s), toutes écartées ` +
      `— principalement « ${raison.raison} ». Assouplissez ce critère et relancez.`;
  }
  if (bilan.hors_cible) {
    return `Aucun prospect retenu : les ${bilan.analyses} entreprises examinées ont toutes un site ` +
      `correct. Choisissez « Les deux » comme objectif, ou changez de secteur.`;
  }
  return `Aucune entreprise ne correspond à ces critères dans la base Sirene.`;
}

async function chargeEtAffiche() {
  try {
    prospects = (await api("/api/prospects")).prospects;
  } catch (erreur) {
    notifie(erreur.message, "erreur");
    prospects = [];
  }
  dessineIndicateurs();
  dessineTableau();
  dessineBilan();
}

function dessineIndicateurs() {
  const cible = vue.querySelector("#indicateurs");
  if (!cible) return;
  const compte = (predicat) => prospects.filter(predicat).length;
  const aRelancer = compte((p) => correspondRelance(p, "du_jour"));
  const cartes = [
    ["Prospects", prospects.length, ""],
    // En tête : c'est la seule case qui représente du travail daté, à faire aujourd'hui.
    ["À relancer", aRelancer, aRelancer ? "s-rouge" : ""],
    ["Chauds", compte((p) => p.priorite === "chaud"), "s-ambre"],
    ["Joignables", compte((p) => correspondContact(p, "joignable")), "s-vert"],
    ["Sans site web", compte((p) => p.site_statut === "aucun_site"), ""],
    ["Audités", compte((p) => p.audit_le), ""],
  ];
  cible.innerHTML = cartes.map(([nom, valeur, classe]) => `
    <div class="indicateur"><div class="valeur ${classe}">${valeur}</div><div class="nom">${esc(nom)}</div></div>`).join("");

  const haut = vue.querySelector("#rappel-haut");
  if (haut) haut.innerHTML = rappelRelances();
  haut?.querySelector("#voir-relances")?.addEventListener("click", () => {
    tri.relance = "du_jour";
    const champ = vue.querySelector("#filtre-relance");
    if (champ) champ.value = "du_jour";
    limiteAffichage = PAS_AFFICHAGE;
    dessineTableau();
  });
}

/**
 * Bandeau des relances dues. Il ne s'affiche que s'il y a quelque chose à faire : un rappel
 * permanent devient un décor qu'on ne lit plus. Le bouton bascule la liste sur ces prospects
 * plutôt que d'ouvrir un écran de plus.
 */
function rappelRelances() {
  const dus = prospects.filter((p) => correspondRelance(p, "du_jour"));
  if (!dus.length) return "";
  const retard = dus.filter((p) => correspondRelance(p, "retard")).length;
  const noms = dus.slice(0, 3).map((p) => p.enseigne?.trim() || p.nom);

  return `<div class="rappel-relances">
    <strong>${dus.length} relance(s) à faire${retard ? ` — dont ${retard} en retard` : ""}</strong>
    <span class="aide-mini">${noms.map(esc).join(", ")}${dus.length > noms.length ? `, +${dus.length - noms.length}` : ""}</span>
    <button type="button" id="voir-relances" class="petit primaire">Voir</button>
  </div>`;
}

/** Ce que la recherche a écarté, et pourquoi : un total qui ne tombe pas juste inquiète. */
function dessineBilan() {
  const cible = vue.querySelector("#bilan");
  if (!cible) return;
  if (!dernierBilan) {
    cible.innerHTML = "";
    return;
  }
  const bilan = dernierBilan;
  const raisons = (bilan.raisons_ecart ?? [])
    .map((r) => `<li>${nombre(r.nombre)} × ${esc(r.raison)}</li>`).join("");

  cible.innerHTML = `
    <p class="aide-mini" style="margin-top:14px">
      Dernière recherche : ${nombre(bilan.total_disponible)} entreprise(s) répondent aux critères que
      l'API sait appliquer, ${nombre(bilan.analyses)} examinée(s) sur ${nombre(bilan.pages_parcourues ?? 0)} page(s),
      <strong>${nombre(bilan.retenus)} retenue(s)</strong>${bilan.nouveaux ? ` dont ${nombre(bilan.nouveaux)} nouvelle(s)` : ""}.
      ${bilan.hors_cible ? `${nombre(bilan.hors_cible)} écartée(s) car leur site n'est pas à refaire. ` : ""}
      ${bilan.tronque ? `Objectif de ${nombre(bilan.objectif ?? 0)} non atteint : le maximum de pages a été parcouru. ` : ""}
    </p>
    ${raisons ? `<div class="aide-mini">Écartées par vos critères :
      <ul style="margin:4px 0 0 18px">${raisons}</ul>
      <p style="margin-top:6px">Ces critères sont vérifiés ici sur chaque entreprise reçue : l'API
        ne sait pas tous les appliquer elle-même, en particulier la date de création.</p></div>` : ""}
    ${panneauPlusJeunes(bilan)}`;

  // Élargir en un clic : le mois proposé est celui qui ferait entrer la plus jeune trouvée.
  cible.querySelector("#elargir-age")?.addEventListener("click", (evenement) => {
    const mois = Number(evenement.currentTarget.dataset.mois);
    const champ = vue.querySelector("#depuis");
    // La liste ne propose que certains paliers : on prend le premier qui couvre le besoin.
    const palier = [...champ.options].map((o) => Number(o.value))
      .filter((v) => v > 0).sort((a, b) => a - b).find((v) => v >= mois);
    champ.value = palier ? String(palier) : "";
    vue.querySelector("#creeApres").value = "";
    notifie(palier ? `Ancienneté portée à ${palier} mois — relancez la recherche`
      : "Critère d'ancienneté retiré — relancez la recherche", "info");
  });
}

/**
 * Quand le filtre d'âge ne laisse rien passer, montrer le gisement réel : les entreprises les
 * plus jeunes trouvées, avec leur âge. Un écran vide ne dit pas s'il faut élargir d'un mois ou
 * de deux ans ; cette liste le dit, et le bouton applique le bon palier.
 */
function panneauPlusJeunes(bilan) {
  const jeunes = bilan.plus_jeunes ?? [];
  if (!jeunes.length) return "";
  const ages = jeunes.map((j) => j.age_mois).filter((m) => typeof m === "number");
  const plusJeune = ages.length ? Math.min(...ages) : null;

  return `<div class="carte serree" style="margin-top:14px">
    <h3 style="margin-top:0">Aucune entreprise assez récente — voici les plus jeunes trouvées</h3>
    <ul style="margin:0 0 10px 18px">
      ${jeunes.map((j) => `<li>${esc(j.nom)}${j.ville ? ` — ${esc(j.ville)}` : ""}
        <span class="aide-mini">créée le ${dateCourte(j.date_creation)}${
          typeof j.age_mois === "number" ? ` · ${j.age_mois} mois` : ""}</span></li>`).join("")}
    </ul>
    ${plusJeune !== null ? `<button id="elargir-age" class="primaire petit" data-mois="${plusJeune}">
      Élargir à ${plusJeune} mois d'ancienneté</button>` : ""}
    <p class="aide-mini">${bilan.filtre_date_applique === false
      ? "L'API a ignoré la fenêtre de dates : le tri se fait par pertinence, les entreprises jeunes arrivent en dernier. La recherche est donc descendue bien au-delà des premières pages avant de conclure."
      : "Le gisement d'entreprises très récentes est mince sur ce secteur et ce département : élargissez la zone ou l'ancienneté."}</p>
  </div>`;
}

/** Date du jour en YYYY-MM-DD, heure locale — `toISOString` décalerait selon le fuseau. */
function aujourdhui() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")]
    .join("-");
}

/**
 * Les relances sont le nerf de la prospection : 80 % des affaires se font après plusieurs
 * contacts. « En retard » et « aujourd'hui » sont volontairement regroupés dans un même
 * filtre — ce qui compte, c'est ce qu'il reste à faire, pas depuis combien de temps.
 */
function correspondRelance(prospect, critere) {
  const date = prospect.relance_le || null;
  const jour = aujourdhui();
  if (critere === "sans") return !date;
  if (!date) return false;
  if (critere === "retard") return date < jour;
  if (critere === "du_jour") return date <= jour;
  if (critere === "planifiee") return date > jour;
  return true;
}

/**
 * Miroir de `correspondContact` de src/moteur/core.ts : la liste affichée et le CSV exporté
 * doivent trancher exactement pareil, sinon l'export ne correspond plus à l'écran.
 */
function correspondContact(prospect, critere) {
  const tel = Boolean(prospect.telephone);
  const mail = Boolean(prospect.email_contact);
  if (critere === "telephone") return tel;
  if (critere === "email") return mail;
  if (critere === "joignable") return tel || mail;
  if (critere === "aucun") return !tel && !mail;
  return true;
}

/** Les prospects effectivement listés, après les filtres d'affichage. */
function prospectsAffiches() {
  const recherche = tri.texte.trim().toLowerCase();
  return prospects.filter((p) => {
    if (tri.statut && p.statut !== tri.statut) return false;
    if (tri.priorite && p.priorite !== tri.priorite) return false;
    if (tri.contact && !correspondContact(p, tri.contact)) return false;
    if (tri.relance && !correspondRelance(p, tri.relance)) return false;
    if (!recherche) return true;
    return [p.nom, p.enseigne, p.ville, p.domaine, p.site_web, p.code_postal, p.email_contact, p.dirigeant]
      .filter(Boolean).join(" ").toLowerCase().includes(recherche);
  });
}

function dessineTableau() {
  const cible = vue.querySelector("#tableau");
  if (!cible) return;

  const retenus = prospectsAffiches();
  const affiches = retenus.slice(0, limiteAffichage);

  vue.querySelector("#compte").textContent = `${retenus.length} / ${prospects.length}`;

  if (!retenus.length) {
    const explication = prospects.length
      ? "Aucun prospect ne correspond aux filtres d'affichage."
      : dernierBilan
        ? messageRecherche(dernierBilan)
        : "Aucun prospect pour l'instant : lancez une recherche ci-dessus, ou auditez directement l'adresse d'un site.";
    cible.innerHTML = `<p class="aide">${esc(explication)}</p>`;
    return;
  }

  cible.innerHTML = `<table class="cartes">
    <thead><tr>
      <th class="nombre">Oppor.</th><th>Entreprise</th><th>Contact</th><th>Site web</th>
      <th class="nombre">Audit</th><th>Statut</th><th></th>
    </tr></thead>
    <tbody>${affiches.map((p) => `
      <tr>
        <td class="nombre" data-libelle="Opportunité">
          <strong class="${classeOpportunite(p.score)}" style="font-size:15px">${p.score}</strong>
          <div class="sous"><span class="etiquette ${CLASSES_PRIORITE[p.priorite] ?? ""}">${esc(p.priorite)}</span></div>
        </td>
        <td data-libelle="Entreprise">
          <a href="#/prospect/${esc(p.id)}" class="titre-ligne">${esc(p.nom)}</a>
          ${[p.enseigne !== p.nom ? p.enseigne : null, p.ville, p.code_postal].filter(Boolean).length
            ? `<div class="sous">${esc([p.enseigne !== p.nom ? p.enseigne : null, p.ville, p.code_postal].filter(Boolean).join(" · "))}</div>`
            : ""}
          <div class="sous">${esc([
            p.activite_code,
            p.date_creation ? `créée le ${dateCourte(p.date_creation)}` : null,
            p.effectif_estime ? `${p.effectif_estime} sal.` : null,
            p.chiffre_affaires ? `CA ${euros(p.chiffre_affaires)}` : null,
          ].filter(Boolean).join(" · "))}</div>
        </td>
        <td data-libelle="Contact">
          ${p.email_contact
            ? `<a href="mailto:${esc(p.email_contact)}">${esc(p.email_contact)}</a>`
            : `<span class="sous">pas d'email publié</span>`}
          ${p.telephone ? `<div class="sous">${esc(p.telephone)}</div>` : ""}
          <div style="margin-top:4px">
            <a href="${esc(p.google_maps_url || p.google_recherche)}" target="_blank" rel="noreferrer noopener"
               class="etiquette ${p.google_maps_url ? "et-accent" : ""}"
               title="${p.google_maps_url ? "Fiche Google publiée sur le site" : "Recherche Google Maps : fiche non confirmée"}">
              ${p.google_maps_url ? "Fiche Google ↗" : "Chercher ↗"}</a>
          </div>
        </td>
        <td data-libelle="Site web">
          ${p.site_web
            ? `<a href="${esc(p.site_web)}" target="_blank" rel="noreferrer noopener">${esc(p.site_web.replace(/^https?:\/\//, "").slice(0, 30))} ↗</a>
               <div class="sous">${esc(LIBELLES_SITE[p.site_statut] ?? p.site_statut)}</div>`
            : `<span class="etiquette et-rouge">${esc(LIBELLES_SITE[p.site_statut] ?? p.site_statut)}</span>`}
        </td>
        <td class="nombre" data-libelle="Audit">${p.audit_concluant === false
          ? `<span class="etiquette">non concluant</span>`
          : p.site_statut === "aucun_site"
            ? `<span class="etiquette">sans objet</span>`
            : p.score_audit === null || p.score_audit === undefined
              ? "—"
              : `<strong class="${classeScore(p.score_audit)}" style="font-size:15px">${p.score_audit}</strong>
                 <div class="sous">${dateCourte(p.audit_le)}</div>`}</td>
        <td data-libelle="Statut">
          <select data-statut="${esc(p.id)}" class="compact" aria-label="Statut de ${esc(p.nom)}">
            ${config.statuts.map((s) => `<option value="${esc(s)}" ${s === p.statut ? "selected" : ""}>${esc(LIBELLES_STATUT[s] ?? s)}</option>`).join("")}
          </select>
          ${p.proposition_prete ? `<div class="sous">proposition prête</div>` : ""}
        </td>
        <td class="actions">
          <div class="ligne">
            <button class="petit" data-auditer="${esc(p.id)}">Auditer</button>
            <a class="bouton" href="#/prospect/${esc(p.id)}"><button class="petit" type="button">Ouvrir</button></a>
          </div>
        </td>
      </tr>`).join("")}
    </tbody></table>
    ${retenus.length > affiches.length ? `
      <div class="ligne" style="justify-content:center;margin-top:14px">
        <span class="aide-mini" style="margin:0">${affiches.length} lignes affichées sur ${nombre(retenus.length)}</span>
        <button class="petit" id="afficher-plus">Afficher ${Math.min(PAS_AFFICHAGE, retenus.length - affiches.length)} de plus</button>
        <button class="petit discret" id="afficher-tout">Tout afficher</button>
      </div>` : ""}`;

  cible.querySelector("#afficher-plus")?.addEventListener("click", () => {
    limiteAffichage += PAS_AFFICHAGE;
    dessineTableau();
  });
  cible.querySelector("#afficher-tout")?.addEventListener("click", () => {
    limiteAffichage = Number.MAX_SAFE_INTEGER;
    dessineTableau();
  });

  cible.querySelectorAll("[data-statut]").forEach((select) => {
    select.addEventListener("change", async () => {
      try {
        await api(`/api/prospects/${select.dataset.statut}`, {
          methode: "PATCH", corps: { statut: select.value },
        });
        const prospect = prospects.find((p) => p.id === select.dataset.statut);
        if (prospect) prospect.statut = select.value;
        dessineIndicateurs();
        notifie("Statut enregistré", "succes");
      } catch (erreur) {
        notifie(erreur.message, "erreur");
      }
    });
  });

  cible.querySelectorAll("[data-auditer]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      try {
        const resultat = await pendant(bouton, "Audit…", () =>
          api("/api/audit", { methode: "POST", corps: { prospect_id: bouton.dataset.auditer } }));
        notifie(messageAudit(resultat), resultat.concluant === false ? "info" : "succes");
        await chargeEtAffiche();
      } catch (erreur) {
        notifie(erreur.message, "erreur");
      }
    });
  });
}

function messageAudit(resultat) {
  if (resultat.sans_site) return resultat.message;
  if (resultat.concluant === false) return `Audit non concluant — ${resultat.message}`;
  const contact = resultat.prospect?.email_contact ? ` — email trouvé : ${resultat.prospect.email_contact}` : "";
  return `Audit terminé — note ${resultat.audit.scores.global}/100${contact}`;
}

// ── Vue : auditer une adresse ───────────────────────────────────────────────

function vueAuditer() {
  vue.innerHTML = `
    <div class="carte">
      <h2>Auditer un site</h2>
      <p class="aide">Collez l'adresse d'un site : référencement, design et mobile, sécurité et
        performance sont analysés en lecture seule (aucune intrusion). Les coordonnées publiées
        sur le site sont relevées au passage. Le site est enregistré comme prospect, prêt pour la
        proposition commerciale. Comptez 15 à 45 secondes.</p>
      <form id="formulaire-audit">
        <div class="grille">
          <div>
            <label for="url">Adresse du site</label>
            <input type="text" id="url" placeholder="garage-martin.fr" required>
          </div>
          <div>
            <label for="nom">Nom de l'entreprise (optionnel)</label>
            <input type="text" id="nom" placeholder="Garage Martin">
          </div>
        </div>
        <div class="ligne" style="margin-top:14px">
          <label class="case"><input type="checkbox" id="rapide">
            Audit rapide (sans Lighthouse ni sondage des fichiers publics)</label>
        </div>
        <div class="ligne ligne-fin" style="margin-top:12px">
          <button type="submit" class="primaire">Lancer l'audit</button>
        </div>
        <div id="progression-audit"></div>
      </form>
    </div>
    <div id="resultat-audit"></div>`;

  const formulaire = vue.querySelector("#formulaire-audit");
  brancheValidation(formulaire);
  formulaire.addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    const corps = {
      url: vue.querySelector("#url").value.trim(),
      nom: vue.querySelector("#nom").value.trim(),
      profondeur: vue.querySelector("#rapide").checked ? "rapide" : "complet",
    };
    const progression = vue.querySelector("#progression-audit");
    progression.innerHTML = `<p class="aide" style="margin-top:12px">Analyse en cours : pages,
      en-têtes HTTP, DNS, coordonnées, Lighthouse… 15 à 45 secondes.</p><div class="progression"></div>`;
    vue.querySelector("#resultat-audit").innerHTML = "";
    try {
      const resultat = await pendant(
        formulaire.querySelector("button[type=submit]"),
        "Audit en cours…",
        () => api("/api/audit", { methode: "POST", corps }),
      );
      const zone = vue.querySelector("#resultat-audit");
      const prospect = resultat.prospect;
      zone.innerHTML = `
        <div class="carte">
          <div class="entre-deux">
            <div>
              <h2>${esc(prospect.nom)}</h2>
              <p class="aide" style="margin:0">Enregistré comme prospect — le devis, l'email HTML
                et le script d'appel se génèrent depuis la fiche.</p>
            </div>
            <a class="bouton" href="#/prospect/${esc(prospect.id)}">
              <button type="button" class="primaire">Ouvrir la fiche et chiffrer</button></a>
          </div>
        </div>
        ${blocCoordonnees(prospect)}
        ${blocAudit(resultat.audit ? { ...resultat.audit, cree_le: new Date().toISOString() } : null)}`;
      brancheOnglets(zone);
      brancheCopiesTexte(zone);
      notifie(messageAudit(resultat), resultat.concluant === false ? "info" : "succes");
    } catch (erreur) {
      notifie(erreur.message, "erreur");
    } finally {
      progression.innerHTML = "";
    }
  });
}

// ── Vue : fiche prospect ────────────────────────────────────────────────────

async function vueProspect(id) {
  vue.innerHTML = `<p class="attente">Chargement de la fiche…</p>`;
  let prospect;
  try {
    prospect = (await api(`/api/prospects/${encodeURIComponent(id)}`)).prospect;
  } catch (erreur) {
    vue.innerHTML = `<div class="carte"><h2>Fiche introuvable</h2>
      <p class="aide">${esc(erreur.message)}</p>
      <a class="bouton" href="#/prospects"><button type="button">Revenir à la liste</button></a></div>`;
    return;
  }

  const identite = [
    ["SIREN", prospect.siren],
    ["Activité (NAF)", prospect.activite_code],
    ["Forme juridique", prospect.nature_juridique],
    ["Créée le", prospect.date_creation ? dateCourte(prospect.date_creation) : null],
    ["Effectif", prospect.effectif_estime ? `${nombre(prospect.effectif_estime)} salarié(s)` : null],
    ["Chiffre d'affaires", prospect.chiffre_affaires
      ? `${euros(prospect.chiffre_affaires)}${prospect.annee_finances ? ` (${prospect.annee_finances})` : ""}`
      : null],
    ["Source", prospect.source === "manuel"
      ? "ajouté à la main"
      : prospect.source === "openstreetmap" ? "OpenStreetMap" : "recherche Sirene"],
  ].filter(([, v]) => v);

  vue.innerHTML = `
    <div class="carte">
      <div class="entre-deux">
        <div>
          <h2>${esc(prospect.nom)}</h2>
          <p class="aide" style="margin:0">${[
            esc([prospect.enseigne !== prospect.nom ? prospect.enseigne : null, prospect.ville, prospect.code_postal]
              .filter(Boolean).join(" · ")),
            prospect.site_web
              ? `<a href="${esc(prospect.site_web)}" target="_blank" rel="noreferrer noopener">${esc(prospect.site_web)} ↗</a>`
              : esc(LIBELLES_SITE[prospect.site_statut] ?? ""),
          ].filter(Boolean).join(" — ")}</p>
        </div>
        <div class="ligne">
          <span class="etiquette ${CLASSES_PRIORITE[prospect.priorite] ?? ""}">Opportunité ${prospect.score}/100</span>
          <span class="etiquette">${esc(LIBELLES_SITE[prospect.site_statut] ?? prospect.site_statut)}</span>
        </div>
      </div>
      ${identite.length ? `<div class="grille" style="margin-top:16px">
        ${identite.map(([cle, v]) => `<div><label>${esc(cle)}</label><div>${esc(v)}</div></div>`).join("")}
      </div>` : ""}
      ${prospect.site_signaux?.length
        ? `<p class="aide-mini" style="margin-top:12px"><strong>Signaux relevés :</strong> ${esc(prospect.site_signaux.join(" · "))}</p>`
        : ""}
    </div>

    <div class="ligne" style="margin-bottom:18px">
      <button id="relancer-audit">${prospect.audit ? "Relancer l'audit" : "Lancer l'audit"}</button>
      <button id="generer" class="primaire">Générer la proposition</button>
      <a class="bouton" href="#/prospects"><button type="button" class="discret">Retour à la liste</button></a>
      <button id="supprimer" class="discret" style="margin-left:auto">Supprimer ce prospect</button>
    </div>
    <div id="zone-progression"></div>

    <div class="grille-large">
      <div>
        <div id="zone-audit">${blocAudit(prospect.audit)}</div>
        <div id="zone-proposition"></div>
      </div>
      <div class="colonne-aside">
        ${blocCoordonnees(prospect)}
        <div class="carte">
          <h2>Corriger le site</h2>
          <p class="aide">La détection se trompe quand le nom de domaine n'a rien à voir avec la
            raison sociale. Corrigez ici : le score d'opportunité est recalculé.</p>
          <div>
            <label for="site_web">Adresse du site</label>
            <input type="text" id="site_web" placeholder="aucun site connu" value="${esc(prospect.site_web ?? "")}">
          </div>
          <div style="margin-top:12px">
            <label for="site_statut">État constaté</label>
            <select id="site_statut">
              ${(config.statuts_site ?? []).map((valeur) => `<option value="${esc(valeur)}" ${valeur === prospect.site_statut ? "selected" : ""}>${esc(LIBELLES_SITE[valeur] ?? valeur)}</option>`).join("")}
            </select>
          </div>
          <div class="ligne ligne-fin" style="margin-top:12px">
            <button id="enregistrer-site">Enregistrer le site</button>
          </div>
        </div>

        <div class="carte">
          <h2>Suivi commercial</h2>
          <div>
            <label for="statut">Statut</label>
            <select id="statut">
              ${config.statuts.map((s) => `<option value="${esc(s)}" ${s === prospect.statut ? "selected" : ""}>${esc(LIBELLES_STATUT[s] ?? s)}</option>`).join("")}
            </select>
          </div>
          <div style="margin-top:12px">
            <label for="relance_le">Rappeler le</label>
            <input type="date" id="relance_le" value="${esc(prospect.relance_le ?? "")}">
            <div class="ligne" style="margin-top:6px">
              ${[["Demain", 1], ["Dans 3 j", 3], ["1 semaine", 7], ["2 semaines", 14], ["1 mois", 30]]
                .map(([libelle, jours]) => `<button type="button" class="petit discret" data-relance="${jours}">${libelle}</button>`).join("")}
              <button type="button" class="petit discret" data-relance="">Effacer</button>
            </div>
            <p class="aide-mini">« Rappelez-moi dans deux semaines » ne se retient pas de tête :
              posez la date, le prospect remonte tout seul dans « À relancer ».</p>
          </div>
          <div style="margin-top:12px">
            <label for="notes">Notes</label>
            <textarea id="notes" placeholder="Compte rendu d'appel, objection, ce qui a été dit…">${esc(prospect.notes ?? "")}</textarea>
          </div>
          <div class="ligne ligne-fin" style="margin-top:12px">
            <button id="enregistrer-suivi" class="primaire">Enregistrer</button>
          </div>
          <p class="aide-mini">Créé le ${dateCourte(prospect.cree_le)}${prospect.audit_le ? ` · audité le ${dateHeure(prospect.audit_le)}` : ""}</p>
        </div>
      </div>
    </div>`;

  brancheOnglets(vue.querySelector("#zone-audit"));
  brancheCopiesTexte(vue);
  if (prospect.documents) dessineProposition(prospect, prospect.documents);

  vue.querySelector("#enregistrer-suivi").addEventListener("click", async (evenement) => {
    try {
      await pendant(evenement.currentTarget, "Enregistrement…", () =>
        api(`/api/prospects/${encodeURIComponent(prospect.id)}`, {
          methode: "PATCH",
          corps: {
            statut: vue.querySelector("#statut").value,
            notes: vue.querySelector("#notes").value,
            relance_le: vue.querySelector("#relance_le").value,
          },
        }));
      notifie("Suivi enregistré", "succes");
    } catch (erreur) {
      notifie(erreur.message, "erreur");
    }
  });

  vue.querySelectorAll("[data-relance]").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      const jours = bouton.dataset.relance;
      const champ = vue.querySelector("#relance_le");
      if (jours === "") {
        champ.value = "";
        return;
      }
      const date = new Date();
      date.setDate(date.getDate() + Number(jours));
      // Format YYYY-MM-DD en heure locale : toISOString décalerait d'un jour selon le fuseau.
      champ.value = [date.getFullYear(), date.getMonth() + 1, date.getDate()]
        .map((n, i) => (i ? String(n).padStart(2, "0") : String(n))).join("-");
    });
  });

  vue.querySelector("#enregistrer-site").addEventListener("click", async (evenement) => {
    try {
      await pendant(evenement.currentTarget, "Enregistrement…", () =>
        api(`/api/prospects/${encodeURIComponent(prospect.id)}`, {
          methode: "PATCH",
          corps: {
            site_web: vue.querySelector("#site_web").value,
            site_statut: vue.querySelector("#site_statut").value,
          },
        }));
      notifie("Site corrigé — relancez l'audit pour le mesurer", "succes");
      await vueProspect(prospect.id);
    } catch (erreur) {
      notifie(erreur.message, "erreur");
    }
  });

  vue.querySelector("#relancer-audit").addEventListener("click", async (evenement) => {
    const progression = vue.querySelector("#zone-progression");
    progression.innerHTML = `<div class="carte serree"><p class="aide" style="margin:0">Analyse en
      cours : 15 à 45 secondes.</p><div class="progression"></div></div>`;
    try {
      const resultat = await pendant(evenement.currentTarget, "Audit en cours…", () =>
        api("/api/audit", { methode: "POST", corps: { prospect_id: prospect.id } }));
      notifie(messageAudit(resultat), resultat.concluant === false ? "info" : "succes");
      await vueProspect(prospect.id);
    } catch (erreur) {
      notifie(erreur.message, "erreur");
      progression.innerHTML = "";
    }
  });

  // Purge à la demande : les dirigeants sont des personnes physiques, l'effacement doit être
  // possible en un clic (et il emporte audits, captures et documents).
  vue.querySelector("#supprimer").addEventListener("click", async (evenement) => {
    if (!confirm(`Supprimer ${prospect.nom} ainsi que ses audits, captures et documents ?`)) return;
    try {
      await pendant(evenement.currentTarget, "Suppression…", () =>
        api(`/api/prospects/${encodeURIComponent(prospect.id)}`, { methode: "DELETE" }));
      notifie("Prospect supprimé", "succes");
      location.hash = "#/prospects";
    } catch (erreur) {
      notifie(erreur.message, "erreur");
    }
  });

  vue.querySelector("#generer").addEventListener("click", async (evenement) => {
    const progression = vue.querySelector("#zone-progression");
    progression.innerHTML = `<div class="carte serree"><p class="aide" style="margin:0">Construction
      du devis et des messages${config.ia ? ", puis reformulation par l'IA" : ""}…</p>
      <div class="progression"></div></div>`;
    try {
      const documents = await pendant(evenement.currentTarget, "Génération…", () =>
        api(`/api/proposition/${encodeURIComponent(prospect.id)}`, { methode: "POST", corps: {} }));
      dessineProposition(prospect, documents);
      notifie("Proposition générée", "succes");
    } catch (erreur) {
      notifie(erreur.message, "erreur");
    } finally {
      progression.innerHTML = "";
    }
  });
}

/** Devis chiffré, email HTML prêt à envoyer, SMS, script d'appel, rapport client. */
function dessineProposition(prospect, documents) {
  const zone = vue.querySelector("#zone-proposition");
  const devis = documents.devis;
  const lignes = [...devis.lignes_projet, ...devis.lignes_recurrentes];

  if (!lignes.length) {
    const introSeule = Boolean(documents.email_intro && documents.email_intro_html);
    const textesSeuls = {
      intro: introSeule ? `Objet : ${documents.email_intro.objet}\n\n${documents.email_intro.corps}` : "",
    };
    zone.innerHTML = `<div class="carte"><h2>Proposition</h2>
      <p class="alerte">${esc(documents.synthese)}</p>
      <p class="aide">Aucun chiffrage pour l'instant. ${introSeule ? "L'email d'approche ci-dessous reste utilisable." : ""}</p></div>
      ${introSeule ? `
      <div class="carte" style="border-color:var(--accent)">
        <div class="entre-deux">
          <h2>✉️ Email d'approche</h2>
          <div class="ligne">
            <button class="primaire" id="copier-intro">Copier avec la mise en forme</button>
            <a class="bouton" href="/api/email/${esc(prospect.id)}?intro" target="_blank" rel="noreferrer noopener"><button type="button">Ouvrir</button></a>
          </div>
        </div>
        <iframe class="apercu court" src="/api/email/${esc(prospect.id)}?intro" title="Aperçu"></iframe>
      </div>` : ""}`;
    if (introSeule) {
      zone.querySelector("#copier-intro").addEventListener("click", () =>
        copieRiche(documents.email_intro_html, textesSeuls.intro, "Email d'approche"));
    }
    return;
  }

  const introDispo = Boolean(documents.email_intro && documents.email_intro_html);
  const textes = {
    intro: introDispo ? `Objet : ${documents.email_intro.objet}\n\n${documents.email_intro.corps}` : "",
    email: `Objet : ${documents.email.objet}\n\n${documents.email.corps}`,
    sms: documents.sms,
    appel: documents.script_appel,
  };

  // Carte « email d'approche » : premier contact, sans devis, avec le PDF de l'audit joint.
  const carteApproche = introDispo ? `
    <div class="carte" style="border-color:var(--accent)">
      <div class="entre-deux">
        <h2>✉️ Email d'approche <span class="etiquette et-accent">sans devis</span></h2>
        <div class="ligne">
          <button class="primaire" id="copier-intro">Copier avec la mise en forme</button>
          <button id="telecharger-intro">Télécharger .html</button>
          <a class="bouton" href="/api/email/${esc(prospect.id)}?intro" target="_blank" rel="noreferrer noopener">
            <button type="button">Ouvrir dans un onglet</button></a>
        </div>
      </div>
      <p class="aide">Premier contact : vous vous présentez, vous pointez les points faibles du
        site, et vous joignez l'audit en PDF. Objet : <strong>${esc(documents.email_intro.objet)}</strong>
        ${prospect.email_contact
          ? ` — destinataire : <a href="mailto:${esc(prospect.email_contact)}?subject=${encodeURIComponent(documents.email_intro.objet)}">${esc(prospect.email_contact)}</a>`
          : " — aucun email trouvé sur le site : à demander par téléphone"}.</p>
      <div class="carte serree" style="margin:0 0 14px;background:var(--fond-relief)">
        <strong style="font-size:13.5px">Pour l'envoyer :</strong>
        <ol style="margin:8px 0 0 18px;padding:0;font-size:13px;color:var(--texte-doux);line-height:1.7">
          <li><a href="/api/rapport/${esc(prospect.id)}" target="_blank" rel="noreferrer noopener">Ouvrez le rapport</a>
            et cliquez « Enregistrer en PDF ».</li>
          <li>« Copier avec la mise en forme », puis collez dans Gmail / Outlook.</li>
          <li>Joignez le PDF de l'audit, et envoyez.</li>
        </ol>
      </div>
      <iframe class="apercu court" src="/api/email/${esc(prospect.id)}?intro" title="Aperçu de l'email d'approche"></iframe>
      <div style="margin-top:10px">${blocCopiable("Version texte (sans mise en forme)", textes.intro, "intro")}</div>
    </div>` : "";

  zone.innerHTML = `
    ${carteApproche}
    <div class="carte">
      <div class="entre-deux">
        <h2>Devis</h2>
        <div class="ligne">
          <span class="etiquette ${documents.genere_par_ia ? "et-vert" : ""}">
            ${documents.genere_par_ia ? "textes personnalisés par l'IA" : "textes issus des modèles"}</span>
          <span class="etiquette">valable jusqu'au ${esc(devis.valide_jusqu_au)}</span>
        </div>
      </div>
      <div class="deroule">
        <table>
          <thead><tr><th>Prestation</th><th>Justifiée par</th><th class="nombre">Prix</th></tr></thead>
          <tbody>
            ${lignes.map((ligne) => `
              <tr>
                <td><span class="titre-ligne">${esc(ligne.libelle)}</span>
                  ${ligne.description ? `<div class="sous">${esc(ligne.description)}</div>` : ""}</td>
                <td class="sous">${esc(ligne.motifs.join(" · ")) || "—"}</td>
                <td class="nombre">${euros(ligne.total)}${ligne.unite === "mois" ? " / mois" : ""}</td>
              </tr>`).join("")}
          </tbody>
          <tfoot>
            ${devis.remise ? `<tr><td colspan="2">Remise commerciale (${devis.taux_remise * 100} %)</td>
              <td class="nombre">− ${euros(devis.remise)}</td></tr>` : ""}
            <tr><td colspan="2"><strong>Total projet HT</strong></td>
              <td class="nombre"><strong>${euros(devis.total_ht)}</strong></td></tr>
            <tr><td colspan="2">TVA ${devis.taux_tva} %</td><td class="nombre">${euros(devis.tva)}</td></tr>
            <tr><td colspan="2"><strong>Total TTC</strong></td>
              <td class="nombre"><strong>${euros(devis.total_ttc)}</strong></td></tr>
            ${devis.mensuel_ht ? `<tr><td colspan="2">Accompagnement mensuel HT</td>
              <td class="nombre">${euros(devis.mensuel_ht)} / mois</td></tr>` : ""}
          </tfoot>
        </table>
      </div>
    </div>

    <div class="carte">
      <div class="entre-deux">
        <h2>Email avec devis <span class="etiquette">relance</span></h2>
        <div class="ligne">
          <button class="primaire" id="copier-email-html">Copier avec la mise en forme</button>
          <button id="telecharger-email">Télécharger .html</button>
          <a class="bouton" href="/api/email/${esc(prospect.id)}" target="_blank" rel="noreferrer noopener">
            <button type="button">Ouvrir dans un onglet</button></a>
        </div>
      </div>
      <p class="aide">À envoyer en relance, une fois le premier contact établi. Objet : <strong>${esc(documents.email.objet)}</strong> —
        ${prospect.email_contact
          ? `destinataire relevé sur le site : <a href="mailto:${esc(prospect.email_contact)}?subject=${encodeURIComponent(documents.email.objet)}">${esc(prospect.email_contact)}</a>`
          : "aucun email trouvé sur le site : à demander par téléphone ou via le formulaire de contact"}.
        Le message indique l'origine des données et le droit d'opposition, comme l'exige la
        prospection B2B.</p>
      <div class="onglets">
        <button data-volet-cible="html" class="actif">Version HTML</button>
        <button data-volet-cible="texte">Version texte</button>
        <button data-volet-cible="sms">SMS</button>
        <button data-volet-cible="appel">Script d'appel</button>
      </div>
      <div data-volet="html">
        <iframe class="apercu court" src="/api/email/${esc(prospect.id)}" title="Aperçu de l'email"></iframe>
      </div>
      <div data-volet="texte" hidden>${blocCopiable("Version texte (envoi sans mise en forme)", textes.email, "email")}</div>
      <div data-volet="sms" hidden>${blocCopiable("SMS", textes.sms, "sms")}</div>
      <div data-volet="appel" hidden>${blocCopiable("Script d'appel", textes.appel, "appel")}</div>
    </div>

    <div class="carte">
      <div class="entre-deux">
        <h2>Rapport client</h2>
        <a class="bouton" href="/api/rapport/${esc(prospect.id)}" target="_blank" rel="noreferrer noopener">
          <button type="button">Ouvrir pour impression PDF</button></a>
      </div>
      <p class="aide">Ce qui sera envoyé au prospect : notes par volet, défauts constatés avec
        leur impact, chiffrage détaillé.</p>
      <iframe class="apercu" src="/api/rapport/${esc(prospect.id)}" title="Rapport d'audit"></iframe>
    </div>`;

  brancheOnglets(zone);
  brancheCopies(zone, textes);
  if (introDispo) {
    zone.querySelector("#copier-intro").addEventListener("click", () =>
      copieRiche(documents.email_intro_html, textes.intro, "Email d'approche"));
    zone.querySelector("#telecharger-intro").addEventListener("click", () =>
      telecharge(`${nomFichierProspect(prospect)}-email-approche.html`, documents.email_intro_html));
  }
  zone.querySelector("#copier-email-html").addEventListener("click", () =>
    copieRiche(documents.email_html, textes.email, "Email"));
  zone.querySelector("#telecharger-email").addEventListener("click", () =>
    telecharge(`${nomFichierProspect(prospect)}-email.html`, documents.email_html));
}

// ── Vue : prestations et identité du devis ──────────────────────────────────

async function vuePrestations() {
  vue.innerHTML = `<p class="attente">Chargement du catalogue…</p>`;
  const { prestations, emetteur } = await api("/api/prestations");

  vue.innerHTML = `
    <div class="carte">
      <h2>Catalogue de prestations</h2>
      <p class="aide">Ces prix alimentent les devis : chaque défaut d'audit appelle une ou
        plusieurs de ces lignes. Décochez une prestation pour qu'elle n'apparaisse plus dans
        aucun devis.</p>
      <div class="deroule">
        <table id="catalogue" class="cartes">
          <thead><tr>
            <th>Actif</th><th>Libellé</th><th>Description</th>
            <th class="nombre">Prix</th><th>Unité</th><th>Catégorie</th>
          </tr></thead>
          <tbody>
            ${prestations.map((p, i) => `
              <tr data-index="${i}" data-code="${esc(p.code)}" data-ordre="${p.ordre ?? 0}">
                <td data-libelle="Actif"><input type="checkbox" data-champ="actif" aria-label="Activer ${esc(p.libelle)}" ${p.actif === false ? "" : "checked"}></td>
                <td data-libelle="Libellé"><input type="text" data-champ="libelle" aria-label="Libellé de ${esc(p.code)}" value="${esc(p.libelle)}"></td>
                <td data-libelle="Description"><input type="text" data-champ="description" aria-label="Description de ${esc(p.libelle)}" value="${esc(p.description ?? "")}"></td>
                <td data-libelle="Prix"><input type="number" data-champ="prix" aria-label="Prix de ${esc(p.libelle)}" value="${Number(p.prix)}" min="0" step="1"></td>
                <td data-libelle="Unité"><select data-champ="unite" aria-label="Unité de ${esc(p.libelle)}">
                  <option value="forfait" ${p.unite === "forfait" ? "selected" : ""}>forfait</option>
                  <option value="mois" ${p.unite === "mois" ? "selected" : ""}>par mois</option>
                </select></td>
                <td data-libelle="Catégorie"><input type="text" data-champ="categorie" aria-label="Catégorie de ${esc(p.libelle)}" value="${esc(p.categorie)}"></td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <div class="carte">
      <h2>Identité portée sur le devis et les emails</h2>
      <div class="grille">
        <div><label for="raison_sociale">Raison sociale</label>
          <input type="text" id="raison_sociale" value="${esc(emetteur.raison_sociale)}"></div>
        <div><label for="siret">SIRET</label>
          <input type="text" id="siret" value="${esc(emetteur.siret)}"></div>
        <div><label for="email">Email</label>
          <input type="text" id="email" value="${esc(emetteur.email)}"></div>
        <div><label for="telephone">Téléphone</label>
          <input type="text" id="telephone" value="${esc(emetteur.telephone)}"></div>
        <div><label for="site_web">Site web</label>
          <input type="text" id="site_web" value="${esc(emetteur.site_web ?? "")}" placeholder="https://smartfixx.fr"></div>
        <div class="pleine-largeur"><label for="adresse">Adresse</label>
          <input type="text" id="adresse" value="${esc(emetteur.adresse)}"></div>
        <div><label for="taux_tva">TVA (%)</label>
          <input type="number" id="taux_tva" value="${Number(emetteur.taux_tva)}" min="0" max="30" step="0.1"></div>
        <div><label for="validite_jours">Validité du devis (jours)</label>
          <input type="number" id="validite_jours" value="${Number(emetteur.validite_jours)}" min="1" max="365"></div>
        <div class="pleine-largeur"><label for="mentions">Mentions</label>
          <input type="text" id="mentions" value="${esc(emetteur.mentions)}"></div>
      </div>
      <div class="ligne ligne-fin" style="margin-top:14px">
        <button id="enregistrer-catalogue" class="primaire">Enregistrer le catalogue et l'identité</button>
      </div>
      <p class="aide-mini">Ces informations apparaissent en en-tête du devis, dans le pied de
        l'email HTML et dans le script d'appel.</p>
    </div>`;

  vue.querySelector("#enregistrer-catalogue").addEventListener("click", async (evenement) => {
    const lignes = [...vue.querySelectorAll("#catalogue tbody tr")].map((tr) => {
      const champ = (nom) => tr.querySelector(`[data-champ="${nom}"]`);
      return {
        code: tr.dataset.code,
        ordre: Number(tr.dataset.ordre),
        actif: champ("actif").checked,
        libelle: champ("libelle").value,
        description: champ("description").value,
        prix: Number(champ("prix").value),
        unite: champ("unite").value,
        categorie: champ("categorie").value,
      };
    });
    const valeur = (id) => vue.querySelector(`#${id}`).value;
    try {
      await pendant(evenement.currentTarget, "Enregistrement…", () =>
        api("/api/prestations", {
          methode: "PUT",
          corps: {
            prestations: lignes,
            emetteur: {
              raison_sociale: valeur("raison_sociale"),
              siret: valeur("siret"),
              email: valeur("email"),
              telephone: valeur("telephone"),
              site_web: valeur("site_web"),
              adresse: valeur("adresse"),
              taux_tva: Number(valeur("taux_tva")),
              validite_jours: Number(valeur("validite_jours")),
              mentions: valeur("mentions"),
            },
          },
        }));
      notifie("Catalogue enregistré — les prochains devis l'utilisent", "succes");
    } catch (erreur) {
      notifie(erreur.message, "erreur");
    }
  });
}

// ── Routage ─────────────────────────────────────────────────────────────────

async function affiche() {
  const route = location.hash.replace(/^#/, "") || "/prospects";
  const [, section, parametre] = route.split("/");

  // Une fiche reste dans la rubrique « Prospects » : l'onglet correspondant reste marqué.
  const rubrique = section === "prospect" ? "prospects" : section || "prospects";
  document.querySelectorAll("#menu a").forEach((lien) => {
    lien.classList.toggle("actif", lien.dataset.vue === rubrique);
  });

  try {
    if (section === "auditer") vueAuditer();
    else if (section === "prestations") await vuePrestations();
    else if (section === "prospect" && parametre) await vueProspect(parametre);
    else await vueProspects();
  } catch (erreur) {
    vue.innerHTML = `<div class="carte"><h2>Erreur</h2><p class="aide">${esc(erreur.message)}</p></div>`;
    notifie(erreur.message, "erreur");
  }
  window.scrollTo({ top: 0 });
}

/**
 * Porte le nom de la société sur l'en-tête et l'onglet du navigateur.
 * La coupure du logotype suit la même règle que `marque.ts` côté serveur : on coupe sur la
 * majuscule interne (« SmartFixx » → « Smart » + « Fixx »), sinon le nom reste d'une seule
 * couleur plutôt que d'inventer une césure.
 */
function appliqueMarque(nom) {
  const propre = (nom ?? "").trim();
  if (!propre) return;

  const interne = /^(.+?[a-zà-ÿ])([A-ZÀ-Þ].*)$/.exec(propre);
  const espace = propre.lastIndexOf(" ");
  const [debut, fin] = interne
    ? [interne[1], interne[2]]
    : espace > 0 ? [propre.slice(0, espace + 1), propre.slice(espace + 1)] : [propre, ""];

  document.getElementById("marque-nom").innerHTML =
    `${esc(debut)}${fin ? `<span class="marque-fin">${esc(fin)}</span>` : ""}`;
  document.title = `${propre} — Prospection & Audit`;
}

async function demarre() {
  try {
    config = await api("/api/config");
  } catch (erreur) {
    vue.innerHTML = `<div class="carte"><h2>Serveur injoignable</h2>
      <p class="aide">${esc(erreur.message)} — vérifiez que <code>npm start</code> tourne
      toujours dans le terminal.</p></div>`;
    return;
  }

  document.getElementById("etat-cles").innerHTML = [
    config.pagespeed ? "Lighthouse : clé PageSpeed" : "Lighthouse : quota public",
    config.ia ? "IA : active" : "IA : désactivée",
  ].map(esc).join(" · ");

  appliqueMarque(config.marque?.nom);

  window.addEventListener("hashchange", affiche);
  await affiche();
}

demarre();
