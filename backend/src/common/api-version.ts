import type { Request, Response, NextFunction } from 'express';

/**
 * API contract version — MAJOR.MINOR.
 *
 * NOT the app release version (package.json, bumped on every release
 * including pure UI changes). This number changes only when the HTTP wire
 * contract itself changes, and is what the three known clients — the
 * in-repo React web frontend, the flightnow iOS app, and the FlightTV tvOS
 * app — negotiate against via the X-API-Version header.
 *
 * Bump by hand, in the same PR as the change:
 *   MAJOR — breaking change (removed/renamed endpoint or field, changed a
 *   request/response shape, changed auth mechanics). Reset MINOR to 0. A
 *   client built against a different MAJOR is rejected by
 *   apiVersionMiddleware below.
 *   MINOR — additive, backward-compatible change (new endpoint, new
 *   optional field/param). Existing clients keep working unmodified.
 * Plain bug fixes don't bump this — that's what package.json/git tags are
 * for. See docs/API.md "Versioning" for the client-facing contract.
 */
export const API_VERSION = {
  major: 1,
  minor: 3,
} as const;

export const API_VERSION_STRING = `${API_VERSION.major}.${API_VERSION.minor}`;

/**
 * Parses a client-declared X-API-Version header ("1" or "1.3"). Only MAJOR
 * is ever checked; MINOR is informational. Returns null on missing,
 * repeated, or unparseable input.
 */
export function parseClientApiVersion(
  raw: string | string[] | undefined,
): { major: number; minor: number } | null {
  if (!raw || Array.isArray(raw)) return null;
  const match = /^(\d+)(?:\.(\d+))?$/.exec(raw.trim());
  if (!match) return null;
  return { major: Number(match[1]), minor: match[2] !== undefined ? Number(match[2]) : 0 };
}

/**
 * Compatibility gate + version reporter, registered globally in main.ts
 * (after enableCors() so a 426 rejection still carries CORS headers).
 *
 *  - Always sets X-API-Version on the response.
 *  - No/malformed X-API-Version request header -> allow through (fail
 *    open; flightnow/FlightTV don't send it yet).
 *  - MAJOR matches server's -> allow through regardless of MINOR (an
 *    older-minor client just never calls newer routes/fields; a client
 *    expecting an unreleased MINOR gets an ordinary 404, not a version
 *    error).
 *  - MAJOR mismatch -> 426 Upgrade Required, before any Nest
 *    guard/pipe/handler runs.
 */
export function apiVersionMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-API-Version', API_VERSION_STRING);

  const clientVersion = parseClientApiVersion(req.headers['x-api-version']);

  if (clientVersion && clientVersion.major !== API_VERSION.major) {
    res.status(426).json({
      statusCode: 426,
      error: 'Upgrade Required',
      message: `This client was built for API v${clientVersion.major}.x, but the server is running v${API_VERSION_STRING}. Please update the app to continue.`,
      serverApiVersion: API_VERSION_STRING,
      clientApiVersion: `${clientVersion.major}.${clientVersion.minor}`,
    });
    return;
  }

  next();
}
