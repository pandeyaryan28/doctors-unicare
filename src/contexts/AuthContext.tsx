import React, { createContext, useContext, useEffect, useState } from 'react';
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

  const fetchDoctorProfile = async (userId: string) => {
    try {
      const { data: existing } = await supabase
        .from('doctors')
        .select('*')
        .eq('auth_user_id', userId)
        .single();

      if (existing) {
        setDoctorProfile(existing);
      } else {
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
            .single();

          if (createError) throw createError;
          if (created) setDoctorProfile(created);
        }
      }
    } catch (err) {
      console.error('Error in fetchDoctorProfile:', err);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchDoctorProfile(user.id);
  };

  useEffect(() => {
    let mounted = true;

    // Unconditional fallback: if everything hangs, release the loading UI after 3s
    const fallbackTimer = setTimeout(() => {
      if (mounted) {
        console.warn('Auth initialization fallback timeout — Releasing loading state.');
        setLoading(false);
      }
    }, 3000);

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
        }
      } catch (err) {
        console.error('Error during initial auth check:', err);
        if (mounted) {
          setDoctorProfile(null);
          setLoading(false);
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
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
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(fallbackTimer);
    };
  }, []);

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
      // 1. Immediately clear local UI state for snappy response
      setUser(null);
      setSession(null);
      setDoctorProfile(null);

      // 2. Attempt to clear Supabase session (use local scope to bypass network errors)
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch (err) {
      console.warn('Sign out error:', err);
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
