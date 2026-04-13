import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const patientSupabase = createClient(
  process.env.VITE_PATIENT_SUPABASE_URL,
  process.env.VITE_PATIENT_SUPABASE_ANON_KEY
);

const serviceSupabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Wait, do we have service role key? Let's check environment.
);

async function test() {
  const { data: extAppts, error: err1 } = await patientSupabase
        .from('appointments')
        .select('*, profiles(name)')
        .eq('doctor_id', '401d05f6-436e-4249-b415-5a0c0b7530a5');

  if (!extAppts) {
    console.log("No appointments fetched!");
    return;
  }

  const toUpsert = extAppts.map((a) => ({
    patient_unicare_appointment_id: a.id || null,
    doctor_id: a.doctor_id || null,
    profile_id: a.profile_id || null,
    patient_name: a.profiles?.name || a.title || 'Unknown Patient',
    scheduled_at: a.date || null,
    timezone: a.timezone || 'Asia/Kolkata',
    status: a.status || 'pending',
    notes: a.notes || null,
  }));

  console.log('Array to upsert:', JSON.parse(JSON.stringify(toUpsert)));
  
  // Notice we use the service rule key to bypass RLS
  const { data, error } = await serviceSupabase.from('appointments').upsert(toUpsert, { onConflict: 'patient_unicare_appointment_id' });
  
  console.log("Result:", data, error);
}

test();
