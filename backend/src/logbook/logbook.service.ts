import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { randomUUID } from 'crypto';
import { LogbookEntry, WeatherSnapshot } from '../database/entities/logbook-entry.entity';
import { Flight } from '../database/entities/flight.entity';
import { Pilot } from '../database/entities/pilot.entity';
import { PilotsService } from '../pilots/pilots.service';
import { LogbookWeatherService } from './logbook-weather.service';
import { LogbookMediaService, MediaRef } from './logbook-media.service';
import { CreateLogbookEntryDto } from './dto/create-logbook-entry.dto';
import { UpdateLogbookEntryDto } from './dto/update-logbook-entry.dto';
import { PushEntryDto, DeleteRefDto } from './dto/push-logbook.dto';

export interface GpxRef {
  flight_id: string;
  gpx_url: string;
  parse_status: string;
  analysis_status: string;
  bbox_json: unknown;
}

export interface LogbookEntryResponse {
  id: string;
  pilot_id: string;
  client_id: string;
  source: string;
  flight_date: string;
  start_at: string | null;
  end_at: string | null;
  duration_seconds: number | null;
  distance_m: number | null;
  avg_speed_mps: number | null;
  max_speed_mps: number | null;
  max_altitude_m: number | null;
  avg_altitude_m: number | null;
  max_climb_mps: number | null;
  max_sink_mps: number | null;
  takeoff_lat: number | null;
  takeoff_lon: number | null;
  landing_lat: number | null;
  landing_lon: number | null;
  launch_site_name: string | null;
  landing_site_name: string | null;
  title: string | null;
  notes: string | null;
  wing: string | null;
  engine: string | null;
  paramotor: string | null;
  equipment_refs_json: unknown;
  fuel_start_litres: number | null;
  fuel_used_litres: number | null;
  battery_start_percent: number | null;
  battery_used_percent: number | null;
  category: string | null;
  flight_purpose: string | null;
  route_name: string | null;
  rating: number | null;
  weather_snapshot: WeatherSnapshot | null;
  weather_source: string | null;
  /** Computed chronological flight number (1 = oldest). null for deleted entries. */
  flight_number: number | null;
  /** Pilot-set override; null means auto-assigned. */
  flight_number_override: number | null;
  revision: number;
  client_updated_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  gpx: GpxRef | null;
  media: MediaRef[];
  // Prefer analyzed Flight metrics for display when linked
  analyzed_duration_seconds: number | null;
  analyzed_distance_m: number | null;
  analyzed_max_altitude_m: number | null;
  analyzed_max_speed_mps: number | null;
}

export interface SyncPushResult {
  client_id: string;
  id: string;
  status: 'created' | 'updated' | 'unchanged' | 'deleted';
  revision: number;
  server: LogbookEntryResponse | null;
}

@Injectable()
export class LogbookService {
  private readonly logger = new Logger(LogbookService.name);

  constructor(
    @InjectRepository(LogbookEntry)
    private readonly logbookRepository: Repository<LogbookEntry>,
    @InjectRepository(Flight)
    private readonly flightsRepository: Repository<Flight>,
    private readonly pilotsService: PilotsService,
    private readonly weatherService: LogbookWeatherService,
    private readonly mediaService: LogbookMediaService,
  ) {}

  // ---------------------------------------------------------------------------
  // Privacy resolution
  // ---------------------------------------------------------------------------

  async resolvePilot(userId: string): Promise<Pilot> {
    return this.pilotsService.resolveCurrentPilotOrThrow(userId);
  }

  private pilotNames(pilot: Pilot): string[] {
    const names: string[] = [pilot.display_name];
    return names.filter(Boolean);
  }

  // ---------------------------------------------------------------------------
  // Flight number computation
  // ---------------------------------------------------------------------------

