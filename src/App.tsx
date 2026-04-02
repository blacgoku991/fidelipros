// 
import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ScrollToTop } from "@/components/ScrollToTop";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Eager-loaded pages (public, lightweight)
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";

// Lazy-loaded: Dashboard pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ClientsPage = lazy(() => import("./pages/dashboard/ClientsPage"));
const CustomizePage = lazy(() => import("./pages/dashboard/CustomizePage"));
const ScannerPage = lazy(() => import("./pages/dashboard/ScannerPage"));
const SettingsPage = lazy(() => import("./pages/dashboard/SettingsPage"));
const CheckoutPage = lazy(() => import("./pages/dashboard/CheckoutPage"));
const RewardsPage = lazy(() => import("./pages/dashboard/RewardsPage"));
const CampaignsPage = lazy(() => import("./pages/dashboard/CampaignsPage"));
const AbonnementPage = lazy(() => import("./pages/dashboard/AbonnementPage"));
const AutomationsPage = lazy(() => import("./pages/dashboard/AutomationsPage"));
const AnalyticsPage = lazy(() => import("./pages/dashboard/AnalyticsPage"));

// Lazy-loaded: Admin pages
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminBusinesses = lazy(() => import("./pages/admin/AdminBusinesses"));
const AdminBusinessDetail = lazy(() => import("./pages/admin/AdminBusinessDetail"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminLandingContent = lazy(() => import("./pages/admin/AdminLandingContent"));
const AdminEmailDigest = lazy(() => import("./pages/admin/AdminEmailDigest"));
const AdminPlans = lazy(() => import("./pages/admin/AdminPlans"));
const AdminMessages = lazy(() => import("./pages/admin/AdminMessages"));
const AdminDemoGenerator = lazy(() => import("./pages/admin/AdminDemoGenerator"));

// Lazy-loaded: Onboarding & public
const Onboarding = lazy(() => import("./pages/Onboarding"));
const OnboardingBusiness = lazy(() => import("./pages/OnboardingBusiness"));
const SetupWizard = lazy(() => import("./pages/SetupWizard"));
const Tarifs = lazy(() => import("./pages/Tarifs"));
const FaqPage = lazy(() => import("./pages/FaqPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const BusinessPublicPage = lazy(() => import("./pages/public/BusinessPublicPage"));
const CardViewPage = lazy(() => import("./pages/public/CardViewPage"));
const VitrinePage = lazy(() => import("./pages/public/VitrinePage"));
const DemoPage = lazy(() => import("./pages/public/DemoPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function LazyFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ErrorBoundary>
        <BrowserRouter>
          <ScrollToTop />
          <AuthProvider>
            <Suspense fallback={<LazyFallback />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/onboarding-business" element={<OnboardingBusiness />} />
                <Route path="/setup" element={<SetupWizard />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/dashboard/clients" element={<ClientsPage />} />
                <Route path="/dashboard/rewards" element={<RewardsPage />} />
                <Route path="/dashboard/scanner" element={<ScannerPage />} />
                <Route path="/dashboard/campaigns" element={<CampaignsPage />} />
                <Route path="/dashboard/customize" element={<CustomizePage />} />
                <Route path="/dashboard/settings" element={<SettingsPage />} />
                <Route path="/dashboard/checkout" element={<CheckoutPage />} />
                <Route path="/dashboard/abonnement" element={<AbonnementPage />} />
                <Route path="/dashboard/automations" element={<AutomationsPage />} />
                <Route path="/dashboard/analytics" element={<AnalyticsPage />} />
                <Route path="/payment" element={<CheckoutPage />} />
                {/* Redirects for removed pages */}
                <Route path="/dashboard/cards" element={<Navigate to="/dashboard/clients" replace />} />
                <Route path="/dashboard/qrcode" element={<Navigate to="/dashboard/customize" replace />} />
                <Route path="/dashboard/notifications" element={<Navigate to="/dashboard/campaigns" replace />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/businesses" element={<AdminBusinesses />} />
                <Route path="/admin/businesses/:businessId" element={<AdminBusinessDetail />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/landing" element={<AdminLandingContent />} />
                <Route path="/admin/digest" element={<AdminEmailDigest />} />
                <Route path="/admin/plans" element={<AdminPlans />} />
                <Route path="/admin/messages" element={<AdminMessages />} />
                <Route path="/admin/demos" element={<AdminDemoGenerator />} />
                <Route path="/b/:businessId" element={<BusinessPublicPage />} />
                <Route path="/vitrine/:slug" element={<VitrinePage />} />
                <Route path="/demo/:slug" element={<DemoPage />} />
                <Route path="/card/:cardCode" element={<CardViewPage />} />
                <Route path="/tarifs" element={<Tarifs />} />
                <Route path="/faq" element={<FaqPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
