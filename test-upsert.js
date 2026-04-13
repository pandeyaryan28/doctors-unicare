import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);
const patientSupabase = createClient(
  process.env.VITE_PATIENT_SUPABASE_URL,
  process.env.VITE_PATIENT_SUPABASE_ANON_KEY
);

async function test() {
  // Try doing exactly what syncPatientAppointmentsToLocal does
  const { data: extAppts, error: err1 } = await patientSupabase
        .from('appointments')
        .select('*, profiles(name)')
        .not('doctor_id', 'is', null);
  
  if (err1) throw err1;

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

  console.log('Trying to upsert:', JSON.stringify(toUpsert, null, 2));

  const { data, error } = await supabase.from('appointments').upsert(toUpsert, { onConflict: 'patient_unicare_appointment_id' });
  console.log('Upsert Data:', data);
  console.log('Upsert Error:', JSON.stringify(error, null, 2));
}

test();
