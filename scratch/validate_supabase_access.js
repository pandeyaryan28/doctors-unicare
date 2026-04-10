import { createClient } from '@supabase/supabase-js';

const PATIENT_SUPABASE_URL = 'https://vtuujzlscnxiyxokxntk.supabase.co';
const PATIENT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0dXVqemxzY254aXl4b2t4bnRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1Mzk3NDcsImV4cCI6MjA5MTExNTc0N30.iok1-xj0wPoVdxBI5wht1nL7hLzYJ9sl1XvlFKiRTOg';

const patientSupabase = createClient(PATIENT_SUPABASE_URL, PATIENT_SUPABASE_ANON_KEY);

async function validateAccess() {
  const packetId = 'cbe5bc29-2e5f-41eb-8e7a-135fb3cbace3';
  console.log(`Checking packet ${packetId}...`);
  
  const { data, error } = await patientSupabase
    .from('shared_packets')
    .select('*')
    .eq('id', packetId)
    .single();

  if (error) {
    console.error('Access Denied or Error:', error.message);
  } else {
    console.log('Access Success! Packet Title:', data.title);
  }
}

validateAccess();
