export interface GpxExtractedMeta {
  glider?: string;      // gaggle:wing
  harness?: string;     // gaggle:engine
  flightDate?: string;  // gaggle:takeoff date → YYYY-MM-DD
  firstLat?: number;    // lat of first trackpoint
  firstLon?: number;    // lon of first trackpoint
}

/**
 * Parse a GPX file's text content and extract Gaggle metadata plus the
 * takeoff coordinates from the first trackpoint.
 *
 * Uses DOMParser + getElementsByTagNameNS so namespace-prefixed elements
 * like <gaggle:wing> are found reliably regardless of how the prefix is declared.
 */
export function parseGpxMeta(xmlText: string): GpxExtractedMeta {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  } catch {
    return {};
  }

  if (doc.querySelector('parsererror')) return {};

  const result: GpxExtractedMeta = {};

  // --- Metadata extensions ---
  // Walk: <gpx> → <metadata> → <extensions>
  // getElementsByTagName matches regardless of namespace prefix.
  const metadataList = doc.getElementsByTagName('metadata');
  for (let i = 0; i < metadataList.length; i++) {
    const extList = metadataList[i].getElementsByTagName('extensions');
    if (extList.length === 0) continue;
    const ext = extList[0];

    // getElementsByTagNameNS('*', localName) matches <gaggle:wing>, <ns:wing>, etc.
    result.glider = nsText(ext, 'wing');
    result.harness = nsText(ext, 'engine');

    // The Gaggle app writes the date under several possible local names
    const rawDate =
      nsText(ext, 'takeoff_date') ??
      nsText(ext, 'takeoffDate') ??
      nsText(ext, 'takeoffdate') ??
      nsText(ext, 'takeoff date'); // try the literal string too (some parsers allow it)
    if (rawDate) result.flightDate = normaliseDate(rawDate);

    break; // only need first <metadata>
  }

  // --- First trackpoint coordinates ---
  const trkpts = doc.getElementsByTagName('trkpt');
  if (trkpts.length > 0) {
    const lat = parseFloat(trkpts[0].getAttribute('lat') ?? '');
    const lon = parseFloat(trkpts[0].getAttribute('lon') ?? '');
    if (!isNaN(lat) && !isNaN(lon)) {
      result.firstLat = lat;
      result.firstLon = lon;
    }
  }

  return result;
}

/**
 * Return the trimmed text content of the first element with the given local name
 * (ignoring namespace prefix) that is a descendant of `parent`.
 * Returns undefined if not found or empty.
 */
function nsText(parent: Element, localName: string): string | undefined {
  // Wildcard namespace URI matches any namespace (covers gaggle:, xsi:, etc.)
  const found = parent.getElementsByTagNameNS('*', localName);
  if (found.length > 0) {
    const text = found[0].textContent?.trim();
    if (text) return text;
  }
  // Also try without namespace (plain element with no prefix)
  const plain = parent.getElementsByTagName(localName);
  if (plain.length > 0) {
    const text = plain[0].textContent?.trim();
    if (text) return text;
  }
  return undefined;
}

/**
 * Attempt to extract YYYY-MM-DD from various date formats Gaggle might use.
 */
function normaliseDate(raw: string): string {
  const trimmed = raw.trim();
  // Already a bare date — return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  // Extract the date portion from a datetime string like "2026-02-16 06:52:17" or
  // "2026-02-16T06:52:17Z". Using the date portion directly avoids new Date() applying
  // a server/browser timezone offset that can shift the date to the previous day.
  const dateMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) return dateMatch[1];
  return trimmed;
}
