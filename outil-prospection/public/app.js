// Interface de l'outil de prospection : JavaScript natif, sans bundler ni framework.
// Quatre vues, routées par le fragment d'URL : prospects, audit d'une adresse, fiche
// prospect, catalogue de prestations.
//
// Règle appliquée partout : tout ce qui vient d'un site tiers (raison sociale, constat
// d'audit, URL) passe par esc() avant d'entrer dans le HTML.

const vue = document.getElementById("vue");
const notifications = document.getElementById("notifications");

/** Référentiels envoyés par le serveur au démarrage (secteurs, libellés, clés présentes). */
let config = null;
/** Dernière liste chargée, réutilisée par les filtres sans rappeler le serveur. */
let prospects = [];
/** Filtres de la vue liste, conservés entre deux rendus. */
const filtres = { texte: "", statut: "", priorite: "" };

const PILIERS = ["seo", "design", "securite", "technique"];

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
  bloque: ["Audit non concluant", "etiquette"],
  injoignable: ["Domaine hors ligne", "et-rouge"],
};

const CLASSES_SEVERITE = { critique: "et-rouge", majeur: "et-orange", mineur: "etiquette" };

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

function classeScore(score) {
  if (score >= 80) return "s-vert";
  if (score >= 55) return "s-ambre";
  if (score >= 35) return "s-orange";
  return "s-rouge";
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
  setTimeout(() => element.remove(), genre === "erreur" ? 9000 : 4500);
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

function copie(texte, quoi) {
  navigator.clipboard.writeText(texte)
    .then(() => notifie(`${quoi} copié dans le presse-papier`, "succes"))
    .catch(() => notifie("Copie impossible : sélectionnez le texte à la main", "erreur"));
}

/** Bloc de texte avec bouton « copier », utilisé pour l'email, le SMS et le script d'appel. */
function blocCopiable(titre, texte, cle) {
  return `<div class="copiable">
    <div class="entre-deux">
      <label>${esc(titre)}</label>
      <button class="petit" data-copie="${esc(cle)}">Copier</button>
    </div>
    <pre id="texte-${esc(cle)}">${esc(texte)}</pre>
  </div>`;
}

function brancheCopies(racine, textes) {
  racine.querySelectorAll("[data-copie]").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      const cle = bouton.dataset.copie;
      copie(textes[cle] ?? "", bouton.previousElementSibling?.textContent ?? "Texte");
    });
  });
}

// ── Rendu d'un audit ────────────────────────────────────────────────────────

