/**
 * patientIdentityService.ts
 *
 * Service layer for resolving UniCare patient identity codes (UC-XXXXXXXX)
 * from the patient DB. Implements:
 *   - QR/code content classification
 *   - Patient profile resolution with status gating
 *   - Age computation from DOB (SQL date type)
 */

import { patientSupabase } from '../lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PatientIdentityProfile {
  /** Patient DB UUID — use as source_profile_id in doctor DB */
  id: string;
  name: string;
  relation: string | null;
  dob: string | null;        // SQL date "YYYY-MM-DD"
  /** Computed client-side from dob */
  age: number;
  gender: string | null;
  blood_group: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  abha_id: string | null;
  emergency_contact: string | null;
  patient_code: string;
  patient_code_status: string;
  created_at: string;
}

export type QRContentType =
  | { type: 'patient_qr';     code: string }   // JSON: {v:1, type:"patient", code:"UC-..."}
  | { type: 'patient_code';   code: string }   // Plain text matching /^UC-[A-Z2-9]{8}$/
  | { type: 'shared_packet';  uuid: string }   // Plain UUID — shared visit packet
  | { type: 'unknown';        raw: string  };

// ── Charset / pattern constants ───────────────────────────────────────────────

/** UC- prefix + 8 chars from [A-Z2-9] (no O, 0, 1, I) */
const PATIENT_CODE_REGEX = /^UC-[A-Z2-9]{8}$/;

/** Loose UUID pattern (validates format only, not version/variant) */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── classifyQRContent ─────────────────────────────────────────────────────────

/**
 * Classifies the raw string decoded from a QR code (or typed by the user).
 *
 * Priority:
 *  1. Try JSON.parse → {v:1, type:"patient", code} → 'patient_qr'
 *  2. Matches /^UC-[A-Z2-9]{8}$/ → 'patient_code'
 *  3. Matches UUID shape → 'shared_packet'
 *  4. Else → 'unknown'
 */
export function classifyQRContent(raw: string): QRContentType {
  const trimmed = raw.trim();

  // 1. Try JSON
  try {
    const parsed = JSON.parse(trimmed);
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.v === 1 &&
      parsed.type === 'patient' &&
      typeof parsed.code === 'string' &&
      PATIENT_CODE_REGEX.test(parsed.code.trim().toUpperCase())
    ) {
      return { type: 'patient_qr', code: parsed.code.trim().toUpperCase() };
    }
  } catch {
    // Not JSON — continue
  }

  // 2. Plain patient code
  const upper = trimmed.toUpperCase();
  if (PATIENT_CODE_REGEX.test(upper)) {
    return { type: 'patient_code', code: upper };
  }

  // 3. UUID → shared visit packet
  if (UUID_REGEX.test(trimmed)) {
    return { type: 'shared_packet', uuid: trimmed };
  }

  return { type: 'unknown', raw: trimmed };
}

// ── computeAge ────────────────────────────────────────────────────────────────

/** Compute age in years from an ISO / SQL date string "YYYY-MM-DD". */
function computeAge(dob: string | null): number {
  if (!dob) return 0;
  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return Math.max(0, age);
}

// ── resolvePatientCode ────────────────────────────────────────────────────────

/**
 * Resolves a UC-XXXXXXXX patient code to a full profile from the patient DB.
 *
 * - Normalises input to uppercase before querying.
 * - Only resolves profiles where patient_code_status = 'active'.
 * - Throws descriptive errors for inactive codes, not-found, and network issues.
 * - The patient DB profiles table has RLS "Doctor App Select Profiles" = true,
 *   so anon/service reads are permitted. No RPC needed.
 */
export async function resolvePatientCode(
  code: string
): Promise<PatientIdentityProfile> {
  const normalised = code.trim().toUpperCase();

  if (!PATIENT_CODE_REGEX.test(normalised)) {
    throw new Error(`Invalid patient code format. Expected UC- followed by 8 characters.`);
  }

  // First check if the code exists regardless of status so we can give a
  // more helpful error if it's inactive vs simply not found.
  const { data, error } = await patientSupabase
    .from('profiles')
    .select(
      'id, name, relation, dob, gender, blood_group, phone, email, ' +
      'address, abha_id, emergency_contact, patient_code, ' +
      'patient_code_status, created_at'
    )
    .eq('patient_code', normalised)
    .maybeSingle();

  if (error) {
    console.error('[patientIdentityService] resolvePatientCode error:', error);
    throw new Error(`Network or database error: ${error.message}`);
  }

  if (!data) {
    throw new Error(
      `Patient code ${normalised} not found. Please verify the code with the patient.`
    );
  }

  if (data.patient_code_status !== 'active') {
    throw new Error(
      `Patient code ${normalised} is ${data.patient_code_status}. ` +
      `Only active codes can be used for patient intake. ` +
      `Ask the patient to check their UniCare app.`
    );
  }

  return {
    ...data,
    age: computeAge(data.dob),
  } as PatientIdentityProfile;
}
