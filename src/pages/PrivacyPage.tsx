const PrivacyPage = () => (
  <div className="min-h-screen bg-background py-16 px-4">
    <div className="max-w-3xl mx-auto prose dark:prose-invert">
      <h1 className="font-display">Politique de Confidentialité</h1>
      <p className="lead">Dernière mise à jour : avril 2026</p>

      <h2>1. Responsable du traitement</h2>
      <p>
        Le responsable du traitement des données est FidéliPro SAS.<br />
        Email DPO : dpo@fidelispro.fr
      </p>

      <h2>2. Données collectées</h2>
      <p>Nous collectons les données suivantes :</p>
      <ul>
        <li><strong>Commerçants</strong> : nom, email, mot de passe (hashé), informations de l'entreprise, données de paiement (via Stripe).</li>
        <li><strong>Clients finaux</strong> : nom, email (optionnel), téléphone (optionnel), date d'anniversaire (optionnel), historique de fidélité (points, visites, récompenses).</li>
        <li><strong>Données techniques</strong> : adresse IP, type de navigateur, pages consultées (analytics anonymisés).</li>
      </ul>

      <h2>3. Finalités du traitement</h2>
      <ul>
        <li>Gestion des comptes commerçants et facturation</li>
        <li>Fonctionnement du programme de fidélité (attribution de points, récompenses)</li>
        <li>Envoi de notifications push via Apple Wallet / Google Wallet</li>
        <li>Rappels automatiques et campagnes marketing (avec consentement)</li>
        <li>Amélioration du service et statistiques anonymisées</li>
      </ul>

      <h2>4. Base légale</h2>
      <ul>
        <li><strong>Exécution du contrat</strong> : gestion du compte, programme de fidélité</li>
        <li><strong>Consentement</strong> : notifications push, campagnes marketing, cookies non essentiels</li>
        <li><strong>Intérêt légitime</strong> : sécurité, prévention de la fraude, amélioration du service</li>
      </ul>

      <h2>5. Durée de conservation</h2>
      <ul>
        <li>Données de compte : durée de la relation contractuelle + 3 ans</li>
        <li>Données de fidélité des clients finaux : durée du programme + 1 an</li>
        <li>Données de facturation : 10 ans (obligation légale)</li>
        <li>Logs techniques : 12 mois</li>
      </ul>

      <h2>6. Partage des données</h2>
      <p>Vos données sont partagées avec :</p>
      <ul>
        <li><strong>Supabase</strong> (hébergement base de données, authentification)</li>
        <li><strong>Stripe</strong> (traitement des paiements)</li>
        <li><strong>Apple / Google</strong> (passes wallet, notifications push)</li>
        <li><strong>Vercel</strong> (hébergement web)</li>
      </ul>
      <p>Aucune donnée n'est vendue à des tiers.</p>

      <h2>7. Vos droits (RGPD)</h2>
      <p>Conformément au RGPD, vous disposez des droits suivants :</p>
      <ul>
        <li><strong>Accès</strong> : obtenir une copie de vos données</li>
        <li><strong>Rectification</strong> : corriger des données inexactes</li>
        <li><strong>Suppression</strong> : demander l'effacement de vos données</li>
        <li><strong>Portabilité</strong> : recevoir vos données dans un format structuré</li>
        <li><strong>Opposition</strong> : vous opposer au traitement de vos données</li>
        <li><strong>Limitation</strong> : restreindre le traitement de vos données</li>
      </ul>
      <p>
        Pour exercer vos droits, contactez-nous à <strong>dpo@fidelispro.fr</strong>.<br />
        Vous pouvez également déposer une plainte auprès de la <strong>CNIL</strong> (cnil.fr).
      </p>

      <h2>8. Cookies</h2>
      <p>
        Ce site utilise uniquement des cookies essentiels au fonctionnement (session d'authentification).
        Aucun cookie de tracking ou publicitaire n'est utilisé.
      </p>

      <h2>9. Sécurité</h2>
      <p>
        Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger
        vos données : chiffrement en transit (TLS), chiffrement au repos, contrôle d'accès basé sur
        les rôles (RLS), audit des accès administrateurs.
      </p>

      <h2>10. Transferts internationaux</h2>
      <p>
        Certaines données peuvent être transférées vers les États-Unis (Supabase, Stripe, Vercel, Apple, Google).
        Ces transferts sont encadrés par les clauses contractuelles types de la Commission européenne
        et/ou le EU-US Data Privacy Framework.
      </p>
    </div>
  </div>
);

export default PrivacyPage;