function blocAudit(audit) {
  if (!audit) {
    return `<div class="carte"><h2>Audit</h2>
      <p class="aide">Aucun audit pour ce prospect. Lancez-en un pour obtenir les notes, les
      défauts et le devis.</p></div>`;
  }

  const [libelleAcces, classeAcces] = LIBELLES_ACCESSIBILITE[audit.accessibilite] ?? ["", "etiquette"];
  const capture = audit.captureDataUri || audit.capture;
  const erreurs = audit.erreurs?.length
    ? `<p class="aide"><strong>Points non vérifiables :</strong> ${esc(audit.erreurs.join(" · "))}</p>`
    : "";

  // Un audit non concluant n'affiche aucune note : elles ne mesureraient rien.
  if (!audit.concluant) {
    return `<div class="carte">
      <div class="entre-deux"><h2>Audit non concluant</h2>
        <span class="etiquette ${classeAcces}">${esc(libelleAcces)}</span></div>
      <p class="alerte">${esc(phrase(audit.erreurs?.[0] ?? "Le site n'a pas pu être analysé"))}
        Aucun défaut n'est affirmé et aucun chiffrage n'est proposé : relancez l'audit depuis un
        réseau qui accède au site, ou vérifiez-le à la main.</p>
      <p class="aide">Adresse testée : <code>${esc(audit.urlFinale || audit.url)}</code>
        — ${dateHeure(audit.cree_le)}</p>
    </div>`;
  }

  const [libelleUrgence, classeUrgence] = LIBELLES_URGENCE[audit.scores.urgence] ?? ["", "etiquette"];
  const pireVolet = [...PILIERS].sort((a, b) => audit.scores[a] - audit.scores[b])[0];

  const notes = `<div class="notes-audit">
    <div class="note-volet globale">
      <div class="valeur ${classeScore(audit.scores.global)}">${audit.scores.global}</div>
      <div class="nom">Note globale</div>
    </div>
    ${PILIERS.map((pilier) => `
      <div class="note-volet">
        <div class="valeur ${classeScore(audit.scores[pilier])}">${audit.scores[pilier]}</div>
        <div class="nom">${esc(config.piliers[pilier])}</div>
      </div>`).join("")}
  </div>`;

  const onglets = PILIERS.map((pilier) => {
    const compte = audit.findings.filter((f) => f.pilier === pilier).length;
    return `<button data-pilier="${pilier}" class="${pilier === pireVolet ? "actif" : ""}">
      ${esc(config.piliers[pilier])} <span class="etiquette">${compte}</span></button>`;
  }).join("");

  const sections = PILIERS.map((pilier) => {
    const findings = audit.findings.filter((f) => f.pilier === pilier);
    const contenu = findings.length
      ? findings.map((f) => `
        <div class="defaut">
          <h4>${esc(f.titre)}
            <span class="etiquette ${CLASSES_SEVERITE[f.severite] ?? "etiquette"}">${esc(config.severites[f.severite])}</span>
            <span class="etiquette">Effort ${esc(config.efforts[f.effort])}</span>
          </h4>
          <p class="constat">${esc(f.constat)}</p>
          <p>${esc(f.impact)}</p>
        </div>`).join("")
      : `<p class="aide">Aucun défaut relevé sur ce volet.</p>`;
    return `<div data-volet="${pilier}" ${pilier === pireVolet ? "" : "hidden"}>${contenu}</div>`;
  }).join("");

  const fichiers = audit.fichiersExposes?.length
    ? `<p class="aide"><strong>Fichiers accessibles publiquement :</strong>
       ${esc(audit.fichiersExposes.map((f) => `${f.chemin} (${f.indice})`).join(" · "))}</p>`
    : "";

  return `<div class="carte" id="bloc-audit">
    <div class="entre-deux">
      <h2>Audit du site</h2>
      <div class="ligne">
        <span class="etiquette ${classeAcces}">${esc(libelleAcces)}</span>
        <span class="etiquette ${classeUrgence}">${esc(libelleUrgence)}</span>
      </div>
    </div>
    <p class="aide">
      <code>${esc(audit.urlFinale || audit.url)}</code> — analysé le ${dateHeure(audit.cree_le)}
      ${audit.profondeur === "rapide" ? " (audit rapide : sans Lighthouse ni sondage)" : ""}
    </p>
    ${notes}
    ${capture ? `<div class="capture" style="margin-top:16px"><img src="${esc(capture)}" alt="Aperçu mobile du site"></div>` : ""}
    ${erreurs}
    ${fichiers}
    <h3 style="margin:18px 0 8px;font-size:15px">${audit.findings.length} défaut(s) constaté(s)</h3>
    <div class="onglets">${onglets}</div>
    ${sections}
  </div>`;
}

function brancheOnglets(racine) {
  const barre = racine.querySelector(".onglets");
  if (!barre) return;
  barre.querySelectorAll("[data-pilier]").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      barre.querySelectorAll("[data-pilier]").forEach((b) => b.classList.remove("actif"));
      bouton.classList.add("actif");
      racine.querySelectorAll("[data-volet]").forEach((section) => {
        section.hidden = section.dataset.volet !== bouton.dataset.pilier;
      });
    });
  });
}

// ── Vue : liste des prospects ───────────────────────────────────────────────

