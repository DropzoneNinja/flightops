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
    uploadedByUserId: string,
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
      pilot_id: dto.pilot_id ?? null,
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
      uploaded_by: uploadedByUserId,
    });

    const saved = await this.flightsRepository.save(flight);

    // Update user storage usage (best-effort – don't fail the upload if this errors)
    try {
      const user = await this.usersService.findById(uploadedByUserId);
      if (user?.username) {
        await this.usersService.adjustStorageUsed(user.username, file.size);
      }
    } catch (err) {
      this.logger.warn(`Failed to update storage_used for user ${uploadedByUserId}: ${err}`);
    }

    // Auto-create a linked logbook entry for the uploading pilot (best-effort)
    if (this.logbookService) {
      this.pilotsService.findByUserId(uploadedByUserId).then((pilot) => {
        if (!pilot) return;
        return this.logbookService.linkFlight({
          pilotId: pilot.id,
          clientId: dto.client_id ?? null,
          flight: saved,
          source: dto.client_id ? 'flightnow' : 'web',
          createdByUserId: uploadedByUserId,
        });
      }).catch((err) =>
        this.logger.warn(`Failed to auto-link logbook entry for flight ${saved.id}: ${err}`),
      );
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

      // Build gaggle stats update from parsed metadata (if present)
      const gaggle = parsed.gaggle;
      const gaggleUpdate: Partial<Flight> = {};
      if (gaggle) {
        if (gaggle.distance_m !== undefined) gaggleUpdate.gaggle_distance_m = gaggle.distance_m;
        if (gaggle.max_speed_mps !== undefined) gaggleUpdate.gaggle_max_speed_mps = gaggle.max_speed_mps;
        if (gaggle.duration_seconds !== undefined) gaggleUpdate.gaggle_duration_seconds = gaggle.duration_seconds;
        if (gaggle.avg_speed_mps !== undefined) gaggleUpdate.gaggle_avg_speed_mps = gaggle.avg_speed_mps;
        if (gaggle.max_altitude_m !== undefined) gaggleUpdate.gaggle_max_altitude_m = gaggle.max_altitude_m;
        if (gaggle.max_climb_mps !== undefined) gaggleUpdate.gaggle_max_climb_mps = gaggle.max_climb_mps;
        if (gaggle.max_g_force !== undefined) gaggleUpdate.gaggle_max_g_force = gaggle.max_g_force;
        if (gaggle.max_sink_mps !== undefined) gaggleUpdate.gaggle_max_sink_mps = gaggle.max_sink_mps;
        if (gaggle.fuel_consumed !== undefined) gaggleUpdate.gaggle_fuel_consumed = gaggle.fuel_consumed;

        // Override flight_date with the date from the GPX (Gaggle records the actual date).
        // takeoffDate is a local-time string like "2026-02-16 06:52:17.688325" — extract
        // only the YYYY-MM-DD portion and append T00:00:00Z so new Date() treats it as
        // UTC midnight, avoiding server-timezone shifts that move the date to the day before.
        if (gaggle.takeoffDate) {
          const datePart = gaggle.takeoffDate.trim().split(/[\sT]/)[0]; // "YYYY-MM-DD"
          gaggleUpdate.flight_date = new Date(`${datePart}T00:00:00.000Z`);
        }

        // Apply glider/harness from GPX only if not already set by the user
        const flight = await this.flightsRepository.findOne({ where: { id: flightId } });
        if (flight) {
          if (!flight.glider && gaggle.wing) gaggleUpdate.glider = gaggle.wing;
          if (!flight.harness && gaggle.engine) gaggleUpdate.harness = gaggle.engine;
        }
      }

      // Record whether trackpoint timestamps were written as UTC (Z suffix) or as
      // bare local time (no Z). This applies regardless of whether Gaggle metadata
      // is present — it depends only on how <time> elements were written in the GPX.
      //   'UTC'   → timestamps are true UTC; browser converts to local time for display.
      //   'local' → Gaggle wrote local clock values without Z; the stored UTC digit
      //             values equal the local display time — show with UTC getters, no conversion.
      gaggleUpdate.timezone = parsed.timestampsAreUtc ? 'UTC' : 'local';

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
        ...gaggleUpdate,
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

  async update(id: string, dto: UpdateFlightDto): Promise<Flight> {
    const flight = await this.findById(id);
    Object.assign(flight, dto);
    return this.flightsRepository.save(flight);
  }

  async delete(id: string): Promise<void> {
    const flight = await this.findById(id);

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

  async findByIdForUser(id: string, userId: string): Promise<Flight> {
    const flight = await this.findById(id);
    if (flight.uploaded_by !== userId) {
      throw new ForbiddenException('You do not have access to this flight');
    }
    return flight;
  }

  async getFilePath(id: string, requestingUserId: string): Promise<string> {
    const flight = await this.findById(id);
    if (flight.uploaded_by !== requestingUserId) {
      throw new ForbiddenException('You do not have access to this flight file');
    }
    return path.join(this.mediaStoragePath, flight.storage_key);
  }

  async getTrackpoints(
    id: string,
    userId: string,
  ): Promise<{ flight_id: string; parse_status: string; timezone: string; trackpoints: unknown[] }> {
    const flight = await this.flightsRepository.findOne({
      where: { id },
      select: ['id', 'uploaded_by', 'parse_status', 'timezone', 'trackpoints_json'],
    });
    if (!flight) throw new NotFoundException(`Flight with ID ${id} not found`);
    if (flight.uploaded_by !== userId) {
      throw new ForbiddenException('You do not have access to this flight');
    }
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
