const LegalPage = () => (
  <div className="min-h-screen bg-background py-16 px-4">
    <div className="max-w-3xl mx-auto prose dark:prose-invert">
      <h1 className="font-display">Mentions Légales</h1>

      <h2>Éditeur du site</h2>
      <p>
        FidéliPro est édité par la société FidéliPro SAS.<br />
        Email : contact@fidelispro.fr
      </p>

      <h2>Hébergement</h2>
      <p>
        Le site est hébergé par Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, USA.<br />
        Les données sont hébergées par Supabase Inc. (infrastructure AWS, région eu-west).
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        L'ensemble des contenus (textes, images, logos, logiciels) présents sur le site sont protégés
        par le droit d'auteur et la propriété intellectuelle. Toute reproduction est interdite sans
        autorisation préalable.
      </p>

      <h2>Responsabilité</h2>
      <p>
        FidéliPro s'efforce de fournir des informations exactes et à jour. Toutefois, nous ne
        garantissons pas l'exactitude, la complétude ou l'actualité des informations diffusées.
      </p>

      <h2>Droit applicable</h2>
      <p>
        Les présentes mentions légales sont régies par le droit français. Tout litige relatif à
        l'utilisation du site sera soumis aux tribunaux compétents de Paris.
      </p>
    </div>
  </div>
);

export default LegalPage;
