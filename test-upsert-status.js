import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function test() {
  const toUpsert = [{
    patient_unicare_appointment_id: "872ca7ad-2a81-4d17-94ed-6b88bf1036a6",
    doctor_id: "401d05f6-436e-4249-b415-5a0c0b7530a5",
    profile_id: "90d529c9-b820-4429-84f2-3884b2f5c88a",
    patient_name: "Shruti",
    scheduled_at: "2026-04-13T09:00:00+00:00",
    timezone: "Asia/Kolkata",
    status: "upcoming",
    notes: "REYEYY3"
  }];

  const res = await supabase.from('appointments').upsert(toUpsert, { onConflict: 'patient_unicare_appointment_id' });
  console.log('Status:', res.status);
  console.log('Error:', res.error);
}

test();
