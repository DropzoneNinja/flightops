import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Pilot } from './pilot.entity';
import { Flight } from './flight.entity';
import { FlightSite } from './flight-site.entity';
import { User } from './user.entity';

/** Where a logbook entry originated. */
export type LogbookSource = 'flightnow' | 'manual' | 'web';

/** How the frozen weather snapshot was obtained. */
export type WeatherSource =
  | 'forecast_cache'
  | 'open_meteo_archive'
  | 'open_meteo_forecast'
  | 'none';

/**
 * Frozen weather snapshot captured at the takeoff site & time when an entry is
 * created. Units mirror the rest of the weather subsystem (wind in km/h).
 */
export interface WeatherSnapshot {
  lat: number;
  lon: number;
  site_id: string | null;
  matched_site_name: string | null;
  observed_at: string | null; // ISO — the hourly row used
  takeoff_at: string | null; // ISO — start_at used for nearest-hour match
  temperature_c: number | null;
  wind_speed_kmh: number | null;
  wind_direction_deg: number | null;
  gust_speed_kmh: number | null;
  precipitation_mm: number | null;
  cloud_cover_pct: number | null;
  cloud_base_m: number | null;
  source: WeatherSource;
  raw?: unknown; // the underlying record as fetched, for audit
}

/**
 * A private, per-pilot logbook entry — the MASTER record that flightnow syncs
 * against. Optionally links to a {@link Flight} (GPX trail + analysis). Every
 * read/write is scoped to the owning pilot; no pilot can see another's entries.
 *
 * See backend/LOGBOOK.md for the full sync contract.
 */
@Entity('logbook_entries')
@Index(['pilot_id'])
@Index(['pilot_id', 'flight_date'])
@Index(['pilot_id', 'updated_at'])
@Index(['flight_id'])
@Index(['deleted_at'])
@Unique('UQ_logbook_pilot_client', ['pilot_id', 'client_id'])
export class LogbookEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // --- Identity & ownership -------------------------------------------------

  /** Owner. Strict privacy boundary — all queries scope by this. */
  @Column({ type: 'uuid' })
  pilot_id: string;

  /**
   * The flightnow Flight.id (UUID) this entry corresponds to. For web/manual
   * entries the server generates one so every row has a stable identity to sync
   * back to mobile. Unique together with pilot_id.
   */
  @Column({ type: 'uuid' })
  client_id: string;

  @Column({
    type: 'enum',
    enum: ['flightnow', 'manual', 'web'],
    default: 'web',
  })
  source: LogbookSource;

  // --- Linkage --------------------------------------------------------------

  /** Linked GPX/analysis flight, when a trail exists. */
  @Column({ type: 'uuid', nullable: true })
  flight_id: string | null;

  /** Matched flight site (for the weather snapshot). */
  @Column({ type: 'uuid', nullable: true })
  site_id: string | null;

  // --- Flight metadata ------------------------------------------------------

  @Column({ type: 'date' })
  flight_date: Date;

  @Column({ type: 'timestamptz', nullable: true })
  start_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  end_at: Date | null;

  @Column({ type: 'int', nullable: true })
  duration_seconds: number | null;

  @Column({ type: 'float', nullable: true })
  distance_m: number | null;

  @Column({ type: 'float', nullable: true })
  avg_speed_mps: number | null;

  @Column({ type: 'float', nullable: true })
  max_speed_mps: number | null;

  @Column({ type: 'float', nullable: true })
  max_altitude_m: number | null;

  @Column({ type: 'float', nullable: true })
  avg_altitude_m: number | null;

  @Column({ type: 'float', nullable: true })
  max_climb_mps: number | null;

  @Column({ type: 'float', nullable: true })
  max_sink_mps: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  takeoff_lat: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  takeoff_lon: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  landing_lat: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  landing_lon: number | null;

  @Column({ type: 'text', nullable: true })
  launch_site_name: string | null;

  @Column({ type: 'text', nullable: true })
  landing_site_name: string | null;

  @Column({ type: 'text', nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  // --- Equipment / fuel -----------------------------------------------------

  @Column({ type: 'text', nullable: true })
  wing: string | null;

  @Column({ type: 'text', nullable: true })
  engine: string | null;

  @Column({ type: 'text', nullable: true })
  paramotor: string | null;

  /** FK to equipment_wings — set when user selects from their equipment list. */
  @Column({ type: 'uuid', nullable: true })
  wing_id: string | null;

  /** FK to equipment_paramotors — set when user selects from their equipment list. */
  @Column({ type: 'uuid', nullable: true })
  paramotor_id: string | null;

  /** Opaque pass-through of the mobile's local equipment refs for round-trip. */
  @Column({ type: 'jsonb', nullable: true })
  equipment_refs_json: {
    paramotorId?: string;
    engineId?: string;
    wingId?: string;
  } | null;

  @Column({ type: 'float', nullable: true })
  fuel_start_litres: number | null;

  @Column({ type: 'float', nullable: true })
  fuel_used_litres: number | null;

  @Column({ type: 'float', nullable: true })
  battery_start_percent: number | null;

  @Column({ type: 'float', nullable: true })
  battery_used_percent: number | null;

  // --- Categorization -------------------------------------------------------

  /** flightnow FlightCategory string (stored as text so new values never break a migration). */
  @Column({ type: 'text', nullable: true })
  category: string | null;

  @Column({ type: 'text', nullable: true })
  flight_purpose: string | null;

  @Column({ type: 'text', nullable: true })
  route_name: string | null;

  @Column({ type: 'smallint', nullable: true })
  rating: number | null;

  // --- Weather snapshot (server-authoritative, frozen at creation) ----------

  @Column({ type: 'jsonb', nullable: true })
  weather_snapshot: WeatherSnapshot | null;

  @Column({ type: 'timestamptz', nullable: true })
  weather_captured_at: Date | null;

  @Column({ type: 'text', nullable: true })
  weather_source: WeatherSource | null;

  // --- Sync / lifecycle -----------------------------------------------------

  /**
   * Pilot-assigned flight number. When set, this entry is pinned to this
   * number; all subsequent auto-numbered entries count up from here.
   * null means "auto-assign based on chronological position".
   */
  @Column({ type: 'int', nullable: true })
  flight_number_override: number | null;

  /** Bumped on every server-side mutation; lets mobile detect change without clock trust. */
  @Column({ type: 'int', default: 1 })
  revision: number;

  /** The mobile-reported updatedAt — the last-write-wins comparand. */
  @Column({ type: 'timestamptz', nullable: true })
  client_updated_at: Date | null;

  /** Tombstone — soft delete. Retained so all devices converge. */
  @Column({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  /** Last time this row was reconciled with a mobile push. */
  @Column({ type: 'timestamptz', nullable: true })
  synced_at: Date | null;

  /** Who created it on the web (audit). */
  @Column({ type: 'uuid', nullable: true })
  created_by_user_id: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  // --- Relationships --------------------------------------------------------

  @ManyToOne(() => Pilot, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pilot_id' })
  pilot: Pilot;

  @ManyToOne(() => Flight, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'flight_id' })
  flight: Flight | null;

  @ManyToOne(() => FlightSite, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'site_id' })
  site: FlightSite | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_user_id' })
  created_by: User | null;
}
