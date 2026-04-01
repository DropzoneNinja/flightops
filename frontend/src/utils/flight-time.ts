/**
 * Timezone-aware flight time formatting.
 *
 * The Gaggle app writes trackpoint <time> elements inconsistently:
 *
 *   With Z suffix  → real UTC.  The backend stores these as true UTC.
 *                    Display by converting to the browser's local timezone
 *                    (toLocaleTimeString does this automatically).
 *
 *   Without Z      → local clock time, no timezone indicator.  The backend
 *                    appends 'Z' before parsing so the written digits are
 *                    preserved as UTC values.  Display by reading the UTC
 *                    clock getters directly — no browser conversion.
 *
 * The flight.timezone field carries this distinction:
 *   'UTC'   → timestamps are true UTC  → use toLocaleTimeString()
 *   'local' → timestamps are local-as-UTC → use UTC getters
 *   (default 'UTC' for flights parsed before this fix)
 */

/** Format a unix-ms timestamp as HH:MM:SS for flight display. */
export function formatFlightTime(unixMs: number, timezone: string | null | undefined): string {
  const d = new Date(unixMs);
  if (!timezone || timezone === 'UTC') {
    // True UTC — let the browser convert to its local timezone
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  // 'local': stored value equals display value — read UTC clock digits directly
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/** Same as formatFlightTime but omits seconds. */
export function formatFlightTimeShort(unixMs: number, timezone: string | null | undefined): string {
  const d = new Date(unixMs);
  if (!timezone || timezone === 'UTC') {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/** Format a timestamp ISO string (as stored on trackpoints/events). */
export function formatFlightTimestamp(ts: string | null | undefined, timezone: string | null | undefined): string {
  if (!ts) return '—';
  return formatFlightTime(new Date(ts).getTime(), timezone);
}
