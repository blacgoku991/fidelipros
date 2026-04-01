
## Phase 1: Database Migration
- Create `automations` table for automated campaigns
- Create `merchant_locations` and `user_merchant_points` tables (multi-merchant prep, inactive)
- No breaking changes to existing tables

## Phase 2: Dashboard Sidebar Restructure
- Reorganize sidebar into 4 grouped sections: Acquisition, Fidélité, Marketing, Analyse
- Add new routes: `/dashboard/automations`, `/dashboard/analytics`
- Keep all existing pages functional

## Phase 3: Main Dashboard Enhancement
- Add "Résultats ce mois-ci" business impact panel (returning customers, rewards, estimated revenue)
- Add smart suggestions widget
- Add quick action buttons
- Cleaner layout with better hierarchy

## Phase 4: Card Settings Redesign
- Redesign CustomizePage with tabbed interface (Design, Type, Champs, Récompenses, Wallet)
- Keep same data flow, just better UI structure
- Ensure consistent card sizing across all types

## Phase 5: Customer Timeline
- Add visual timeline to client profile in ClientsPage
- Show visits, rewards, campaigns in chronological order

## Phase 6: Automations Enhancement
- Create dedicated automations page at `/dashboard/automations`
- Move existing auto-reminder, geofence, birthday settings
- Add more trigger options with visual UI

## Phase 7: Analytics Page
- Create dedicated `/dashboard/analytics` page
- Add return rate, reward usage, engagement evolution charts
- Business insights with actionable data

## Phase 8: Homepage Alignment
- Update hero messaging to focus on business value
- Ensure visual consistency with product

## Files to create/modify:
- New: `src/pages/dashboard/AutomationsPage.tsx`
- New: `src/pages/dashboard/AnalyticsPage.tsx`  
- New: `src/components/dashboard/BusinessResults.tsx`
- New: `src/components/dashboard/SmartSuggestions.tsx`
- New: `src/components/dashboard/QuickActions.tsx`
- New: `src/components/dashboard/CustomerTimeline.tsx`
- Modified: `src/lib/sidebarItems.ts` (grouped sections)
- Modified: `src/components/dashboard/DashboardSidebar.tsx` (group support)
- Modified: `src/App.tsx` (new routes)
- Modified: `src/pages/Dashboard.tsx` (new widgets)
- Modified: `src/pages/dashboard/CustomizePage.tsx` (tabbed redesign)
- Modified: `src/pages/dashboard/ClientsPage.tsx` (timeline)
