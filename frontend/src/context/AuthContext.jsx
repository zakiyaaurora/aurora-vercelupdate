import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid) => {
    if (!uid) { setProfile(null); return null; }
    const { data } = await supabase
      .from("profiles")
      .select("id, name, email, role, phone, status")
      .eq("id", uid)
      .maybeSingle();
    setProfile(data || null);
    return data;
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    let alive = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) await loadProfile(data.session.user.id);
      setLoading(false);
    })();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, next) => {
      setSession(next);
      setUser(next?.user ?? null);
      if (next?.user) await loadProfile(next.user.id);
      else setProfile(null);
    });

    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, [loadProfile]);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user) await loadProfile(data.user.id);
    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut({ scope: "local" });
    setProfile(null);
    setUser(null);
    setSession(null);
  };

  const refreshProfile = () => (user ? loadProfile(user.id) : null);

  const role = profile?.role || null;

  return (
    <AuthContext.Provider
      value={{ session, user, profile, role, loading, signIn, signOut, refreshProfile, configured: isSupabaseConfigured }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
