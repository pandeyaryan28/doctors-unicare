import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('CRITICAL: Missing Primary Supabase environment variables. Check your .env file or production environment settings.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const patientSupabaseUrl = import.meta.env.VITE_PATIENT_SUPABASE_URL || '';
const patientSupabaseAnonKey = import.meta.env.VITE_PATIENT_SUPABASE_ANON_KEY || '';

if (!patientSupabaseUrl || !patientSupabaseAnonKey) {
  console.warn('WARNING: Missing Patient Supabase environment variables. Patient health packet importing will not work.');
}

export const patientSupabase = createClient(patientSupabaseUrl, patientSupabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      doctors: {
        Row: {
          id: string;
          auth_user_id: string;
          full_name: string;
          email: string;
          avatar_url: string | null;
          specialty: string | null;
          registration_number: string | null;
          clinic_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['doctors']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['doctors']['Insert']>;
      };
      patients: {
        Row: {
          id: string;
          doctor_id: string;
          name: string;
          age: number | null;
          gender: string | null;
          phone: string | null;
          email: string | null;
          dob: string | null;
          blood_group: string | null;
          abha_id: string | null;
          address: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['patients']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['patients']['Insert']>;
      };
      queue: {
        Row: {
          id: string;
          doctor_id: string;
          patient_id: string;
          status: 'waiting' | 'in-consultation' | 'completed';
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['queue']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['queue']['Insert']>;
      };
      consultations: {
        Row: {
          id: string;
          doctor_id: string;
          patient_id: string;
          symptoms: string | null;
          diagnosis: string | null;
          notes: string | null;
          medicines: any[];
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['consultations']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['consultations']['Insert']>;
      };
    };
  };
};