async function vueProspects() {
  vue.innerHTML = `
    <div class="carte">
      <h2>Trouver des entreprises</h2>
      <p class="aide">Base Sirene en open data : entreprises récentes (budget de lancement) ou
        établies dont le site est à refaire. Les résultats sont dédoublonnés par SIREN, et le
        suivi commercial déjà saisi n'est jamais écrasé.</p>
      <form id="recherche">
        <div class="grille">
          <div>
            <label for="departement">Département</label>
            <input type="text" id="departement" placeholder="33" maxlength="3">
          </div>
          <div>
            <label for="codePostal">Code postal</label>
            <input type="text" id="codePostal" placeholder="33000" maxlength="5">
          </div>
          <div>
            <label for="q">Recherche libre</label>
            <input type="text" id="q" placeholder="nom, activité…">
          </div>
          <div>
            <label for="depuis">Créées depuis moins de (mois)</label>
            <input type="number" id="depuis" value="12" min="0" max="240">
          </div>
          <div>
            <label for="caMin">CA minimum (€)</label>
            <input type="number" id="caMin" placeholder="0" min="0" step="10000">
          </div>
          <div>
            <label for="cible">Objectif</label>
            <select id="cible">
              <option value="tous">Les deux : sans site ou site à refaire</option>
              <option value="sans_site">Entreprises sans site web</option>
              <option value="site_a_refaire">Sites web à refaire</option>
            </select>
          </div>
          <div>
            <label for="pages">Pages à parcourir (25 par page)</label>
            <input type="number" id="pages" value="2" min="1" max="10">
          </div>
        </div>
        <div style="margin-top:14px">
          <label>Secteurs</label>
          <div class="cases" id="secteurs">
            ${config.secteurs.map((s) => `
              <label class="case"><input type="checkbox" value="${esc(s.id)}"> ${esc(s.label)}</label>
            `).join("")}
          </div>
        </div>
        <div class="ligne" style="margin-top:16px">
          <label class="case"><input type="checkbox" id="auditSites" checked> Détecter et analyser les sites web (plus lent, mais c'est ce qui qualifie le prospect)</label>
        </div>
        <div class="ligne ligne-fin" style="margin-top:12px">
          <button type="submit" class="primaire">Lancer la recherche</button>
        </div>
        <div id="progression-recherche"></div>
      </form>
    </div>
    <div class="carte">
      <div class="entre-deux">
        <h2>Prospects enregistrés <span class="etiquette" id="compte"></span></h2>
        <div class="ligne">
          <a href="/api/export.csv"><button type="button">Exporter en CSV</button></a>
        </div>
      </div>
      <div class="grille" style="margin-bottom:14px">
        <div>
          <label for="filtre-texte">Filtrer</label>
          <input type="text" id="filtre-texte" placeholder="nom, ville, domaine…">
        </div>
        <div>
          <label for="filtre-statut">Statut</label>
          <select id="filtre-statut"><option value="">Tous</option>
            ${config.statuts.map((s) => `<option value="${esc(s)}">${esc(LIBELLES_STATUT[s] ?? s)}</option>`).join("")}
          </select>
        </div>
        <div>
          <label for="filtre-priorite">Priorité</label>
          <select id="filtre-priorite"><option value="">Toutes</option>
            <option value="chaud">Chaud</option><option value="tiede">Tiède</option><option value="froid">Froid</option>
          </select>
        </div>
      </div>
      <div class="deroule" id="tableau"><p class="attente">Chargement…</p></div>
    </div>`;

  const formulaire = vue.querySelector("#recherche");
  formulaire.addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    const secteurs = [...vue.querySelectorAll("#secteurs input:checked")].map((c) => c.value);
    const corps = {
      departement: vue.querySelector("#departement").value,
      codePostal: vue.querySelector("#codePostal").value,
      q: vue.querySelector("#q").value,
      depuis: Number(vue.querySelector("#depuis").value),
      caMin: Number(vue.querySelector("#caMin").value) || undefined,
      cible: vue.querySelector("#cible").value,
      pages: Number(vue.querySelector("#pages").value),
      secteurs,
      auditSites: vue.querySelector("#auditSites").checked,
    };
    const progression = vue.querySelector("#progression-recherche");
    progression.innerHTML = `<p class="aide" style="margin-top:12px">Recherche en cours — comptez
      quelques secondes par page, plus le temps d'analyse des sites.</p><div class="progression"></div>`;
    try {
      const resultat = await pendant(
        formulaire.querySelector("button[type=submit]"),
        "Recherche…",
        () => api("/api/prospection", { methode: "POST", corps }),
      );
      notifie(
        `${resultat.retenus} prospect(s) retenu(s) sur ${resultat.analyses} analysé(s) — ` +
          `${resultat.nouveaux} nouveau(x)${resultat.tronque ? " (recherche tronquée)" : ""}`,
        "succes",
      );
      await chargeEtAffiche();
    } catch (erreur) {
      notifie(erreur.message, "erreur");
    } finally {
      progression.innerHTML = "";
    }
  });

  ["texte", "statut", "priorite"].forEach((clef) => {
    const champ = vue.querySelector(`#filtre-${clef}`);
    champ.value = filtres[clef];
    champ.addEventListener("input", () => {
      filtres[clef] = champ.value;
      dessineTableau();
    });
  });

  await chargeEtAffiche();
}

