import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid) => {
    if (!uid) {
      setProfile(null);
      return null;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, role, phone, status")
        .eq("id", uid)
        .maybeSingle();

      if (error) {
        console.error("Gagal memuat profile:", error);
        setProfile(null);
        return null;
      }

      setProfile(data || null);
      return data;
    } catch (error) {
      console.error("Gagal memuat profile:", error);
      setProfile(null);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let alive = true;

    const initializeAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!alive) return;

        if (error) {
          console.error("Gagal mengambil session:", error);
          setSession(null);
          setUser(null);
          setProfile(null);
          return;
        }

        const currentSession = data?.session || null;
        const currentUser = currentSession?.user || null;

        setSession(currentSession);
        setUser(currentUser);

        if (currentUser) {
          await loadProfile(currentUser.id);
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error("Gagal menginisialisasi autentikasi:", error);

        if (alive) {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!alive) return;

      setSession(nextSession || null);
      setUser(nextSession?.user || null);

      if (!nextSession?.user) {
        setProfile(null);
      } else {
        loadProfile(nextSession.user.id).catch((error) => {
          console.error("Gagal memperbarui profile:", error);
        });
      }
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    if (data?.user) {
      await loadProfile(data.user.id);
    }

    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut({ scope: "local" });

    setProfile(null);
    setUser(null);
    setSession(null);
  };

  const refreshProfile = () => {
    return user ? loadProfile(user.id) : null;
  };

  const role = profile?.role || null;

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        role,
        loading,
        signIn,
        signOut,
        refreshProfile,
        configured: isSupabaseConfigured,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
