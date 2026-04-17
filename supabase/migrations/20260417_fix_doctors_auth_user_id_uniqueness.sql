-- ============================================================================
-- Migration: Fix doctors.auth_user_id uniqueness
-- Date: 2026-04-17
-- Purpose:
--   1. Safely deduplicate any rows that share the same auth_user_id,
--      keeping the most recently updated row and merging non-null fields
--      from older rows into the winner.
--   2. Enforce the UNIQUE constraint on auth_user_id (idempotent: skipped if
--      it already exists under any name).
-- ============================================================================

-- ── Step 1: Merge useful non-null fields from duplicate older rows ──────────
--
-- For each auth_user_id that has >1 row, find the "winner" (latest updated_at)
-- and update it with any non-null fields from the older duplicates that the
-- winner currently has NULL for.  We do this field-by-field for safety.
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT auth_user_id
    FROM public.doctors
    GROUP BY auth_user_id
    HAVING COUNT(*) > 1
  LOOP
    -- Update the winner row with non-null values from older rows
    UPDATE public.doctors winner
    SET
      specialty         = COALESCE(winner.specialty,         oldest.specialty),
      registration_number = COALESCE(winner.registration_number, oldest.registration_number),
      clinic_name       = COALESCE(winner.clinic_name,       oldest.clinic_name),
      clinic_address    = COALESCE(winner.clinic_address,    oldest.clinic_address),
      phone             = COALESCE(winner.phone,             oldest.phone),
      qualification     = COALESCE(winner.qualification,     oldest.qualification),
      avatar_url        = COALESCE(winner.avatar_url,        oldest.avatar_url),
      clinic_code       = COALESCE(winner.clinic_code,       oldest.clinic_code)
    FROM (
      -- Aggregate non-null fields from all non-winner rows
      SELECT
        auth_user_id,
        MAX(specialty)            AS specialty,
        MAX(registration_number)  AS registration_number,
        MAX(clinic_name)          AS clinic_name,
        MAX(clinic_address)       AS clinic_address,
        MAX(phone)                AS phone,
        MAX(qualification)        AS qualification,
        MAX(avatar_url)           AS avatar_url,
        MAX(clinic_code)          AS clinic_code
      FROM public.doctors
      WHERE auth_user_id = rec.auth_user_id
        AND id != (
          SELECT id FROM public.doctors
          WHERE auth_user_id = rec.auth_user_id
          ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
          LIMIT 1
        )
      GROUP BY auth_user_id
    ) oldest
    WHERE winner.auth_user_id = rec.auth_user_id
      AND winner.id = (
        SELECT id FROM public.doctors
        WHERE auth_user_id = rec.auth_user_id
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
        LIMIT 1
      );

    RAISE NOTICE 'Merged duplicate rows for auth_user_id=%', rec.auth_user_id;
  END LOOP;
END $$;

-- ── Step 2: Delete duplicate older rows (keep only the latest per auth_user_id)
DELETE FROM public.doctors
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY auth_user_id
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
      ) AS rn
    FROM public.doctors
  ) ranked
  WHERE rn > 1
);

-- ── Step 3: Enforce UNIQUE constraint (idempotent) ────────────────────────────
DO $$
BEGIN
  -- Only add if no unique constraint / index already covers auth_user_id
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'doctors'
      AND indexdef LIKE '%auth_user_id%'
      AND indexdef LIKE '%UNIQUE%'
  ) THEN
    ALTER TABLE public.doctors
      ADD CONSTRAINT doctors_auth_user_id_unique UNIQUE (auth_user_id);
    RAISE NOTICE 'Added UNIQUE constraint on doctors.auth_user_id';
  ELSE
    RAISE NOTICE 'UNIQUE constraint on doctors.auth_user_id already exists — skipping.';
  END IF;
END $$;