async function chargeEtAffiche() {
  try {
    prospects = (await api("/api/prospects")).prospects;
  } catch (erreur) {
    notifie(erreur.message, "erreur");
    prospects = [];
  }
  dessineTableau();
}

function dessineTableau() {
  const cible = vue.querySelector("#tableau");
  if (!cible) return;

  const recherche = filtres.texte.trim().toLowerCase();
  const retenus = prospects.filter((p) => {
    if (filtres.statut && p.statut !== filtres.statut) return false;
    if (filtres.priorite && p.priorite !== filtres.priorite) return false;
    if (!recherche) return true;
    return [p.nom, p.enseigne, p.ville, p.domaine, p.site_web, p.code_postal]
      .filter(Boolean).join(" ").toLowerCase().includes(recherche);
  });

  vue.querySelector("#compte").textContent = `${retenus.length} / ${prospects.length}`;

  if (!retenus.length) {
    cible.innerHTML = `<p class="aide">${prospects.length
      ? "Aucun prospect ne correspond aux filtres."
      : "Aucun prospect pour l'instant : lancez une recherche ci-dessus, ou auditez directement l'adresse d'un site."}</p>`;
    return;
  }

  cible.innerHTML = `<table>
    <thead><tr>
      <th class="nombre">Score</th><th>Entreprise</th><th>Ville</th><th>Site web</th>
      <th class="nombre">Audit</th><th>Priorité</th><th>Statut</th><th></th>
    </tr></thead>
    <tbody>${retenus.map((p) => `
      <tr>
        <td class="nombre"><strong class="${classeOpportunite(p.score)}">${p.score}</strong></td>
        <td>
          <a href="#/prospect/${esc(p.id)}"><strong>${esc(p.nom)}</strong></a>
          ${p.enseigne && p.enseigne !== p.nom ? `<div class="aide" style="margin:0">${esc(p.enseigne)}</div>` : ""}
          ${p.email_contact ? `<div class="aide" style="margin:0">${esc(p.email_contact)}</div>` : ""}
        </td>
        <td>${esc(p.ville ?? "—")}<div class="aide" style="margin:0">${esc(p.code_postal ?? "")}</div></td>
        <td>
          ${p.site_web
            ? `<a href="${esc(p.site_web)}" target="_blank" rel="noreferrer noopener">${esc(p.site_web.replace(/^https?:\/\//, "").slice(0, 34))}</a>`
            : `<span class="etiquette et-rouge">${esc(LIBELLES_SITE[p.site_statut] ?? p.site_statut)}</span>`}
          ${p.site_web ? `<div class="aide" style="margin:0">${esc(LIBELLES_SITE[p.site_statut] ?? p.site_statut)}</div>` : ""}
        </td>
        <td class="nombre">${p.audit && !p.audit.concluant
          ? `<span class="etiquette">non concluant</span>`
          : p.site_statut === "aucun_site"
            ? `<span class="etiquette">sans objet</span>`
            : p.score_audit === null || p.score_audit === undefined
              ? "—"
              : `<strong class="${classeScore(p.score_audit)}">${p.score_audit}</strong>`}</td>
        <td><span class="etiquette ${p.priorite === "chaud" ? "et-rouge" : p.priorite === "tiede" ? "et-ambre" : "etiquette"}">${esc(p.priorite)}</span></td>
        <td>
          <select data-statut="${esc(p.id)}">
            ${config.statuts.map((s) => `<option value="${esc(s)}" ${s === p.statut ? "selected" : ""}>${esc(LIBELLES_STATUT[s] ?? s)}</option>`).join("")}
          </select>
        </td>
        <td>
          <div class="ligne">
            <button class="petit" data-auditer="${esc(p.id)}">Auditer</button>
            <a href="#/prospect/${esc(p.id)}"><button class="petit" type="button">Ouvrir</button></a>
          </div>
        </td>
      </tr>`).join("")}
    </tbody></table>`;

  cible.querySelectorAll("[data-statut]").forEach((select) => {
    select.addEventListener("change", async () => {
      try {
        await api(`/api/prospects/${select.dataset.statut}`, {
          methode: "PATCH",
          corps: { statut: select.value },
        });
        const prospect = prospects.find((p) => p.id === select.dataset.statut);
        if (prospect) prospect.statut = select.value;
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
        notifie(
          resultat.sans_site
            ? resultat.message
            : resultat.concluant
              ? `Audit terminé — note ${resultat.audit.scores.global}/100`
              : `Audit non concluant — ${resultat.message}`,
          resultat.concluant === false ? "info" : "succes",
        );
        await chargeEtAffiche();
      } catch (erreur) {
        notifie(erreur.message, "erreur");
      }
    });
  });
}

