/**
 * patientResolverService.ts
 *
 * Centralized "resolve-or-upsert" service for doctor-side patient records.
 *
 * All patient intake handlers (UC code scan, QR packet, appointment confirm,
 * appointment check-in, walk-in add) MUST go through resolveOrUpsertPatient()
 * to guarantee that the same UniCare user always maps to exactly one local
 * patient row per doctor.
 *
 * Resolution priority (strict):
 *   1. source_profile_id  — UUID from UniCare profiles.id (strongest signal)
 *   2. patient_code       — UC-XXXXXXXX (reliable secondary)
 *   3. phone              — only when phone is non-null AND uniquely matches
 *                           exactly one existing row (guarded fallback, logged)
 *   4. create new row     — if none of the above match
 *
 * Identity fields (source_profile_id, patient_code, identity_source,
 * last_identity_sync_at) are ALWAYS written on upsert/update so that the
 * record is strengthened even if it was created via a weaker signal earlier.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Patient, IdentitySource } from '../types';

// ── Input type ────────────────────────────────────────────────────────────────

export interface IdentitySignals {
  /** UUID from UniCare profiles.id — strongest canonical identity */
  source_profile_id?: string | null;
  /** UC-XXXXXXXX patient code */
  patient_code?: string | null;
  /** Patient's display name (required for row creation) */
  name: string;
  age?: number;
  gender?: string | null;
  phone?: string | null;
  email?: string | null;
  blood_group?: string | null;
  address?: string | null;
  abha_id?: string | null;
  dob?: string | null;
  /** Why / how this patient is being registered */
  identity_source: IdentitySource;
}

// ── Resolution result ─────────────────────────────────────────────────────────

