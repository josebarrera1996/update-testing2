// src/context/AuthContext.tsx
"use client";

import { createContext, useContext, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useDispatch } from "react-redux";
import { setUser, setLoading, logout } from "@/store/slices/authSlice";
import { useRouter } from "next/navigation";

interface AuthContextType {
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClientComponentClient();
  const dispatch = useDispatch();
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      dispatch(setLoading(true));

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          dispatch(setUser(session.user));
        } else {
          dispatch(setUser(null));
        }
      } catch (error) {
        console.error("Error checking auth:", error);
        dispatch(setUser(null));
      } finally {
        dispatch(setLoading(false));
      }
    };

    // Llamar inmediatamente para obtener el estado inicial
    getUser();

    // Suscribirse a cambios de autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      //console.log("Auth state changed:", event);
      if (session?.user) {
        dispatch(setUser(session.user));
      } else {
        dispatch(setUser(null));
      }
      dispatch(setLoading(false));
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, dispatch]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      dispatch(logout());
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) throw error;
    } catch (error) {
      console.error("Error signing in with Google:", error);
    }
  };

  const value = {
    signOut,
    signInWithGoogle,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