// ── Vue : auditer une adresse ───────────────────────────────────────────────

function vueAuditer() {
  vue.innerHTML = `
    <div class="carte">
      <h2>Auditer un site</h2>
      <p class="aide">Collez l'adresse d'un site : référencement, design et mobile, sécurité et
        performance sont analysés en lecture seule (aucune intrusion). Le site est enregistré
        comme prospect, prêt pour la proposition commerciale. Comptez 15 à 45 secondes.</p>
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
          <label class="case"><input type="checkbox" id="rapide"> Audit rapide (sans Lighthouse ni sondage des fichiers publics)</label>
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
      en-têtes HTTP, DNS, Lighthouse… 15 à 45 secondes.</p><div class="progression"></div>`;
    vue.querySelector("#resultat-audit").innerHTML = "";
    try {
      const resultat = await pendant(
        formulaire.querySelector("button[type=submit]"),
        "Audit en cours…",
        () => api("/api/audit", { methode: "POST", corps }),
      );
      const zone = vue.querySelector("#resultat-audit");
      zone.innerHTML = `
        <div class="carte">
          <div class="entre-deux">
            <h2>${esc(resultat.prospect.nom)}</h2>
            <div class="ligne">
              <a href="#/prospect/${esc(resultat.prospect.id)}"><button type="button" class="primaire">Ouvrir la fiche et chiffrer</button></a>
            </div>
          </div>
          <p class="aide">Enregistré comme prospect — le devis, l'email et le script d'appel se
            génèrent depuis la fiche.</p>
        </div>
        ${blocAudit(resultat.audit ? { ...resultat.audit, cree_le: new Date().toISOString() } : null)}`;
      brancheOnglets(zone);
      notifie(
        resultat.concluant === false ? `Audit non concluant — ${resultat.message}` : "Audit terminé",
        resultat.concluant === false ? "info" : "succes",
      );
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
      <a href="#/prospects"><button type="button">Revenir à la liste</button></a></div>`;
    return;
  }

  const lignesIdentite = [
    ["Dirigeant", prospect.dirigeant],
    ["Email", prospect.email_contact],
    ["Téléphone", prospect.telephone],
    ["Adresse", [prospect.adresse, prospect.code_postal, prospect.ville].filter(Boolean).join(" ")],
    ["SIREN", prospect.siren],
    ["Activité (NAF)", prospect.activite_code],
    ["Forme juridique", prospect.nature_juridique],
    ["Créée le", prospect.date_creation],
    ["Effectif", prospect.effectif_estime ? `${nombre(prospect.effectif_estime)} salarié(s)` : null],
    ["Chiffre d'affaires", prospect.chiffre_affaires
      ? `${euros(prospect.chiffre_affaires)}${prospect.annee_finances ? ` (${prospect.annee_finances})` : ""}`
      : null],
    ["Source", prospect.source === "manuel" ? "ajouté à la main" : "recherche Sirene"],
  ].filter(([, valeur]) => valeur);

  vue.innerHTML = `
    <div class="carte">
      <div class="entre-deux">
        <div>
          <h2>${esc(prospect.nom)}</h2>
          <p class="aide">
            ${[
              esc([prospect.enseigne, prospect.ville].filter(Boolean).join(" · ")),
              prospect.site_web
                ? `<a href="${esc(prospect.site_web)}" target="_blank" rel="noreferrer noopener">${esc(prospect.site_web)}</a>`
                : esc(LIBELLES_SITE[prospect.site_statut] ?? ""),
            ].filter(Boolean).join(" — ")}
          </p>
        </div>
        <div class="ligne">
          <span class="etiquette ${prospect.priorite === "chaud" ? "et-rouge" : prospect.priorite === "tiede" ? "et-ambre" : "etiquette"}">
            Opportunité ${prospect.score}/100</span>
          <span class="etiquette">${esc(LIBELLES_SITE[prospect.site_statut] ?? prospect.site_statut)}</span>
        </div>
      </div>
      <div class="grille" style="margin-top:14px">
        ${lignesIdentite.map(([cle, valeur]) => `
          <div><label>${esc(cle)}</label><div>${esc(valeur)}</div></div>`).join("")}
      </div>
      ${prospect.site_signaux?.length
        ? `<p class="aide" style="margin-top:14px"><strong>Signaux relevés :</strong> ${esc(prospect.site_signaux.join(" · "))}</p>`
        : ""}
    </div>

    <div class="carte">
      <h2>Suivi commercial</h2>
      <div class="grille">
        <div>
          <label for="statut">Statut</label>
          <select id="statut">
            ${config.statuts.map((s) => `<option value="${esc(s)}" ${s === prospect.statut ? "selected" : ""}>${esc(LIBELLES_STATUT[s] ?? s)}</option>`).join("")}
          </select>
        </div>
        <div style="grid-column:1/-1">
          <label for="notes">Notes</label>
          <textarea id="notes" placeholder="Compte rendu d'appel, objection, date de rappel…">${esc(prospect.notes ?? "")}</textarea>
        </div>
      </div>
      <div class="ligne ligne-fin" style="margin-top:12px">
        <button id="enregistrer-suivi" class="primaire">Enregistrer</button>
      </div>
    </div>

    <div class="ligne" style="margin-bottom:20px">
      <button id="relancer-audit">${prospect.audit ? "Relancer l'audit" : "Lancer l'audit"}</button>
      <button id="generer" class="primaire">Générer la proposition</button>
      <a href="#/prospects"><button type="button">Retour à la liste</button></a>
    </div>
    <div id="zone-progression"></div>

    <div id="zone-audit">${blocAudit(prospect.audit)}</div>
    <div id="zone-proposition"></div>`;

  brancheOnglets(vue.querySelector("#zone-audit"));
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

  vue.querySelector("#relancer-audit").addEventListener("click", async (evenement) => {
    const progression = vue.querySelector("#zone-progression");
    progression.innerHTML = `<div class="carte"><p class="aide">Analyse en cours : 15 à 45 secondes.</p>
      <div class="progression"></div></div>`;
    try {
      const resultat = await pendant(evenement.currentTarget, "Audit en cours…", () =>
        api("/api/audit", { methode: "POST", corps: { prospect_id: prospect.id } }));
      notifie(
        resultat.sans_site ? resultat.message
          : resultat.concluant ? `Audit terminé — note ${resultat.audit.scores.global}/100`
            : `Audit non concluant — ${resultat.message}`,
        resultat.concluant === false ? "info" : "succes",
      );
      await vueProspect(prospect.id);
    } catch (erreur) {
      notifie(erreur.message, "erreur");
    } finally {
      progression.innerHTML = "";
    }
  });

  vue.querySelector("#generer").addEventListener("click", async (evenement) => {
    const progression = vue.querySelector("#zone-progression");
    progression.innerHTML = `<div class="carte"><p class="aide">Construction du devis et des
      messages${config.ia ? ", puis reformulation par l'IA" : ""}…</p><div class="progression"></div></div>`;
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

/** Devis chiffré + email, SMS et script d'appel prêts à copier. */
function dessineProposition(prospect, documents) {
  const zone = vue.querySelector("#zone-proposition");
  const devis = documents.devis;
  const lignes = [...devis.lignes_projet, ...devis.lignes_recurrentes];

  if (!lignes.length) {
    zone.innerHTML = `<div class="carte"><h2>Proposition</h2>
      <p class="alerte">${esc(documents.synthese)}</p>
      <p class="aide">Aucun chiffrage n'est proposé : il n'y a pas de constat exploitable sur
        lequel appuyer un devis.</p></div>`;
    return;
  }

  const textes = {
    email: `Objet : ${documents.email.objet}\n\n${documents.email.corps}`,
    sms: documents.sms,
    appel: documents.script_appel,
    synthese: documents.synthese,
  };

  zone.innerHTML = `
    <div class="carte">
      <div class="entre-deux">
        <h2>Devis</h2>
        <div class="ligne">
          ${documents.genere_par_ia
            ? `<span class="etiquette et-vert">textes personnalisés par l'IA</span>`
            : `<span class="etiquette">textes issus des modèles</span>`}
          <span class="etiquette">valable jusqu'au ${esc(devis.valide_jusqu_au)}</span>
        </div>
      </div>
      <div class="deroule">
        <table>
          <thead><tr><th>Prestation</th><th>Pourquoi</th><th class="nombre">Prix</th></tr></thead>
          <tbody>
            ${lignes.map((ligne) => `
              <tr>
                <td><strong>${esc(ligne.libelle)}</strong>
                  ${ligne.description ? `<div class="aide" style="margin:0">${esc(ligne.description)}</div>` : ""}</td>
                <td class="aide" style="margin:0">${esc(ligne.motifs.join(" · ")) || "—"}</td>
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
        <h2>Prise de contact</h2>
        <a href="/api/rapport/${esc(prospect.id)}" target="_blank" rel="noreferrer noopener">
          <button type="button">Rapport imprimable (PDF)</button></a>
      </div>
      <p class="aide">L'email mentionne l'origine des données et le droit d'opposition, comme
        l'exige la prospection B2B.</p>
      <div class="grille" style="grid-template-columns:1fr">
        ${blocCopiable(`Email — ${documents.email.objet}`, textes.email, "email")}
        ${blocCopiable("SMS", textes.sms, "sms")}
        ${blocCopiable("Script d'appel", textes.appel, "appel")}
      </div>
    </div>

    <div class="carte">
      <h2>Rapport client</h2>
      <p class="aide">Ce qui sera envoyé au prospect : notes par volet, défauts constatés,
        chiffrage. Imprimable en PDF depuis le bouton ci-dessus.</p>
      <iframe class="rapport" src="/api/rapport/${esc(prospect.id)}" title="Rapport d'audit"></iframe>
    </div>`;

  brancheCopies(zone, textes);
}

// ── Vue : prestations et identité du devis ──────────────────────────────────

async function vuePrestations() {
  vue.innerHTML = `<p class="attente">Chargement du catalogue…</p>`;
  const { prestations, emetteur } = await api("/api/prestations");

  vue.innerHTML = `
    <div class="carte">
      <h2>Catalogue de prestations</h2>
      <p class="aide">Ces prix alimentent les devis : chaque défaut d'audit appelle une ou
        plusieurs de ces lignes. Décochez une prestation pour qu'elle n'apparaisse plus.</p>
      <div class="deroule">
        <table id="catalogue">
          <thead><tr>
            <th>Actif</th><th>Libellé</th><th>Description</th>
            <th class="nombre">Prix</th><th>Unité</th><th>Catégorie</th>
          </tr></thead>
          <tbody>
            ${prestations.map((p, i) => `
              <tr data-index="${i}" data-code="${esc(p.code)}" data-ordre="${p.ordre ?? 0}">
                <td><input type="checkbox" data-champ="actif" ${p.actif === false ? "" : "checked"}></td>
                <td><input type="text" data-champ="libelle" value="${esc(p.libelle)}"></td>
                <td><input type="text" data-champ="description" value="${esc(p.description ?? "")}"></td>
                <td><input type="number" data-champ="prix" value="${Number(p.prix)}" min="0" step="10"></td>
                <td><select data-champ="unite">
                  <option value="forfait" ${p.unite === "forfait" ? "selected" : ""}>forfait</option>
                  <option value="mois" ${p.unite === "mois" ? "selected" : ""}>par mois</option>
                </select></td>
                <td><input type="text" data-champ="categorie" value="${esc(p.categorie)}"></td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <div class="carte">
      <h2>Identité portée sur le devis</h2>
      <div class="grille">
        <div><label for="raison_sociale">Raison sociale</label>
          <input type="text" id="raison_sociale" value="${esc(emetteur.raison_sociale)}"></div>
        <div><label for="siret">SIRET</label>
          <input type="text" id="siret" value="${esc(emetteur.siret)}"></div>
        <div><label for="email">Email</label>
          <input type="text" id="email" value="${esc(emetteur.email)}"></div>
        <div><label for="telephone">Téléphone</label>
          <input type="text" id="telephone" value="${esc(emetteur.telephone)}"></div>
        <div style="grid-column:1/-1"><label for="adresse">Adresse</label>
          <input type="text" id="adresse" value="${esc(emetteur.adresse)}"></div>
        <div><label for="taux_tva">TVA (%)</label>
          <input type="number" id="taux_tva" value="${Number(emetteur.taux_tva)}" min="0" max="30" step="0.1"></div>
        <div><label for="validite_jours">Validité du devis (jours)</label>
          <input type="number" id="validite_jours" value="${Number(emetteur.validite_jours)}" min="1" max="365"></div>
        <div style="grid-column:1/-1"><label for="mentions">Mentions</label>
          <input type="text" id="mentions" value="${esc(emetteur.mentions)}"></div>
      </div>
      <div class="ligne ligne-fin" style="margin-top:14px">
        <button id="enregistrer-catalogue" class="primaire">Enregistrer le catalogue et l'identité</button>
      </div>
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

  document.querySelectorAll("#menu a").forEach((lien) => {
    lien.classList.toggle("actif", lien.dataset.vue === (section || "prospects"));
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
    config.pagespeed ? "Lighthouse : clé PageSpeed active" : "Lighthouse : quota public",
    config.ia ? "IA : active" : "IA : désactivée",
  ].map(esc).join(" · ");

  window.addEventListener("hashchange", affiche);
  await affiche();
}

demarre();
