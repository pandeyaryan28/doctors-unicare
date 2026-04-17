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

  // Prevents concurrent fetchDoctorProfile calls — initAuth + onAuthStateChange
  // INITIAL_SESSION both fire on mount; only one should run.
  const fetchingRef = useRef(false);

  const fetchDoctorProfile = async (userId: string) => {
    // Lock: skip if a fetch is already in flight for this mount cycle.
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      // Always prefer the most recently updated/created row so that edits made
      // on the current session are reflected on refresh.
      // The DB enforces UNIQUE on auth_user_id (doctors_auth_user_id_key index),
      // so there should only ever be one row per user.
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
      } else {
        // No row yet — create one from Google auth metadata
        const { data: newUser } = await supabase.auth.getUser();
        if (newUser?.user) {
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
            // 23505 = unique_violation: another concurrent request beat us to the insert.
            // Gracefully recover by fetching the now-existing row.
            if (createError.code === '23505') {
              const { data: retryExisting } = await supabase
                .from('doctors')
                .select('*')
                .eq('auth_user_id', userId)
                .order('updated_at', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              if (retryExisting) {
                setDoctorProfile(retryExisting);
                return;
              }
            }
            throw createError;
          }
          if (created) setDoctorProfile(created);
        }
      }
    } catch (err) {
      console.error('[AuthContext] Error in fetchDoctorProfile:', err);
    } finally {
      fetchingRef.current = false;
    }
  };

  const refreshProfile = async () => {
    // refreshProfile is always an explicit user action — bypass the lock.
    fetchingRef.current = false;
    if (user) await fetchDoctorProfile(user.id);
  };

  useEffect(() => {
    let mounted = true;

    // Safety fallback: if auth init somehow hangs past 8s, unblock the UI.
    // Normal cold-start with a live DB should complete in < 2s.
    const fallbackTimer = setTimeout(() => {
      if (mounted) {
        console.warn('[AuthContext] Auth initialization fallback timeout — releasing loading state.');
        setLoading(false);
      }
    }, 8000);

    // ── Primary init: read the stored session from localStorage (synchronous
    // in practice) and fetch the doctor profile once. ──────────────────────
    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user) {
            await fetchDoctorProfile(session.user.id);
          } else {
            setDoctorProfile(null);
          }
          setLoading(false);
          clearTimeout(fallbackTimer);
        }
      } catch (err) {
        console.error('[AuthContext] Error during initial auth check:', err);
        if (mounted) {
          setDoctorProfile(null);
          setLoading(false);
          clearTimeout(fallbackTimer);
        }
      }
    };

    initAuth();

    // ── Auth state listener: handles sign-in, sign-out, and token refreshes
    // after the initial mount. INITIAL_SESSION is skipped because initAuth
    // already owns that moment — running both would fire duplicate DB fetches
    // that race each other and can together exceed the fallback timer. ───────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      // Skip INITIAL_SESSION — initAuth already handled it.
      if (event === 'INITIAL_SESSION') return;

      setSession(session);
      setUser(session?.user ?? null);

      try {
        if (session?.user) {
          await fetchDoctorProfile(session.user.id);
        } else {
          setDoctorProfile(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
          clearTimeout(fallbackTimer);
        }
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
      // 1. Immediately clear local UI state for a snappy response
      setUser(null);
      setSession(null);
      setDoctorProfile(null);

      // 2. Attempt to clear the Supabase session (local scope avoids network errors)
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch (err) {
      console.warn('[AuthContext] Sign out error:', err);
      // Fallback: forcefully clear storage and reload
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
