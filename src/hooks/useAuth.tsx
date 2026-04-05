import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Tables } from "@/integrations/supabase/types";

type Business = Tables<"businesses">;

interface AuthContextType {
  user: User | null;
  loading: boolean;
  contextLoaded: boolean;
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
  const [authReady, setAuthReady] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [contextLoaded, setContextLoaded] = useState(false);

  const clearAuthState = () => {
    setUser(null);
    setRole(null);
    setBusiness(null);
    setLocationId(null);
    setLocationName(null);
  };

  useEffect(() => {
    let active = true;

    const bootSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;

      if (error || !data.session) {
        clearAuthState();
        setAuthReady(true);
        setLoading(false);
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!active) return;

      if (userError || !userData.user) {
        console.warn("[Auth] Session exists but user is invalid/deleted, signing out");
        await supabase.auth.signOut();
        if (!active) return;
        clearAuthState();
        setAuthReady(true);
        setLoading(false);
        return;
      }

      setUser(userData.user);
      setAuthReady(true);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || event === "INITIAL_SESSION") return;

      if (!session) {
        clearAuthState();
        setAuthReady(true);
        setLoading(false);
        return;
      }

      // Don't reload everything on token refresh - user hasn't changed
      if (event === "TOKEN_REFRESHED") {
        setUser(session.user);
        return;
      }

      setLoading(true);
      setUser(session.user);
      setAuthReady(true);
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
      if (!authReady) return;

      if (!user) {
        setRole(null);
        setBusiness(null);
        setLocationId(null);
        setLocationName(null);
        setLoading(false);
        setContextLoaded(true);
        return;
      }

      const [rolesRes, bizRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id).limit(1),
        supabase.from("businesses").select("*").eq("owner_id", user.id).maybeSingle(),
      ]);

      if (!active) return;

      const userRole = rolesRes.data?.[0]?.role ?? null;
      setRole(userRole);

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
      } else if (localStorage.getItem("impersonating_business")) {
        localStorage.removeItem("impersonating_business");
        localStorage.removeItem("impersonating_business_name");
      }

      setBusiness(resolvedBusiness);
      setLocationId(resolvedLocationId);
      setLocationName(resolvedLocationName);
      setLoading(false);
      setContextLoaded(true);

      const biz = resolvedBusiness;
      const path = window.location.pathname;
      const isExempt =
        path.startsWith("/dashboard/checkout") ||
        path.startsWith("/admin") ||
        path.startsWith("/setup");
      const isBlocked = !biz || (
        biz.subscription_status !== "active" &&
        biz.subscription_status !== "trialing"
      );

      if (
        isBlocked &&
        path.startsWith("/dashboard") &&
        !isExempt &&
        userRole !== "location_manager" &&
        userRole !== "super_admin"
      ) {
        navigate(`/dashboard/checkout?plan=${biz?.subscription_plan || "starter"}`, { replace: true });
      }
    };

    loadUserContext();

    return () => {
      active = false;
    };
  }, [authReady, user, navigate]);

  const isFranchiseOwner = (!!(business as any)?.is_franchise || (business as any)?.subscription_plan === "franchise") && role !== "location_manager" && !locationId;

  const refreshBusiness = async () => {
    if (!user) return;
    const impersonatedId = localStorage.getItem("impersonating_business");
    if (role === "super_admin" && impersonatedId) {
      const { data: roleCheck } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "super_admin").maybeSingle();
      if (roleCheck) {
        const { data } = await supabase.from("businesses").select("*").eq("id", impersonatedId).maybeSingle();
        if (data) {
          setBusiness(data);
          return;
        }
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
    <AuthContext.Provider value={{ user, loading, contextLoaded, role, business, locationId, locationName, isFranchiseOwner, logout, refreshBusiness }}>
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
