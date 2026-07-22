import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { Flight } from '../database/entities/flight.entity';
import { GpxParserService } from './gpx-parser.service';
import { GpxNormalizerService } from './gpx-normalizer.service';
import { FlightAnalysisService } from './flight-analysis.service';
import { CreateFlightDto } from './dto/create-flight.dto';
import { UpdateFlightDto } from './dto/update-flight.dto';
import { User } from '../database/entities/user.entity';
import { UsersService } from '../users/users.service';
import { PilotsService } from '../pilots/pilots.service';
import { LogbookService } from '../logbook/logbook.service';

export interface NormalizedComparisonPoint {
  t: number | null;       // seconds since takeoff
  lat: number;
  lon: number;
  elevation_m: number | null;
  speed_mps: number | null;
  vertical_speed_mps: number | null;
  phase: string;
}

export interface ComparisonEntry {
  flight_id: string;
  flight_date: string;
  title: string | null;
  pilot: unknown;
  glider: string | null;
  duration_seconds: number | null;
  total_distance_m: number | null;
  max_altitude_m: number | null;
  max_speed_mps: number | null;
  max_climb_mps: number | null;
  confidence_score: number | null;
  trackpoints: NormalizedComparisonPoint[];
}

export interface ComparisonResult {
  flights: ComparisonEntry[];
}

// Accepted GPX MIME types
const ACCEPTED_MIME_TYPES = new Set([
  'application/gpx+xml',
  'application/xml',
  'text/xml',
  'application/octet-stream', // some browsers/OS may send this for .gpx
]);

@Injectable()
export class FlightsService {
  private readonly mediaStoragePath: string;
  private readonly maxGpxUploadSize: number;
  private readonly logger = new Logger(FlightsService.name);

  constructor(
    @InjectRepository(Flight)
    private readonly flightsRepository: Repository<Flight>,
    private readonly gpxParser: GpxParserService,
    private readonly gpxNormalizer: GpxNormalizerService,
    private readonly flightAnalysis: FlightAnalysisService,
    private readonly usersService: UsersService,
    private readonly pilotsService: PilotsService,
    @Optional() private readonly logbookService: LogbookService,
  ) {
    this.mediaStoragePath = process.env.MEDIA_STORAGE_PATH || '/app/media';
    this.maxGpxUploadSize = parseInt(
      process.env.MAX_GPX_UPLOAD_SIZE || '52428800', // 50 MB default
      10,
    );
  }

  // ---------------------------------------------------------------------------
  // Upload
  // ---------------------------------------------------------------------------

  async uploadGpx(
    file: Express.Multer.File,
    dto: CreateFlightDto,
    user: User,
  ): Promise<Flight> {
    // Validate file presence
    if (!file) throw new BadRequestException('No file uploaded');

    // Validate size
    if (file.size > this.maxGpxUploadSize) {
      throw new BadRequestException(
        `GPX file exceeds maximum size of ${this.maxGpxUploadSize} bytes`,
      );
    }

    // Validate extension (.gpx required)
    const originalExt = path.extname(file.originalname).toLowerCase();
    if (originalExt !== '.gpx') {
      throw new BadRequestException('Only .gpx files are accepted');
    }

    // Validate MIME (best-effort; browsers may send generic types)
    if (file.mimetype && !ACCEPTED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(`Unsupported MIME type: ${file.mimetype}`);
    }

    // Pilot attribution: defaults to the uploader's linked pilot; an explicit
    // pilot_id may only reference someone else's pilot when the uploader is an admin
    const ownPilot = await this.pilotsService.findByUserId(user.id);
    let pilotId: string | null = ownPilot?.id ?? null;
    if (dto.pilot_id && dto.pilot_id !== ownPilot?.id) {
      if (!user.is_admin) {
        throw new ForbiddenException(
          'You can only attribute a flight to your own pilot profile',
        );
      }
      try {
        await this.pilotsService.findById(dto.pilot_id);
      } catch {
        throw new BadRequestException('pilot_id does not reference an existing pilot');
      }
      pilotId = dto.pilot_id;
    }

    // Sanitize filename – prevent path traversal
    const sanitizedName = this.sanitizeFilename(file.originalname);
    const secureFilename = `${randomUUID()}-${sanitizedName}`;

    // Date-based directory
    const flightDate = new Date(dto.flight_date);
    const datePath = flightDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const dirPath = path.join(this.mediaStoragePath, datePath);
    await fs.mkdir(dirPath, { recursive: true });

    const storageKey = path.join(datePath, secureFilename);
    const absolutePath = path.join(this.mediaStoragePath, storageKey);

    // Write to disk
    await fs.writeFile(absolutePath, file.buffer);

    // Create Flight record with uploaded status
    const flight = this.flightsRepository.create({
      flight_date: new Date(dto.flight_date),
      site_id: dto.site_id ?? null,
      pilot_id: pilotId,
      title: dto.title ?? null,
      notes: dto.notes ?? null,
      launch_site_name: dto.launch_site_name ?? null,
      glider: dto.glider ?? null,
      harness: dto.harness ?? null,
      original_filename: sanitizedName,
      storage_key: storageKey,
      file_size: file.size,
      parse_status: 'uploaded',
      analysis_status: 'pending',
      uploaded_by: user.id,
    });

    const saved = await this.flightsRepository.save(flight);

    // Update user storage usage (best-effort – don't fail the upload if this errors)
    try {
      const fullUser = await this.usersService.findById(user.id);
      if (fullUser?.username) {
        await this.usersService.adjustStorageUsed(fullUser.username, file.size);
      }
    } catch (err) {
      this.logger.warn(`Failed to update storage_used for user ${user.id}: ${err}`);
    }

    // Auto-create a linked logbook entry for the uploading pilot (best-effort).
    // Awaited so the response the client refetches on already reflects the link —
    // otherwise the UI's immediate refetch can race this write and show unlinked.
    if (this.logbookService && ownPilot) {
      try {
        await this.logbookService.linkFlight({
          pilotId: ownPilot.id,
          clientId: dto.client_id ?? null,
          flight: saved,
          source: dto.client_id ? 'flightnow' : 'web',
          createdByUserId: user.id,
        });
      } catch (err) {
        this.logger.warn(`Failed to auto-link logbook entry for flight ${saved.id}: ${err}`);
      }
    }

    // Kick off async parse + analysis pipeline (fire-and-forget)
    this.parseAndAnalyze(saved.id, absolutePath).catch((err) =>
      this.logger.error(`Background parse failed for flight ${saved.id}: ${err}`),
    );

    return saved;
  }

