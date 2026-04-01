import { Injectable, BadRequestException } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import * as fs from 'fs/promises';

export interface RawTrackpoint {
  lat: number;
  lon: number;
  elevation: number | null; // metres AMSL, null if absent
  time: Date | null;        // null if absent
  // Gaggle per-point extensions (present only in Gaggle-recorded GPX files)
  gaggle_speed_mps?: number;
  gaggle_climb_rate_mps?: number;
  gaggle_agl_m?: number;
  gaggle_g_force?: number;
}

export interface GaggleMetadata {
  wing?: string;            // gaggle:wing → glider name
  engine?: string;          // gaggle:engine → harness/trike name
  takeoffDate?: string;     // gaggle:takeoff date → YYYY-MM-DD
  distance_m?: number;      // gaggle:distance (converted from km)
  max_speed_mps?: number;   // gaggle:maxSpeed (converted from km/h)
  duration_seconds?: number;// gaggle:duration (seconds)
  avg_speed_mps?: number;   // gaggle:averageSpeed (converted from km/h)
  max_altitude_m?: number;  // gaggle:maxAltitude (metres)
  max_climb_mps?: number;   // gaggle:maxClimb (m/s)
  max_g_force?: number;     // gaggle:maxGForce
  max_sink_mps?: number;    // gaggle:maxSink (m/s, stored as negative)
  fuel_consumed?: number;   // gaggle:fuelConsumed
}

export interface ParsedGpxData {
  metadata: {
    name?: string;
    description?: string;
    author?: string;
    time?: Date;
  };
  gaggle?: GaggleMetadata;
  trackpoints: RawTrackpoint[];
  segmentCount: number;
  /**
   * True when every trackpoint timestamp with a timezone indicator used 'Z' or
   * an explicit UTC offset (+HH:MM / -HH:MM).  False when timestamps were written
   * without any timezone indicator — the Gaggle app sometimes does this, writing
   * the local clock time directly without a Z suffix.
   *
   * Use this flag to decide how to display times:
   *   true  → timestamps are real UTC; browser can safely localise them.
   *   false → timestamps store local clock values as if they were UTC;
   *            display using UTC getters (no browser timezone conversion).
   */
  timestampsAreUtc: boolean;
}

