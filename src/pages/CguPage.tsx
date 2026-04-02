const CguPage = () => (
  <div className="min-h-screen bg-background py-16 px-4">
    <div className="max-w-3xl mx-auto prose dark:prose-invert">
      <h1 className="font-display">Conditions Générales d'Utilisation</h1>
      <p className="lead">Dernière mise à jour : avril 2026</p>

      <h2>1. Objet</h2>
      <p>
        Les présentes CGU régissent l'utilisation de la plateforme FidéliPro, service de création
        et gestion de programmes de fidélité digitaux à destination des commerçants.
      </p>

      <h2>2. Inscription et compte</h2>
      <p>
        L'utilisation de FidéliPro nécessite la création d'un compte. L'utilisateur garantit
        l'exactitude des informations fournies et s'engage à maintenir la confidentialité de ses
        identifiants de connexion.
      </p>

      <h2>3. Services proposés</h2>
      <ul>
        <li>Création de cartes de fidélité digitales personnalisables</li>
        <li>Gestion des clients et attribution de points</li>
        <li>Intégration Apple Wallet et Google Wallet</li>
        <li>Notifications push et campagnes marketing</li>
        <li>Analytics et statistiques</li>
        <li>Scanner QR pour le suivi des visites</li>
      </ul>

      <h2>4. Abonnement et paiement</h2>
      <p>
        L'accès aux fonctionnalités est soumis à un abonnement mensuel. Le paiement est géré
        par Stripe. L'abonnement est reconduit tacitement chaque mois. Le commerçant peut
        annuler à tout moment via le portail client Stripe.
      </p>

      <h2>5. Responsabilités du commerçant</h2>
      <ul>
        <li>Respecter la réglementation en vigueur (RGPD, droit de la consommation)</li>
        <li>Informer ses clients de l'existence du programme de fidélité et des données collectées</li>
        <li>Ne pas utiliser le service à des fins illicites</li>
        <li>Obtenir le consentement de ses clients pour l'envoi de notifications marketing</li>
      </ul>

      <h2>6. Propriété intellectuelle</h2>
      <p>
        FidéliPro reste propriétaire de l'ensemble de la plateforme. Le commerçant conserve
        la propriété de ses données commerciales et de ses contenus personnalisés.
      </p>

      <h2>7. Protection des données</h2>
      <p>
        Le traitement des données personnelles est détaillé dans notre{" "}
        <a href="/privacy">Politique de Confidentialité</a>.
      </p>

      <h2>8. Résiliation</h2>
      <p>
        Le commerçant peut résilier son abonnement à tout moment. En cas de manquement aux
        présentes CGU, FidéliPro se réserve le droit de suspendre ou supprimer le compte.
      </p>

      <h2>9. Limitation de responsabilité</h2>
      <p>
        FidéliPro ne saurait être tenu responsable des dommages indirects résultant de
        l'utilisation du service. Notre responsabilité est limitée au montant des sommes versées
        au cours des 12 derniers mois.
      </p>

      <h2>10. Droit applicable</h2>
      <p>
        Les présentes CGU sont soumises au droit français. Tout litige sera soumis aux
        tribunaux compétents de Paris.
      </p>
    </div>
  </div>
);

export default CguPage;