  // ---------------------------------------------------------------------------
  // Background parse + analysis pipeline
  // ---------------------------------------------------------------------------

  private async parseAndAnalyze(flightId: string, filePath: string): Promise<void> {
    const start = Date.now();
    this.logger.log(`[parse:start] flightId=${flightId}`);

    // Mark as parsing
    await this.flightsRepository.update(flightId, { parse_status: 'parsing' });

    try {
      const parsed = await this.gpxParser.parseGpxFile(filePath);
      const { trackpoints, summary } = this.gpxNormalizer.normalize(parsed.trackpoints);

      // Build app-reported stats update from parsed metadata (if present)
      const appData = parsed.appData;
      const appUpdate: Partial<Flight> = {};
      if (appData) {
        if (appData.distance_m !== undefined) appUpdate.gaggle_distance_m = appData.distance_m;
        if (appData.max_speed_mps !== undefined) appUpdate.gaggle_max_speed_mps = appData.max_speed_mps;
        if (appData.duration_seconds !== undefined) appUpdate.gaggle_duration_seconds = appData.duration_seconds;
        if (appData.avg_speed_mps !== undefined) appUpdate.gaggle_avg_speed_mps = appData.avg_speed_mps;
        if (appData.max_altitude_m !== undefined) appUpdate.gaggle_max_altitude_m = appData.max_altitude_m;
        if (appData.max_climb_mps !== undefined) appUpdate.gaggle_max_climb_mps = appData.max_climb_mps;
        if (appData.max_g_force !== undefined) appUpdate.gaggle_max_g_force = appData.max_g_force;
        if (appData.max_sink_mps !== undefined) appUpdate.gaggle_max_sink_mps = appData.max_sink_mps;
        if (appData.fuel_consumed !== undefined) appUpdate.gaggle_fuel_consumed = appData.fuel_consumed;

        // Override flight_date with the date from the GPX (the app records the actual local date).
        // takeoffDate is a local-time string like "2026-02-16 06:52:17.688325" — extract
        // only the YYYY-MM-DD portion and append T00:00:00Z so new Date() treats it as
        // UTC midnight, avoiding server-timezone shifts that move the date to the day before.
        if (appData.takeoffDate) {
          const datePart = appData.takeoffDate.trim().split(/[\sT]/)[0]; // "YYYY-MM-DD"
          appUpdate.flight_date = new Date(`${datePart}T00:00:00.000Z`);
        }

        // Apply glider/harness from GPX only if not already set by the user
        const flight = await this.flightsRepository.findOne({ where: { id: flightId } });
        if (flight) {
          if (!flight.glider && appData.wing) appUpdate.glider = appData.wing;
          if (!flight.harness && appData.engine) appUpdate.harness = appData.engine;
        }
      }

      // Record whether trackpoint timestamps were written as UTC (Z suffix) or as
      // bare local time (no Z). This applies regardless of whether app metadata
      // is present — it depends only on how <time> elements were written in the GPX.
      //   'UTC'   → timestamps are true UTC; browser converts to local time for display.
      //   'local' → app wrote local clock values without Z; the stored UTC digit
      //             values equal the local display time — show with UTC getters, no conversion.
      appUpdate.timezone = parsed.timestampsAreUtc ? 'UTC' : 'local';

      await this.flightsRepository.update(flightId, {
        parse_status: 'analyzed',
        analysis_status: 'pending',
        start_at: summary.start_at ?? undefined,
        end_at: summary.end_at ?? undefined,
        duration_seconds: summary.duration_seconds ?? undefined,
        total_distance_m: summary.total_distance_m,
        max_altitude_m: summary.max_altitude_m ?? undefined,
        min_altitude_m: summary.min_altitude_m ?? undefined,
        altitude_gain_m: summary.altitude_gain_m,
        altitude_loss_m: summary.altitude_loss_m,
        avg_speed_mps: summary.avg_speed_mps ?? undefined,
        max_speed_mps: summary.max_speed_mps ?? undefined,
        max_climb_mps: summary.max_climb_mps ?? undefined,
        max_descent_mps: summary.max_descent_mps ?? undefined,
        trackpoint_count: summary.trackpoint_count,
        segment_count: parsed.segmentCount,
        bbox_json: summary.bbox,
        confidence_score: summary.confidence_score,
        trackpoints_json: trackpoints as unknown[],
        ...appUpdate,
      });

      const durationMs = Date.now() - start;
      this.logger.log(
        `[parse:complete] flightId=${flightId} trackpointCount=${summary.trackpoint_count} duration_ms=${durationMs}`,
      );

      // Kick off analysis pipeline (fire-and-forget)
      this.flightAnalysis.analyzeFlightAsync(flightId).catch((err) =>
        this.logger.error(`Background analysis failed for flight ${flightId}: ${err}`),
      );
    } catch (err) {
      const durationMs = Date.now() - start;
      this.logger.error(
        `[parse:fail] flightId=${flightId} duration_ms=${durationMs} error=${err}`,
      );
      await this.flightsRepository.update(flightId, { parse_status: 'failed' });
    }
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  /** Open to any authenticated user — flights are shared/viewable across pilots. */
  async findByDate(date: string): Promise<Flight[]> {
    return this.flightsRepository.find({
      where: { flight_date: new Date(date) },
      relations: ['pilot', 'site'],
      order: { created_at: 'ASC' },
    });
  }

  async findById(id: string): Promise<Flight> {
    const flight = await this.flightsRepository.findOne({
      where: { id },
      relations: ['pilot', 'site'],
    });
    if (!flight) throw new NotFoundException(`Flight with ID ${id} not found`);
    return flight;
  }

  async update(id: string, dto: UpdateFlightDto, user: User): Promise<Flight> {
    const flight = await this.getForEdit(id, user);
    Object.assign(flight, dto);
    return this.flightsRepository.save(flight);
  }

  async delete(id: string, user: User): Promise<void> {
    const flight = await this.getForEdit(id, user);

    // Delete file from disk (best-effort)
    try {
      const absolutePath = path.join(this.mediaStoragePath, flight.storage_key);
      await fs.unlink(absolutePath);
    } catch (err) {
      this.logger.warn(`Could not delete GPX file for flight ${id}: ${err}`);
    }

    // Decrement user storage usage
    try {
      const user = await this.usersService.findById(flight.uploaded_by);
      if (user?.username) {
        await this.usersService.adjustStorageUsed(user.username, -flight.file_size);
      }
    } catch (err) {
      this.logger.warn(`Failed to update storage_used on delete for flight ${id}: ${err}`);
    }

    await this.flightsRepository.remove(flight);
  }

  /**
   * View access to flights is open to any authenticated user (shared across
   * pilots, like Media). This gate is only for mutations: update, delete,
   * and re-analysis. Uploader or admin only.
   */
  async getForEdit(id: string, user: User): Promise<Flight> {
    const flight = await this.findById(id);
    if (!user.is_admin && flight.uploaded_by !== user.id) {
      throw new ForbiddenException('You do not have permission to modify this flight');
    }
    return flight;
  }

  async getFilePath(id: string): Promise<string> {
    const flight = await this.findById(id);
    return path.join(this.mediaStoragePath, flight.storage_key);
  }

  /**
   * Limited, read-only flight summary for display alongside media that references this
   * flight (e.g. FlightTV's "Flight Information" panel). Only display fields are returned —
   * trackpoints/GPX/storage details are never exposed here, unlike findById.
   */
  async getDisplaySummary(id: string): Promise<{
    id: string;
    flight_date: Date;
    title: string | null;
    duration_seconds: number | null;
    launch_site_name: string | null;
    landing_site_name: string | null;
    max_altitude_m: number | null;
    max_speed_mps: number | null;
    total_distance_m: number | null;
    pilot: { id: string; display_name: string } | null;
  }> {
    const flight = await this.findById(id);
    return {
      id: flight.id,
      flight_date: flight.flight_date,
      title: flight.title,
      duration_seconds: flight.duration_seconds,
      launch_site_name: flight.launch_site_name,
      landing_site_name: flight.landing_site_name,
      max_altitude_m: flight.max_altitude_m,
      max_speed_mps: flight.max_speed_mps,
      total_distance_m: flight.total_distance_m,
      pilot: flight.pilot ? { id: flight.pilot.id, display_name: flight.pilot.display_name } : null,
    };
  }

  /** View access is open to any authenticated user — see getForEdit. */
  async getTrackpoints(
    id: string,
  ): Promise<{ flight_id: string; parse_status: string; timezone: string; trackpoints: unknown[] }> {
    return this.getPublicTrackpoints(id);
  }

  /**
   * Trackpoints for a flight, reachable either directly (GET /flights/:id/trackpoints,
   * any authenticated user) or via a linked media item (GET /media/:id/flight/trackpoints,
   * e.g. FlightTV showing a flight path alongside a video). Not ownership-scoped.
   */
  async getPublicTrackpoints(
    id: string,
  ): Promise<{ flight_id: string; parse_status: string; timezone: string; trackpoints: unknown[] }> {
    const flight = await this.flightsRepository.findOne({
      where: { id },
      select: ['id', 'parse_status', 'timezone', 'trackpoints_json'],
    });
    if (!flight) throw new NotFoundException(`Flight with ID ${id} not found`);
    return {
      flight_id: flight.id,
      parse_status: flight.parse_status,
      timezone: flight.timezone,
      trackpoints: (flight.trackpoints_json as unknown[]) ?? [],
    };
  }

  /** POST /flights/compare — return normalized comparison data for selected flights */
  async compareFlights(flightIds: string[]): Promise<ComparisonResult> {
    if (!flightIds || flightIds.length < 2) {
      throw new BadRequestException('At least 2 flight IDs are required for comparison');
    }
    if (flightIds.length > 6) {
      throw new BadRequestException('Cannot compare more than 6 flights at once');
    }

    const flights = await Promise.all(flightIds.map((id) => this.findById(id)));

    // Build normalized comparison entries
    const entries = flights.map((f) => {
      const tps = (f.trackpoints_json as unknown[]) ?? [];
      // Normalize timestamps to seconds-since-takeoff so charts align
      let normalizedTrackpoints: NormalizedComparisonPoint[] = [];
      if (tps.length > 0) {
        const first = tps[0] as { timestamp?: string; lat: number; lon: number; elevation_m?: number | null; speed_mps?: number | null; vertical_speed_mps?: number | null; phase?: string };
        const originTime = first.timestamp ? new Date(first.timestamp).getTime() : 0;
        normalizedTrackpoints = tps.map((tp) => {
          const t = tp as typeof first;
          const tsMs = t.timestamp ? new Date(t.timestamp).getTime() : null;
          return {
            t: tsMs !== null ? Math.round((tsMs - originTime) / 1000) : null,
            lat: t.lat,
            lon: t.lon,
            elevation_m: t.elevation_m ?? null,
            speed_mps: t.speed_mps ?? null,
            vertical_speed_mps: t.vertical_speed_mps ?? null,
            phase: t.phase ?? 'unknown',
          };
        });
      }

      return {
        flight_id: f.id,
        flight_date: f.flight_date instanceof Date
          ? f.flight_date.toISOString().split('T')[0]
          : String(f.flight_date),
        title: f.title,
        pilot: f.pilot ?? null,
        glider: f.glider,
        duration_seconds: f.duration_seconds,
        total_distance_m: f.total_distance_m,
        max_altitude_m: f.max_altitude_m,
        max_speed_mps: f.max_speed_mps,
        max_climb_mps: f.max_climb_mps,
        confidence_score: f.confidence_score,
        trackpoints: normalizedTrackpoints,
      };
    });

    return { flights: entries };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Remove path components and dangerous characters from an uploaded filename */
  private sanitizeFilename(filename: string): string {
    return path
      .basename(filename)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 200);
  }
}
