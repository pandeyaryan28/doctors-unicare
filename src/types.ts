export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  blood_group?: string;
  email?: string;
  address?: string;
}

export interface Consultation {
  id: string;
  patient_id: string;
  queue_id: string | null;
  symptoms: string;
  diagnosis: string;
  notes: string;
  medicines: Medicine[];
  created_at: string;
}

export interface Medicine {
  name: string;
  timing: ('morning' | 'noon' | 'evening')[];
  food: 'before' | 'after';
  days: number;
}

export interface QueueItem {
  id: string;
  patient_id: string;
  doctor_id: string;
  status: 'waiting' | 'in-consultation' | 'completed';
  token_number: number;
  chief_complaint: string | null;
  called_at: string | null;
  created_at: string;
  updated_at: string;
  patient?: Patient;
}

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'checked_in' | 'completed';

export interface Appointment {
  id: string;
  patient_unicare_appointment_id: string;
  doctor_id: string;
  patient_id: string | null;
  profile_id: string;
  patient_name: string;
  scheduled_at: string;   // ISO UTC
  timezone: string;
  status: AppointmentStatus;
  queue_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  patient?: Patient;      // joined via select
}

export interface PacketData {
  id: string;
  title: string;
  expires_at: string;
  profile_data: {
    name: string;
    dob: string;
    gender: string;
    blood_group: string;
    abha_id: string;
    phone: string;
    email: string;
    address: string;
  };
  medical_history: {
    question_id: string;
    question: string;
    answer: string;
  }[];
  records: {
    id: string;
    title: string;
    date: string;
    provider: string;
    type: string;
    file_url: string;
    file_name: string;
    file_type: string;
  }[];
}