  /**
   * Given a set of non-deleted entries, compute each entry's flight number.
   * Entries are sorted oldest-first (date, then start_at, then created_at).
   * A manual override resets the running counter; subsequent auto-assigned
   * entries increment from there.
   */
  private computeFlightNumbers(entries: LogbookEntry[]): Map<string, number> {
    const sorted = entries
      .filter((e) => !e.deleted_at)
      .sort((a, b) => {
        const da = a.flight_date instanceof Date
          ? a.flight_date.toISOString().split('T')[0]
          : String(a.flight_date);
        const db = b.flight_date instanceof Date
          ? b.flight_date.toISOString().split('T')[0]
          : String(b.flight_date);
        if (da !== db) return da.localeCompare(db);
        const sa = a.start_at?.getTime() ?? 0;
        const sb = b.start_at?.getTime() ?? 0;
        if (sa !== sb) return sa - sb;
        return a.created_at.getTime() - b.created_at.getTime();
      });

    const result = new Map<string, number>();
    let counter = 0;
    for (const entry of sorted) {
      if (entry.flight_number_override != null) {
        counter = entry.flight_number_override;
      } else {
        counter++;
      }
      result.set(entry.id, counter);
    }
    return result;
  }

  /** Lightweight DB load to compute flight numbers for a single entry. */
  private async flightNumberForEntry(pilotId: string, entryId: string): Promise<number | null> {
    const rows = await this.logbookRepository
      .createQueryBuilder('le')
      .select(['le.id', 'le.flight_date', 'le.start_at', 'le.created_at', 'le.flight_number_override'])
      .where('le.pilot_id = :pid', { pid: pilotId })
      .andWhere('le.deleted_at IS NULL')
      .orderBy('le.flight_date', 'ASC')
      .addOrderBy('le.start_at', 'ASC', 'NULLS LAST')
      .addOrderBy('le.created_at', 'ASC')
      .getMany();

    let counter = 0;
    for (const row of rows) {
      if (row.flight_number_override != null) {
        counter = row.flight_number_override;
      } else {
        counter++;
      }
      if (row.id === entryId) return counter;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // List
  // ---------------------------------------------------------------------------

  async findAll(
    userId: string,
    from?: string,
    to?: string,
  ): Promise<LogbookEntryResponse[]> {
    const pilot = await this.resolvePilot(userId);
    const qb = this.logbookRepository
      .createQueryBuilder('le')
      .leftJoinAndSelect('le.flight', 'flight')
      .where('le.pilot_id = :pid', { pid: pilot.id })
      .andWhere('le.deleted_at IS NULL')
      .orderBy('le.flight_date', 'DESC')
      .addOrderBy('le.start_at', 'DESC');

    if (from) qb.andWhere('le.flight_date >= :from', { from });
    if (to) qb.andWhere('le.flight_date <= :to', { to });

    const entries = await qb.getMany();

    // Batch media by date
    const dates = entries.map((e) => e.flight_date as Date);
    const names = this.pilotNames(pilot);
    const mediaByDate = await this.mediaService.getMediaForPilotOnDates(names, dates);

    const flightNumbers = this.computeFlightNumbers(entries);

    return entries.map((e) => {
      const dateKey = e.flight_date instanceof Date
        ? e.flight_date.toISOString().split('T')[0]
        : String(e.flight_date);
      return this.toResponse(e, mediaByDate.get(dateKey) ?? [], flightNumbers.get(e.id) ?? null);
    });
  }

  // ---------------------------------------------------------------------------
  // Get one
  // ---------------------------------------------------------------------------

  async findOne(userId: string, id: string): Promise<LogbookEntryResponse> {
    const pilot = await this.resolvePilot(userId);
    const entry = await this.logbookRepository.findOne({
      where: { id, pilot_id: pilot.id },
      relations: ['flight'],
    });
    if (!entry) throw new NotFoundException(`Logbook entry not found`);

    const names = this.pilotNames(pilot);
    const media = await this.mediaService.getMediaForPilotOnDate(names, entry.flight_date as Date);
    const flightNumber = await this.flightNumberForEntry(pilot.id, entry.id);
    return this.toResponse(entry, media, flightNumber);
  }

  // ---------------------------------------------------------------------------
  // Create (manual / web)
  // ---------------------------------------------------------------------------

  async create(userId: string, dto: CreateLogbookEntryDto): Promise<LogbookEntryResponse> {
    const pilot = await this.resolvePilot(userId);
    const clientId = dto.client_id ?? randomUUID();

    // Idempotency: return existing if client_id already known
    const existing = await this.logbookRepository.findOne({
      where: { pilot_id: pilot.id, client_id: clientId },
      relations: ['flight'],
    });
    if (existing) {
      const names = this.pilotNames(pilot);
      const media = await this.mediaService.getMediaForPilotOnDate(names, existing.flight_date as Date);
      const flightNumber = await this.flightNumberForEntry(pilot.id, existing.id);
      return this.toResponse(existing, media, flightNumber);
    }

    const datePart = dto.flight_date.split('T')[0];
    const entry = this.logbookRepository.create({
      pilot_id: pilot.id,
      client_id: clientId,
      source: 'web',
      created_by_user_id: userId,
      flight_date: new Date(`${datePart}T00:00:00.000Z`),
      title: dto.title ?? null,
      notes: dto.notes ?? null,
      launch_site_name: dto.launch_site_name ?? null,
      landing_site_name: dto.landing_site_name ?? null,
      category: dto.category ?? null,
      flight_purpose: dto.flight_purpose ?? null,
      route_name: dto.route_name ?? null,
      rating: dto.rating ?? null,
      wing: dto.wing ?? null,
      engine: dto.engine ?? null,
      paramotor: dto.paramotor ?? null,
      fuel_start_litres: dto.fuel_start_litres ?? null,
      fuel_used_litres: dto.fuel_used_litres ?? null,
      battery_start_percent: dto.battery_start_percent ?? null,
      battery_used_percent: dto.battery_used_percent ?? null,
      start_at: dto.start_at ? new Date(dto.start_at) : null,
      end_at: dto.end_at ? new Date(dto.end_at) : null,
      duration_seconds: dto.duration_seconds ?? null,
      max_altitude_m: dto.max_altitude_m ?? null,
      max_speed_mps: dto.max_speed_mps ?? null,
      distance_m: dto.distance_m ?? null,
      revision: 1,
      client_updated_at: null,
    });

    const saved = await this.logbookRepository.save(entry);
    const names = this.pilotNames(pilot);
    const media = await this.mediaService.getMediaForPilotOnDate(names, saved.flight_date as Date);
    const flightNumber = await this.flightNumberForEntry(pilot.id, saved.id);
    return this.toResponse(saved, media, flightNumber);
  }

  // ---------------------------------------------------------------------------
  // Update (web)
  // ---------------------------------------------------------------------------

  async update(
    userId: string,
    id: string,
    dto: UpdateLogbookEntryDto,
  ): Promise<LogbookEntryResponse> {
    const pilot = await this.resolvePilot(userId);
    const entry = await this.logbookRepository.findOne({
      where: { id, pilot_id: pilot.id },
      relations: ['flight'],
    });
    if (!entry) throw new NotFoundException(`Logbook entry not found`);

    if (dto.title !== undefined) entry.title = dto.title;
    if (dto.notes !== undefined) entry.notes = dto.notes;
    if (dto.launch_site_name !== undefined) entry.launch_site_name = dto.launch_site_name;
    if (dto.landing_site_name !== undefined) entry.landing_site_name = dto.landing_site_name;
    if (dto.category !== undefined) entry.category = dto.category;
    if (dto.flight_purpose !== undefined) entry.flight_purpose = dto.flight_purpose;
    if (dto.route_name !== undefined) entry.route_name = dto.route_name;
    if (dto.rating !== undefined) entry.rating = dto.rating;
    if (dto.wing !== undefined) entry.wing = dto.wing;
    if (dto.engine !== undefined) entry.engine = dto.engine;
    if (dto.paramotor !== undefined) entry.paramotor = dto.paramotor;
    if (dto.fuel_start_litres !== undefined) entry.fuel_start_litres = dto.fuel_start_litres;
    if (dto.fuel_used_litres !== undefined) entry.fuel_used_litres = dto.fuel_used_litres;
    if (dto.battery_start_percent !== undefined) entry.battery_start_percent = dto.battery_start_percent;
    if (dto.battery_used_percent !== undefined) entry.battery_used_percent = dto.battery_used_percent;
    if (dto.start_at !== undefined) entry.start_at = dto.start_at ? new Date(dto.start_at) : null;
    if (dto.end_at !== undefined) entry.end_at = dto.end_at ? new Date(dto.end_at) : null;
    if (dto.duration_seconds !== undefined) entry.duration_seconds = dto.duration_seconds ?? null;
    if (dto.max_altitude_m !== undefined) entry.max_altitude_m = dto.max_altitude_m ?? null;
    if (dto.max_speed_mps !== undefined) entry.max_speed_mps = dto.max_speed_mps ?? null;
    if (dto.distance_m !== undefined) entry.distance_m = dto.distance_m ?? null;
    if (dto.flight_number_override !== undefined) entry.flight_number_override = dto.flight_number_override;

    if (dto.flight_id !== undefined && !entry.flight_id) {
      const flight = await this.flightsRepository.findOne({ where: { id: dto.flight_id } });
      if (flight) {
        entry.flight_id = flight.id;
        // Derive approximate coordinates from bbox for weather capture
        const bbox = flight.bbox_json as { minLat: number; maxLat: number; minLon: number; maxLon: number } | null;
        if (bbox && !entry.weather_snapshot) {
          const lat = (bbox.minLat + bbox.maxLat) / 2;
          const lon = (bbox.minLon + bbox.maxLon) / 2;
          const datePart = (entry.flight_date as unknown as string).slice(0, 10);
          this.captureWeatherAsync(entry, lat, lon, datePart);
        }
      }
    }

    entry.revision += 1;
    const saved = await this.logbookRepository.save(entry);

    const names = this.pilotNames(pilot);
    const media = await this.mediaService.getMediaForPilotOnDate(names, saved.flight_date as Date);
    const flightNumber = await this.flightNumberForEntry(pilot.id, saved.id);
    return this.toResponse(saved, media, flightNumber);
  }

  // ---------------------------------------------------------------------------
  // Soft-delete
  // ---------------------------------------------------------------------------

  async softDelete(userId: string, id: string): Promise<{ id: string; deleted_at: string }> {
    const pilot = await this.resolvePilot(userId);
    const entry = await this.logbookRepository.findOne({
      where: { id, pilot_id: pilot.id },
    });
    if (!entry) throw new NotFoundException(`Logbook entry not found`);
    entry.deleted_at = new Date();
    entry.revision += 1;
    await this.logbookRepository.save(entry);
    return { id: entry.id, deleted_at: entry.deleted_at.toISOString() };
  }

  // ---------------------------------------------------------------------------
  // Sync pull (GET /logbook/sync?since=)
  // ---------------------------------------------------------------------------

  async syncPull(userId: string, since: string | undefined): Promise<{
    server_time: string;
    entries: LogbookEntryResponse[];
  }> {
    const pilot = await this.resolvePilot(userId);
    const serverTime = new Date();

    const qb = this.logbookRepository
      .createQueryBuilder('le')
      .leftJoinAndSelect('le.flight', 'flight')
      .where('le.pilot_id = :pid', { pid: pilot.id })
      .orderBy('le.updated_at', 'ASC');

    if (since) {
      qb.andWhere('le.updated_at > :since', { since: new Date(since) });
    }

    const entries = await qb.getMany();

    const dates = entries.map((e) => e.flight_date as Date);
    const names = this.pilotNames(pilot);
    const mediaByDate = await this.mediaService.getMediaForPilotOnDates(names, dates);

    const flightNumbers = this.computeFlightNumbers(entries);

    const mapped = entries.map((e) => {
      const dateKey = e.flight_date instanceof Date
        ? e.flight_date.toISOString().split('T')[0]
        : String(e.flight_date);
      return this.toResponse(e, mediaByDate.get(dateKey) ?? [], e.deleted_at ? null : (flightNumbers.get(e.id) ?? null));
    });

    return { server_time: serverTime.toISOString(), entries: mapped };
  }

  // ---------------------------------------------------------------------------
  // Sync push (POST /logbook/sync) — batch upsert from mobile
  // ---------------------------------------------------------------------------

  async syncPush(
    userId: string,
    entries: PushEntryDto[],
    deletes: DeleteRefDto[],
  ): Promise<{ server_time: string; results: SyncPushResult[] }> {
    const pilot = await this.resolvePilot(userId);
    const names = this.pilotNames(pilot);
    const serverTime = new Date();
    const results: SyncPushResult[] = [];

    // Process entries
    for (const pushed of entries) {
      const result = await this.upsertFromMobile(pilot, pushed, names);
      results.push(result);
    }

    // Process deletes
    for (const del of deletes) {
      const result = await this.tombstoneFromMobile(pilot, del);
      results.push(result);
    }

    return { server_time: serverTime.toISOString(), results };
  }

  private async upsertFromMobile(
    pilot: Pilot,
    pushed: PushEntryDto,
    names: string[],
  ): Promise<SyncPushResult> {
    const existing = await this.logbookRepository.findOne({
      where: { pilot_id: pilot.id, client_id: pushed.client_id },
      relations: ['flight'],
    });

    const datePart = pushed.flight_date.split('T')[0];
    const flightDate = new Date(`${datePart}T00:00:00.000Z`);

    if (!existing) {
      // CREATE
      const entry = this.logbookRepository.create({
        pilot_id: pilot.id,
        client_id: pushed.client_id,
        source: 'flightnow',
        flight_date: flightDate,
        start_at: pushed.start_at ? new Date(pushed.start_at) : null,
        end_at: pushed.end_at ? new Date(pushed.end_at) : null,
        duration_seconds: pushed.duration_seconds ?? null,
        distance_m: pushed.distance_m ?? null,
        avg_speed_mps: pushed.avg_speed_mps ?? null,
        max_speed_mps: pushed.max_speed_mps ?? null,
        max_altitude_m: pushed.max_altitude_m ?? null,
        avg_altitude_m: pushed.avg_altitude_m ?? null,
        max_climb_mps: pushed.max_climb_mps ?? null,
        max_sink_mps: pushed.max_sink_mps ?? null,
        takeoff_lat: pushed.takeoff_lat ?? null,
        takeoff_lon: pushed.takeoff_lon ?? null,
        landing_lat: pushed.landing_lat ?? null,
        landing_lon: pushed.landing_lon ?? null,
        launch_site_name: pushed.launch_site_name ?? null,
        landing_site_name: pushed.landing_site_name ?? null,
        title: pushed.title ?? null,
        notes: pushed.notes ?? null,
        wing: pushed.wing ?? null,
        engine: pushed.engine ?? null,
        paramotor: pushed.paramotor ?? null,
        equipment_refs_json: pushed.equipment_refs_json ?? null,
        fuel_start_litres: pushed.fuel_start_litres ?? null,
        fuel_used_litres: pushed.fuel_used_litres ?? null,
        battery_start_percent: pushed.battery_start_percent ?? null,
        battery_used_percent: pushed.battery_used_percent ?? null,
        category: pushed.category ?? null,
        flight_purpose: pushed.flight_purpose ?? null,
        route_name: pushed.route_name ?? null,
        rating: pushed.rating ?? null,
        client_updated_at: new Date(pushed.client_updated_at),
        deleted_at: pushed.deleted_at ? new Date(pushed.deleted_at) : null,
        synced_at: new Date(),
        revision: 1,
      });
      const saved = await this.logbookRepository.save(entry);

      // Capture weather async (best-effort, non-blocking)
      if (pushed.takeoff_lat != null && pushed.takeoff_lon != null) {
        this.captureWeatherAsync(saved, pushed.takeoff_lat, pushed.takeoff_lon, datePart);
      }

      const media = await this.mediaService.getMediaForPilotOnDate(names, flightDate);
      const flightNumber = await this.flightNumberForEntry(pilot.id, saved.id);
      return {
        client_id: pushed.client_id,
        id: saved.id,
        status: 'created',
        revision: saved.revision,
        server: this.toResponse(saved, media, flightNumber),
      };
    }

    // CONFLICT RESOLUTION (last-write-wins)
    const serverComparand: Date = existing.client_updated_at ?? existing.updated_at;
    const mobileTime = new Date(pushed.client_updated_at);

    if (mobileTime <= serverComparand) {
      // Server wins — return current server row (mobile must reconcile)
      const media = await this.mediaService.getMediaForPilotOnDate(names, existing.flight_date as Date);
      const flightNumber = await this.flightNumberForEntry(pilot.id, existing.id);
      return {
        client_id: pushed.client_id,
        id: existing.id,
        status: 'unchanged',
        revision: existing.revision,
        server: this.toResponse(existing, media, flightNumber),
      };
    }

    // Mobile wins — update client-owned fields only; never overwrite server-authoritative ones
    existing.title = pushed.title ?? existing.title;
    existing.notes = pushed.notes ?? existing.notes;
    existing.launch_site_name = pushed.launch_site_name ?? existing.launch_site_name;
    existing.landing_site_name = pushed.landing_site_name ?? existing.landing_site_name;
    existing.category = pushed.category ?? existing.category;
    existing.flight_purpose = pushed.flight_purpose ?? existing.flight_purpose;
    existing.route_name = pushed.route_name ?? existing.route_name;
    existing.rating = pushed.rating ?? existing.rating;
    existing.wing = pushed.wing ?? existing.wing;
    existing.engine = pushed.engine ?? existing.engine;
    existing.paramotor = pushed.paramotor ?? existing.paramotor;
    existing.equipment_refs_json = pushed.equipment_refs_json ?? existing.equipment_refs_json;
    existing.fuel_start_litres = pushed.fuel_start_litres ?? existing.fuel_start_litres;
    existing.fuel_used_litres = pushed.fuel_used_litres ?? existing.fuel_used_litres;
    existing.battery_start_percent = pushed.battery_start_percent ?? existing.battery_start_percent;
    existing.battery_used_percent = pushed.battery_used_percent ?? existing.battery_used_percent;
    // Only update raw metrics when no linked Flight analysis is present
    if (!existing.flight_id) {
      if (pushed.duration_seconds != null) existing.duration_seconds = pushed.duration_seconds;
      if (pushed.distance_m != null) existing.distance_m = pushed.distance_m;
      if (pushed.avg_speed_mps != null) existing.avg_speed_mps = pushed.avg_speed_mps;
      if (pushed.max_speed_mps != null) existing.max_speed_mps = pushed.max_speed_mps;
      if (pushed.max_altitude_m != null) existing.max_altitude_m = pushed.max_altitude_m;
      if (pushed.avg_altitude_m != null) existing.avg_altitude_m = pushed.avg_altitude_m;
      if (pushed.max_climb_mps != null) existing.max_climb_mps = pushed.max_climb_mps;
      if (pushed.max_sink_mps != null) existing.max_sink_mps = pushed.max_sink_mps;
      if (pushed.start_at) existing.start_at = new Date(pushed.start_at);
      if (pushed.end_at) existing.end_at = new Date(pushed.end_at);
    }
    if (pushed.takeoff_lat != null) existing.takeoff_lat = pushed.takeoff_lat;
    if (pushed.takeoff_lon != null) existing.takeoff_lon = pushed.takeoff_lon;
    if (pushed.landing_lat != null) existing.landing_lat = pushed.landing_lat;
    if (pushed.landing_lon != null) existing.landing_lon = pushed.landing_lon;

    if (pushed.deleted_at) existing.deleted_at = new Date(pushed.deleted_at);
    existing.client_updated_at = mobileTime;
    existing.synced_at = new Date();
    existing.revision += 1;

    const saved = await this.logbookRepository.save(existing);
    const media = await this.mediaService.getMediaForPilotOnDate(names, saved.flight_date as Date);
    const flightNumber = await this.flightNumberForEntry(pilot.id, saved.id);
    return {
      client_id: pushed.client_id,
      id: saved.id,
      status: 'updated',
      revision: saved.revision,
      server: this.toResponse(saved, media, flightNumber),
    };
  }

  private async tombstoneFromMobile(
    pilot: Pilot,
    del: DeleteRefDto,
  ): Promise<SyncPushResult> {
    const entry = await this.logbookRepository.findOne({
      where: { pilot_id: pilot.id, client_id: del.client_id },
    });
    if (!entry || entry.deleted_at) {
      return {
        client_id: del.client_id,
        id: entry?.id ?? del.client_id,
        status: 'deleted',
        revision: entry?.revision ?? 0,
        server: null,
      };
    }
    const deleteTime = new Date(del.deleted_at);
    const serverComparand = entry.client_updated_at ?? entry.updated_at;
    if (deleteTime >= serverComparand) {
      entry.deleted_at = deleteTime;
      entry.revision += 1;
      await this.logbookRepository.save(entry);
    }
    return {
      client_id: del.client_id,
      id: entry.id,
      status: 'deleted',
      revision: entry.revision,
      server: null,
    };
  }

  // ---------------------------------------------------------------------------
  // Orphaned flight discovery and import (used by onboarding prompt)
  // ---------------------------------------------------------------------------

  async findOrphanedFlights(userId: string): Promise<Flight[]> {
    await this.resolvePilot(userId);
    return this.flightsRepository
      .createQueryBuilder('f')
      .where('f.uploaded_by = :userId', { userId })
      .andWhere("f.parse_status != 'uploaded'")
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM logbook_entries l
          WHERE l.flight_id = f.id AND l.deleted_at IS NULL
        )`,
      )
      .orderBy('f.start_at', 'DESC', 'NULLS LAST')
      .getMany();
  }

  async importFlightToLogbook(userId: string, flightId: string): Promise<LogbookEntry> {
    const pilot = await this.resolvePilot(userId);
    const flight = await this.flightsRepository.findOne({ where: { id: flightId } });
    if (!flight) throw new NotFoundException(`Flight ${flightId} not found`);
    if (flight.uploaded_by !== userId) throw new ForbiddenException('Not your flight');
    return this.linkFlight({
      pilotId: pilot.id,
      clientId: null,
      flight,
      source: 'web',
      createdByUserId: userId,
    });
  }

  // ---------------------------------------------------------------------------
  // Called by FlightsService after GPX upload (auto-link)
  // ---------------------------------------------------------------------------

  async linkFlight(params: {
    pilotId: string;
    clientId: string | null;
    flight: Flight;
    source: 'flightnow' | 'web';
    createdByUserId: string;
  }): Promise<LogbookEntry> {
    const { pilotId, flight, source, createdByUserId } = params;
    const clientId = params.clientId ?? randomUUID();

    const existing = await this.logbookRepository.findOne({
      where: { pilot_id: pilotId, client_id: clientId },
    });

    if (existing) {
      // Just link the flight if not already linked
      if (!existing.flight_id) {
        existing.flight_id = flight.id;
        existing.revision += 1;
        const saved = await this.logbookRepository.save(existing);
        // Capture weather async
        if (saved.takeoff_lat != null && saved.takeoff_lon != null && !saved.weather_snapshot) {
          const datePart = (saved.flight_date instanceof Date
            ? saved.flight_date.toISOString()
            : String(saved.flight_date)).split('T')[0];
          this.captureWeatherAsync(saved, Number(saved.takeoff_lat), Number(saved.takeoff_lon), datePart);
        }
        return saved;
      }
      return existing;
    }

    const datePart = (flight.flight_date instanceof Date
      ? flight.flight_date.toISOString()
      : String(flight.flight_date)).split('T')[0];

    const entry = this.logbookRepository.create({
      pilot_id: pilotId,
      client_id: clientId,
      source,
      created_by_user_id: createdByUserId,
      flight_id: flight.id,
      flight_date: new Date(`${datePart}T00:00:00.000Z`),
      title: flight.title ?? null,
      notes: flight.notes ?? null,
      launch_site_name: flight.launch_site_name ?? null,
      wing: flight.glider ?? null,
      engine: flight.harness ?? null,
      revision: 1,
      client_updated_at: null,
    });

    const saved = await this.logbookRepository.save(entry);

    // Capture weather snapshot async from bbox or takeoff coords if available
    const lat = (flight.bbox_json as any)?.minLat;
    const lon = (flight.bbox_json as any)?.minLon;
    if (lat != null && lon != null) {
      this.captureWeatherAsync(saved, lat, lon, datePart);
    }

    return saved;
  }

  private captureWeatherAsync(
    entry: LogbookEntry,
    lat: number,
    lon: number,
    datePart: string,
  ): void {
    this.weatherService
      .captureSnapshot(lat, lon, datePart, entry.start_at)
      .then(async (snapshot) => {
        if (!snapshot) return;
        await this.logbookRepository.update(entry.id, {
          weather_snapshot: snapshot,
          weather_captured_at: new Date(),
          weather_source: snapshot.source,
          site_id: snapshot.site_id ?? undefined,
        });
      })
      .catch((err) => this.logger.warn(`Weather async capture failed for ${entry.id}: ${err}`));
  }

  // ---------------------------------------------------------------------------
  // Response shaping
  // ---------------------------------------------------------------------------

  private toResponse(entry: LogbookEntry, media: MediaRef[], flightNumber: number | null = null): LogbookEntryResponse {
    const f = entry.flight as Flight | null;
    const fDate = entry.flight_date instanceof Date
      ? entry.flight_date.toISOString().split('T')[0]
      : String(entry.flight_date);

    const gpx: GpxRef | null = f
      ? {
          flight_id: f.id,
          gpx_url: `/flights/${f.id}/file`,
          parse_status: f.parse_status,
          analysis_status: f.analysis_status,
          bbox_json: f.bbox_json,
        }
      : null;

    return {
      id: entry.id,
      pilot_id: entry.pilot_id,
      client_id: entry.client_id,
      source: entry.source,
      flight_date: fDate,
      start_at: entry.start_at?.toISOString() ?? f?.start_at?.toISOString() ?? null,
      end_at: entry.end_at?.toISOString() ?? f?.end_at?.toISOString() ?? null,
      // Raw fields = pilot-entered only; analyzed_* carry GPX values (display prefers analyzed_*)
      duration_seconds: entry.duration_seconds,
      distance_m: entry.distance_m,
      avg_speed_mps: entry.avg_speed_mps,
      max_speed_mps: entry.max_speed_mps,
      max_altitude_m: entry.max_altitude_m,
      avg_altitude_m: entry.avg_altitude_m,
      max_climb_mps: entry.max_climb_mps,
      max_sink_mps: entry.max_sink_mps,
      takeoff_lat: entry.takeoff_lat != null ? Number(entry.takeoff_lat) : null,
      takeoff_lon: entry.takeoff_lon != null ? Number(entry.takeoff_lon) : null,
      landing_lat: entry.landing_lat != null ? Number(entry.landing_lat) : null,
      landing_lon: entry.landing_lon != null ? Number(entry.landing_lon) : null,
      launch_site_name: entry.launch_site_name ?? f?.launch_site_name ?? null,
      landing_site_name: entry.landing_site_name ?? f?.landing_site_name ?? null,
      title: entry.title ?? f?.title ?? null,
      notes: entry.notes ?? f?.notes ?? null,
      wing: entry.wing ?? f?.glider ?? null,
      engine: entry.engine ?? f?.harness ?? null,
      paramotor: entry.paramotor ?? null,
      equipment_refs_json: entry.equipment_refs_json,
      fuel_start_litres: entry.fuel_start_litres,
      fuel_used_litres: entry.fuel_used_litres,
      battery_start_percent: entry.battery_start_percent,
      battery_used_percent: entry.battery_used_percent,
      category: entry.category,
      flight_purpose: entry.flight_purpose,
      route_name: entry.route_name,
      rating: entry.rating,
      weather_snapshot: entry.weather_snapshot,
      weather_source: entry.weather_source,
      flight_number: flightNumber,
      flight_number_override: entry.flight_number_override,
      revision: entry.revision,
      client_updated_at: entry.client_updated_at?.toISOString() ?? null,
      deleted_at: entry.deleted_at?.toISOString() ?? null,
      created_at: entry.created_at.toISOString(),
      updated_at: entry.updated_at.toISOString(),
      gpx,
      media,
      // Analyzed Flight metrics for display preference
      analyzed_duration_seconds: f?.duration_seconds ?? null,
      analyzed_distance_m: f?.total_distance_m ?? null,
      analyzed_max_altitude_m: f?.max_altitude_m ?? null,
      analyzed_max_speed_mps: f?.max_speed_mps ?? null,
    };
  }
}
