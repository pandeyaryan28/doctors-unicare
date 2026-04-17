import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface DoctorProfile {
  id: string;
  auth_user_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  specialty: string | null;
  registration_number: string | null;
  clinic_name: string | null;
  phone: string | null;
  clinic_address: string | null;
  qualification: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  doctorProfile: DoctorProfile | null;
  loading: boolean;
  isConfigured: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const isConfigured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

  // Prevent concurrent profile fetches (e.g. INITIAL_SESSION + TOKEN_REFRESHED
  // firing close together in the same mount).
  const fetchingRef = useRef(false);

  const fetchDoctorProfile = async (userId: string) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      // Prefer the most recently updated row — the DB already enforces
      // UNIQUE on auth_user_id (doctors_auth_user_id_key index), so this
      // ordering is a safety net for any legacy duplicates only.
      const { data: existing, error: selectError } = await supabase
        .from('doctors')
        .select('*')
        .eq('auth_user_id', userId)
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (selectError) {
        console.warn('[AuthContext] Warning fetching profile:', selectError);
      }

      if (existing) {
        setDoctorProfile(existing);
        return;
      }

      // No row yet — create one from Google OAuth metadata.
      const { data: newUser } = await supabase.auth.getUser();
      if (!newUser?.user) return;

      const { data: created, error: createError } = await supabase
        .from('doctors')
        .insert({
          auth_user_id: userId,
          full_name: newUser.user.user_metadata.full_name || 'Doctor',
          email: newUser.user.email || '',
          avatar_url: newUser.user.user_metadata.avatar_url || null,
        })
        .select()
        .limit(1)
        .maybeSingle();

      if (createError) {
        // 23505 = unique_violation: a parallel request already created the row.
        if (createError.code === '23505') {
          const { data: retryExisting } = await supabase
            .from('doctors')
            .select('*')
            .eq('auth_user_id', userId)
            .order('updated_at', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (retryExisting) setDoctorProfile(retryExisting);
          return;
        }
        throw createError;
      }

      if (created) setDoctorProfile(created);
    } catch (err) {
      console.error('[AuthContext] Error in fetchDoctorProfile:', err);
    } finally {
      fetchingRef.current = false;
    }
  };

  const refreshProfile = async () => {
    fetchingRef.current = false; // bypass the lock for explicit refresh
    if (user) await fetchDoctorProfile(user.id);
  };

  useEffect(() => {
    let mounted = true;
    let loadingReleased = false;

    const releaseLoading = () => {
      if (!loadingReleased && mounted) {
        loadingReleased = true;
        setLoading(false);
      }
    };

    // Emergency escape hatch — should never fire in practice now that we
    // don't block on network calls during initialization.
    const fallbackTimer = setTimeout(() => {
      console.warn('[AuthContext] Auth initialization fallback timeout — releasing loading state.');
      releaseLoading();
    }, 10000);

    // ─────────────────────────────────────────────────────────────────────────
    // IMPORTANT: Do NOT call supabase.auth.getSession() here.
    //
    // In Supabase JS v2, getSession() triggers a token-refresh network call
    // when the access token is expired. That network call can hang for 10s+
    // and blocks setLoading(false), causing the fallback timer to fire.
    //
    // onAuthStateChange fires INITIAL_SESSION **synchronously from localStorage**
    // without any network calls. This is the correct v2 initialization pattern.
    // ─────────────────────────────────────────────────────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      // TOKEN_REFRESHED: access token was silently renewed. Only update the
      // stored session object — no profile re-fetch needed, and don't touch
      // the loading state (it was already released on INITIAL_SESSION).
      if (event === 'TOKEN_REFRESHED') {
        setSession(session);
        return;
      }

      // Update auth state for all other events.
      setSession(session);
      setUser(session?.user ?? null);

      if (!session?.user) {
        // Not signed in (INITIAL_SESSION with no session, or SIGNED_OUT).
        setDoctorProfile(null);
        releaseLoading();
        clearTimeout(fallbackTimer);
        return;
      }

      // ── INITIAL_SESSION (page load / refresh) ───────────────────────────
      // Release loading NOW — we know the user is logged in from localStorage.
      // The profile fetch runs in the background; components handle null
      // doctorProfile gracefully (null checks / fallback text) for the brief
      // moment before the profile arrives (~300–600 ms).
      if (event === 'INITIAL_SESSION') {
        releaseLoading();
        clearTimeout(fallbackTimer);
        fetchDoctorProfile(session.user.id); // intentionally not awaited
        return;
      }

      // ── SIGNED_IN (explicit login) ──────────────────────────────────────
      // Await the profile so the dashboard has data the instant it renders.
      try {
        await fetchDoctorProfile(session.user.id);
      } finally {
        releaseLoading();
        clearTimeout(fallbackTimer);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(fallbackTimer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    try {
      setUser(null);
      setSession(null);
      setDoctorProfile(null);
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch (err) {
      console.warn('[AuthContext] Sign out error:', err);
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, doctorProfile, loading, isConfigured, signInWithGoogle, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
