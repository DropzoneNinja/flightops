import { LogbookMergeService } from './logbook-merge.service';
import { LogbookEntry } from '../database/entities/logbook-entry.entity';

// isMatch/detectConflict are private — this is deliberately a white-box test
// of the tolerance constants, exercised via `as any` rather than expanding
// the public API just for test access.
const service = new LogbookMergeService({} as any, {} as any);
const svc = service as any;

// Merricks-ish coordinates, matching the real-world report this feature was built from.
const BASE_LAT = -38.36;
const BASE_LON = 145.13;

function fn(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    startAt: new Date('2026-08-16T02:00:00Z'),
    endAt: new Date('2026-08-16T02:18:00Z'),
    takeoffLat: BASE_LAT,
    takeoffLon: BASE_LON,
    durationSeconds: 1080, // 18m
    distanceM: 13600,
    maxAltitudeM: 1056,
    ...overrides,
  };
}

function web(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    startAt: new Date('2026-08-16T02:00:30Z'),
    endAt: new Date('2026-08-16T02:15:30Z'), // ~2.5 min shorter, mirrors real report skew
    bbox: { minLat: BASE_LAT - 0.01, minLon: BASE_LON - 0.01, maxLat: BASE_LAT + 0.01, maxLon: BASE_LON + 0.01 },
    durationSeconds: 900, // 15m
    distanceM: 13550,
    maxAltitudeM: 1050,
    ...overrides,
  };
}

describe('LogbookMergeService.isMatch', () => {
  it('matches the same real flight despite duration skew, per the reported bug', () => {
    expect(svc.isMatch(fn(), web())).toBe(true);
  });

  it('rejects when time windows do not overlap even with a generous buffer', () => {
    const laterWeb = web({
      startAt: new Date('2026-08-16T02:40:00Z'),
      endAt: new Date('2026-08-16T02:53:00Z'),
    });
    expect(svc.isMatch(fn(), laterWeb)).toBe(false);
  });

  it('rejects two genuinely separate back-to-back flights at the same site/day', () => {
    // Real turnaround time: ~20 min after the first flight lands.
    const secondFlight = fn({
      startAt: new Date('2026-08-16T02:38:00Z'),
      endAt: new Date('2026-08-16T02:51:00Z'),
      durationSeconds: 780,
      distanceM: 9300,
      maxAltitudeM: 1113,
    });
    expect(svc.isMatch(secondFlight, web())).toBe(false);
  });

  it('rejects when the takeoff point is far outside the bbox', () => {
    const farAway = fn({ takeoffLat: BASE_LAT + 5, takeoffLon: BASE_LON + 5 });
    expect(svc.isMatch(farAway, web())).toBe(false);
  });

  it('accepts a takeoff point just inside the place buffer around the bbox', () => {
    // ~300m outside the bbox edge, under the 400m buffer.
    const justOutside = fn({ takeoffLat: BASE_LAT - 0.01 - 0.0027 });
    expect(svc.isMatch(justOutside, web())).toBe(true);
  });

  it('rejects when only one of three stats is comparable and it disagrees', () => {
    const onlyDuration = fn({ distanceM: null, maxAltitudeM: null, durationSeconds: 3000 });
    const onlyDurationWeb = web({ distanceM: null, maxAltitudeM: null });
    expect(svc.isMatch(onlyDuration, onlyDurationWeb)).toBe(false);
  });

  it('accepts when 2 of 3 stats agree even if the third is off', () => {
    const oneOff = fn({ maxAltitudeM: 2000 }); // altitude wildly off
    expect(svc.isMatch(oneOff, web())).toBe(true); // duration + distance still agree
  });

  it('rejects when no stats are comparable at all, even with matching time/place', () => {
    const noStats = fn({ durationSeconds: null, distanceM: null, maxAltitudeM: null });
    expect(svc.isMatch(noStats, web())).toBe(false);
  });

  it('rejects when time data is missing on either side', () => {
    expect(svc.isMatch(fn({ startAt: null }), web())).toBe(false);
    expect(svc.isMatch(fn(), web({ endAt: null }))).toBe(false);
  });
});

describe('LogbookMergeService.detectConflict', () => {
  const base = (overrides: Partial<LogbookEntry> = {}): LogbookEntry =>
    ({
      id: 'entry-1',
      flight_number_override: null,
      wing_id: null,
      paramotor_id: null,
      ...overrides,
    } as LogbookEntry);

  it('returns null when neither side has an override or equipment set', () => {
    expect(svc.detectConflict(base(), base({ id: 'entry-2' }))).toBeNull();
  });

  it('returns null when only one side has a flight_number_override', () => {
    const a = base({ flight_number_override: 5 });
    const b = base({ id: 'entry-2' });
    expect(svc.detectConflict(a, b)).toBeNull();
  });

  it('flags a real conflict when both sides set a different flight_number_override', () => {
    const a = base({ flight_number_override: 5 });
    const b = base({ id: 'entry-2', flight_number_override: 7 });
    expect(svc.detectConflict(a, b)).toBe('flight_number_override_mismatch');
  });

  it('does not flag when both sides agree on the same override value', () => {
    const a = base({ flight_number_override: 5 });
    const b = base({ id: 'entry-2', flight_number_override: 5 });
    expect(svc.detectConflict(a, b)).toBeNull();
  });

  it('flags a wing_id conflict when both sides set a different wing', () => {
    const a = base({ wing_id: 'wing-a' });
    const b = base({ id: 'entry-2', wing_id: 'wing-b' });
    expect(svc.detectConflict(a, b)).toBe('wing_id_mismatch');
  });

  it('flags a paramotor_id conflict when both sides set a different paramotor', () => {
    const a = base({ paramotor_id: 'pm-a' });
    const b = base({ id: 'entry-2', paramotor_id: 'pm-b' });
    expect(svc.detectConflict(a, b)).toBe('paramotor_id_mismatch');
  });
});
