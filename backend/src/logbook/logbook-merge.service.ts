import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LogbookEntry } from '../database/entities/logbook-entry.entity';
import { Flight } from '../database/entities/flight.entity';
import { EquipmentHoursService } from '../equipment/equipment-hours.service';

/**
 * Merges the two independent, non-communicating logbook ingestion paths
 * (web GPX upload vs flightnow mobile sync) when they both produced an entry
 * for the same real flight. See docs/API.md "Logbook duplicate merging" and
 * the design notes in the codebase for the full rationale — in short:
 *
 * The surviving row must always be the flightnow-sourced entry, because its
 * `client_id` is the phone's own local Flight.id, and iOS reconciles server
 * state to its local data purely by `client_id` on every app foreground. If
 * the web-sourced entry's randomly-generated `client_id` survived instead,
 * the phone would never recognize the merged row (creating a phantom
 * duplicate) and, if the flightnow-origin row were deleted, would tombstone
 * its own real local flight. So merges always: copy the web entry's
 * `flight_id` (and anything the flightnow entry is missing) onto the
 * flightnow entry, then soft-delete the web entry.
 */

interface FlightnowMatchInput {
  startAt: Date | null;
  endAt: Date | null;
  takeoffLat: number | null;
  takeoffLon: number | null;
  durationSeconds: number | null;
  distanceM: number | null;
  maxAltitudeM: number | null;
}

interface WebMatchInput {
  startAt: Date | null;
  endAt: Date | null;
  bbox: { minLat: number; minLon: number; maxLat: number; maxLon: number } | null;
  durationSeconds: number | null;
  distanceM: number | null;
  maxAltitudeM: number | null;
}

export interface MergeOutcome {
  merged: boolean;
  survivorId: string | null;
  loserId: string | null;
  reason: 'merged' | 'no_candidate' | 'ambiguous' | 'flight_not_analyzed' | string; // `conflict:${field}`
}

export interface BackfillDetail {
  flightnowEntryId: string;
  webEntryId?: string;
  outcome: string;
  candidateIds?: string[];
}

export interface BackfillSummary {
  merged: number;
  flaggedConflicts: number;
  flaggedAmbiguous: number;
  noCandidateCount: number;
  details: BackfillDetail[];
}

@Injectable()
export class LogbookMergeService {
  private readonly logger = new Logger(LogbookMergeService.name);

  // Tunable matching constants — see docs/API.md for the reasoning behind
  // each. Deliberately conservative: a missed auto-merge self-heals on a
  // later run/backfill; a false-positive merge silently soft-deletes a real
  // distinct flight.
  private static readonly TIME_BUFFER_MINUTES = 3;
  private static readonly PLACE_BUFFER_METERS = 400;
  private static readonly DURATION_ABS_TOLERANCE_S = 90;
  private static readonly DURATION_PCT_TOLERANCE = 0.2;
  private static readonly DISTANCE_ABS_TOLERANCE_M = 500;
  private static readonly DISTANCE_PCT_TOLERANCE = 0.2;
  private static readonly ALTITUDE_ABS_TOLERANCE_M = 50;
  private static readonly ALTITUDE_PCT_TOLERANCE = 0.15;

  constructor(
    @InjectRepository(LogbookEntry)
    private readonly logbookRepository: Repository<LogbookEntry>,
    private readonly equipmentHoursService: EquipmentHoursService,
  ) {}

  // ---------------------------------------------------------------------------
  // Live hook 1 — called right after upsertFromMobile's CREATE branch saves a
  // brand-new source:'flightnow' entry.
  // ---------------------------------------------------------------------------

