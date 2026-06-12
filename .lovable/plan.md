# Désactivation paiement + attribution manuelle + géocodage VTC

## 1. Désactivation Stripe (sans supprimer le code)

- Ajout d'un flag global `payments_enabled` dans `site_settings` (défaut: `false`).
- `SignupPage` : ne propose plus de choix de plan, l'utilisateur s'inscrit directement (email + mdp + nom commerce).
- `handle_new_user` (trigger DB) : crée le business avec `subscription_status='pending_activation'`, `subscription_plan=NULL`, `business_template=NULL`.
- Route `/dashboard/abonnement` : remplace l'UI Stripe par un écran "Votre compte est en attente d'activation — contactez fidelipro.com" (avec lien WhatsApp/email).
- `useAuth` + `RequireActiveSubscription` : si `subscription_status === 'pending_activation'` → redirige vers `/pending-activation` (nouvel écran). Toutes les routes dashboard sont bloquées sauf cette page + `/dashboard/settings/compte` + déconnexion.
- Le code Stripe (edge functions `create-checkout`, `stripe-webhook`, etc.) reste en place mais n'est plus appelé depuis l'UI. Aucune suppression.

## 2. Panel super-admin — Attribution manuelle

Sur `/admin/businesses` (déjà existant), enrichissement :

- Nouvelle colonne "Statut" : `pending_activation` / `active` / `suspended` avec badge couleur.
- Bouton "Activer ce compte" → modal avec :
  - Sélecteur **Plan** : Starter / Pro / Franchise
  - Sélecteur **Template** : Restaurant / Coffee / Beauty / Barber / Bakery / Retail / **VTC** / Custom
  - Date de fin d'abonnement (optionnelle, par défaut +1 an)
  - Toggle "Franchise activée"
- Au submit : RPC `admin_activate_business` (SECURITY DEFINER, vérifie role super_admin) qui set `subscription_status='active'`, `subscription_plan`, `business_template`, applique la config du template (couleurs, loyalty_type, etc.), log dans `admin_audit_logs`.
- Bouton "Suspendre" → repasse à `pending_activation`.
- Bouton "Changer plan/template" sur business actif → même modal.

## 3. Template VTC réservé super-admin

- Retiré de la liste publique des templates (`TemplateSelector` dans onboarding) → masqué via filtre `if (template.id === 'vtc') return false`.
- Disponible uniquement dans la modale d'activation super-admin.
- Une fois attribué, l'entreprise voit "Mode chauffeur" dans sa sidebar et la section VTC dans Paramètres.

## 4. Géocodage automatique via Lovable AI

Nouvelle edge function `geocode-address` :
- Input : `{ address: string }`
- Appelle `google/gemini-2.5-flash` avec un prompt structuré : "Renvoie les coordonnées GPS au format JSON `{lat, lng, formatted_address, city, country}` pour cette adresse française : X. Si ambiguë, prends la plus probable. Si impossible, renvoie null."
- Réponse JSON validée.
- Cache léger en mémoire process (Map) sur l'adresse normalisée.

Intégration :
- `BusinessPublicPage` (signup client VTC) : quand l'utilisateur tape une adresse et perd le focus (`onBlur`), appel auto à `geocode-address`. Petit indicateur "✓ Adresse localisée" ou "⚠ Adresse non reconnue".
- Si géolocalisation manuelle déjà fournie (`📍 Position actuelle`), skip le géocodage.
- `register_customer_and_card` reçoit `home_lat/lng` géocodés ou GPS direct.

## 5. Nouvelle page `/pending-activation`

Écran simple, dark mode, branding FidelisPro :
- Icône horloge animée
- "Compte créé avec succès 🎉"
- "Votre commerce est en attente d'activation. Contactez-nous pour activer votre programme de fidélité."
- Boutons : WhatsApp (lien `wa.me`), Email (mailto), Déconnexion.
- Affiche le nom du commerce et l'email du compte.

## Hors scope

- Suppression du code Stripe (gardé en backup réactivable).
- Notification email automatique lors de l'activation par toi (faisable rapidement après si tu veux).
- Édition du géocodage sur des adresses internationales complexes.

## Détails techniques

**Migration SQL** :
- `ALTER TABLE businesses ADD COLUMN activated_at timestamptz, activated_by uuid REFERENCES auth.users(id), subscription_expires_at timestamptz`
- Modifier l'enum `subscription_status` si besoin pour ajouter `pending_activation`
- Modifier `handle_new_user` pour set `pending_activation`
- Nouvelle RPC `admin_activate_business(business_id, plan, template, expires_at, is_franchise)`
- `site_settings.payments_enabled boolean default false`

**Fichiers modifiés** :
- `src/pages/SignupPage.tsx` (retrait du choix de plan)
- `src/pages/PendingActivationPage.tsx` (nouveau)
- `src/App.tsx` (route + guard)
- `src/hooks/useAuth.tsx` (expose `isPendingActivation`)
- `src/pages/dashboard/SubscriptionPage.tsx` (UI bloquée)
- `src/components/auth/RequireActiveSubscription.tsx` (guard renforcé)
- `src/pages/admin/AdminBusinessesPage.tsx` (modale activation)
- `src/components/admin/ActivateBusinessModal.tsx` (nouveau)
- `src/lib/businessTemplates.ts` (flag `superAdminOnly: true` sur VTC)
- `src/components/onboarding/TemplateSelector.tsx` (filtre VTC)
- `src/pages/public/BusinessPublicPage.tsx` (géocodage onBlur)
- `supabase/functions/geocode-address/index.ts` (nouveau)
