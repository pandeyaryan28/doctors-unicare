/**
 * qrPayload.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared helper that produces the structured JSON payload embedded in the
 * doctor / clinic QR code.
 *
 * Format (v1):
 *   { "v": 1, "type": "doctor", "code": "<CLINIC_CODE>" }
 *
 * The UniCare patient app scanner already handles this shape:
 *   classifyQRContent parses JSON → looks for type === "doctor" → resolves code.
 *
 * WHY JSON instead of a URL?
 *   - Decouples QR from any URL route structure.
 *   - Scanner works reliably inside the UniCare app without deep-link setup.
 *   - External phone camera scanning the QR won't auto-open a browser page —
 *     this is an accepted trade-off for the "scan inside UniCare app" workflow.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Regex that validates the 6-character DRxxxx clinic code format. */
const CLINIC_CODE_RE = /^DR[A-Z0-9]{4}$/;

/**
 * Builds the JSON string that should be embedded as QR data for a doctor card.
 *
 * @param clinicCode - Uppercase 6-char clinic code, e.g. "DR3F2A"
 * @returns Compact JSON string, e.g. `{"v":1,"type":"doctor","code":"DR3F2A"}`
 * @throws Error if clinicCode fails the DRxxxx format validation.
 */
export function buildDoctorQrPayload(clinicCode: string): string {
  const code = clinicCode.trim().toUpperCase();
  if (!CLINIC_CODE_RE.test(code)) {
    throw new Error(
      `buildDoctorQrPayload: invalid clinic code "${code}". Expected DRxxxx (6 chars, uppercase).`
    );
  }
  return JSON.stringify({ code });
}
