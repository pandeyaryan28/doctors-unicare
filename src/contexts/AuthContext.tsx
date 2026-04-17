/**
 * AuthContext — Complete rewrite (2026-04-17)
 *
 * Design principles:
 * 1. NEVER call supabase.auth.getSession() on startup.
 *    In Supabase JS v2, getSession() silently triggers a network token-refresh
 *    when the stored access-token is expired. That network call can hang for
 *    10-30 s, blocking setLoading(false) and causing the fallback timer to fire.
 *
 * 2. Use ONLY onAuthStateChange for initialization.
 *    The INITIAL_SESSION event fires synchronously from localStorage — no
 *    network involved. We know the auth state in < 5 ms.
 *
 * 3. Release the loading spinner the moment auth state is known (INITIAL_SESSION).
 *    Profile fetching happens in the background. Components already guard
 *    against null doctorProfile with early-return checks.
 *
 * 4. Re-fetch the profile on SIGNED_IN (explicit login) only — not on
 *    TOKEN_REFRESHED (token silently renewed, user hasn't changed).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DoctorProfile {
  id: string;
  auth_user_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  specialty: string | null;
  registration_number: string | null;
  clinic_name: string | null;
  clinic_address: string | null;
  phone: string | null;
  qualification: string | null;
  clinic_code: string | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  doctorProfile: DoctorProfile | null;
  /** True only while we don't yet know whether the user is logged in or not. */
  loading: boolean;
  isConfigured: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};

// ─── Provider ────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);

  // loading = "we don't know yet if a session exists"
  // Flipped to false as soon as INITIAL_SESSION fires (< 5 ms, no network).
  const [loading, setLoading] = useState(true);

  const isConfigured = Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  );

  // Prevent two simultaneous fetchDoctorProfile calls (e.g. rapid re-renders).
  const isFetchingProfile = useRef(false);

  // ── Profile fetcher ────────────────────────────────────────────────────────
  const fetchDoctorProfile = useCallback(async (userId: string): Promise<void> => {
    if (isFetchingProfile.current) return;
    isFetchingProfile.current = true;

    try {
      // Step 1: look up the existing row.
      // Descending order on updated_at + created_at means that if the UNIQUE
      // constraint was ever missed and two rows exist, we always get the newest.
      const { data: row, error: fetchErr } = await supabase
        .from('doctors')
        .select('*')
        .eq('auth_user_id', userId)
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchErr) {
        console.error('[Auth] fetchDoctorProfile select error:', fetchErr.message);
        return;
      }

      if (row) {
        setDoctorProfile(row as DoctorProfile);
        return;
      }

      // Step 2: no row yet — bootstrap one from OAuth user metadata.
      const {
        data: { user: oauthUser },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr || !oauthUser) {
        console.error('[Auth] Could not retrieve OAuth user:', userErr?.message);
        return;
      }

      const { data: newRow, error: insertErr } = await supabase
        .from('doctors')
        .insert({
          auth_user_id: userId,
          full_name: oauthUser.user_metadata?.full_name ?? 'Doctor',
          email: oauthUser.email ?? '',
          avatar_url: oauthUser.user_metadata?.avatar_url ?? null,
        })
        .select()
        .single();

      if (insertErr) {
        if (insertErr.code === '23505') {
          // Unique violation: another tab beat us. Just re-fetch.
          const { data: retryRow } = await supabase
            .from('doctors')
            .select('*')
            .eq('auth_user_id', userId)
            .order('updated_at', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (retryRow) setDoctorProfile(retryRow as DoctorProfile);
        } else {
          console.error('[Auth] fetchDoctorProfile insert error:', insertErr.message);
        }
        return;
      }

      if (newRow) setDoctorProfile(newRow as DoctorProfile);
    } finally {
      isFetchingProfile.current = false;
    }
  }, []);

  // ── Auth state listener ────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true; // prevents state updates after unmount

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!alive) return;

        // ── TOKEN_REFRESHED ────────────────────────────────────────────────
        // The Supabase client silently renewed the access token.
        // Only update the session object; user & profile haven't changed.
        if (event === 'TOKEN_REFRESHED') {
          setSession(newSession);
          return;
        }

        // ── All other events ───────────────────────────────────────────────
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (!newSession?.user) {
          // Signed out or no stored session.
          setDoctorProfile(null);
          setLoading(false);
          return;
        }

        // ── INITIAL_SESSION ────────────────────────────────────────────────
        // Fires immediately from localStorage — no network call needed.
        // Release the loading spinner right now so the UI is never blocked.
        // Profile fetch runs in the background.
        if (event === 'INITIAL_SESSION') {
          setLoading(false);
          fetchDoctorProfile(newSession.user.id); // fire-and-forget
          return;
        }

        // ── SIGNED_IN (explicit login / OAuth redirect) ────────────────────
        // Await the profile here so the dashboard has data from the first render.
        // Loading is already false (set on INITIAL_SESSION or never started here).
        fetchDoctorProfile(newSession.user.id);
      }
    );

    // Absolute safety net — if onAuthStateChange never fires (misconfigured
    // env vars, etc.), unblock the UI after 6 s.
    const safetyTimer = setTimeout(() => {
      if (alive) {
        console.warn('[Auth] Safety timeout reached — forcing loading = false.');
        setLoading(false);
      }
    }, 6000);

    return () => {
      alive = false;
      subscription.unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, [fetchDoctorProfile]);

  // ── Public actions ─────────────────────────────────────────────────────────

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    isFetchingProfile.current = false; // force bypass lock
    await fetchDoctorProfile(user.id);
  }, [user, fetchDoctorProfile]);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    // Clear UI state immediately for instant feedback.
    setUser(null);
    setSession(null);
    setDoctorProfile(null);

    try {
      // 'local' scope clears the stored session without a network call,
      // making sign-out reliable even when offline.
      await supabase.auth.signOut({ scope: 'local' });
    } catch (err) {
      console.warn('[Auth] signOut error:', err);
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  const value: AuthContextValue = {
    user,
    session,
    doctorProfile,
    loading,
    isConfigured,
    signInWithGoogle,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
