import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Tables } from "@/integrations/supabase/types";

type Business = Tables<"businesses">;

interface AuthContextType {
  user: User | null;
  loading: boolean;
  role: string | null;
  business: Business | null;
  locationId: string | null;
  locationName: string | null;
  isFranchiseOwner: boolean;
  logout: () => Promise<void>;
  refreshBusiness: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const bootSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;

      if (error || !data.session) {
        setUser(null);
        setRole(null);
        setBusiness(null);
        setLocationId(null);
        setLocationName(null);
        setLoading(false);
        return;
      }

      // Verify the user still exists (handles deleted accounts with stale sessions)
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!active) return;

      if (userError || !userData.user) {
        console.warn("[Auth] Session exists but user is invalid/deleted, signing out");
        await supabase.auth.signOut();
        setUser(null);
        setRole(null);
        setBusiness(null);
        setLocationId(null);
        setLocationName(null);
        setLoading(false);
        return;
      }

      setUser(userData.user);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      if (!session) {
        setUser(null);
        setRole(null);
        setBusiness(null);
        setLocationId(null);
        setLocationName(null);
        setLoading(false);
        return;
      }

      setUser(session.user);
    });

    bootSession();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadUserContext = async () => {
      if (!user) return;

      const [rolesRes, bizRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id).limit(1),
        supabase.from("businesses").select("*").eq("owner_id", user.id).maybeSingle(),
      ]);

      if (!active) return;

      const userRole = rolesRes.data?.[0]?.role ?? null;
      setRole(userRole);

      // Admin impersonation: only allow if role is verified as super_admin from DB
      let resolvedBusiness = bizRes.data ?? null;
      let resolvedLocationId: string | null = null;
      let resolvedLocationName: string | null = null;

      if (userRole === "super_admin") {
        const impersonatedId = localStorage.getItem("impersonating_business");
        if (impersonatedId) {
          const { data: impBiz } = await supabase
            .from("businesses")
            .select("*")
            .eq("id", impersonatedId)
            .maybeSingle();
          if (!active) return;
          if (impBiz) {
            resolvedBusiness = impBiz;
          } else {
            localStorage.removeItem("impersonating_business");
            localStorage.removeItem("impersonating_business_name");
          }
        }
      } else if (userRole === "location_manager") {
        // Location manager: find their location and parent business
        const { data: lmData } = await supabase
          .from("location_managers")
          .select("location_id, merchant_locations(business_id, name)")
          .eq("user_id", user.id)
          .limit(1);
        if (!active) return;

        if (lmData && lmData.length > 0) {
          const lm = lmData[0] as any;
          resolvedLocationId = lm.location_id;
          resolvedLocationName = lm.merchant_locations?.name || null;
          const parentBizId = lm.merchant_locations?.business_id;
          if (parentBizId) {
            const { data: parentBiz } = await supabase
              .from("businesses")
              .select("*")
              .eq("id", parentBizId)
              .maybeSingle();
            if (!active) return;
            if (parentBiz) resolvedBusiness = parentBiz;
          }
        }
      } else {
        // Not super_admin — clear any stale impersonation state
        if (localStorage.getItem("impersonating_business")) {
          localStorage.removeItem("impersonating_business");
          localStorage.removeItem("impersonating_business_name");
        }
      }

      setBusiness(resolvedBusiness);
      setLocationId(resolvedLocationId);
      setLocationName(resolvedLocationName);
      setLoading(false);

      // Subscription gate: redirect unpaid users to checkout
      const biz = resolvedBusiness;
      const path = window.location.pathname;
      const isExempt =
        path.startsWith("/dashboard/checkout") ||
        path.startsWith("/dashboard/abonnement") ||
        path.startsWith("/admin") ||
        path.startsWith("/setup");
      const isBlocked = biz && (
        biz.subscription_status === "inactive" ||
        biz.subscription_status === "past_due" ||
        biz.subscription_status === "canceled"
      );
      // Location managers are covered by the franchise owner's subscription
      if (
        isBlocked &&
        path.startsWith("/dashboard") &&
        !isExempt &&
        userRole !== "location_manager"
      ) {
        navigate(`/dashboard/checkout?plan=${biz.subscription_plan || "starter"}`, { replace: true });
      }
    };

    loadUserContext();

    return () => {
      active = false;
    };
  }, [user]);

  const isFranchiseOwner = !!(business as any)?.is_franchise && role !== "location_manager" && !locationId;

  const refreshBusiness = async () => {
    if (!user) return;
    // Respect admin impersonation only if role is verified super_admin
    const impersonatedId = localStorage.getItem("impersonating_business");
    if (role === "super_admin" && impersonatedId) {
      const { data: roleCheck } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "super_admin").maybeSingle();
      if (roleCheck) {
        const { data } = await supabase.from("businesses").select("*").eq("id", impersonatedId).maybeSingle();
        if (data) { setBusiness(data); return; }
      } else {
        localStorage.removeItem("impersonating_business");
        localStorage.removeItem("impersonating_business_name");
      }
    }
    const { data } = await supabase.from("businesses").select("*").eq("owner_id", user.id).maybeSingle();
    setBusiness(data ?? null);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  };

  return (
    <AuthContext.Provider value={{ user, loading, role, business, locationId, locationName, isFranchiseOwner, logout, refreshBusiness }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(redirectTo = "/login") {
  const context = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (context && !context.loading && !context.user && redirectTo) {
      navigate(redirectTo, { replace: true });
    }
  }, [context?.loading, context?.user, redirectTo, navigate]);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