  async tryClaimForNewFlightnowEntry(entry: LogbookEntry): Promise<MergeOutcome> {
    const candidates = await this.logbookRepository
      .createQueryBuilder('le')
      .leftJoinAndSelect('le.flight', 'flight')
      .where('le.pilot_id = :pid', { pid: entry.pilot_id })
      .andWhere('le.source = :src', { src: 'web' })
      .andWhere('le.flight_date = :d', { d: this.toDateKey(entry.flight_date) })
      .andWhere('le.flight_id IS NOT NULL')
      .andWhere('le.deleted_at IS NULL')
      .andWhere('le.merge_flagged_at IS NULL')
      .andWhere("flight.parse_status = 'analyzed'")
      .getMany();

    const fnInput = this.toFlightnowMatchInput(entry);
    const matches = candidates.filter(
      (c) => c.flight && this.isMatch(fnInput, this.toWebMatchInput(c.flight)),
    );

    if (matches.length === 0) {
      return { merged: false, survivorId: null, loserId: null, reason: 'no_candidate' };
    }
    if (matches.length > 1) {
      await this.flagAmbiguous(entry, matches);
      return { merged: false, survivorId: null, loserId: null, reason: 'ambiguous' };
    }

    return this.performMerge(entry.id, matches[0].id);
  }

  // ---------------------------------------------------------------------------
  // Live hook 2 — called right after a Flight's GPX parse completes
  // (parse_status -> 'analyzed'), to catch the far more common ordering
  // where flightnow synced first and the matching GPX analysis finishes
  // moments later.
  // ---------------------------------------------------------------------------

  async tryMergeAfterFlightAnalyzed(webEntry: LogbookEntry, flight: Flight): Promise<MergeOutcome> {
    if (webEntry.deleted_at || webEntry.merge_flagged_at || webEntry.flight_id !== flight.id) {
      return { merged: false, survivorId: null, loserId: null, reason: 'no_candidate' };
    }
    if (flight.parse_status !== 'analyzed') {
      return { merged: false, survivorId: null, loserId: null, reason: 'flight_not_analyzed' };
    }

    const candidates = await this.logbookRepository
      .createQueryBuilder('le')
      .where('le.pilot_id = :pid', { pid: webEntry.pilot_id })
      .andWhere('le.source = :src', { src: 'flightnow' })
      .andWhere('le.flight_date = :d', { d: this.toDateKey(webEntry.flight_date) })
      .andWhere('le.flight_id IS NULL')
      .andWhere('le.deleted_at IS NULL')
      .andWhere('le.merge_flagged_at IS NULL')
      .getMany();

    const webInput = this.toWebMatchInput(flight);
    const matches = candidates.filter((c) => this.isMatch(this.toFlightnowMatchInput(c), webInput));

    if (matches.length === 0) {
      return { merged: false, survivorId: null, loserId: null, reason: 'no_candidate' };
    }
    if (matches.length > 1) {
      await this.flagAmbiguous(webEntry, matches);
      return { merged: false, survivorId: null, loserId: null, reason: 'ambiguous' };
    }

    return this.performMerge(matches[0].id, webEntry.id);
  }

  // ---------------------------------------------------------------------------
  // One-time (re-runnable) backfill across all pilots
  // ---------------------------------------------------------------------------

