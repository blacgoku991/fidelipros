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
const tri = { texte: "", statut: "", priorite: "" };
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
    ${capture ? `<div class="capture" style="margin-top:16px"><img src="${esc(capture)}" alt="Aperçu mobile du site"></div>` : ""}
    ${nonVerifie}
    ${fichiers}
    <h3>${audit.findings.length} défaut(s) constaté(s)</h3>
    <div class="onglets">${onglets}</div>
    ${sections}
  </div>`;
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
                ${[["", "peu importe"], ["6", "6 mois"], ["12", "12 mois"], ["18", "18 mois"], ["24", "2 ans"], ["60", "5 ans"]]
                  .map(([v, l]) => `<option value="${v}" ${String(criteres.depuis ?? "12") === v ? "selected" : ""}>${l}</option>`).join("")}
              </select>
              <p class="aide-mini">Une entreprise jeune a un budget de lancement.</p>
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
              <input type="number" id="caMin" placeholder="0" min="0" step="10000" value="${valeur("caMin")}">
              <p class="aide-mini">Connu seulement pour les entreprises qui déposent leurs comptes :
                filtrer dessus écarte les autres.</p>
            </div>
            <div>
              <label for="caMax">CA maximum (€)</label>
              <input type="number" id="caMax" placeholder="illimité" min="0" step="10000" value="${valeur("caMax")}">
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
              <label for="pages">Pages à parcourir (25 entreprises / page)</label>
              <input type="number" id="pages" value="${valeur("pages", "2")}" min="1" max="10">
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
          <button type="button" id="auditer-lot">Auditer 10 prospects</button>
          <button type="button" id="exporter">Exporter en CSV</button>
        </div>
      </div>
      <div id="progression-audits"></div>
      <div class="deroule" id="tableau"><p class="attente">Chargement…</p></div>
      <div id="bilan"></div>
    </div>`;

  const panneau = vue.querySelector("#panneau-recherche");
  panneau.addEventListener("toggle", () => localStorage.setItem(CLE_PANNEAU, panneau.open ? "1" : "0"));

  const formulaire = vue.querySelector("#recherche");
  formulaire.addEventListener("submit", (evenement) => {
    evenement.preventDefault();
    lanceRecherche(formulaire);
  });
  vue.querySelector("#vider-criteres").addEventListener("click", () => {
    localStorage.removeItem(CLE_CRITERES);
    vueProspects();
  });

  ["texte", "statut", "priorite"].forEach((clef) => {
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
    pages: Number(lire("pages")),
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
    notifie(
      `${resultat.retenus} prospect(s) retenu(s) — ${resultat.nouveaux} nouveau(x)` +
        (resultat.hors_criteres ? `, ${resultat.hors_criteres} hors critères` : ""),
      "succes",
    );
    vue.querySelector("#panneau-recherche").open = false;
    localStorage.setItem(CLE_PANNEAU, "0");
    await chargeEtAffiche();
  } catch (erreur) {
    notifie(erreur.message, "erreur");
  } finally {
    progression.innerHTML = "";
  }
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
  const cartes = [
    ["Prospects", prospects.length, ""],
    ["Chauds", compte((p) => p.priorite === "chaud"), "s-rouge"],
    ["À contacter", compte((p) => p.statut === "a_contacter"), "s-ambre"],
    ["Avec email", compte((p) => p.email_contact), "s-vert"],
    ["Sans site web", compte((p) => p.site_statut === "aucun_site"), ""],
    ["Audités", compte((p) => p.audit_le), ""],
  ];
  cible.innerHTML = cartes.map(([nom, valeur, classe]) => `
    <div class="indicateur"><div class="valeur ${classe}">${valeur}</div><div class="nom">${esc(nom)}</div></div>`).join("");
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
      Dernière recherche : ${nombre(bilan.total_disponible)} entreprise(s) correspondent aux critères
      côté API, ${nombre(bilan.analyses)} analysée(s) sur les pages parcourues,
      <strong>${nombre(bilan.retenus)} retenue(s)</strong>${bilan.nouveaux ? ` dont ${nombre(bilan.nouveaux)} nouvelle(s)` : ""}.
      ${bilan.hors_cible ? `${nombre(bilan.hors_cible)} écartée(s) car leur site n'est pas à refaire. ` : ""}
      ${bilan.tronque ? "Recherche interrompue avant la fin des pages demandées. " : ""}
    </p>
    ${raisons ? `<div class="aide-mini">Écartées par vos critères :
      <ul style="margin:4px 0 0 18px">${raisons}</ul></div>` : ""}`;
}

/** Les prospects effectivement listés, après les filtres d'affichage. */
function prospectsAffiches() {
  const recherche = tri.texte.trim().toLowerCase();
  return prospects.filter((p) => {
    if (tri.statut && p.statut !== tri.statut) return false;
    if (tri.priorite && p.priorite !== tri.priorite) return false;
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
    cible.innerHTML = `<p class="aide">${prospects.length
      ? "Aucun prospect ne correspond aux filtres d'affichage."
      : "Aucun prospect pour l'instant : lancez une recherche ci-dessus, ou auditez directement l'adresse d'un site."}</p>`;
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
    ["Source", prospect.source === "manuel" ? "ajouté à la main" : "recherche Sirene"],
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
            <label for="notes">Notes</label>
            <textarea id="notes" placeholder="Compte rendu d'appel, objection, date de rappel…">${esc(prospect.notes ?? "")}</textarea>
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
          corps: { statut: vue.querySelector("#statut").value, notes: vue.querySelector("#notes").value },
        }));
      notifie("Suivi enregistré", "succes");
    } catch (erreur) {
      notifie(erreur.message, "erreur");
    }
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
    zone.innerHTML = `<div class="carte"><h2>Proposition</h2>
      <p class="alerte">${esc(documents.synthese)}</p>
      <p class="aide">Aucun chiffrage : il n'y a pas de constat exploitable sur lequel appuyer
        un devis.</p></div>`;
    return;
  }

  const textes = {
    email: `Objet : ${documents.email.objet}\n\n${documents.email.corps}`,
    sms: documents.sms,
    appel: documents.script_appel,
  };

  zone.innerHTML = `
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
        <h2>Email à envoyer</h2>
        <div class="ligne">
          <button class="primaire" id="copier-email-html">Copier avec la mise en forme</button>
          <button id="telecharger-email">Télécharger .html</button>
          <a class="bouton" href="/api/email/${esc(prospect.id)}" target="_blank" rel="noreferrer noopener">
            <button type="button">Ouvrir dans un onglet</button></a>
        </div>
      </div>
      <p class="aide">Objet : <strong>${esc(documents.email.objet)}</strong> —
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
                <td data-libelle="Prix"><input type="number" data-champ="prix" aria-label="Prix de ${esc(p.libelle)}" value="${Number(p.prix)}" min="0" step="10"></td>
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

  window.addEventListener("hashchange", affiche);
  await affiche();
}

demarre();
