import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { Pilot } from './pilot.entity';

/**
 * A one-row-per-pilot record that captures the pilot's accumulated flight
 * history *before* they started using this tool.  The values here are added
 * to the running totals shown on the logbook page so experienced pilots
 * see accurate career numbers from day one.
 */
@Entity('logbook_baselines')
@Unique('UQ_LOGBOOK_BASELINE_PILOT', ['pilot_id'])
@Index(['pilot_id'])
export class LogbookBaseline {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  pilot_id: string;

  /** Number of flights flown before using this tool. */
  @Column({ type: 'int', default: 0 })
  prior_flights: number;

  /** Total airtime in seconds before using this tool. */
  @Column({ type: 'int', nullable: true })
  prior_duration_seconds: number | null;

  /** Total distance in metres before using this tool. */
  @Column({ type: 'float', nullable: true })
  prior_distance_m: number | null;

  /** Optional notes, e.g. the date range or source the pilot used to derive these numbers. */
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Pilot, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pilot_id' })
  pilot: Pilot;
}
