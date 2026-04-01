import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Pilot } from './pilot.entity';
import { FlightSite } from './flight-site.entity';
import { User } from './user.entity';

export type ParseStatus = 'uploaded' | 'parsing' | 'analyzed' | 'failed';
export type AnalysisStatus = 'pending' | 'running' | 'complete' | 'failed';

@Entity('flights')
@Index(['flight_date'])
@Index(['pilot_id'])
export class Flight {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  flight_date: Date;

  @Column({ type: 'uuid', nullable: true })
  site_id: string;

  @Column({ type: 'uuid', nullable: true })
  pilot_id: string;

  @Column({ type: 'text', nullable: true })
  title: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'text', nullable: true })
  launch_site_name: string;

  @Column({ type: 'text', nullable: true })
  landing_site_name: string;

  @Column({ type: 'text', nullable: true })
  glider: string;

  @Column({ type: 'text', nullable: true })
  harness: string;

  @Column({ type: 'varchar', length: 100, default: 'UTC' })
  timezone: string;

  @Column({ type: 'text' })
  original_filename: string;

  @Column({ type: 'text' })
  storage_key: string; // relative path under MEDIA_STORAGE_PATH

  @Column({ type: 'bigint' })
  file_size: number;

  @Column({
    type: 'enum',
    enum: ['uploaded', 'parsing', 'analyzed', 'failed'],
    default: 'uploaded',
  })
  parse_status: ParseStatus;

  @Column({
    type: 'enum',
    enum: ['pending', 'running', 'complete', 'failed'],
    default: 'pending',
  })
  analysis_status: AnalysisStatus;

  @Column({ type: 'varchar', length: 50, nullable: true })
  analysis_version: string;

  @Column({ type: 'timestamp', nullable: true })
  start_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  end_at: Date;

  @Column({ type: 'int', nullable: true })
  duration_seconds: number;

  @Column({ type: 'float', nullable: true })
  total_distance_m: number;

  @Column({ type: 'float', nullable: true })
  max_altitude_m: number;

  @Column({ type: 'float', nullable: true })
  min_altitude_m: number;

  @Column({ type: 'float', nullable: true })
  altitude_gain_m: number;

  @Column({ type: 'float', nullable: true })
  altitude_loss_m: number;

  @Column({ type: 'float', nullable: true })
  avg_speed_mps: number;

  @Column({ type: 'float', nullable: true })
  max_speed_mps: number;

  @Column({ type: 'float', nullable: true })
  max_climb_mps: number;

  @Column({ type: 'float', nullable: true })
  max_descent_mps: number;

  @Column({ type: 'int', nullable: true })
  trackpoint_count: number;

  @Column({ type: 'int', nullable: true })
  segment_count: number;

  @Column({ type: 'jsonb', nullable: true })
  bbox_json: { minLon: number; minLat: number; maxLon: number; maxLat: number };

  @Column({ type: 'float', nullable: true })
  confidence_score: number;

  // Gaggle app pre-computed stats (stored separately from our calculated values)
  @Column({ type: 'float', nullable: true })
  gaggle_distance_m: number;

  @Column({ type: 'float', nullable: true })
  gaggle_max_speed_mps: number;

  @Column({ type: 'float', nullable: true })
  gaggle_duration_seconds: number;

  @Column({ type: 'float', nullable: true })
  gaggle_avg_speed_mps: number;

  @Column({ type: 'float', nullable: true })
  gaggle_max_altitude_m: number;

  @Column({ type: 'float', nullable: true })
  gaggle_max_climb_mps: number;

  @Column({ type: 'float', nullable: true })
  gaggle_max_g_force: number;

  @Column({ type: 'float', nullable: true })
  gaggle_max_sink_mps: number;

  @Column({ type: 'float', nullable: true })
  gaggle_fuel_consumed: number;

  @Column({ type: 'jsonb', nullable: true })
  summary_json: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  trackpoints_json: unknown[]; // normalized trackpoints (compressed array)

  @Column({ type: 'uuid' })
  uploaded_by: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relationships
  @ManyToOne(() => Pilot, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'pilot_id' })
  pilot: Pilot;

  @ManyToOne(() => FlightSite, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'site_id' })
  site: FlightSite;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'uploaded_by' })
  uploader: User;
}