export interface ResolveResult {
  patient: Patient;
  /** true = an existing row was found and (optionally) enriched */
  matched: boolean;
  /** which field was used to match */
  matchedOn: 'source_profile_id' | 'patient_code' | 'phone' | 'created';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build the payload that is always written when creating or enriching a row. */
function identityPayload(signals: IdentitySignals) {
  return {
    source_profile_id: signals.source_profile_id ?? null,
    patient_code: signals.patient_code ?? null,
    identity_source: signals.identity_source,
    last_identity_sync_at: new Date().toISOString(),
  };
}

/** Build the full row payload used when creating a brand-new patient. */
function createPayload(doctorId: string, signals: IdentitySignals) {
  return {
    doctor_id: doctorId,
    name: signals.name,
    age: signals.age ?? 0,
    gender: signals.gender ?? 'Not specified',
    phone: signals.phone ?? null,
    email: signals.email ?? null,
    blood_group: signals.blood_group ?? null,
    address: signals.address ?? null,
    abha_id: signals.abha_id ?? null,
    dob: signals.dob ?? null,
    ...identityPayload(signals),
  };
}

// ── resolveOrUpsertPatient ────────────────────────────────────────────────────

/**
 * Resolves (or creates) a local patient row for the given doctor using the
 * supplied identity signals. Always call this instead of ad-hoc insert/update.
 *
 * @param signals    Identity signals — must include name; all others optional
 * @param doctorId   The currently authenticated doctor's profile ID
 * @param db         The *doctor-side* Supabase client (not the patient DB)
 */
export async function resolveOrUpsertPatient(
  signals: IdentitySignals,
  doctorId: string,
  db: SupabaseClient
): Promise<ResolveResult> {
  // ── 1. Match by source_profile_id ─────────────────────────────────────────
  if (signals.source_profile_id) {
    const { data: existing } = await db
      .from('patients')
      .select('*')
      .eq('doctor_id', doctorId)
      .eq('source_profile_id', signals.source_profile_id)
      .maybeSingle();

    if (existing) {
      console.info('[resolver] matched by source_profile_id:', existing.id);
      // Enrich with any new identity fields (e.g. patient_code now known)
      const { data: updated } = await db
        .from('patients')
        .update({
          ...identityPayload(signals),
          // Enrich demographic fields only if we have richer data now
          ...(signals.blood_group ? { blood_group: signals.blood_group } : {}),
          ...(signals.phone ? { phone: signals.phone } : {}),
          ...(signals.email ? { email: signals.email } : {}),
        })
        .eq('id', existing.id)
        .select()
        .single();
      return { patient: (updated ?? existing) as Patient, matched: true, matchedOn: 'source_profile_id' };
    }
  }

  // ── 2. Match by patient_code ───────────────────────────────────────────────
  if (signals.patient_code) {
    const { data: existing } = await db
      .from('patients')
      .select('*')
      .eq('doctor_id', doctorId)
      .eq('patient_code', signals.patient_code)
      .maybeSingle();

    if (existing) {
      console.info('[resolver] matched by patient_code:', existing.id);
      const { data: updated } = await db
        .from('patients')
        .update({
          ...identityPayload(signals),
          ...(signals.source_profile_id ? { source_profile_id: signals.source_profile_id } : {}),
          ...(signals.blood_group ? { blood_group: signals.blood_group } : {}),
          ...(signals.phone ? { phone: signals.phone } : {}),
          ...(signals.email ? { email: signals.email } : {}),
        })
        .eq('id', existing.id)
        .select()
        .single();
      return { patient: (updated ?? existing) as Patient, matched: true, matchedOn: 'patient_code' };
    }
  }

  // ── 3. Guarded phone fallback ──────────────────────────────────────────────
  if (signals.phone) {
    const { data: phoneMatches } = await db
      .from('patients')
      .select('*')
      .eq('doctor_id', doctorId)
      .eq('phone', signals.phone);

    if (phoneMatches && phoneMatches.length === 1) {
      console.warn(
        '[resolver] phone fallback used — consider re-scanning UC code to strengthen identity.',
        { phone: signals.phone, patientId: phoneMatches[0].id }
      );
      const existing = phoneMatches[0];
      // Only enrich identity if we have canonical signals (don't overwrite
      // a stronger identity on an existing row with a weaker one)
      const shouldEnrichIdentity =
        (signals.source_profile_id && !existing.source_profile_id) ||
        (signals.patient_code && !existing.patient_code);

      if (shouldEnrichIdentity) {
        const { data: updated } = await db
          .from('patients')
          .update(identityPayload(signals))
          .eq('id', existing.id)
          .select()
          .single();
        return { patient: (updated ?? existing) as Patient, matched: true, matchedOn: 'phone' };
      }
      return { patient: existing as Patient, matched: true, matchedOn: 'phone' };
    } else if (phoneMatches && phoneMatches.length > 1) {
      console.warn('[resolver] phone matches multiple patients — skipping phone fallback', {
        phone: signals.phone,
        count: phoneMatches.length,
      });
    }
  }

  // ── 4. Create new row ──────────────────────────────────────────────────────
  console.info('[resolver] no match found — creating new patient row', {
    name: signals.name,
    identity_source: signals.identity_source,
  });
  const { data: created, error } = await db
    .from('patients')
    .insert(createPayload(doctorId, signals))
    .select()
    .single();

  if (error) {
    // Handle race condition: unique constraint violation means another tab
    // or request already created the row. Re-fetch by source_profile_id.
    if (error.code === '23505' && signals.source_profile_id) {
      const { data: raceWinner } = await db
        .from('patients')
        .select('*')
        .eq('doctor_id', doctorId)
        .eq('source_profile_id', signals.source_profile_id)
        .single();
      if (raceWinner) {
        console.warn('[resolver] race-condition insert conflict — re-fetched existing row', raceWinner.id);
        return { patient: raceWinner as Patient, matched: true, matchedOn: 'source_profile_id' };
      }
    }
    throw error;
  }

  return { patient: created as Patient, matched: false, matchedOn: 'created' };
}
