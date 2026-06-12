## Objectif
Ajouter un nouveau type de programme « VTC / Chauffeur » : le commerçant est mobile, ses clients reçoivent une notification de proximité quand il s'approche de leur zone.

## 1. Base de données (migration)

**Nouvelles colonnes sur `businesses`** (utilisées uniquement quand `business_template = 'vtc'`) :
- `is_mobile_merchant` (bool) — inverse la logique geofence
- `driver_current_lat`, `driver_current_lng` (double) — position live du chauffeur
- `driver_last_position_at` (timestamptz)
- `driver_is_online` (bool)
- `driver_proximity_radius_km` (numeric, défaut 2) — rayon de détection autour du client
- `driver_proximity_cooldown_hours` (int, défaut 6) — configurable
- `driver_proximity_message` (text, défaut « Votre chauffeur préféré est dans les parages ! -10% sur votre prochaine course 🚗 »)
- `driver_discount_percent` (int, défaut 10)

**Nouvelles colonnes sur `customers`** :
- `home_address` (text)
- `home_lat`, `home_lng` (double) — géocodés à l'inscription
- `last_known_lat`, `last_known_lng` (double) — position GPS tel (optionnelle)
- `last_position_at` (timestamptz)

**Nouvelle table `driver_proximity_log`** : trace chaque notif envoyée pour respecter le cooldown.
- `business_id`, `customer_id`, `sent_at`, `distance_km`

**Nouveau template métier** dans `src/lib/businessTemplates.ts` :
- Clé `vtc`, libellés adaptés (« courses » au lieu de « visites », « -10% offert » au lieu de « café offert »), icône voiture.

## 2. Page PWA chauffeur (`/dashboard/driver`)

Accessible depuis la sidebar quand `business_template = 'vtc'` :
- Toggle « En ligne / Hors ligne »
- Demande la permission de géolocalisation
- En arrière-plan : `navigator.geolocation.watchPosition` toutes les 60 secondes (configurable)
- À chaque tick, appelle l'edge function `driver-broadcast-position`
- Affiche : nb de clients dans la zone, dernière notif envoyée, courses du jour
- Manifest PWA mis à jour pour permettre l'installation sur l'écran d'accueil

## 3. Edge function `driver-broadcast-position`

Inputs : `business_id`, `lat`, `lng`
Logique :
1. Vérifier que le caller est bien le owner du business (JWT)
2. Mettre à jour `driver_current_lat/lng` + `driver_last_position_at`
3. Récupérer tous les clients du business avec `home_lat/lng` non null (ou `last_known_lat/lng` plus récent)
4. Calcul Haversine côté serveur, filtrer ≤ `driver_proximity_radius_km`
5. Pour chaque client éligible : vérifier qu'aucune entrée `driver_proximity_log` n'existe < `cooldown_hours`
6. Appeler `send-notifications` avec le message personnalisé `driver_proximity_message`
7. Insérer une ligne dans `driver_proximity_log`

## 4. Inscription client (vitrine)

Page publique `BusinessPublicPage` quand template = vtc :
- Champ « Adresse de votre domicile » (Google Places autocomplete via connecteur)
- Géocodage stocké dans `home_lat/lng` à la création (RPC `register_customer_and_card` enrichie)
- Option « Partager ma position en temps réel » qui demande la permission GPS et envoie périodiquement les coords via une nouvelle RPC `update_customer_position(customer_id, token, lat, lng)`

## 5. Réglages chauffeur

Dans `SettingsPage.tsx`, nouvelle section « Mode VTC » visible si template = vtc :
- Rayon de détection (slider 0.5–10 km)
- Cooldown notif (1h à 7 jours)
- Message personnalisé envoyé aux clients
- % de réduction proposé

## 6. Détails techniques
- Géocodage adresses via le connecteur Google Maps déjà autorisé (gateway Lovable)
- Cooldown stocké côté serveur (table dédiée) pour éviter spam
- Position chauffeur jamais exposée aux clients (RLS stricte sur `driver_current_lat/lng`)
- Aucun changement aux templates existants (resto, café, etc.) — fonctionnalité 100% additionnelle
- Tracking dans `notifications_log` avec `notification_type = 'driver_proximity'`

## Hors scope
- Tracking historique des trajets / itinéraires
- Système de réservation de course intégré (juste une notif, pas de booking)
- Paiement / facturation des courses
- Application native iOS/Android (PWA suffisante pour la géoloc en background côté chauffeur)
