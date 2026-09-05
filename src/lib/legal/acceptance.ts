export const TERMS_VERSION = "2026-09-06";
export const PRIVACY_VERSION = "2026-09-06";
export const LEGAL_ACCEPTANCE_VALUE = "accepted";

export function hasAcceptedLegalTerms(value: FormDataEntryValue | null): boolean {
  return value === LEGAL_ACCEPTANCE_VALUE;
}