@Injectable()
export class GpxParserService {
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: true,
    parseTagValue: true,
    isArray: (tagName) =>
      ['trk', 'trkseg', 'trkpt', 'wpt', 'rte', 'rtept'].includes(tagName),
  });

  /**
   * Parse a GPX file from disk and return normalized raw trackpoints.
   * Throws BadRequestException on malformed or empty files.
   */
  async parseGpxFile(filePath: string): Promise<ParsedGpxData> {
    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch {
      throw new BadRequestException('Could not read GPX file from storage');
    }

    return this.parseGpxString(content);
  }

  /**
   * Parse a GPX XML string and return normalized raw trackpoints.
   * Exposed separately for unit-testing.
   */
  parseGpxString(xml: string): ParsedGpxData {
    // Guard against XML bomb / entity expansion before parsing
    if (xml.length > 52_428_800) {
      throw new BadRequestException('GPX file exceeds maximum allowed size');
    }
    if (/<!ENTITY/i.test(xml)) {
      throw new BadRequestException('GPX file contains disallowed XML entities');
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = this.parser.parse(xml) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('Failed to parse GPX file: invalid XML');
    }

    const gpx = parsed['gpx'] as Record<string, unknown> | undefined;
    if (!gpx) {
      throw new BadRequestException('File does not appear to be a valid GPX document (missing <gpx> root element)');
    }

    const metadata = this.extractMetadata(gpx);
    const gaggle = this.extractGaggleMetadata(gpx);
    const { trackpoints, segmentCount, timestampsAreUtc } = this.extractTrackpoints(gpx);

    if (trackpoints.length === 0) {
      throw new BadRequestException('GPX file contains no trackpoints');
    }

    return { metadata, gaggle, trackpoints, segmentCount, timestampsAreUtc };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private extractMetadata(gpx: Record<string, unknown>) {
    const raw = gpx['metadata'] as Record<string, unknown> | undefined;
    return {
      name: raw?.['name'] as string | undefined,
      description: raw?.['desc'] as string | undefined,
      author: (raw?.['author'] as Record<string, unknown>)?.['name'] as string | undefined,
      time: raw?.['time'] ? this.parseTimestamp(raw['time'] as string) ?? undefined : undefined,
    };
  }

  private extractTrackpoints(gpx: Record<string, unknown>): {
    trackpoints: RawTrackpoint[];
    segmentCount: number;
    timestampsAreUtc: boolean;
  } {
    const tracks = (gpx['trk'] as unknown[]) ?? [];
    const trackpoints: RawTrackpoint[] = [];
    let segmentCount = 0;
    let utcCount = 0;
    let localCount = 0;

    for (const trk of tracks) {
      const trkObj = trk as Record<string, unknown>;
      const segments = (trkObj['trkseg'] as unknown[]) ?? [];
      for (const seg of segments) {
        segmentCount++;
        const segObj = seg as Record<string, unknown>;
        const points = (segObj['trkpt'] as unknown[]) ?? [];
        for (const pt of points) {
          const ptObj = pt as Record<string, unknown>;
          const lat = ptObj['@_lat'] as number | undefined;
          const lon = ptObj['@_lon'] as number | undefined;
          if (lat === undefined || lon === undefined) continue;

          const eleRaw = ptObj['ele'];
          const elevation = eleRaw !== undefined && eleRaw !== null
            ? Number(eleRaw)
            : null;

          const timeRaw = ptObj['time'];
          let time: Date | null = null;
          if (timeRaw) {
            const rawStr = String(timeRaw).trim();
            // Track whether this file uses UTC-indicated timestamps or bare local times
            if (this.hasTimezoneIndicator(rawStr)) {
              utcCount++;
            } else {
              localCount++;
            }
            time = this.parseTimestamp(rawStr);
          }

          // Gaggle per-point extensions
          const ext = ptObj['extensions'] as Record<string, unknown> | undefined;
          const tp: RawTrackpoint = { lat, lon, elevation, time };
          if (ext) {
            const speedRaw = ext['gaggle:speed'] ?? ext['speed'];
            if (speedRaw !== undefined && speedRaw !== null) {
              // Gaggle reports speed in km/h
              tp.gaggle_speed_mps = Number(speedRaw) / 3.6;
            }
            const climbRaw = ext['gaggle:climbRate'] ?? ext['climbRate'];
            if (climbRaw !== undefined && climbRaw !== null) {
              tp.gaggle_climb_rate_mps = Number(climbRaw);
            }
            const aglRaw = ext['gaggle:agl'] ?? ext['agl'];
            if (aglRaw !== undefined && aglRaw !== null) {
              tp.gaggle_agl_m = Number(aglRaw);
            }
            const gForceRaw = ext['gaggle:gForce'] ?? ext['gForce'];
            if (gForceRaw !== undefined && gForceRaw !== null) {
              tp.gaggle_g_force = Number(gForceRaw);
            }
          }

          trackpoints.push(tp);
        }
      }
    }

    // A file is considered UTC if it has timestamps with timezone indicators and
    // none without. If only bare local timestamps are found, it's 'local'.
    // Mixed files (shouldn't happen) are treated as UTC for safety.
    const timestampsAreUtc = utcCount > 0 || localCount === 0;
    return { trackpoints, segmentCount, timestampsAreUtc };
  }

  private extractGaggleMetadata(gpx: Record<string, unknown>): GaggleMetadata | undefined {
    const metadata = gpx['metadata'] as Record<string, unknown> | undefined;
    if (!metadata) return undefined;

    const ext = metadata['extensions'] as Record<string, unknown> | undefined;
    if (!ext) return undefined;

    const result: GaggleMetadata = {};
    let hasAny = false;

    const str = (key: string): string | undefined => {
      const v = ext[key];
      if (v === undefined || v === null) return undefined;
      return String(v).trim() || undefined;
    };
    const num = (key: string): number | undefined => {
      const v = ext[key];
      if (v === undefined || v === null) return undefined;
      const n = Number(v);
      return isNaN(n) ? undefined : n;
    };

    const wing = str('gaggle:wing');
    if (wing) { result.wing = wing; hasAny = true; }

    const engine = str('gaggle:engine');
    if (engine) { result.engine = engine; hasAny = true; }

    const takeoffDate = str('gaggle:takeoff date');
    if (takeoffDate) { result.takeoffDate = takeoffDate; hasAny = true; }

    // Distance: Gaggle stores in km, convert to metres
    const distKm = num('gaggle:distance');
    if (distKm !== undefined) { result.distance_m = distKm * 1000; hasAny = true; }

    // Speeds: Gaggle stores in km/h, convert to m/s
    const maxSpeedKph = num('gaggle:maxSpeed');
    if (maxSpeedKph !== undefined) { result.max_speed_mps = maxSpeedKph / 3.6; hasAny = true; }

    const avgSpeedKph = num('gaggle:averageSpeed');
    if (avgSpeedKph !== undefined) { result.avg_speed_mps = avgSpeedKph / 3.6; hasAny = true; }

    const duration = num('gaggle:duration');
    if (duration !== undefined) { result.duration_seconds = duration; hasAny = true; }

    const maxAlt = num('gaggle:maxAltitude');
    if (maxAlt !== undefined) { result.max_altitude_m = maxAlt; hasAny = true; }

    const maxClimb = num('gaggle:maxClimb');
    if (maxClimb !== undefined) { result.max_climb_mps = maxClimb; hasAny = true; }

    const maxGForce = num('gaggle:maxGForce');
    if (maxGForce !== undefined) { result.max_g_force = maxGForce; hasAny = true; }

    const maxSink = num('gaggle:maxSink');
    if (maxSink !== undefined) { result.max_sink_mps = maxSink; hasAny = true; }

    const fuelConsumed = num('gaggle:fuelConsumed');
    if (fuelConsumed !== undefined) { result.fuel_consumed = fuelConsumed; hasAny = true; }

    return hasAny ? result : undefined;
  }

  /** Returns true when the raw timestamp string carries explicit timezone info
   *  (trailing 'Z' for UTC, or a numeric offset like +10:00 / -05:30). */
  private hasTimezoneIndicator(raw: string): boolean {
    const t = raw.trim();
    return t.endsWith('Z') || t.endsWith('z') || /[+-]\d{2}:?\d{2}$/.test(t);
  }

  private parseTimestamp(raw: string): Date | null {
    if (!raw) return null;
    const trimmed = raw.trim();
    // If there is no timezone indicator the Gaggle app wrote a bare local clock
    // value. Append 'Z' so that JavaScript treats the written digits as UTC,
    // preserving the numeric clock value through the UTC round-trip. The
    // flight.timezone flag ('UTC' vs 'local') tells the frontend how to display.
    const normalised = this.hasTimezoneIndicator(trimmed) ? trimmed : trimmed + 'Z';
    const d = new Date(normalised);
    return isNaN(d.getTime()) ? null : d;
  }
}
