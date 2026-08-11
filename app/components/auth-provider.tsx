"use client";

import { type Session } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getSupabaseBrowserClient, getSupabaseConfigError } from "@/app/lib/supabase/client";

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      const timer = window.setTimeout(() => setLoading(false), 0);
      return () => window.clearTimeout(timer);
    }

    void client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const client = getSupabaseBrowserClient();
    if (!client) return { ok: false, message: getSupabaseConfigError() ?? "Sign-in is unavailable." } as const;
    const { error } = await client.auth.signInWithPassword({ email, password });
    return error ? { ok: false, message: "Unable to sign in. Check your email and password." } as const : { ok: true } as const;
  };

  const signOut = async () => {
    const client = getSupabaseBrowserClient();
    if (client) await client.auth.signOut();
  };

  return <AuthContext.Provider value={{ session, loading, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}

export function RequireStaffAuth({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading && !session && pathname !== "/login") router.replace("/login");
  }, [loading, pathname, router, session]);

  if (pathname === "/login") return <>{children}</>;
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-medium text-slate-600">Checking staff access...</div>;
  if (!session) return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-medium text-slate-600">Redirecting to staff sign-in...</div>;
  return <>{children}</>;
}