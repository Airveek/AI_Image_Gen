/**
 * Read GA4's stable client identifier from the first-party `_ga` cookie.
 *
 * The signed Airveek acquisition cookie remains the preferred identity for
 * attribution. This is only a fallback for the short window where the
 * consent-gated attribution request and the first Measurement Protocol event
 * can race. The value is already a GA4 pseudonymous identifier; it is never
 * logged or persisted independently by this helper.
 */
export function readGaClientIdFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader || cookieHeader.length > 16_000) return null;
  const raw = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("_ga="))
    ?.slice(4) ?? "";
  if (!raw) return null;

  let value = raw;
  try { value = decodeURIComponent(raw); } catch { /* keep the raw cookie value */ }
  const match = /^GA\d+\.\d+\.(\d+)\.(\d+)$/.exec(value);
  return match ? `${match[1]}.${match[2]}` : null;
}
