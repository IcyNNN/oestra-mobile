import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "./supabase";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const applySession = useCallback((nextSession: Session | null) => {
    setSession(nextSession);
    setStatus(nextSession?.user ? "authenticated" : "unauthenticated");
  }, []);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        if (mounted) {
          setStatus("unauthenticated");
        }
        return;
      }
      if (mounted) {
        applySession(data.session);
      }
    };

    bootstrap();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!mounted) {
          return;
        }
        applySession(nextSession);
      },
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [applySession]);

  const signUp = useCallback(async (email: string, password: string) => {
    // Difference from Next.js version: no server action; direct client-side Supabase call in RN.
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      throw new Error(error.message);
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    // Difference from Next.js version: no route handler; direct client-side Supabase call in RN.
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(error.message);
    }
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      signUp,
      signIn,
      signOut,
    }),
    [session, signIn, signOut, signUp, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