  async backfillMergeDuplicates(opts?: { dryRun?: boolean; pilotId?: string }): Promise<BackfillSummary> {
    const dryRun = opts?.dryRun ?? false;

    const flightnowQb = this.logbookRepository
      .createQueryBuilder('le')
      .where('le.source = :src', { src: 'flightnow' })
      .andWhere('le.flight_id IS NULL')
      .andWhere('le.deleted_at IS NULL')
      .andWhere('le.merge_flagged_at IS NULL');
    if (opts?.pilotId) flightnowQb.andWhere('le.pilot_id = :pid', { pid: opts.pilotId });
    const flightnowEntries = await flightnowQb.getMany();

    const webQb = this.logbookRepository
      .createQueryBuilder('le')
      .leftJoinAndSelect('le.flight', 'flight')
      .where('le.source = :src', { src: 'web' })
      .andWhere('le.flight_id IS NOT NULL')
      .andWhere('le.deleted_at IS NULL')
      .andWhere('le.merge_flagged_at IS NULL')
      .andWhere("flight.parse_status = 'analyzed'");
    if (opts?.pilotId) webQb.andWhere('le.pilot_id = :pid', { pid: opts.pilotId });
    const webEntries = await webQb.getMany();

    const webByBucket = new Map<string, LogbookEntry[]>();
    for (const w of webEntries) {
      const key = this.bucketKey(w.pilot_id, w.flight_date);
      const list = webByBucket.get(key);
      if (list) list.push(w);
      else webByBucket.set(key, [w]);
    }

    const summary: BackfillSummary = {
      merged: 0,
      flaggedConflicts: 0,
      flaggedAmbiguous: 0,
      noCandidateCount: 0,
      details: [],
    };

    for (const fn of flightnowEntries) {
      const key = this.bucketKey(fn.pilot_id, fn.flight_date);
      const webCandidates = (webByBucket.get(key) ?? []).filter((w) => w.flight);
      const fnInput = this.toFlightnowMatchInput(fn);
      const matches = webCandidates.filter((w) => this.isMatch(fnInput, this.toWebMatchInput(w.flight!)));

      if (matches.length === 0) {
        summary.noCandidateCount++;
        continue;
      }

      if (matches.length > 1) {
        summary.flaggedAmbiguous++;
        summary.details.push({
          flightnowEntryId: fn.id,
          outcome: 'ambiguous',
          candidateIds: matches.map((m) => m.id),
        });
        if (!dryRun) await this.flagAmbiguous(fn, matches);
        // Remove all ambiguous candidates from the pool so a later flightnow
        // entry in this same run can't also claim one of them.
        this.removeFromBucket(webByBucket, key, matches);
        continue;
      }

      const loser = matches[0];
      this.removeFromBucket(webByBucket, key, [loser]);

      if (dryRun) {
        const conflict = this.detectConflict(fn, loser);
        if (conflict) {
          summary.flaggedConflicts++;
          summary.details.push({ flightnowEntryId: fn.id, webEntryId: loser.id, outcome: `conflict:${conflict}` });
        } else {
          summary.merged++;
          summary.details.push({ flightnowEntryId: fn.id, webEntryId: loser.id, outcome: 'would_merge' });
        }
        continue;
      }

      const outcome = await this.performMerge(fn.id, loser.id);
      if (outcome.merged) {
        summary.merged++;
        summary.details.push({ flightnowEntryId: fn.id, webEntryId: loser.id, outcome: 'merged' });
      } else {
        summary.flaggedConflicts++;
        summary.details.push({ flightnowEntryId: fn.id, webEntryId: loser.id, outcome: outcome.reason });
      }
    }

    return summary;
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private removeFromBucket(
    webByBucket: Map<string, LogbookEntry[]>,
    key: string,
    used: LogbookEntry[],
  ): void {
    const usedIds = new Set(used.map((u) => u.id));
    const remaining = (webByBucket.get(key) ?? []).filter((w) => !usedIds.has(w.id));
    webByBucket.set(key, remaining);
  }

  private bucketKey(pilotId: string, date: Date | string): string {
    return `${pilotId}|${this.toDateKey(date)}`;
  }

  private toDateKey(d: Date | string): string {
    return d instanceof Date ? d.toISOString().split('T')[0] : String(d).split('T')[0];
  }

  private toFlightnowMatchInput(entry: LogbookEntry): FlightnowMatchInput {
    return {
      startAt: entry.start_at,
      endAt: entry.end_at,
      takeoffLat: entry.takeoff_lat != null ? Number(entry.takeoff_lat) : null,
      takeoffLon: entry.takeoff_lon != null ? Number(entry.takeoff_lon) : null,
      durationSeconds: entry.duration_seconds,
      distanceM: entry.distance_m,
      maxAltitudeM: entry.max_altitude_m,
    };
  }

  private toWebMatchInput(flight: Flight): WebMatchInput {
    return {
      startAt: flight.start_at ?? null,
      endAt: flight.end_at ?? null,
      bbox: flight.bbox_json ?? null,
      durationSeconds: flight.duration_seconds ?? null,
      distanceM: flight.total_distance_m ?? null,
      maxAltitudeM: flight.max_altitude_m ?? null,
    };
  }

  /**
   * Multi-signal match: same pilot + same date are enforced by the caller's
   * query, so this only needs to check time window, place, and stats
   * corroboration — all required, since date+site alone isn't enough to
   * distinguish two real back-to-back flights.
   */
  private isMatch(fn: FlightnowMatchInput, web: WebMatchInput): boolean {
    if (!this.timeWindowsOverlap(fn, web)) return false;
    if (!this.placeMatches(fn, web)) return false;
    return this.statsCorroborate(fn, web);
  }

  private timeWindowsOverlap(fn: FlightnowMatchInput, web: WebMatchInput): boolean {
    if (!fn.startAt || !fn.endAt || !web.startAt || !web.endAt) return false;
    const bufMs = LogbookMergeService.TIME_BUFFER_MINUTES * 60 * 1000;
    const fnStart = fn.startAt.getTime() - bufMs;
    const fnEnd = fn.endAt.getTime() + bufMs;
    const webStart = web.startAt.getTime() - bufMs;
    const webEnd = web.endAt.getTime() + bufMs;
    return fnStart <= webEnd && webStart <= fnEnd;
  }

  private placeMatches(fn: FlightnowMatchInput, web: WebMatchInput): boolean {
    if (fn.takeoffLat == null || fn.takeoffLon == null || !web.bbox) return false;
    const bufferMeters = LogbookMergeService.PLACE_BUFFER_METERS;
    const latBuf = bufferMeters / 111320;
    const lonBuf = bufferMeters / (111320 * Math.cos((fn.takeoffLat * Math.PI) / 180));
    return (
      fn.takeoffLat >= web.bbox.minLat - latBuf &&
      fn.takeoffLat <= web.bbox.maxLat + latBuf &&
      fn.takeoffLon >= web.bbox.minLon - lonBuf &&
      fn.takeoffLon <= web.bbox.maxLon + lonBuf
    );
  }

  private statsCorroborate(fn: FlightnowMatchInput, web: WebMatchInput): boolean {
    const checks: (boolean | null)[] = [
      this.withinTolerance(
        fn.durationSeconds,
        web.durationSeconds,
        LogbookMergeService.DURATION_ABS_TOLERANCE_S,
        LogbookMergeService.DURATION_PCT_TOLERANCE,
      ),
      this.withinTolerance(
        fn.distanceM,
        web.distanceM,
        LogbookMergeService.DISTANCE_ABS_TOLERANCE_M,
        LogbookMergeService.DISTANCE_PCT_TOLERANCE,
      ),
      this.withinTolerance(
        fn.maxAltitudeM,
        web.maxAltitudeM,
        LogbookMergeService.ALTITUDE_ABS_TOLERANCE_M,
        LogbookMergeService.ALTITUDE_PCT_TOLERANCE,
      ),
    ];

    const comparable = checks.filter((c) => c !== null) as boolean[];
    if (comparable.length === 0) return false; // time+place alone is never sufficient
    if (comparable.length === 1) return comparable[0];
    const agreeing = comparable.filter(Boolean).length;
    return agreeing >= 2;
  }

  /** Returns null when the pair isn't comparable (one/both sides missing). */
  private withinTolerance(
    a: number | null,
    b: number | null,
    absFloor: number,
    pct: number,
  ): boolean | null {
    if (a == null || b == null) return null;
    const tolerance = Math.max(absFloor, pct * Math.max(Math.abs(a), Math.abs(b)));
    return Math.abs(a - b) <= tolerance;
  }

  private detectConflict(a: LogbookEntry, b: LogbookEntry): string | null {
    if (
      a.flight_number_override != null &&
      b.flight_number_override != null &&
      a.flight_number_override !== b.flight_number_override
    ) {
      return 'flight_number_override_mismatch';
    }
    if (a.wing_id != null && b.wing_id != null && a.wing_id !== b.wing_id) {
      return 'wing_id_mismatch';
    }
    if (a.paramotor_id != null && b.paramotor_id != null && a.paramotor_id !== b.paramotor_id) {
      return 'paramotor_id_mismatch';
    }
    return null;
  }

  private async flagAmbiguous(entry: LogbookEntry, others: LogbookEntry[]): Promise<void> {
    const now = new Date();
    const ids = [entry.id, ...others.map((o) => o.id)];
    await this.logbookRepository.update(
      { id: In(ids) },
      { merge_flagged_at: now, merge_flagged_reason: 'ambiguous_multiple_candidates' },
    );
  }

  /**
   * Survivor is always the flightnow-sourced row (see class doc for why).
   * Copies over anything the survivor is missing, soft-deletes the loser,
   * then reconciles equipment hours for whatever wing/paramotor ids were
   * touched on either side.
   */
  private async performMerge(survivorId: string, loserId: string): Promise<MergeOutcome> {
    const survivor = await this.logbookRepository.findOne({ where: { id: survivorId } });
    const loser = await this.logbookRepository.findOne({ where: { id: loserId } });
    if (!survivor || !loser) {
      return { merged: false, survivorId: null, loserId: null, reason: 'no_candidate' };
    }

    const conflict = this.detectConflict(survivor, loser);
    if (conflict) {
      const now = new Date();
      survivor.merge_flagged_at = now;
      survivor.merge_flagged_reason = conflict;
      loser.merge_flagged_at = now;
      loser.merge_flagged_reason = conflict;
      await this.logbookRepository.save([survivor, loser]);
      this.logger.warn(
        `Merge conflict between ${survivor.id} (flightnow) and ${loser.id} (web): ${conflict}. Both flagged, not merged.`,
      );
      return { merged: false, survivorId: null, loserId: null, reason: `conflict:${conflict}` };
    }

    const oldSurvivorWingId = survivor.wing_id;
    const oldSurvivorParamotorId = survivor.paramotor_id;

    if (!survivor.flight_id) survivor.flight_id = loser.flight_id;
    if (!survivor.title) survivor.title = loser.title;
    if (!survivor.notes) survivor.notes = loser.notes;
    if (!survivor.launch_site_name) survivor.launch_site_name = loser.launch_site_name;
    if (!survivor.mission_id) survivor.mission_id = loser.mission_id;
    if (survivor.flight_number_override == null) {
      survivor.flight_number_override = loser.flight_number_override;
    }
    if (!survivor.weather_snapshot) {
      survivor.weather_snapshot = loser.weather_snapshot;
      survivor.weather_captured_at = loser.weather_captured_at;
      survivor.weather_source = loser.weather_source;
      if (!survivor.site_id) survivor.site_id = loser.site_id;
    }
    if (!survivor.wing_id) survivor.wing_id = loser.wing_id;
    if (!survivor.paramotor_id) survivor.paramotor_id = loser.paramotor_id;
    survivor.revision += 1;

    loser.deleted_at = new Date();
    loser.revision += 1;

    await this.logbookRepository.save([survivor, loser]);
    this.logger.log(`Merged logbook entry ${loser.id} (web) into ${survivor.id} (flightnow).`);

    const touchedWingIds = new Set(
      [oldSurvivorWingId, loser.wing_id, survivor.wing_id].filter((v): v is string => !!v),
    );
    const touchedParamotorIds = new Set(
      [oldSurvivorParamotorId, loser.paramotor_id, survivor.paramotor_id].filter((v): v is string => !!v),
    );
    if (touchedWingIds.size || touchedParamotorIds.size) {
      await this.equipmentHoursService.recalculate(
        { wingIds: touchedWingIds, paramotorIds: touchedParamotorIds },
        survivor.pilot_id,
      );
    }

    return { merged: true, survivorId: survivor.id, loserId: loser.id, reason: 'merged' };
  }
}
